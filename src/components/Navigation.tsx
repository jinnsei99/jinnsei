import React from "react";
import {
  FlaskConical,
  Calculator,
  BookOpen,
  Activity,
  Dna,
  Cpu,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

export type NavTabId = "structure" | "derivation" | "literature" | "spectral" | "biochem" | "gnn";

interface NavigationProps {
  activeTab: NavTabId;
  onTabChange: (tab: NavTabId) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    {
      id: "structure" as NavTabId,
      label: "3D Structure Tutor",
      subLabel: "Py3Dmol & FMO Orbitals",
      icon: FlaskConical,
      color: "text-cyan-400",
      activeBg: "bg-cyan-500 text-slate-950 shadow-cyan-500/20",
    },
    {
      id: "derivation" as NavTabId,
      label: "Quantum Derivations",
      subLabel: "SymPy & KaTeX Steps",
      icon: Calculator,
      color: "text-indigo-400",
      activeBg: "bg-indigo-600 text-white shadow-indigo-600/30",
    },
    {
      id: "literature" as NavTabId,
      label: "Literature & RAG",
      subLabel: "PubMed & ChemRxivQuest",
      icon: BookOpen,
      color: "text-emerald-400",
      activeBg: "bg-emerald-500 text-slate-950 shadow-emerald-500/20",
    },
    {
      id: "spectral" as NavTabId,
      label: "Analytical NMR",
      subLabel: "NMRglue & DP4-AI",
      icon: Activity,
      color: "text-teal-400",
      activeBg: "bg-teal-500 text-slate-950 shadow-teal-500/20",
    },
    {
      id: "biochem" as NavTabId,
      label: "ESMFold Proteomics",
      subLabel: "De Novo 3D Folding",
      icon: Dna,
      color: "text-rose-400",
      activeBg: "bg-rose-600 text-white shadow-rose-600/30",
    },
    {
      id: "gnn" as NavTabId,
      label: "Client GNN Core",
      subLabel: "WASM & MPNN In-Browser",
      icon: Cpu,
      color: "text-violet-400",
      activeBg: "bg-violet-600 text-white shadow-violet-600/30",
    },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Tagline */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-rose-500 p-0.5 shadow-lg shadow-cyan-500/20">
              <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-slate-950">
                <FlaskConical className="h-5 w-5 text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-extrabold tracking-tight text-white font-mono">
                  Chem<span className="text-cyan-400">Verse</span>
                </h1>
                <span className="rounded bg-cyan-500/10 px-2 py-0.5 text-[10px] font-mono font-semibold text-cyan-400 border border-cyan-500/20">
                  Edutech v2.5
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Multi-Major Integrated Cheminformatics & Quantum Chemistry Platform
              </p>
            </div>
          </div>

          {/* System Status Indicators */}
          <div className="hidden lg:flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 font-mono text-slate-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>WASM GNN: Active</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 font-mono text-slate-300">
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
              <span>Anti-Black-Box AI: Online</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation Menu */}
        <div className="flex space-x-1 overflow-x-auto py-2.5 scrollbar-none border-t border-slate-900">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2 text-left transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? `${tab.activeBg} font-semibold shadow-md`
                    : "text-slate-400 hover:bg-slate-900/80 hover:text-slate-200"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "" : tab.color}`} />
                <div className="flex flex-col">
                  <span className="text-xs font-bold leading-none">{tab.label}</span>
                  <span className={`text-[10px] leading-tight mt-0.5 ${isActive ? "opacity-90" : "text-slate-400"}`}>
                    {tab.subLabel}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
