export interface ProcessedNmrSpectrum {
  ppmAxis: number[];
  intensityReal: number[];
  intensityImag: number[];
  peaksDetected: Array<{ ppm: number; intensity: number; area: number }>;
}

// In-place Cooley-Tukey Radix-2 FFT
function fftRadix2(real: Float64Array, imag: Float64Array, forward: boolean = true) {
  const n = real.length;
  if ((n & (n - 1)) !== 0) {
    throw new Error("FFT length must be a power of 2");
  }

  // Bit-reversal permutation
  let j = 0;
  for (let i = 0; i < n - 1; i++) {
    if (i < j) {
      const tempR = real[i];
      real[i] = real[j];
      real[j] = tempR;

      const tempI = imag[i];
      imag[i] = imag[j];
      imag[j] = tempI;
    }
    let k = n >> 1;
    while (k <= j) {
      j -= k;
      k >>= 1;
    }
    j += k;
  }

  // Butterfly computations
  const sign = forward ? -1 : 1;
  for (let len = 2; len <= n; len <<= 1) {
    const halfLen = len >> 1;
    const angle = (sign * 2 * Math.PI) / len;
    const wStepR = Math.cos(angle);
    const wStepI = Math.sin(angle);

    for (let i = 0; i < n; i += len) {
      let wR = 1.0;
      let wI = 0.0;

      for (let k = 0; k < halfLen; k++) {
        const posEven = i + k;
        const posOdd = i + k + halfLen;

        const oddR = real[posOdd] * wR - imag[posOdd] * wI;
        const oddI = real[posOdd] * wI + imag[posOdd] * wR;

        real[posOdd] = real[posEven] - oddR;
        imag[posOdd] = imag[posEven] - oddI;

        real[posEven] = real[posEven] + oddR;
        imag[posEven] = imag[posEven] + oddI;

        const nextWR = wR * wStepR - wI * wStepI;
        const nextWI = wR * wStepI + wI * wStepR;
        wR = nextWR;
        wI = nextWI;
      }
    }
  }

  if (!forward) {
    for (let i = 0; i < n; i++) {
      real[i] /= n;
      imag[i] /= n;
    }
  }
}

export function processNmrFid(
  fidReal: number[],
  fidImag: number[],
  options: {
    lineBroadeningHz?: number; // Apodization exponential multiplier
    zeroFillSize?: number; // e.g. 1024, 2048, 4096
    phase0Deg?: number; // Zero-order phase in degrees (-180 to 180)
    phase1Deg?: number; // First-order phase in degrees (-180 to 180)
    frequencyMHz?: number; // Spectrometer carrier frequency e.g. 400 MHz
    spectralWidthPpm?: number; // Sweep width e.g. 12 ppm
    carrierPpm?: number; // Center frequency e.g. 5.0 ppm
  }
): ProcessedNmrSpectrum {
  const lb = options.lineBroadeningHz ?? 1.0;
  const zeroFill = options.zeroFillSize ?? 1024;
  const ph0Rad = ((options.phase0Deg ?? 0) * Math.PI) / 180.0;
  const ph1Rad = ((options.phase1Deg ?? 0) * Math.PI) / 180.0;
  const freqMHz = options.frequencyMHz ?? 400;
  const swPpm = options.spectralWidthPpm ?? 12;
  const centerPpm = options.carrierPpm ?? 5.5;

  const inLen = fidReal.length;
  // Ensure target size is power of 2
  let targetSize = 1;
  while (targetSize < zeroFill || targetSize < inLen) {
    targetSize <<= 1;
  }

  const realBuffer = new Float64Array(targetSize);
  const imagBuffer = new Float64Array(targetSize);

  // 1. Apodization (Exponential Window) + Copy to Buffer
  const dt = 1.0 / (swPpm * freqMHz); // sampling period
  for (let i = 0; i < inLen; i++) {
    const t = i * dt;
    const windowFactor = Math.exp(-Math.PI * lb * t);
    realBuffer[i] = fidReal[i] * windowFactor;
    imagBuffer[i] = (fidImag[i] || 0) * windowFactor;
  }
  // Zero-filling: rest of buffer remains 0

  // 2. Fast Fourier Transform (FFT)
  fftRadix2(realBuffer, imagBuffer, true);

  // 3. FFT Shift (shift zero frequency to center)
  const half = targetSize >> 1;
  const shiftedReal = new Float64Array(targetSize);
  const shiftedImag = new Float64Array(targetSize);
  for (let i = 0; i < half; i++) {
    shiftedReal[i] = realBuffer[i + half];
    shiftedImag[i] = imagBuffer[i + half];
    shiftedReal[i + half] = realBuffer[i];
    shiftedImag[i + half] = imagBuffer[i];
  }

  // 4. Phase Correction: S'(w) = S(w) * exp(i * (ph0 + ph1 * (w - w0)/sw))
  const finalReal = new Float64Array(targetSize);
  const finalImag = new Float64Array(targetSize);
  const ppmAxis: number[] = new Array(targetSize);

  let maxPeakVal = 1e-6;

  for (let i = 0; i < targetSize; i++) {
    const normFreq = (i - half) / half; // -1 to 1 across spectrum
    const totalPhase = ph0Rad + ph1Rad * normFreq;
    const cosP = Math.cos(totalPhase);
    const sinP = Math.sin(totalPhase);

    // Chemical shift ppm axis (high ppm on left / downfield, 0 ppm on right / upfield)
    // Standard NMR convention: downfield to upfield
    const ppm = centerPpm + (swPpm / 2) - ((i / targetSize) * swPpm);
    ppmAxis[i] = Number(ppm.toFixed(3));

    const r = shiftedReal[i];
    const im = shiftedImag[i];
    const pr = r * cosP - im * sinP;
    const pi = r * sinP + im * cosP;

    finalReal[i] = pr;
    finalImag[i] = pi;

    if (Math.abs(pr) > maxPeakVal) {
      maxPeakVal = Math.abs(pr);
    }
  }

  // Normalize Intensity to 0 - 100 scale
  const normIntensityReal: number[] = new Array(targetSize);
  const normIntensityImag: number[] = new Array(targetSize);
  for (let i = 0; i < targetSize; i++) {
    normIntensityReal[i] = Number(((finalReal[i] / maxPeakVal) * 100).toFixed(2));
    normIntensityImag[i] = Number(((finalImag[i] / maxPeakVal) * 100).toFixed(2));
  }

  // 5. Automatic Peak Detection
  const peaksDetected: Array<{ ppm: number; intensity: number; area: number }> = [];
  const threshold = 10.0; // 10% of maximum height
  for (let i = 2; i < targetSize - 2; i++) {
    const val = normIntensityReal[i];
    if (val > threshold && val > normIntensityReal[i - 1] && val > normIntensityReal[i + 1]) {
      // Local maximum
      const ppm = ppmAxis[i];
      // Quick trapezoidal area estimation around peak
      let area = 0;
      for (let k = Math.max(0, i - 4); k <= Math.min(targetSize - 1, i + 4); k++) {
        area += Math.max(0, normIntensityReal[k]);
      }
      peaksDetected.push({
        ppm,
        intensity: val,
        area: Number((area * 0.01).toFixed(2)),
      });
    }
  }

  return {
    ppmAxis,
    intensityReal: normIntensityReal,
    intensityImag: normIntensityImag,
    peaksDetected,
  };
}
