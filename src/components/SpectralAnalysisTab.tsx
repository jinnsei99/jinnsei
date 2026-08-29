import React, { useState, useMemo } from "react";
import { PRESET_NMR_DATASETS } from "../data/curriculumData";
import { NmrDataset, NmrPeak } from "../types";
import { processNmrFid, ProcessedNmrSpectrum } from "../utils/nmrEngine";
import {
  Activity,
  Sliders,
  Upload,
  Sparkles,
  BarChart2,
  CheckCircle2,
  RotateCw,
  Layers,
  HelpCircle,
  FileCode,
  Zap,
} from "lucide-react";

export const SpectralAnalysisTab: React.FC = () => {
  const [selectedDataset, setSelectedDataset] = useState<NmrDataset>(PRESET_NMR_DATASETS[0]);
  const [lineBroadening, setLineBroadening] = useState<number>(1.2);
  const [zeroFill, setZeroFill] = useState<number>(2048);
  const [phase0, setPhase0] = useState<number>(0);
  const [phase1, setPhase1] = useState<number>(0);
  const [viewDomain, setViewDomain] = useState<"frequency" | "fid">("frequency");
  const [isLoadingAi, setIsLoadingAi] = useState<boolean>(false);
  const [aiInterpretation, setAiInterpretation] = useState<any>(null);

  // Compute live processed spectrum via nmrEngine (simulating nmrglue)
  const processedData: ProcessedNmrSpectrum = useMemo(() => {
    return processNmrFid(selectedDataset.fidSignalReal, selectedDataset.fidSignalImag, {
      lineBroadeningHz: lineBroadening,
      zeroFillSize: zeroFill,
      phase0Deg: phase0,
      phase1Deg: phase1,
      frequencyMHz: selectedDataset.frequencyMHz,
      spectralWidthPpm: 12,
      carrierPpm: 5.5,
    });
  }, [selectedDataset, lineBroadening, zeroFill, phase0, phase1]);

  // Request DP4-AI structure confirmation and automated peak assignment
  const handleInterpretNmr = async () => {
    setIsLoadingAi(true);
    try {
      const response = await fetch("/api/nmr/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          peaks: selectedDataset.peaks,
          solvent: selectedDataset.solvent,
          frequencyMHz: selectedDataset.frequencyMHz,
          nucleus: selectedDataset.nucleus,
          proposedSmiles: selectedDataset.smiles,
          proposedName: selectedDataset.compoundName,
        }),
      });

      const resData = await response.json();
      if (resData.success && resData.data) {
        setAiInterpretation(resData.data);
      }
    } catch (err) {
      console.error("NMR interpret error:", err);
    } finally {
      setIsLoadingAi(false);
    }
  };

  // Handle synthetic/uploaded raw FID file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n").filter((l) => l.trim() && !l.startsWith("#"));
      const reals: number[] = [];
      const imags: number[] = [];

      for (const line of lines.slice(0, 1024)) {
        const parts = line.trim().split(/[\s,]+/);
        if (parts.length >= 1) {
          reals.push(parseFloat(parts[0]) || 0);
          imags.push(parts.length > 1 ? parseFloat(parts[1]) || 0 : 0);
        }
      }

      if (reals.length > 10) {
        const customSet: NmrDataset = {
          id: `uploaded_${Date.now()}`,
          compoundName: file.name.replace(/\.[^/.]+$/, ""),
          nucleus: "1H",
          frequencyMHz: 400,
          solvent: "CDCl3",
          smiles: "Custom",
          fidTime: reals.map((_, idx) => idx * 0.002),
          fidSignalReal: reals,
          fidSignalImag: imags,
          peaks: [
            {
              id: 1,
              shiftPpm: 2.1,
              intensity: 75,
              multiplicity: "m",
              integral: 1.0,
              assignedGroup: "Uploaded Peak Cluster",
            },
          ],
          spectralNotes: `Loaded from user FID data (${reals.length} points).`,
          dp4Score: 0.95,
        };
        setSelectedDataset(customSet);
        setAiInterpretation(null);
      }
    };
    reader.readAsText(file);
  };

  // Generate SVG Path for NMR Spectrum
  const svgSpectrumPath = useMemo(() => {
    const pts = processedData.intensityReal;
    const len = pts.length;
    if (len === 0) return "";

    const width = 800;
    const height = 240;
    const padding = 20;

    let path = `M 0 ${height - padding}`;
    for (let i = 0; i < len; i += 2) {
      const x = (i / len) * width;
      const val = Math.max(0, Math.min(100, pts[i]));
      const y = height - padding - (val / 100) * (height - 2 * padding);
      path += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    return path;
  }, [processedData.intensityReal]);

  // Generate SVG Path for Time-Domain FID
  const svgFidPath = useMemo(() => {
    const pts = selectedDataset.fidSignalReal;
    const len = pts.length;
    if (len === 0) return "";

    const width = 800;
    const height = 240;
    const midY = height / 2;

    let path = `M 0 ${midY}`;
    for (let i = 0; i < len; i++) {
      const x = (i / len) * width;
      const val = pts[i];
      const y = midY - val * 25;
      path += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    return path;
  }, [selectedDataset.fidSignalReal]);

  return (
    <div id="spectral-nmr-module" className="space-y-6 animate-fadeIn">
      {/* Header Banner */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="rounded bg-teal-500/20 px-2 py-0.5 text-xs font-semibold text-teal-400 border border-teal-500/30">
                NMRglue Web Pipeline
              </span>
              <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-xs font-semibold text-indigo-300 border border-indigo-500/30">
                DP4-AI Structure Verification
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white">
              Analytical NMR Spectral Processing & Structure Assignment
            </h2>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl">
              Process raw time-domain Free Induction Decay (FID) signals in real time. Apply exponential apodization, zero-filling, Fast Fourier Transform (FFT), and zero/first-order phase corrections.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer transition-colors shadow-md">
              <Upload className="h-3.5 w-3.5 text-cyan-400" />
              <span>Upload Raw FID (.fid/.txt)</span>
              <input type="file" accept=".fid,.txt,.csv,.dat" onChange={handleFileUpload} className="hidden" />
            </label>

            <button
              type="button"
              onClick={handleInterpretNmr}
              disabled={isLoadingAi}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-teal-500 to-cyan-600 px-4 py-2 text-xs font-bold text-slate-950 hover:from-teal-400 hover:to-cyan-500 transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-teal-500/20"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{isLoadingAi ? "Running DP4-AI..." : "Verify with DP4-AI"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dataset Selection Bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 p-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
          <Activity className="h-3.5 w-3.5 text-teal-400" />
          Experimental Spectra:
        </span>
        {PRESET_NMR_DATASETS.map((ds) => {
          const isSelected = selectedDataset.id === ds.id;
          return (
            <button
              key={ds.id}
              type="button"
              onClick={() => {
                setSelectedDataset(ds);
                setAiInterpretation(null);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                isSelected
                  ? "bg-teal-500 text-slate-950 font-bold shadow-md shadow-teal-500/20"
                  : "bg-slate-800/80 text-slate-300 hover:bg-slate-700/80 hover:text-white border border-slate-700/50"
              }`}
            >
              {ds.compoundName} ({ds.frequencyMHz} MHz)
            </button>
          );
        })}
      </div>

      {/* Main Grid: Interactive Spectrum Canvas + NMRglue Processing Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Spectrum / FID Waveform Viewport */}
        <div className="lg:col-span-8 space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 shadow-2xl backdrop-blur-md space-y-4">
            {/* Viewport Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-teal-400 animate-pulse" />
                <h3 className="text-sm font-bold text-white font-mono">
                  {selectedDataset.compoundName} — {viewDomain === "frequency" ? "Frequency Domain Spectrum" : "Raw Time-Domain FID Signal"}
                </h3>
              </div>

              {/* Toggle Domain Mode */}
              <div className="flex rounded-lg border border-slate-800 bg-slate-950 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setViewDomain("frequency")}
                  className={`rounded px-3 py-1 font-medium transition-colors ${
                    viewDomain === "frequency" ? "bg-teal-500 text-slate-950 font-semibold" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Frequency Spectrum (ppm)
                </button>
                <button
                  type="button"
                  onClick={() => setViewDomain("fid")}
                  className={`rounded px-3 py-1 font-medium transition-colors ${
                    viewDomain === "fid" ? "bg-teal-500 text-slate-950 font-semibold" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Time-Domain FID s(t)
                </button>
              </div>
            </div>

            {/* SVG Interactive Waveform Display */}
            <div className="relative rounded-xl border border-slate-800 bg-slate-950 p-3 overflow-hidden">
              <svg viewBox="0 0 800 240" className="w-full h-64 select-none">
                {/* Grid Lines */}
                <line x1="0" y1="220" x2="800" y2="220" stroke="#334155" strokeWidth="1.5" />
                <line x1="0" y1="120" x2="800" y2="120" stroke="#1e293b" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="0" y1="20" x2="800" y2="20" stroke="#1e293b" strokeWidth="1" strokeDasharray="4 4" />

                {viewDomain === "frequency" ? (
                  <>
                    {/* Spectral Path */}
                    <path
                      d={svgSpectrumPath}
                      fill="none"
                      stroke="#2dd4bf"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* Peak Labels & Chemical Shift Grid */}
                    {selectedDataset.peaks.map((pk) => {
                      // Map ppm (e.g. 1.25 in range 12 to 0 ppm)
                      // x = ((12 - ppm) / 12) * 800
                      const x = ((12 - pk.shiftPpm) / 12) * 800;
                      return (
                        <g key={pk.id}>
                          <line x1={x} y1="20" x2={x} y2="220" stroke="#0ea5e9" strokeWidth="1" strokeDasharray="2 2" opacity="0.4" />
                          <circle cx={x} cy={60} r="3.5" fill="#38bdf8" />
                          <text x={x} y="45" fill="#bae6fd" fontSize="11" textAnchor="middle" fontFamily="monospace" fontWeight="bold">
                            {pk.shiftPpm} ppm
                          </text>
                          <text x={x} y="15" fill="#94a3b8" fontSize="10" textAnchor="middle" fontFamily="sans-serif">
                            ({pk.multiplicity})
                          </text>
                        </g>
                      );
                    })}
                  </>
                ) : (
                  /* Time-Domain FID Signal */
                  <path
                    d={svgFidPath}
                    fill="none"
                    stroke="#818cf8"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
              </svg>

              {/* Chemical Shift ppm Axis Markings (Convention: 12 ppm downfield -> 0 ppm upfield) */}
              {viewDomain === "frequency" && (
                <div className="flex justify-between text-[11px] font-mono text-slate-400 px-2 pt-1 border-t border-slate-800">
                  <span>12.0 ppm (Downfield)</span>
                  <span>10.0</span>
                  <span>8.0</span>
                  <span>6.0</span>
                  <span>4.0</span>
                  <span>2.0</span>
                  <span>0.0 ppm (TMS Ref)</span>
                </div>
              )}
            </div>

            {/* Spectral Notes */}
            <p className="text-xs text-slate-300 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80 leading-relaxed">
              {selectedDataset.spectralNotes}
            </p>
          </div>

          {/* Peak Assignment Table */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <BarChart2 className="h-4 w-4 text-teal-400" />
                Detected Peak Splitting & Multiplet Analysis
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                Solvent: {selectedDataset.solvent}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-mono">
                    <th className="py-2 px-2.5">δ (ppm)</th>
                    <th className="py-2 px-2.5">Multiplicity</th>
                    <th className="py-2 px-2.5">Integral</th>
                    <th className="py-2 px-2.5">J Coupling</th>
                    <th className="py-2 px-2.5">Structural Assignment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {selectedDataset.peaks.map((pk: NmrPeak) => (
                    <tr key={pk.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2 px-2.5 font-mono font-bold text-teal-300">{pk.shiftPpm}</td>
                      <td className="py-2 px-2.5 font-mono uppercase text-indigo-300">{pk.multiplicity}</td>
                      <td className="py-2 px-2.5 font-mono text-cyan-300">{pk.integral}H</td>
                      <td className="py-2 px-2.5 font-mono text-slate-400">{pk.jCouplingHz || "N/A"}</td>
                      <td className="py-2 px-2.5 text-slate-300">{pk.assignedGroup}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: NMRglue Processing Knobs & DP4-AI Report */}
        <div className="lg:col-span-4 space-y-4">
          {/* Signal Processing Parameters */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
              <Sliders className="h-4 w-4 text-teal-400" />
              <h4 className="text-sm font-bold text-white">NMRglue Signal Processing</h4>
            </div>

            {/* Apodization Line Broadening Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-slate-300">Exponential Apodization (LB):</span>
                <span className="font-mono text-teal-300 font-bold">{lineBroadening} Hz</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="5.0"
                step="0.1"
                value={lineBroadening}
                onChange={(e) => setLineBroadening(parseFloat(e.target.value))}
                className="w-full accent-teal-400 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 block">
                Multiplies FID by exp(-π·LB·t) to enhance signal-to-noise ratio.
              </span>
            </div>

            {/* Zero-Filling Size */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-slate-300">Zero-Filling Resolution:</span>
                <span className="font-mono text-indigo-300 font-bold">{zeroFill} pts</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[1024, 2048, 4096].map((zf) => (
                  <button
                    key={zf}
                    type="button"
                    onClick={() => setZeroFill(zf)}
                    className={`py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                      zeroFill === zf
                        ? "bg-indigo-600 text-white font-bold"
                        : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                    }`}
                  >
                    {zf} pts
                  </button>
                ))}
              </div>
            </div>

            {/* Zero-Order Phase Correction (PH0) */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-slate-300">Zero-Order Phase (PH0):</span>
                <span className="font-mono text-cyan-300 font-bold">{phase0}°</span>
              </div>
              <input
                type="range"
                min="-180"
                max="180"
                step="5"
                value={phase0}
                onChange={(e) => setPhase0(parseInt(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            {/* First-Order Phase Correction (PH1) */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-slate-300">First-Order Phase (PH1):</span>
                <span className="font-mono text-cyan-300 font-bold">{phase1}°</span>
              </div>
              <input
                type="range"
                min="-180"
                max="180"
                step="5"
                value={phase1}
                onChange={(e) => setPhase1(parseInt(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            {/* Reset Processing */}
            <button
              type="button"
              onClick={() => {
                setLineBroadening(1.2);
                setZeroFill(2048);
                setPhase0(0);
                setPhase1(0);
              }}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950 py-2 text-xs text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
            >
              <RotateCw className="h-3 w-3" />
              <span>Reset Signal Parameters</span>
            </button>
          </div>

          {/* DP4-AI Structure Confirmation Report */}
          {aiInterpretation && (
            <div className="rounded-xl border border-teal-500/40 bg-slate-900/95 p-4 space-y-3 shadow-xl backdrop-blur-md animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-teal-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                    DP4-AI Computational Verdict
                  </h4>
                </div>
                <span className="rounded bg-teal-500/20 px-2 py-0.5 text-xs font-mono font-bold text-teal-300 border border-teal-500/30">
                  DP4: {(aiInterpretation.dp4Score * 100).toFixed(1)}%
                </span>
              </div>

              <p className="text-xs text-slate-200 leading-relaxed font-medium">
                {aiInterpretation.structuralSummary}
              </p>

              {aiInterpretation.couplingAnalysis && (
                <div className="text-[11px] text-slate-300 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                  <span className="font-bold text-indigo-300 block mb-0.5">Spin-Spin Coupling Insights:</span>
                  {aiInterpretation.couplingAnalysis}
                </div>
              )}

              {aiInterpretation.pedagogicalKeyPoints && (
                <div className="space-y-1 pt-1">
                  <span className="text-[11px] font-bold text-teal-300 uppercase tracking-wider block">
                    Spectroscopy Key Takeaways:
                  </span>
                  {aiInterpretation.pedagogicalKeyPoints.map((pt: string, pIdx: number) => (
                    <div key={pIdx} className="flex items-start gap-1.5 text-[11px] text-slate-300">
                      <span className="text-teal-400 font-bold">•</span>
                      <span>{pt}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
