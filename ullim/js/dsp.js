/* 울림 — 소리 재료: 엔벌로프, 노이즈, 일그러짐 곡선, 잔향, 드럼 합성 */
(function (U) {
'use strict';

/* ================= 엔벌로프 =================
   선형 램프 대신 setTargetAtTime만 쓴다. 중간에 끊어도(cancelScheduledValues)
   이미 시작한 곡선이 이어져서 '틱' 소리가 나지 않는다. */
const LN6 = Math.log(6);
function envOn(param, t, peak, a, d, s, base = 0) {
  a = Math.max(0.0008, a); d = Math.max(0.001, d);
  param.cancelScheduledValues(t);
  param.setValueAtTime(base, t);
  // 목표를 1.2배로 잡으면 정확히 a초 뒤에 peak를 지난다
  param.setTargetAtTime(base + (peak - base) * 1.2, t, a / LN6);
  param.setTargetAtTime(base + (peak - base) * s, t + a, d / 3);
}
function envOff(param, t, r, base = 0) {
  param.cancelScheduledValues(t);
  param.setTargetAtTime(base, t, Math.max(0.001, r) / 4);
}
function envEnd(t, r) { return t + Math.max(0.001, r) * 1.6 + 0.02; }
function stopAt(src, t) { try { src.stop(t); } catch (e) { /* 이미 멈춤 */ } }
function smooth(param, v, t, tc = 0.012) {
  if (!isFinite(v)) return;
  param.cancelScheduledValues(t);
  param.setTargetAtTime(v, t, tc);
}
function velGain(v, sens) {
  const x = U.clamp(v, 1, 127) / 127;
  return 1 - sens + sens * Math.pow(x, 1.6);
}
function gainNode(ctx, v = 1) { const g = ctx.createGain(); g.gain.value = v; return g; }

/* ================= 노이즈 ================= */
const noiseCache = new WeakMap();
function noiseBuffer(ctx) {
  let b = noiseCache.get(ctx);
  if (!b) {
    const len = Math.floor(ctx.sampleRate * 2);
    b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    noiseCache.set(ctx, b);
  }
  return b;
}
function noiseSource(ctx, loop = true) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuffer(ctx);
  s.loop = loop;
  return s;
}

/* ================= 웨이브셰이퍼 곡선 ================= */
function satCurve(type, driveDb, bits) {
  const n = 2048, c = new Float32Array(n);
  const k = U.dbToGain(driveDb);
  const L = Math.pow(2, Math.max(1, (bits || 8) - 1));
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const y = x * k;
    let o;
    switch (type) {
      case 'tube': o = y >= 0 ? 1 - Math.exp(-y) : -(1 - Math.exp(y * 1.3)) * 0.82; break;
      case 'hard': o = U.clamp(y, -1, 1); o = o - (o * o * o) / 12; break;
      case 'fold': o = Math.sin(y * Math.PI / 2); break;
      case 'crush': o = Math.round(U.clamp(y, -1, 1) * L) / L; break;
      default: o = Math.tanh(y);
    }
    c[i] = o;
  }
  return c;
}
/* 리미터 끝단: 최고 크기(ceil) 근처부터 부드럽게 눌러 절대 넘지 않게. 입력은 1/4로 줄여 넣는다 */
function clipCurve(ceil) {
  const n = 4096, c = new Float32Array(n);
  const knee = ceil * 0.85;
  for (let i = 0; i < n; i++) {
    const x = ((i / (n - 1)) * 2 - 1) * 4;
    const a = Math.abs(x);
    let y = a <= knee ? a : knee + (ceil - knee) * Math.tanh((a - knee) / (ceil - knee));
    c[i] = Math.sign(x) * y;
  }
  return c;
}

/* ================= 잔향 (임펄스 응답 합성) ================= */
function makeIR(ctx, decay, size, damp) {
  const sr = ctx.sampleRate;
  const len = Math.max(1, Math.floor(sr * Math.min(22, decay * 1.15 + 0.1)));
  const buf = ctx.createBuffer(2, len, sr);
  const er = Math.floor(sr * (0.008 + size * 0.07)); // 초기 반사 구간
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let y = 0, energy = 0;
    const rnd = U.rng(ch * 7919 + 13);
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const env = Math.pow(10, -3 * t / decay);
      const fc = 18000 * Math.pow(damp / 18000, Math.min(1, t / decay));
      const alpha = 1 - Math.exp(-2 * Math.PI * fc / sr);
      const x = (rnd() * 2 - 1) * env;
      y += alpha * (x - y);
      const fade = i < er ? (i / er) * 0.6 : 1;
      d[i] = y * fade;
    }
    // 초기 반사음: 공간 크기에 따라 몇 개의 또렷한 메아리
    const taps = 6 + Math.round(size * 10);
    for (let k = 0; k < taps; k++) {
      const pos = Math.floor(er * (0.15 + 0.85 * rnd()));
      if (pos < len) d[pos] += (rnd() < 0.5 ? -1 : 1) * (0.5 - k / taps * 0.4) * (0.6 + size * 0.4);
    }
    for (let i = 0; i < len; i++) energy += d[i] * d[i];
    const norm = 1 / Math.sqrt(energy || 1);
    for (let i = 0; i < len; i++) d[i] *= norm;
  }
  return buf;
}

/* ================= 드럼 합성 =================
   패드 소리는 오프라인으로 한 번 그려 두고 버퍼로 재생한다.
   같은 설정이면 결과를 공유한다. */
const drumCache = new Map();
const METAL = [205.3, 304.4, 369.6, 522.7, 540, 800];

function env(p, t, peak, attack, tc) {
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(peak, t + attack);
  p.setTargetAtTime(0, t + attack, tc);
}
function noiseInto(ctx, dest) {
  const n = noiseSource(ctx, true);
  n.connect(dest);
  n.start(0);
  return n;
}
function metal(ctx, dest, mul) {
  for (const f of METAL) {
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = f * mul;
    o.connect(dest);
    o.start(0);
  }
}
function filt(ctx, type, f, q) {
  const b = ctx.createBiquadFilter();
  b.type = type;
  b.frequency.value = f;
  if (q != null) b.Q.value = q;
  return b;
}

const DRUM_RECIPES = {
  kick(ctx, o, D) {
    const f0 = 50 * Math.pow(2, o.tune / 12);
    const d = 0.12 + o.decay * 1.2;
    const out = ctx.createWaveShaper();
    out.curve = satCurve('soft', 3, 8);
    out.connect(D);
    const amp = gainNode(ctx, 0);
    amp.connect(out);
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(f0 * 4.5, 0);
    osc.frequency.exponentialRampToValueAtTime(f0 * 1.4, 0.03);
    osc.frequency.exponentialRampToValueAtTime(f0, 0.1 + o.decay * 0.05);
    osc.connect(amp);
    osc.start(0);
    env(amp.gain, 0, 1, 0.002, d / 4);
    const cg = gainNode(ctx, 0);
    const hp = filt(ctx, 'highpass', 1800);
    noiseInto(ctx, hp); hp.connect(cg); cg.connect(out);
    env(cg.gain, 0, 0.15 + o.tone * 0.6, 0.001, 0.004);
    return d * 1.5 + 0.05;
  },
  snare(ctx, o, D) {
    const f = 185 * Math.pow(2, o.tune / 12);
    const d = 0.08 + o.decay * 0.45;
    const bus = gainNode(ctx, 0.9); bus.connect(D);
    const body = gainNode(ctx, 0); body.connect(bus);
    const tr = ctx.createOscillator(); tr.type = 'triangle';
    tr.frequency.setValueAtTime(f * 1.6, 0); tr.frequency.exponentialRampToValueAtTime(f, 0.025);
    tr.connect(body); tr.start(0);
    const s2 = ctx.createOscillator(); s2.frequency.value = f * 1.92; s2.connect(body); s2.start(0);
    env(body.gain, 0, 0.75 - o.tone * 0.3, 0.001, 0.035 + o.decay * 0.04);
    const nz = gainNode(ctx, 0);
    const hp = filt(ctx, 'highpass', 1400), bp = filt(ctx, 'peaking', 5500, 0.8);
    bp.gain.value = 4;
    noiseInto(ctx, hp); hp.connect(bp); bp.connect(nz); nz.connect(bus);
    env(nz.gain, 0, 0.35 + o.tone * 0.6, 0.001, d / 4);
    return d * 1.6 + 0.05;
  },
  clap(ctx, o, D) {
    const d = 0.1 + o.decay * 0.5;
    const bp = filt(ctx, 'bandpass', 900 + o.tone * 1100, 1.3);
    const hp = filt(ctx, 'highpass', 500);
    const g = gainNode(ctx, 0);
    noiseInto(ctx, bp); bp.connect(hp); hp.connect(g); g.connect(D);
    const p = g.gain;
    p.setValueAtTime(0, 0);
    for (const t of [0, 0.011, 0.023]) { p.setValueAtTime(1.6, t); p.setTargetAtTime(0.1, t + 0.001, 0.003); }
    p.setValueAtTime(1.2, 0.034);
    p.setTargetAtTime(0, 0.035, d / 4);
    return d * 1.5 + 0.06;
  },
  chh(ctx, o, D) { return DRUM_RECIPES._hat(ctx, o, D, 0.018 + o.decay * 0.12); },
  ohh(ctx, o, D) { return DRUM_RECIPES._hat(ctx, o, D, 0.12 + o.decay * 0.8); },
  _hat(ctx, o, D, d) {
    const mul = Math.pow(2, o.tune / 12);
    const bp = filt(ctx, 'bandpass', 10000 * mul, 0.9);
    const hp = filt(ctx, 'highpass', 7000 * mul);
    const mg = gainNode(ctx, 0.35 * (1 - o.tone * 0.6));
    const ng = gainNode(ctx, 0.25 + o.tone * 0.5);
    metal(ctx, mg, mul);
    noiseInto(ctx, ng);
    mg.connect(bp); ng.connect(bp);
    const amp = gainNode(ctx, 0);
    bp.connect(hp); hp.connect(amp); amp.connect(D);
    env(amp.gain, 0, 1.3, 0.0008, d / 4);
    return d * 1.6 + 0.03;
  },
  tom(ctx, o, D) {
    const f = 105 * Math.pow(2, o.tune / 12);
    const d = 0.15 + o.decay * 0.7;
    const amp = gainNode(ctx, 0); amp.connect(D);
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(f * 1.7, 0); osc.frequency.exponentialRampToValueAtTime(f, 0.06);
    osc.connect(amp); osc.start(0);
    env(amp.gain, 0, 1, 0.002, d / 4);
    const ng = gainNode(ctx, 0); const lp = filt(ctx, 'lowpass', 3000);
    noiseInto(ctx, lp); lp.connect(ng); ng.connect(D);
    env(ng.gain, 0, 0.1 + o.tone * 0.3, 0.001, 0.01);
    return d * 1.6 + 0.05;
  },
  rim(ctx, o, D) {
    const mul = Math.pow(2, o.tune / 12);
    const amp = gainNode(ctx, 0); const hp = filt(ctx, 'highpass', 400);
    amp.connect(hp); hp.connect(D);
    const a = ctx.createOscillator(); a.type = 'triangle'; a.frequency.value = 1700 * mul; a.connect(amp); a.start(0);
    const b = ctx.createOscillator(); b.frequency.value = 480 * mul; b.connect(amp); b.start(0);
    env(amp.gain, 0, 0.9, 0.0005, 0.008 + o.decay * 0.02);
    return 0.12 + o.decay * 0.1;
  },
  cow(ctx, o, D) {
    const mul = Math.pow(2, o.tune / 12);
    const d = 0.12 + o.decay * 0.6;
    const bp = filt(ctx, 'bandpass', 850 * mul, 1.8);
    const amp = gainNode(ctx, 0);
    for (const f of [540, 800]) { const s = ctx.createOscillator(); s.type = 'square'; s.frequency.value = f * mul; s.connect(bp); s.start(0); }
    bp.connect(amp); amp.connect(D);
    amp.gain.setValueAtTime(0, 0); amp.gain.linearRampToValueAtTime(1, 0.001);
    amp.gain.setTargetAtTime(0.35, 0.001, 0.01); amp.gain.setTargetAtTime(0, 0.03, d / 4);
    return d * 1.5 + 0.05;
  },
  crash(ctx, o, D) { return DRUM_RECIPES._cym(ctx, o, D, 0.9 + o.decay * 2.6, 2.3, 5000); },
  ride(ctx, o, D) {
    const len = DRUM_RECIPES._cym(ctx, o, D, 0.7 + o.decay * 2, 1.7, 3500, 0.5);
    const mul = Math.pow(2, o.tune / 12);
    const bell = gainNode(ctx, 0); bell.connect(D);
    for (const f of [2950, 4410]) { const s = ctx.createOscillator(); s.frequency.value = f * mul; s.connect(bell); s.start(0); }
    env(bell.gain, 0, 0.12 + o.tone * 0.2, 0.001, 0.25 + o.decay * 0.4);
    return len;
  },
  _cym(ctx, o, D, d, mulBase, hpF, level = 0.8) {
    const mul = Math.pow(2, o.tune / 12) * mulBase;
    const mg = gainNode(ctx, 0.3); const ng = gainNode(ctx, 0.35 + o.tone * 0.4);
    metal(ctx, mg, mul); noiseInto(ctx, ng);
    const hp = filt(ctx, 'highpass', hpF * Math.pow(2, o.tune / 12));
    const amp = gainNode(ctx, 0);
    mg.connect(hp); ng.connect(hp); hp.connect(amp); amp.connect(D);
    env(amp.gain, 0, level, 0.001, d / 4);
    return d * 1.5 + 0.05;
  },
  shaker(ctx, o, D) {
    const d = 0.04 + o.decay * 0.15;
    const bp = filt(ctx, 'bandpass', 5500 + o.tone * 3000, 1.5);
    const amp = gainNode(ctx, 0);
    noiseInto(ctx, bp); bp.connect(amp); amp.connect(D);
    amp.gain.setValueAtTime(0, 0); amp.gain.linearRampToValueAtTime(0.9, 0.012);
    amp.gain.setTargetAtTime(0, 0.014, d / 4);
    return d * 1.5 + 0.05;
  },
  conga(ctx, o, D) {
    const f = 215 * Math.pow(2, o.tune / 12);
    const d = 0.1 + o.decay * 0.45;
    const amp = gainNode(ctx, 0); amp.connect(D);
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(f * 1.25, 0); osc.frequency.exponentialRampToValueAtTime(f, 0.03);
    osc.connect(amp); osc.start(0);
    env(amp.gain, 0, 0.9, 0.001, d / 4);
    const ng = gainNode(ctx, 0); const bp = filt(ctx, 'bandpass', 2500, 1);
    noiseInto(ctx, bp); bp.connect(ng); ng.connect(D);
    env(ng.gain, 0, o.tone * 0.5, 0.0005, 0.006);
    return d * 1.6 + 0.05;
  },
  sub(ctx, o, D) {
    const f = 49 * Math.pow(2, o.tune / 12);
    const d = 0.35 + o.decay * 2.8;
    const sh = ctx.createWaveShaper(); sh.curve = satCurve('soft', 2 + o.tone * 14, 8);
    const amp = gainNode(ctx, 0);
    amp.connect(sh); sh.connect(D);
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(f * 2.2, 0); osc.frequency.exponentialRampToValueAtTime(f, 0.045);
    osc.connect(amp); osc.start(0);
    amp.gain.setValueAtTime(0, 0); amp.gain.linearRampToValueAtTime(0.85, 0.003);
    amp.gain.setTargetAtTime(0, 0.06, d / 4);
    return d * 1.5 + 0.08;
  },
  zap(ctx, o, D) {
    const f = 2600 * Math.pow(2, o.tune / 12);
    const d = 0.05 + o.decay * 0.3;
    const amp = gainNode(ctx, 0); amp.connect(D);
    const osc = ctx.createOscillator(); osc.type = o.tone > 0.5 ? 'square' : 'sine';
    osc.frequency.setValueAtTime(f, 0); osc.frequency.exponentialRampToValueAtTime(70, d);
    osc.connect(amp); osc.start(0);
    env(amp.gain, 0, 0.6, 0.001, d / 2.5);
    return d * 1.8 + 0.04;
  },
  noise(ctx, o, D) {
    const d = 0.1 + o.decay * 0.8;
    const bp = filt(ctx, 'bandpass', 600 * Math.pow(2, o.tune / 12) * (1 + o.tone * 6), 0.9);
    const amp = gainNode(ctx, 0);
    noiseInto(ctx, bp); bp.connect(amp); amp.connect(D);
    env(amp.gain, 0, 1.1, 0.002, d / 4);
    return d * 1.6 + 0.05;
  },
  /* 재즈 브러시: 철사 솔로 스네어를 톡 치는 소리. 거친 노이즈가 살짝 부드럽게 시작하고 북 가죽이 낮게 운다 */
  brush(ctx, o, D) {
    const mul = Math.pow(2, o.tune / 12);
    const d = 0.06 + o.decay * 0.35;
    const bp = filt(ctx, 'bandpass', (2400 + o.tone * 3200) * mul, 0.7);
    const hp = filt(ctx, 'highpass', 450 * mul);
    const amp = gainNode(ctx, 0);
    noiseInto(ctx, bp); bp.connect(hp); hp.connect(amp); amp.connect(D);
    amp.gain.setValueAtTime(0, 0);
    amp.gain.linearRampToValueAtTime(1, 0.004);
    amp.gain.setTargetAtTime(0.32, 0.004, 0.018);
    amp.gain.setTargetAtTime(0, 0.03, d / 4);
    const body = gainNode(ctx, 0); body.connect(D);
    const tr = ctx.createOscillator(); tr.type = 'triangle'; tr.frequency.value = 175 * mul; tr.connect(body); tr.start(0);
    env(body.gain, 0, 0.16, 0.002, 0.03);
    return d * 1.6 + 0.06;
  },
  /* 브러시로 가죽을 둥글게 쓸기: 천천히 커졌다 사라지는 노이즈, 쓰는 동안 결이 조금씩 밝아진다 */
  swish(ctx, o, D) {
    const f = (3000 + o.tone * 2600) * Math.pow(2, o.tune / 12);
    const d = 0.25 + o.decay * 0.9;
    const bp = filt(ctx, 'bandpass', f * 0.7, 0.5);
    bp.frequency.setValueAtTime(f * 0.7, 0);
    bp.frequency.linearRampToValueAtTime(f * 1.2, d);
    const amp = gainNode(ctx, 0);
    noiseInto(ctx, bp); bp.connect(amp); amp.connect(D);
    amp.gain.setValueAtTime(0, 0);
    amp.gain.linearRampToValueAtTime(0.8, d * 0.45);
    amp.gain.linearRampToValueAtTime(0, d);
    return d + 0.05;
  },
  snap(ctx, o, D) {
    const bp = filt(ctx, 'bandpass', 2300 * Math.pow(2, o.tune / 12), 2.5);
    const amp = gainNode(ctx, 0);
    noiseInto(ctx, bp); bp.connect(amp); amp.connect(D);
    env(amp.gain, 0, 2.2, 0.0005, 0.012 + o.decay * 0.03);
    const c = ctx.createOscillator(); const cg = gainNode(ctx, 0);
    c.frequency.value = 1200; c.connect(cg); cg.connect(D); c.start(0);
    env(cg.gain, 0, 0.25 + o.tone * 0.3, 0.0003, 0.003);
    return 0.2 + o.decay * 0.15;
  }
};
/* ================= 어쿠스틱 드럼 (밴드 킷) =================
   전자 드럼과 달리 한 샘플씩 자바스크립트로 계산한다.
   북: 가죽의 떨림(어긋난 배음 몇 개가 저마다 줄어드는 사인파)이 칠 때 살짝 높았다 내려앉고, 채가 닿는 '딱'과 방 울림이 붙는다.
   스네어: 가죽 + 아래 가죽에 붙은 철사줄이 '촤' 하고 떤다. 심벌: 금속판의 어긋난 배음 수십 개와 쉭 하는 노이즈 */
const MEMBRANE = [1, 1.59, 2.14, 2.3, 2.65, 2.92];   // 둥근 가죽의 떨림 비율
/* 2차 필터 계수 (RBJ) */
function bq(type, f, q, sr) {
  const w = 2 * Math.PI * Math.min(f, sr * 0.45) / sr, cs = Math.cos(w), al = Math.sin(w) / (2 * (q || 0.707));
  let b0, b1, b2;
  if (type === 'lowpass') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; }
  else if (type === 'highpass') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; }
  else { b0 = al; b1 = 0; b2 = -al; }   // bandpass (가운데 0 dB)
  const a0 = 1 + al;
  return [b0 / a0, b1 / a0, b2 / a0, -2 * cs / a0, (1 - al) / a0];
}
function runBq(x, c) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const y = c[0] * x[i] + c[1] * x1 + c[2] * x2 - c[3] * y1 - c[4] * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = y; x[i] = y;
  }
  return x;
}
/* 줄어드는 사인파: f에서 시작 배율 g로 높았다가 gt초 만에 내려앉는다. T: -60 dB까지 시간 */
function addMode(x, sr, f, amp, T, g, gt) {
  const n = Math.min(x.length, Math.ceil(sr * T * 1.2)), k = -6.9078 / (T * sr);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, fi = g && gt ? f * (1 + (g - 1) * Math.exp(-t / gt)) : f;
    ph += 2 * Math.PI * fi / sr;
    x[i] += amp * Math.exp(k * i) * Math.sin(ph) * Math.min(1, i / (sr * 0.0004));
  }
}
/* 금속판의 배음 하나 (재귀식이라 길어도 가볍다) */
function ring(x, sr, f, a, T, at) {
  if (f >= sr * 0.45 || a <= 0) return;
  const w = 2 * Math.PI * f / sr, r = Math.exp(-6.9078 / (T * sr)), c2 = 2 * r * Math.cos(w), r2 = r * r;
  const s0 = Math.round((at || 0) * sr), n = Math.min(x.length, s0 + Math.ceil(T * sr * 1.1));
  let y2 = 0, y1 = a * Math.sin(w);
  if (s0 + 1 < n) x[s0 + 1] += y1;
  for (let i = s0 + 2; i < n; i++) { const y = c2 * y1 - r2 * y2; x[i] += y; y2 = y1; y1 = y; }
}
/* 거른 노이즈 한 번: att초에 올라 tau(지수 시간 상수)로 줄어든다 */
function addNoise(x, sr, amp, att, tau, rnd, filters, at) {
  const s0 = Math.round((at || 0) * sr), n = Math.min(x.length - s0, Math.ceil(sr * (att + tau * 8)));
  if (n <= 0) return;
  let z = new Float32Array(n);
  for (let i = 0; i < n; i++) z[i] = rnd() * 2 - 1;
  for (const [type, f, q] of filters || []) z = runBq(z, bq(type, f, q, sr));
  const a = Math.max(1, att * sr);
  for (let i = 0; i < n; i++) x[s0 + i] += amp * z[i] * Math.min(1, i / a) * Math.exp(-Math.max(0, i - a) / (tau * sr));
}
/* 금속판: fLo~fHi 사이에 어긋난 배음 n개. 높은 배음일수록 hiT배 오래 (크래시는 처음엔 낮은 소리가 먼저 사라진다) */
function metalPlate(x, sr, rnd, n, fLo, fHi, T, amp, hiT, at) {
  for (let k = 0; k < n; k++) {
    const u = rnd(), f = fLo * Math.pow(fHi / fLo, u);
    ring(x, sr, f, amp * (0.35 + 0.65 * rnd()) / Math.sqrt(n), T * (0.6 + 0.8 * rnd()) * (1 + (hiT || 0) * (u - 0.5)), at);
  }
}
function peakTo(x, p) {
  let m = 1e-9;
  for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i]));
  for (let i = 0; i < x.length; i++) x[i] *= p / m;
  return x;
}
function softClip(x, k) { const d = Math.tanh(k); for (let i = 0; i < x.length; i++) x[i] = Math.tanh(k * x[i]) / d; return x; }
/* 방 울림 IR은 샘플레이트마다 한 번 */
const roomIRs = new Map();
function roomIR(ctx) {
  const k = ctx.sampleRate;
  if (!roomIRs.has(k)) roomIRs.set(k, makeIR(ctx, 0.45, 0.25, 4500));
  return roomIRs.get(k);
}
/* 계산한 소리를 오프라인 컨텍스트에서 재생하고, room만큼 작은 방의 울림을 섞는다 */
function playJS(ctx, D, x, room) {
  const b = ctx.createBuffer(1, x.length, ctx.sampleRate);
  b.getChannelData(0).set(x);
  const s = ctx.createBufferSource();
  s.buffer = b; s.connect(D); s.start(0);
  if (room) {
    const cv = ctx.createConvolver();
    cv.normalize = false;
    cv.buffer = roomIR(ctx);
    const g = gainNode(ctx, room);
    s.connect(cv); cv.connect(g); g.connect(D);
  }
  return x.length / ctx.sampleRate + (room ? 0.5 : 0.02);
}
const sbuf = (sr, sec) => new Float32Array(Math.ceil(sr * sec));
Object.assign(DRUM_RECIPES, {
  /* 킥: 가죽이 '둥' 내려앉고, 앞쪽 몸통의 '퍽', 비터의 '딱'. tone을 올리면 비터 소리가 밝고 커진다 */
  akick(ctx, o, D) {
    const sr = ctx.sampleRate, m = Math.pow(2, o.tune / 12), rnd = U.rng(101);
    const T = 0.22 + o.decay * 0.6, x = sbuf(sr, T * 1.2 + 0.05);
    addMode(x, sr, 52 * m, 1, T, 1.6, 0.012);
    addMode(x, sr, 52 * m * MEMBRANE[1], 0.22, T * 0.35, 1.3, 0.01);
    addMode(x, sr, 52 * m * MEMBRANE[2], 0.1, T * 0.22, 1.2, 0.008);
    addNoise(x, sr, 0.3, 0.001, 0.012, rnd, [['bandpass', 170 * m, 1.2]]);
    addNoise(x, sr, 0.3 + 0.6 * o.tone, 0.0002, 0.0018 + 0.0018 * o.tone, rnd, [['highpass', 1500 + 2500 * o.tone, 0.7]]);
    return playJS(ctx, D, peakTo(softClip(x, 1.5), 0.8), 0.08);
  },
  /* 스네어: 가죽 떨림 여섯 개 + 철사줄 '촤'(가죽보다 조금 길게) + 채 끝 '딱'. tone을 올리면 철사줄이 크고 밝다 */
  asnare(ctx, o, D) { return DRUM_RECIPES._asn(ctx, o, D, false); },
  /* 림샷: 채가 가죽과 테를 함께 때려 더 크게 '짝' 하고 테가 울린다 */
  arim(ctx, o, D) { return DRUM_RECIPES._asn(ctx, o, D, true); },
  _asn(ctx, o, D, rim) {
    const sr = ctx.sampleRate, m = Math.pow(2, o.tune / 12), rnd = U.rng(rim ? 211 : 203);
    const T = 0.16 + o.decay * 0.3, Tw = 0.14 + o.decay * 0.4, x = sbuf(sr, Math.max(T, Tw) * 1.2 + 0.05);
    const f = 185 * m, amps = [0.8, 0.45, 0.3, 0.25, 0.15, 0.1];
    MEMBRANE.forEach((r, i) => addMode(x, sr, f * r, amps[i], T * [1, 0.7, 0.55, 0.5, 0.4, 0.35][i], i < 2 ? 1.1 : 0, 0.006));
    addNoise(x, sr, 0.55 + 0.55 * o.tone, 0.0008, Tw / 6.9, rnd, [['highpass', 1700 * m, 0.7], ['lowpass', 9500, 0.7]]);
    addNoise(x, sr, 0.25, 0.0005, Tw / 9, rnd, [['bandpass', 4200 * m, 1.1]]);
    addNoise(x, sr, rim ? 0.9 : 0.35 + 0.25 * o.tone, 0.0002, 0.0015, rnd, [['highpass', 2500, 0.7]]);
    if (rim) { addMode(x, sr, 930 * m, 0.35, 0.22, 0, 0); addMode(x, sr, 1660 * m, 0.22, 0.16, 0, 0); }
    return playJS(ctx, D, peakTo(softClip(x, 1.3), rim ? 0.95 : 0.88), 0.14);
  },
  /* 사이드 스틱(크로스 스틱): 채를 눕혀 테를 쳐서 나는 나무 소리 '똑' */
  astick(ctx, o, D) {
    const sr = ctx.sampleRate, m = Math.pow(2, o.tune / 12), rnd = U.rng(307), x = sbuf(sr, 0.25 + o.decay * 0.2);
    const T = 0.05 + o.decay * 0.08;
    addMode(x, sr, 520 * m, 0.9, T, 0, 0);
    addMode(x, sr, 1320 * m, 0.5, T * 0.7, 0, 0);
    addMode(x, sr, 2900 * m, 0.25 + 0.2 * o.tone, T * 0.5, 0, 0);
    addNoise(x, sr, 0.45, 0.0002, 0.002, rnd, [['bandpass', 2500 * m, 1]]);
    return playJS(ctx, D, peakTo(x, 0.7), 0.1);
  },
  /* 탐: 가죽이 '둥' 하고 눈에 띄게 내려앉는다. tune으로 플로어·로우·하이 탐을 나눈다 */
  atom(ctx, o, D) {
    const sr = ctx.sampleRate, m = Math.pow(2, o.tune / 12), rnd = U.rng(401);
    const T = 0.45 + o.decay * 0.9, x = sbuf(sr, T * 1.2 + 0.05), f = 98 * m;
    addMode(x, sr, f, 1, T, 1.18, 0.04);
    addMode(x, sr, f * MEMBRANE[1], 0.35, T * 0.45, 1.12, 0.03);
    addMode(x, sr, f * MEMBRANE[2], 0.18, T * 0.3, 1.08, 0.02);
    addMode(x, sr, f * MEMBRANE[4], 0.08, T * 0.2, 0, 0);
    addNoise(x, sr, 0.2, 0.001, 0.012, rnd, [['bandpass', f * 1.3, 1.2]]);
    addNoise(x, sr, 0.25 + 0.3 * o.tone, 0.0002, 0.0015, rnd, [['highpass', 1500 + 2000 * o.tone, 0.7]]);
    return playJS(ctx, D, peakTo(softClip(x, 1.2), 0.7), 0.12);
  },
  /* 하이햇: 닫힌 소리는 짧게 '칙', 열린 소리는 '츠~', 발로 밟으면 둔하게 '척' */
  ahat(ctx, o, D) { return DRUM_RECIPES._ahh(ctx, o, D, 0.05 + o.decay * 0.12, 'closed'); },
  aohat(ctx, o, D) { return DRUM_RECIPES._ahh(ctx, o, D, 0.5 + o.decay * 1.4, 'open'); },
  apedal(ctx, o, D) { return DRUM_RECIPES._ahh(ctx, o, D, 0.04 + o.decay * 0.06, 'pedal'); },
  _ahh(ctx, o, D, T, kind) {
    const sr = ctx.sampleRate, m = Math.pow(2, o.tune / 12), rnd = U.rng(kind === 'open' ? 509 : kind === 'pedal' ? 523 : 503);
    const x = sbuf(sr, T * 1.3 + 0.03), pedal = kind === 'pedal';
    metalPlate(x, sr, rnd, 40, (pedal ? 2400 : 3200) * m, (pedal ? 9000 : 15000) * m, T, 0.9, 0.5);
    addNoise(x, sr, (0.4 + 0.4 * o.tone) * (pedal ? 0.6 : 1), kind === 'open' ? 0.002 : 0.0005, T / 6.9, rnd, pedal ? [['bandpass', 5200 * m, 0.8]] : [['highpass', 6500 * m, 0.7]]);
    addNoise(x, sr, pedal ? 0.35 : 0.25, 0.0003, 0.002, rnd, [['bandpass', pedal ? 900 : 3000, 1.2]]);   // 판끼리 닿는 '칙'
    return playJS(ctx, D, peakTo(x, pedal ? 0.4 : 0.55), 0);
  },
  /* 크래시: 낮은 배음이 먼저 사라지고 높은 '쉬~'가 오래 남는다. 처음 몇 ms 동안 소리가 부풀어 오른다 */
  acrash(ctx, o, D) {
    const sr = ctx.sampleRate, m = Math.pow(2, o.tune / 12), rnd = U.rng(601);
    const T = 1.8 + o.decay * 2.5, x = sbuf(sr, T * 1.2);
    metalPlate(x, sr, rnd, 70, 350 * m, 16000 * m, T, 1, 1.2);
    addNoise(x, sr, 0.35 + 0.3 * o.tone, 0.004, T * 0.8 / 6.9, rnd, [['highpass', 2500 * m, 0.7]]);
    addNoise(x, sr, 0.3, 0.0003, 0.003, rnd, [['highpass', 4000, 0.7]]);
    return playJS(ctx, D, peakTo(x, 0.6), 0);
  },
  /* 라이드: 채 끝이 '팅' 하는 음과 그 뒤의 은은한 울림 */
  aride(ctx, o, D) {
    const sr = ctx.sampleRate, m = Math.pow(2, o.tune / 12), rnd = U.rng(701);
    const T = 1.6 + o.decay * 1.6, x = sbuf(sr, T * 1.2);
    metalPlate(x, sr, rnd, 48, 1800 * m, 14000 * m, T, 0.45, 0.6);
    [3150, 4580, 6020, 7400].forEach((f, i) => ring(x, sr, f * m, [0.35, 0.28, 0.2, 0.12][i], 0.9 + 0.6 * o.decay));
    addNoise(x, sr, 0.25 * (0.5 + o.tone), 0.0002, 0.002, rnd, [['highpass', 5000, 0.7]]);
    return playJS(ctx, D, peakTo(x, 0.45), 0);
  },
  /* 라이드 벨: 심벌 가운데 볼록한 곳을 쳐서 종처럼 '띵' */
  abell(ctx, o, D) {
    const sr = ctx.sampleRate, m = Math.pow(2, o.tune / 12), rnd = U.rng(709);
    const T = 1.8 + o.decay * 1.2, x = sbuf(sr, T * 1.2);
    [[1240, 1], [2610, 0.6], [3430, 0.5], [4710, 0.35], [6100, 0.2]].forEach(([f, a]) => ring(x, sr, f * m, a * 0.4, T * (0.7 + 0.3 * rnd())));
    metalPlate(x, sr, rnd, 24, 2000 * m, 12000 * m, T * 0.7, 0.2, 0);
    addNoise(x, sr, 0.15, 0.0002, 0.002, rnd, [['highpass', 4000, 0.7]]);
    return playJS(ctx, D, peakTo(x, 0.5), 0);
  },
  /* 탬버린: 작은 방울(징글) 여러 쌍이 거의 같이 '찰랑' */
  atamb(ctx, o, D) {
    const sr = ctx.sampleRate, m = Math.pow(2, o.tune / 12), rnd = U.rng(809);
    const T = 0.14 + o.decay * 0.2, x = sbuf(sr, T * 1.3 + 0.03);
    for (let j = 0; j < 6; j++) {
      const at = rnd() * 0.012;
      for (let k = 0; k < 6; k++) ring(x, sr, (4500 + rnd() * 6500) * m, (0.3 + 0.7 * rnd()) * 0.15, T * (0.6 + 0.6 * rnd()), at);
    }
    addNoise(x, sr, 0.3 + 0.3 * o.tone, 0.001, T / 8, rnd, [['highpass', 6000 * m, 0.7]]);
    return playJS(ctx, D, peakTo(x, 0.45), 0);
  }
});
const JS_DRUMS = new Set(['akick', 'asnare', 'arim', 'astick', 'atom', 'ahat', 'aohat', 'apedal', 'acrash', 'aride', 'abell', 'atamb']);
const LEVEL = { kick: 0.85, snare: 0.7, clap: 0.6, chh: 0.4, ohh: 0.4, tom: 0.7, rim: 0.55, cow: 0.4, crash: 0.45, ride: 0.4, shaker: 0.4, conga: 0.6, sub: 0.85, zap: 0.45, noise: 0.45, snap: 0.55, brush: 1.1, swish: 0.4,
  akick: 1, asnare: 1, arim: 1, astick: 1, atom: 1, ahat: 1, aohat: 1, apedal: 1, acrash: 1, aride: 1, abell: 1, atamb: 1 };

function OfflineCtx(ch, len, sr) {
  const C = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  return new C(ch, Math.max(1, len), sr);
}
/* 합성 드럼 하나를 버퍼로 */
function renderDrum(type, o, sr) {
  const key = [type, U.round(o.tune, 2), U.round(o.decay, 3), U.round(o.tone, 3), sr].join('|');
  if (drumCache.has(key)) return drumCache.get(key);
  const recipe = DRUM_RECIPES[type] || DRUM_RECIPES.noise;
  // 길이를 먼저 알아야 해서 더미 컨텍스트 없이 대략값으로 잡는다
  const est = { kick: 2, snare: 1, clap: 1, chh: 0.4, ohh: 1.6, tom: 1.4, rim: 0.3, cow: 1.2, crash: 5.5, ride: 4.3, shaker: 0.4, conga: 1, sub: 4.8, zap: 0.7, noise: 1.6, snap: 0.4, brush: 0.8, swish: 1.3,
    akick: 1.6, asnare: 1.3, arim: 1.3, astick: 1, atom: 2.3, ahat: 0.4, aohat: 2.6, apedal: 0.3, acrash: 5.3, aride: 4, abell: 3.7, atamb: 0.6 }[type] || 2;
  const go = () => {
    const ctx = OfflineCtx(1, Math.ceil(est * sr), sr);
    const out = gainNode(ctx, LEVEL[type] || 0.6);
    out.connect(ctx.destination);
    let want = est;
    try { want = recipe.call(DRUM_RECIPES, ctx, o, out); } catch (e) { console.error(e); }
    return ctx.startRendering().then(buf => trimBuffer(buf, Math.min(est, want)));
  };
  // 어쿠스틱 드럼은 자바스크립트로 계산해서 패드마다 따로 쉬어 가며 (킷을 한꺼번에 불러도 화면이 멈추지 않게)
  const p = JS_DRUMS.has(type) ? new Promise(r => setTimeout(r, 0)).then(go) : go();
  drumCache.set(key, p);
  return p;
}
function trimBuffer(buf, sec) {
  const len = Math.min(buf.length, Math.ceil(sec * buf.sampleRate));
  if (len >= buf.length) return fadeTail(buf);
  const out = new AudioBuffer({ length: len, numberOfChannels: buf.numberOfChannels, sampleRate: buf.sampleRate });
  for (let c = 0; c < buf.numberOfChannels; c++) out.copyToChannel(buf.getChannelData(c).subarray(0, len), c);
  return fadeTail(out);
}
function fadeTail(buf) {
  const n = Math.min(buf.length, Math.floor(buf.sampleRate * 0.01));
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < n; i++) d[buf.length - 1 - i] *= i / n;
  }
  return buf;
}

Object.assign(U, {
  envOn, envOff, envEnd, stopAt, smooth, velGain, gainNode, noiseBuffer, noiseSource,
  satCurve, clipCurve, makeIR, renderDrum, OfflineCtx, trimBuffer, DRUM_RECIPES
});
})(window.U = window.U || {});
