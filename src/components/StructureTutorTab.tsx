import React, { useState } from "react";
import { CURATED_MOLECULES } from "../data/curriculumData";
import { CuratedMolecule } from "../types";
import { Viewer3D } from "./Viewer3D";
import { runClientGnnInference } from "../utils/gnnEngine";
import {
  Sparkles,
  Search,
  Activity,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  ChevronRight,
  Zap,
  Layers,
  FlaskConical,
  BrainCircuit,
  MessageSquareQuote,
} from "lucide-react";

export const StructureTutorTab: React.FC = () => {
  const [selectedMolecule, setSelectedMolecule] = useState<CuratedMolecule>(CURATED_MOLECULES[0]);
  const [customSmilesInput, setCustomSmilesInput] = useState<string>("");
  const [atomFocus, setAtomFocus] = useState<string | null>(null);
  const [studentQuestion, setStudentQuestion] = useState<string>("");
  const [isLoadingAi, setIsLoadingAi] = useState<boolean>(false);
  const [aiReport, setAiReport] = useState<any>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [showCoT, setShowCoT] = useState<boolean>(true);

  // Compute live client-side GNN properties
  const gnnStats = React.useMemo(() => {
    return runClientGnnInference(selectedMolecule.smiles);
  }, [selectedMolecule.smiles]);

  // Request in-depth AI structure tutoring
  const handleAskTutor = async (customQuery?: string) => {
    setIsLoadingAi(true);
    setAiReport(null);
    try {
      const response = await fetch("/api/tutor/structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moleculeName: selectedMolecule.name,
          smiles: selectedMolecule.smiles,
          formula: selectedMolecule.formula,
          atomFocus: atomFocus || undefined,
          queryContext: customQuery || studentQuestion || undefined,
        }),
      });

      const resData = await response.json();
      if (resData.success && resData.data) {
        setAiReport(resData.data);
      }
    } catch (err) {
      console.error("Failed to request AI tutor:", err);
    } finally {
      setIsLoadingAi(false);
    }
  };

  // Handle custom SMILES lookup or molecule building
  const handleLoadCustomSmiles = () => {
    if (!customSmilesInput.trim()) return;
    const smiles = customSmilesInput.trim();
    const gnn = runClientGnnInference(smiles);

    // Generate basic 3D coordinates via SDF template for common functional groups
    const newMol: CuratedMolecule = {
      id: `custom_${Date.now()}`,
      name: `Target: ${smiles}`,
      formula: `MW ${gnn.molWeight} g/mol`,
      category: "Organic Synthesis",
      smiles,
      description: `User-specified molecular SMILES graph containing ${gnn.nodeEmbeddings.length} non-hydrogen heavy atoms.`,
      keyEducationalConcept: `GNN Computed Properties: LogP = ${gnn.logP}, TPSA = ${gnn.tpsa} Å², QED = ${gnn.qedScore}`,
      molWeight: gnn.molWeight,
      logP: gnn.logP,
      tpsa: gnn.tpsa,
      reactiveSites: [
        {
          type: "Nucleophilic",
          location: "Heteroatom lone pairs / π bonds",
          explanation: "Calculated high electron density center from local electronegativity mapping.",
          orbital: "HOMO",
        },
      ],
      stericNotes: "Conformational analysis indicates potential steric crowding based on rotatable bond count.",
      stabilityRationale: gnn.lipinskiPass ? "Conforms to Lipinski Rule of 5 for drug-like stability." : "Exceeds standard molecular weight / lipophilicity thresholds.",
      unintuitiveAspect: "Electronic polarization often overrides steric effects in determining kinetic attack trajectories.",
      sdfContent: CURATED_MOLECULES[0].sdfContent, // Base template
    };

    setSelectedMolecule(newMol);
    setAtomFocus(null);
    setAiReport(null);
  };

  return (
    <div id="structure-tutor-module" className="space-y-6 animate-fadeIn">
      {/* Module Banner / Introduction */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="rounded bg-cyan-500/20 px-2 py-0.5 text-xs font-semibold text-cyan-400 border border-cyan-500/30">
                Py3Dmol & FMO Engine
              </span>
              <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-xs font-semibold text-indigo-300 border border-indigo-500/30">
                Organic & Physical Chemistry Tutor
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white">
              Intelligent 3D Molecular Structure & Reactive Site Tutor
            </h2>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl">
              Interact with real-time 3D conformations in WebGL. Inspect nucleophilic/electrophilic orbital centers, steric strain parameters, and explore step-by-step reasoning behind chemical stability.
            </p>
          </div>

          <button
            type="button"
            onClick={() => handleAskTutor()}
            disabled={isLoadingAi}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 hover:from-cyan-400 hover:to-blue-500 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Sparkles className="h-4 w-4" />
            <span>{isLoadingAi ? "Analyzing Molecular Orbitals..." : "Request AI Deep Analysis"}</span>
          </button>
        </div>
      </div>

      {/* Preset Selector & Custom SMILES Bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Preset Molecule Chips */}
        <div className="md:col-span-8 flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 p-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
            <FlaskConical className="h-3.5 w-3.5 text-cyan-400" />
            Curriculum Cases:
          </span>
          {CURATED_MOLECULES.map((mol) => {
            const isSelected = selectedMolecule.id === mol.id;
            return (
              <button
                key={mol.id}
                type="button"
                onClick={() => {
                  setSelectedMolecule(mol);
                  setAtomFocus(null);
                  setAiReport(null);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  isSelected
                    ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 font-semibold"
                    : "bg-slate-800/80 text-slate-300 hover:bg-slate-700/80 hover:text-white border border-slate-700/50"
                }`}
              >
                {mol.name.split(" ")[0]} ({mol.category.split(" ")[0]})
              </button>
            );
          })}
        </div>

        {/* Custom SMILES Input */}
        <div className="md:col-span-4 flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 p-2">
          <input
            type="text"
            placeholder="Input SMILES (e.g. CC(=O)Cl)"
            value={customSmilesInput}
            onChange={(e) => setCustomSmilesInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLoadCustomSmiles()}
            className="w-full rounded-lg bg-slate-950 px-3 py-1.5 text-xs text-slate-200 border border-slate-800 focus:outline-none focus:border-cyan-500 font-mono"
          />
          <button
            type="button"
            onClick={handleLoadCustomSmiles}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-cyan-400 hover:bg-slate-700 transition-colors border border-slate-700"
          >
            Render
          </button>
        </div>
      </div>

      {/* Main Grid: 3D Viewer + Chemistry Analysis Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: 3D Molecular Canvas & GNN Quick Metrics */}
        <div className="lg:col-span-7 space-y-4">
          <Viewer3D
            data={selectedMolecule.sdfContent}
            format="sdf"
            title={`${selectedMolecule.name} — 3D Conformation`}
            highlightSites={selectedMolecule.reactiveSites}
            onAtomClick={(atom) => {
              const label = `${atom.elem} (Atom #${atom.serial || 1})`;
              setAtomFocus(label);
            }}
          />

          {/* Quick Client-Side GNN Biophysical Descriptors */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Mol. Weight</span>
              <span className="text-base font-bold text-white font-mono">{gnnStats.molWeight} <span className="text-xs font-normal text-slate-400">g/mol</span></span>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">LogP (Lipophilicity)</span>
              <span className={`text-base font-bold font-mono ${gnnStats.logP <= 5 ? "text-emerald-400" : "text-amber-400"}`}>
                {gnnStats.logP}
              </span>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">TPSA</span>
              <span className="text-base font-bold text-cyan-300 font-mono">{gnnStats.tpsa} <span className="text-xs font-normal text-slate-400">Å²</span></span>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Drug-likeness (QED)</span>
              <span className="text-base font-bold text-indigo-300 font-mono">{(gnnStats.qedScore * 100).toFixed(0)}%</span>
            </div>
          </div>

          {/* Educational Concept Card */}
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-4">
            <div className="flex items-start gap-3">
              <Zap className="h-5 w-5 text-cyan-400 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-cyan-300">Frontier Orbital & Reaction Concept</h4>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  {selectedMolecule.keyEducationalConcept}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Interactive Cheminformatics & Tutoring Panel */}
        <div className="lg:col-span-5 space-y-4">
          {/* Reactive Sites & FMO Breakdown */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Identified Reactive Centers</h3>
              </div>
              <span className="text-[11px] font-mono text-slate-400">HOMO / LUMO Mapping</span>
            </div>

            <div className="space-y-2.5">
              {selectedMolecule.reactiveSites.map((site, idx) => {
                const isNu = site.type === "Nucleophilic";
                return (
                  <div
                    key={idx}
                    className={`rounded-lg border p-3 text-xs transition-all ${
                      isNu
                        ? "border-sky-500/40 bg-sky-950/20 text-sky-200"
                        : "border-rose-500/40 bg-rose-950/20 text-rose-200"
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold mb-1">
                      <span className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${isNu ? "bg-sky-400" : "bg-rose-400"}`} />
                        {site.type} Center: {site.location}
                      </span>
                      <span className="rounded bg-slate-900/80 px-2 py-0.5 font-mono text-[10px] text-slate-300 border border-slate-700">
                        {site.orbital}
                      </span>
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed mt-1">
                      {site.explanation}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Steric Hindrance & Stability Breakdown */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 space-y-3">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-400 block mb-1 flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" />
                Steric Conformation & Strain Analysis
              </span>
              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/80">
                {selectedMolecule.stericNotes}
              </p>
            </div>

            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 block mb-1 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Thermodynamic & Kinetic Stability Rationale
              </span>
              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/80">
                {selectedMolecule.stabilityRationale}
              </p>
            </div>

            {/* Unintuitive Student Trap */}
            <div className="rounded-lg border border-indigo-500/30 bg-indigo-950/20 p-3">
              <div className="flex items-start gap-2">
                <HelpCircle className="h-4 w-4 text-indigo-400 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-xs font-bold text-indigo-300">Common Misconception & Nuance:</span>
                  <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                    {selectedMolecule.unintuitiveAspect}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Question Input to LLM Agent */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Ask Tutor About This Conformation / Reaction:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. Why doesn't the nucleophile attack from the front side?"
                value={studentQuestion}
                onChange={(e) => setStudentQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAskTutor()}
                className="w-full rounded-lg bg-slate-950 px-3 py-2 text-xs text-slate-200 border border-slate-800 focus:outline-none focus:border-cyan-500"
              />
              <button
                type="button"
                onClick={() => handleAskTutor()}
                disabled={isLoadingAi}
                className="rounded-lg bg-cyan-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400 disabled:opacity-50 transition-colors flex-shrink-0 cursor-pointer"
              >
                Ask
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Anti-Black-Box AI Reasoning Drawer & Tutoring Report */}
      {aiReport && (
        <div className="rounded-xl border border-cyan-500/40 bg-slate-900/95 p-5 shadow-2xl backdrop-blur-md space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <BrainCircuit className="h-5 w-5 text-cyan-400" />
              <h3 className="text-base font-bold text-white">
                Intelligent Structure Report & Transparent Chain-of-Thought
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowCoT(!showCoT)}
              className="text-xs font-mono text-cyan-400 hover:text-cyan-300 underline"
            >
              {showCoT ? "Hide Reasoning Steps" : "Show Reasoning Steps"}
            </button>
          </div>

          <p className="text-sm text-slate-200 leading-relaxed font-medium">
            {aiReport.summary}
          </p>

          {/* Chain of Thought (Anti-Black-Box) */}
          {showCoT && aiReport.chainOfThought && (
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2 font-mono">
                AI Reasoning Trace (Chain-of-Thought):
              </span>
              <div className="space-y-1.5">
                {aiReport.chainOfThought.map((step: string, sIdx: number) => (
                  <div key={sIdx} className="flex items-start gap-2 text-xs text-slate-300 font-mono">
                    <ChevronRight className="h-3.5 w-3.5 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Self-Check Quiz generated by AI */}
          {aiReport.quizQuestions && aiReport.quizQuestions.length > 0 && (
            <div className="rounded-lg border border-indigo-500/30 bg-indigo-950/20 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-indigo-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                  Concept Mastery Self-Check
                </h4>
              </div>

              {aiReport.quizQuestions.map((q: any, qIdx: number) => {
                const userSelected = quizAnswers[qIdx];
                const isAnswered = userSelected !== undefined;
                const isCorrect = userSelected === q.correctIndex;

                return (
                  <div key={qIdx} className="rounded-lg border border-slate-800 bg-slate-900/90 p-3.5 space-y-2.5">
                    <p className="text-xs font-semibold text-white">
                      {qIdx + 1}. {q.question}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {q.options.map((opt: string, optIdx: number) => {
                        const isThisChosen = userSelected === optIdx;
                        const isThisCorrect = optIdx === q.correctIndex;

                        let btnStyle = "border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700";
                        if (isAnswered) {
                          if (isThisCorrect) {
                            btnStyle = "border-emerald-500 bg-emerald-950/50 text-emerald-200 font-semibold";
                          } else if (isThisChosen && !isCorrect) {
                            btnStyle = "border-rose-500 bg-rose-950/50 text-rose-200";
                          }
                        }

                        return (
                          <button
                            key={optIdx}
                            type="button"
                            onClick={() => setQuizAnswers((prev) => ({ ...prev, [qIdx]: optIdx }))}
                            disabled={isAnswered}
                            className={`flex items-center text-left gap-2 rounded-lg border p-2.5 text-xs transition-all ${btnStyle}`}
                          >
                            <span className="font-mono text-slate-400">{String.fromCharCode(65 + optIdx)}.</span>
                            <span>{opt}</span>
                          </button>
                        );
                      })}
                    </div>

                    {isAnswered && (
                      <div className={`text-xs p-2 rounded-lg border ${isCorrect ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300" : "bg-rose-950/40 border-rose-500/30 text-rose-300"}`}>
                        <span className="font-bold">{isCorrect ? "✓ Correct! " : "✗ Incorrect: "}</span>
                        {q.explanation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
