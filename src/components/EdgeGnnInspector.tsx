import React, { useState } from "react";
import { runClientGnnInference } from "../utils/gnnEngine";
import { GnnPrediction, GnnNodeEmbedding } from "../types";
import {
  Cpu,
  ShieldCheck,
  Zap,
  Activity,
  Layers,
  CheckCircle2,
  XCircle,
  BarChart,
  HelpCircle,
  Terminal,
  Grid,
} from "lucide-react";

const SAMPLE_SMILES = [
  { name: "Aspirin", smiles: "CC(=O)Oc1ccccc1C(=O)O" },
  { name: "Caffeine", smiles: "CN1C=NC2=C1C(=O)N(C(=O)N2C)C" },
  { name: "Paracetamol", smiles: "CC(=O)Nc1ccc(O)cc1" },
  { name: "Ibuprofen", smiles: "CC(C)Cc1ccc(cc1)C(C)C(=O)O" },
  { name: "Penicillin G", smiles: "CC1(C(N2C(S1)C(C2=O)NC(=O)Cc3ccccc3)C(=O)O)C" },
];

export const EdgeGnnInspector: React.FC = () => {
  const [smilesInput, setSmilesInput] = useState<string>("CC(=O)Oc1ccccc1C(=O)O");
  const [activeSmiles, setActiveSmiles] = useState<string>("CC(=O)Oc1ccccc1C(=O)O");
  const [selectedNode, setSelectedNode] = useState<GnnNodeEmbedding | null>(null);

  const gnnResult: GnnPrediction = React.useMemo(() => {
    return runClientGnnInference(activeSmiles);
  }, [activeSmiles]);

  const handleCompute = () => {
    if (!smilesInput.trim()) return;
    setActiveSmiles(smilesInput.trim());
    setSelectedNode(null);
  };

  return (
    <div id="edge-gnn-inspector-module" className="space-y-6 animate-fadeIn">
      {/* Header Banner */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="rounded bg-violet-500/20 px-2 py-0.5 text-xs font-semibold text-violet-400 border border-violet-500/30">
                WASM & Client GNN Engine
              </span>
              <span className="rounded bg-cyan-500/20 px-2 py-0.5 text-xs font-semibold text-cyan-300 border border-cyan-500/30">
                Zero-Latency Privacy-Preserving Inference
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white">
              Client-Side Graph Neural Network (MPNN) & Cheminformatics Core
            </h2>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl">
              Executes 3-layer Message Passing Neural Networks directly inside the browser. Inspect node feature vectors, adjacency matrices, Lipinski Rule of 5 constraints, and synthetic accessibility.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-lg bg-emerald-950/60 px-3 py-1.5 text-xs font-mono text-emerald-300 border border-emerald-500/30">
              <Zap className="h-3.5 w-3.5 text-emerald-400" />
              <span>Inference Time: ~0.8 ms (Local)</span>
            </span>
          </div>
        </div>
      </div>

      {/* SMILES Input Bar & Presets */}
      <div className="space-y-3">
        <div className="flex gap-2 rounded-xl border border-slate-800 bg-slate-900/80 p-3">
          <input
            type="text"
            placeholder="Input SMILES string for real-time GNN message passing..."
            value={smilesInput}
            onChange={(e) => setSmilesInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCompute()}
            className="w-full rounded-lg bg-slate-950 px-3.5 py-2 text-xs text-slate-200 border border-slate-800 focus:outline-none focus:border-violet-500 font-mono"
          />
          <button
            type="button"
            onClick={handleCompute}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2 text-xs font-bold text-white hover:from-violet-500 hover:to-indigo-500 transition-all flex-shrink-0 cursor-pointer shadow-lg shadow-violet-600/20"
          >
            <Cpu className="h-4 w-4" />
            <span>Pass Messages</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Quick Drug Graphs:
          </span>
          {SAMPLE_SMILES.map((sm, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setSmilesInput(sm.smiles);
                setActiveSmiles(sm.smiles);
                setSelectedNode(null);
              }}
              className={`rounded-lg border px-3 py-1 text-xs transition-colors ${
                activeSmiles === sm.smiles
                  ? "border-violet-500 bg-violet-950/40 text-violet-300 font-semibold"
                  : "border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700 hover:text-slate-200"
              }`}
            >
              {sm.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: GNN Latent Space & Lipinski Rule of 5 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Lipinski Rule of 5 & Cheminformatics Descriptors */}
        <div className="lg:col-span-7 space-y-4">
          {/* Descriptors Bento Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">Molecular Weight</span>
              <span className="text-xl font-bold text-white font-mono mt-1 block">
                {gnnResult.molWeight} <span className="text-xs font-normal text-slate-400">g/mol</span>
              </span>
              <span className="text-[11px] text-slate-500">Threshold: ≤ 500 Da</span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">LogP (Lipophilicity)</span>
              <span className={`text-xl font-bold font-mono mt-1 block ${gnnResult.logP <= 5 ? "text-emerald-400" : "text-amber-400"}`}>
                {gnnResult.logP}
              </span>
              <span className="text-[11px] text-slate-500">Threshold: ≤ 5.0</span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">Polar Surface (TPSA)</span>
              <span className="text-xl font-bold text-cyan-300 font-mono mt-1 block">
                {gnnResult.tpsa} <span className="text-xs font-normal text-slate-400">Å²</span>
              </span>
              <span className="text-[11px] text-slate-500">Optimum: 20-140 Å²</span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">H-Bond Donors</span>
              <span className="text-xl font-bold text-indigo-300 font-mono mt-1 block">{gnnResult.hBondDonors}</span>
              <span className="text-[11px] text-slate-500">Threshold: ≤ 5</span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">H-Bond Acceptors</span>
              <span className="text-xl font-bold text-indigo-300 font-mono mt-1 block">{gnnResult.hBondAcceptors}</span>
              <span className="text-[11px] text-slate-500">Threshold: ≤ 10</span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">Rotatable Bonds</span>
              <span className="text-xl font-bold text-amber-300 font-mono mt-1 block">{gnnResult.rotatableBonds}</span>
              <span className="text-[11px] text-slate-500">Flexibility index</span>
            </div>
          </div>

          {/* Lipinski Rule of 5 Compliance Banner */}
          <div
            className={`rounded-xl border p-4 flex items-center justify-between ${
              gnnResult.lipinskiPass
                ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-300"
                : "border-amber-500/40 bg-amber-950/20 text-amber-300"
            }`}
          >
            <div className="flex items-center gap-3">
              {gnnResult.lipinskiPass ? (
                <CheckCircle2 className="h-6 w-6 text-emerald-400 flex-shrink-0" />
              ) : (
                <XCircle className="h-6 w-6 text-amber-400 flex-shrink-0" />
              )}
              <div>
                <h4 className="text-sm font-bold text-white">
                  Lipinski's Rule of 5: {gnnResult.lipinskiPass ? "Compliant (Drug-Like Profile)" : "Violations Detected"}
                </h4>
                <p className="text-xs text-slate-300 mt-0.5">
                  Evaluates oral bioavailability based on mass, lipophilicity, and hydrogen bonding capacity.
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs uppercase tracking-wider font-mono text-slate-400 block">QED Score</span>
              <span className="text-lg font-mono font-bold text-white">{(gnnResult.qedScore * 100).toFixed(0)}%</span>
            </div>
          </div>

          {/* Adjacency Matrix Visualizer */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Grid className="h-4 w-4 text-violet-400" />
                Molecular Graph Adjacency Matrix [A]
              </span>
              <span className="text-[11px] font-mono text-slate-400">{gnnResult.nodeEmbeddings.length} × {gnnResult.nodeEmbeddings.length} Nodes</span>
            </div>

            <div className="overflow-x-auto">
              <div className="inline-grid gap-1 bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[10px]">
                {gnnResult.adjacencyMatrix.map((row, rIdx) => (
                  <div key={rIdx} className="flex gap-1">
                    {row.map((val, cIdx) => (
                      <span
                        key={cIdx}
                        className={`h-5 w-5 flex items-center justify-center rounded ${
                          val > 0 ? "bg-violet-600/80 text-white font-bold" : "bg-slate-900 text-slate-600"
                        }`}
                        title={`Atom ${rIdx + 1} - Atom ${cIdx + 1}: Bond Order ${val}`}
                      >
                        {val > 0 ? val : "·"}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: GNN Atom Node Latent Embeddings (Message Passing) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-violet-400" />
                <h4 className="text-sm font-bold text-white">Atom Node Embeddings</h4>
              </div>
              <span className="text-[11px] font-mono text-slate-400">Layer-3 MPNN Outputs</span>
            </div>

            <p className="text-xs text-slate-400">
              Click any atom node to inspect its multi-dimensional latent representation after graph convolution:
            </p>

            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
              {gnnResult.nodeEmbeddings.map((node: GnnNodeEmbedding) => {
                const isSelected = selectedNode?.atomIndex === node.atomIndex;
                return (
                  <button
                    key={node.atomIndex}
                    type="button"
                    onClick={() => setSelectedNode(node)}
                    className={`w-full text-left rounded-lg border p-2.5 transition-all text-xs ${
                      isSelected
                        ? "border-violet-500 bg-violet-950/40 text-white"
                        : "border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-violet-300 font-mono">
                        Node #{node.atomIndex}: {node.element} ({node.hybridization})
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">
                        Deg: {node.degree} • EN: {node.electronegativity}
                      </span>
                    </div>

                    {/* Vector Bar */}
                    <div className="flex items-center gap-1 mt-2">
                      {node.latentVector.slice(0, 6).map((val, vIdx) => {
                        const widthPct = Math.min(100, Math.max(10, Math.abs(val) * 100));
                        return (
                          <div key={vIdx} className="flex-1 bg-slate-900 rounded h-1.5 overflow-hidden">
                            <div
                              className="h-full bg-violet-500 rounded"
                              style={{ width: `${widthPct}%` }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Node Inspector */}
          {selectedNode && (
            <div className="rounded-xl border border-violet-500/40 bg-slate-900/95 p-4 space-y-2.5 animate-fadeIn">
              <span className="text-xs font-bold uppercase tracking-wider text-violet-300 block font-mono">
                Node #{selectedNode.atomIndex} Latent Tensor Vector:
              </span>
              <div className="rounded-lg bg-slate-950 p-3 font-mono text-xs text-violet-200 border border-slate-800 break-all leading-relaxed">
                [{selectedNode.latentVector.join(", ")}]
              </div>
              <p className="text-[11px] text-slate-400">
                Encodes topological distance to electronegative heteroatoms, aromatic ring membership, and local steric crowding.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
