/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Navigation, NavTabId } from "./components/Navigation";
import { StructureTutorTab } from "./components/StructureTutorTab";
import { QuantumDerivationsTab } from "./components/QuantumDerivationsTab";
import { LiteratureRagTab } from "./components/LiteratureRagTab";
import { SpectralAnalysisTab } from "./components/SpectralAnalysisTab";
import { BiochemistryEsmFoldTab } from "./components/BiochemistryEsmFoldTab";
import { EdgeGnnInspector } from "./components/EdgeGnnInspector";
import { FlaskConical, ShieldCheck, Sparkles, BookOpen, Layers } from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTabId>("structure");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Platform Header & Navigation */}
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Tab Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === "structure" && <StructureTutorTab />}
        {activeTab === "derivation" && <QuantumDerivationsTab />}
        {activeTab === "literature" && <LiteratureRagTab />}
        {activeTab === "spectral" && <SpectralAnalysisTab />}
        {activeTab === "biochem" && <BiochemistryEsmFoldTab />}
        {activeTab === "gnn" && <EdgeGnnInspector />}
      </main>

      {/* Educational Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-6 mt-12 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-cyan-400" />
            <span className="font-mono font-semibold text-slate-300">
              ChemVerse Edutech
            </span>
            <span>• Undergraduate Multi-Major Integrated Cheminformatics</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-slate-400 font-mono text-[11px]">
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              Anti-Black-Box AI
            </span>
            <span>•</span>
            <span>WASM/ONNX Web</span>
            <span>•</span>
            <span>Py3Dmol WebGL</span>
            <span>•</span>
            <span>SymPy & KaTeX</span>
            <span>•</span>
            <span>ESMFold Proteomics</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

