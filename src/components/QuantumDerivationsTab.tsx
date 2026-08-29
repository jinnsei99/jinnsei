import React, { useState } from "react";
import { DERIVATION_TOPICS } from "../data/curriculumData";
import { DerivationTopic, DerivationVariable, DerivationStep } from "../types";
import { KatexMath } from "./KatexMath";
import {
  Calculator,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  HelpCircle,
  Sparkles,
  Info,
  Layers,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Code2,
  Atom,
} from "lucide-react";

export const QuantumDerivationsTab: React.FC = () => {
  const [selectedTopic, setSelectedTopic] = useState<DerivationTopic>(DERIVATION_TOPICS[0]);
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0);
  const [selectedVariable, setSelectedVariable] = useState<DerivationVariable | null>(null);
  const [customEquationInput, setCustomEquationInput] = useState<string>("");
  const [isLoadingAi, setIsLoadingAi] = useState<boolean>(false);
  const [customDerivation, setCustomDerivation] = useState<any>(null);

  const activeTopic = customDerivation || selectedTopic;
  const currentStep: DerivationStep = activeTopic.steps[currentStepIdx] || activeTopic.steps[0];

  const handleRequestAiDerivation = async () => {
    if (!customEquationInput.trim()) return;
    setIsLoadingAi(true);
    try {
      const response = await fetch("/api/tutor/derivation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicTitle: customEquationInput.trim(),
          customEquation: customEquationInput.trim(),
        }),
      });

      const data = await response.json();
      if (data.success && data.data) {
        setCustomDerivation(data.data);
        setCurrentStepIdx(0);
      }
    } catch (err) {
      console.error("AI derivation error:", err);
    } finally {
      setIsLoadingAi(false);
    }
  };

  return (
    <div id="quantum-derivations-module" className="space-y-6 animate-fadeIn">
      {/* Header Banner */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-xs font-semibold text-indigo-400 border border-indigo-500/30">
                SymPy & KaTeX Engine
              </span>
              <span className="rounded bg-cyan-500/20 px-2 py-0.5 text-xs font-semibold text-cyan-300 border border-cyan-500/30">
                Step-by-Step Quantum Calculus
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white">
              Physical & Quantum Chemistry Equation Derivation
            </h2>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl">
              Break down complex derivations step-by-step. Inspect the physical meaning of every operator and variable, avoid common mathematical traps, and explore the origin of quantum discreteness.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono">
              Step {currentStepIdx + 1} of {activeTopic.steps.length}
            </span>
          </div>
        </div>
      </div>

      {/* Topic Chips and Custom Formula Input */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Curated Topic Chips */}
        <div className="md:col-span-8 flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 p-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
            <Calculator className="h-3.5 w-3.5 text-indigo-400" />
            Core Derivations:
          </span>
          {DERIVATION_TOPICS.map((topic) => {
            const isSelected = !customDerivation && selectedTopic.id === topic.id;
            return (
              <button
                key={topic.id}
                type="button"
                onClick={() => {
                  setSelectedTopic(topic);
                  setCustomDerivation(null);
                  setCurrentStepIdx(0);
                  setSelectedVariable(null);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  isSelected
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-semibold"
                    : "bg-slate-800/80 text-slate-300 hover:bg-slate-700/80 hover:text-white border border-slate-700/50"
                }`}
              >
                {topic.title}
              </button>
            );
          })}
        </div>

        {/* Custom Derivation Request */}
        <div className="md:col-span-4 flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 p-2">
          <input
            type="text"
            placeholder="Derive topic (e.g. Clausius-Clapeyron)"
            value={customEquationInput}
            onChange={(e) => setCustomEquationInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRequestAiDerivation()}
            className="w-full rounded-lg bg-slate-950 px-3 py-1.5 text-xs text-slate-200 border border-slate-800 focus:outline-none focus:border-indigo-500 font-mono"
          />
          <button
            type="button"
            onClick={handleRequestAiDerivation}
            disabled={isLoadingAi}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors disabled:opacity-50 flex-shrink-0 cursor-pointer"
          >
            {isLoadingAi ? "Solving..." : "Derive"}
          </button>
        </div>
      </div>

      {/* Main Derivation Canvas: Mathematical Progression & Interactive Variable Guide */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Step Card & KaTeX Display */}
        <div className="lg:col-span-8 space-y-4">
          {/* Active Step Card */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl backdrop-blur-md space-y-5">
            {/* Step Navigation & Title */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
              <div>
                <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-indigo-400">
                  Step {currentStep.stepNumber} of {activeTopic.steps.length} • {activeTopic.domain}
                </span>
                <h3 className="text-base font-bold text-white mt-0.5">
                  {currentStep.stepTitle}
                </h3>
              </div>

              {/* Step Navigation Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentStepIdx(Math.max(0, currentStepIdx - 1))}
                  disabled={currentStepIdx === 0}
                  className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Previous</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStepIdx(Math.min(activeTopic.steps.length - 1, currentStepIdx + 1))}
                  disabled={currentStepIdx === activeTopic.steps.length - 1}
                  className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <span>Next Step</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* LaTeX Mathematical Formula Display */}
            <div className="rounded-xl border border-indigo-500/30 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-6 text-center shadow-inner overflow-x-auto">
              <KatexMath
                math={currentStep.latexEquation}
                displayMode={true}
                className="text-lg md:text-xl text-indigo-200"
              />
            </div>

            {/* Mathematical Operation Description */}
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300 uppercase tracking-wider">
                <Layers className="h-3.5 w-3.5" />
                <span>Mathematical Operation:</span>
              </div>
              <p className="text-xs font-mono text-slate-300 leading-relaxed">
                {currentStep.mathematicalOperation}
              </p>
            </div>

            {/* Detailed Conceptual Explanation */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300 uppercase tracking-wider">
                <Info className="h-3.5 w-3.5" />
                <span>Physical Rationale & Pedagogical Breakdown:</span>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed bg-slate-950/40 p-3.5 rounded-lg border border-slate-800/80">
                {currentStep.detailedExplanation}
              </p>
            </div>

            {/* SymPy Code Equivalent */}
            {currentStep.sympyEquivalent && (
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 flex items-start gap-2.5">
                <Code2 className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                <div className="overflow-x-auto w-full">
                  <span className="text-[11px] font-mono text-slate-400 block mb-0.5">SymPy Symbolic Representation:</span>
                  <code className="text-xs font-mono text-emerald-300">{currentStep.sympyEquivalent}</code>
                </div>
              </div>
            )}

            {/* Key Takeaway Banner */}
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-3.5 flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-xs font-bold text-emerald-300">Key Takeaway:</span>
                <p className="text-xs text-slate-200 mt-0.5">{currentStep.keyTakeaway}</p>
              </div>
            </div>
          </div>

          {/* Derivation Step Progress Bar */}
          <div className="flex items-center justify-between gap-1.5 rounded-xl border border-slate-800 bg-slate-900/80 p-3">
            {activeTopic.steps.map((st: DerivationStep, idx: number) => {
              const isCurrent = idx === currentStepIdx;
              const isPast = idx < currentStepIdx;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentStepIdx(idx)}
                  className={`flex-1 py-2 px-1 text-center rounded-lg transition-all text-xs font-mono font-medium ${
                    isCurrent
                      ? "bg-indigo-600 text-white font-bold shadow-md"
                      : isPast
                      ? "bg-indigo-950/60 text-indigo-300 border border-indigo-800/40"
                      : "bg-slate-950 text-slate-500 border border-slate-800"
                  }`}
                >
                  Step {idx + 1}
                </button>
              );
            })}
          </div>

          {/* Final Form & Physical Interpretation */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <Atom className="h-4 w-4 text-cyan-400" />
              <h4 className="text-sm font-bold text-white">Final Derived Equation & Quantum Significance</h4>
            </div>

            <div className="rounded-lg bg-slate-950 p-4 text-center border border-slate-800">
              <KatexMath math={activeTopic.finalForm.latexEquation} displayMode={true} className="text-lg text-cyan-300" />
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/50 p-3 rounded-lg border border-slate-800/80">
              {activeTopic.finalForm.interpretation}
            </p>
          </div>
        </div>

        {/* Right: Interactive Variable Guide & Anti-Black-Box Inspection */}
        <div className="lg:col-span-4 space-y-4">
          {/* Interactive Variable Inspector (Click/Hover) */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-indigo-400" />
                <h4 className="text-sm font-bold text-white">Variable Symbol Guide</h4>
              </div>
              <span className="text-[11px] font-mono text-slate-400">Click to Inspect</span>
            </div>

            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {activeTopic.variablesGuide.map((v: DerivationVariable, vIdx: number) => {
                const isSelected = selectedVariable?.symbol === v.symbol;
                return (
                  <button
                    key={vIdx}
                    type="button"
                    onClick={() => setSelectedVariable(v)}
                    className={`w-full text-left rounded-lg border p-2.5 transition-all text-xs ${
                      isSelected
                        ? "border-indigo-500 bg-indigo-950/40 text-white"
                        : "border-slate-800 bg-slate-950/70 text-slate-300 hover:border-slate-700 hover:bg-slate-900"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-300 font-mono text-sm">
                        <KatexMath math={v.symbol} />
                      </span>
                      <span className="font-mono text-[10px] text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                        <KatexMath math={v.unit} />
                      </span>
                    </div>
                    <div className="font-semibold text-slate-200 mt-1">{v.name}</div>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{v.physicalMeaning}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fundamental Postulates */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 block flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
              Starting Assumptions & Postulates
            </span>
            <div className="space-y-1.5">
              {activeTopic.fundamentalPostulates.map((postulate: string, pIdx: number) => (
                <div key={pIdx} className="rounded-lg bg-slate-950/60 p-2.5 border border-slate-800 text-xs text-slate-300">
                  <KatexMath math={postulate} />
                </div>
              ))}
            </div>
          </div>

          {/* Common Pitfalls & Traps (Anti-Black-Box) */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 space-y-2.5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                Common Student Pitfalls
              </h4>
            </div>
            <div className="space-y-1.5">
              {activeTopic.commonPitfalls.map((pitfall: string, pfIdx: number) => (
                <div key={pfIdx} className="flex items-start gap-2 text-xs text-slate-300">
                  <span className="text-amber-400 font-bold">•</span>
                  <span>{pitfall}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
