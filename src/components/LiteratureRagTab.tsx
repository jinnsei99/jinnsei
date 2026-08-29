import React, { useState } from "react";
import { PubMedArticle, RagLiteratureResult, ReActStep } from "../types";
import {
  Search,
  BookOpen,
  FileText,
  ExternalLink,
  BrainCircuit,
  Sparkles,
  CheckCircle2,
  ListFilter,
  BookmarkPlus,
  Compass,
  GraduationCap,
  Layers,
  Flame,
} from "lucide-react";

const SUGGESTED_QUERIES = [
  "Asymmetric organocatalysis with proline derivatives in aldol reactions",
  "Solid-state battery electrolytes: Garnet LLZO vs NASICON conductivity",
  "Metal-Organic Frameworks (MOFs) for direct air capture of carbon dioxide",
  "Bioorthogonal click chemistry: Tetrazine-trans-cyclooctene fast ligation",
  "Core-shell quantum dots photoluminescence blinking suppression",
];

export const LiteratureRagTab: React.FC = () => {
  const [queryInput, setQueryInput] = useState<string>("");
  const [fieldFilter, setFieldFilter] = useState<string>("organic");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [articles, setArticles] = useState<PubMedArticle[]>([]);
  const [ragResult, setRagResult] = useState<RagLiteratureResult | null>(null);
  const [showReActTrace, setShowReActTrace] = useState<boolean>(true);

  const handleExecuteSearch = async (queryToRun?: string) => {
    const q = queryToRun || queryInput;
    if (!q.trim()) return;

    setIsLoading(true);
    setRagResult(null);
    setArticles([]);

    try {
      const response = await fetch("/api/literature/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q.trim(), field: fieldFilter }),
      });

      const resData = await response.json();
      if (resData.success) {
        setArticles(resData.articles || []);
        setRagResult(resData.rag || null);
      }
    } catch (err) {
      console.error("Literature search error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div id="literature-rag-module" className="space-y-6 animate-fadeIn">
      {/* Header Banner */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/30">
                PubMed API & ChemRxivQuest
              </span>
              <span className="rounded bg-cyan-500/20 px-2 py-0.5 text-xs font-semibold text-cyan-300 border border-cyan-500/30">
                ReAct Agentic RAG Pipeline
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white">
              Academic Literature Search & Evidence-Grounded Chemistry Q&A
            </h2>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl">
              Conduct academic research with paper-qa methodology. Retrieve live PubMed peer-reviewed papers, view the ReAct reasoning trajectory, and verify citation evidence [1] transparently.
            </p>
          </div>
        </div>
      </div>

      {/* Search Bar & Suggested Topics */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5 rounded-xl border border-slate-800 bg-slate-900/80 p-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Ask research question or search papers (e.g. MOFs for carbon capture)..."
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleExecuteSearch()}
              className="w-full rounded-lg bg-slate-950 pl-10 pr-4 py-2.5 text-sm text-slate-200 border border-slate-800 focus:outline-none focus:border-cyan-500 font-sans"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={fieldFilter}
              onChange={(e) => setFieldFilter(e.target.value)}
              className="rounded-lg bg-slate-950 px-3 py-2.5 text-xs text-slate-300 border border-slate-800 focus:outline-none focus:border-cyan-500 font-medium"
            >
              <option value="organic">Organic Synthesis</option>
              <option value="physical">Physical / Quantum</option>
              <option value="inorganic">Inorganic & Materials</option>
              <option value="biochemistry">Biochemistry</option>
              <option value="analytical">Analytical Chemistry</option>
            </select>

            <button
              type="button"
              onClick={() => handleExecuteSearch()}
              disabled={isLoading}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:from-emerald-400 hover:to-teal-500 transition-all disabled:opacity-50 flex-shrink-0 cursor-pointer shadow-lg shadow-emerald-500/20"
            >
              <Sparkles className="h-4 w-4" />
              <span>{isLoading ? "Searching & Reasoning..." : "Search RAG"}</span>
            </button>
          </div>
        </div>

        {/* ChemRxivQuest Benchmark Chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Flame className="h-3.5 w-3.5 text-amber-400" />
            ChemRxivQuest Benchmark Prompts:
          </span>
          {SUGGESTED_QUERIES.map((sq, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setQueryInput(sq);
                handleExecuteSearch(sq);
              }}
              className="rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-1 text-xs text-slate-300 hover:border-slate-700 hover:bg-slate-800 transition-colors"
            >
              {sq.split(":")[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: RAG Synthesis + Retrieved PubMed Papers */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: ReAct Thought Trace & Synthesized Answer */}
        <div className="lg:col-span-8 space-y-4">
          {ragResult ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl backdrop-blur-md space-y-5">
              {/* Answer Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-emerald-400" />
                  <h3 className="text-base font-bold text-white">
                    Synthesized Academic Briefing
                  </h3>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-mono text-emerald-300 border border-emerald-500/30">
                    Confidence: {(ragResult.confidenceScore * 100).toFixed(0)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowReActTrace(!showReActTrace)}
                    className="text-cyan-400 hover:text-cyan-300 font-mono underline"
                  >
                    {showReActTrace ? "Hide ReAct Trace" : "Show ReAct Trace"}
                  </button>
                </div>
              </div>

              {/* Anti-Black-Box ReAct Reasoning Steps */}
              {showReActTrace && ragResult.reActThoughtTrace && (
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400 uppercase tracking-wider font-mono">
                    <BrainCircuit className="h-4 w-4" />
                    <span>ReAct Multi-Step Agent Trajectory:</span>
                  </div>
                  <div className="space-y-2">
                    {ragResult.reActThoughtTrace.map((step: ReActStep, sIdx: number) => (
                      <div key={sIdx} className="rounded border border-slate-800/80 bg-slate-900/60 p-2.5 text-xs text-slate-300">
                        <span className="font-mono font-bold text-indigo-300 block mb-0.5">
                          Stage {sIdx + 1}: [{step.stage}]
                        </span>
                        <span className="text-slate-300">{step.thought}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Main Synthesized Explanation with Citations */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Mechanistic Synthesis & Evidence:
                </h4>
                <div className="rounded-lg bg-slate-950/60 p-4 border border-slate-800/80 text-sm text-slate-200 leading-relaxed space-y-3">
                  <p>{ragResult.synthesizedAnswer}</p>
                </div>
              </div>

              {/* Key Takeaways */}
              {ragResult.keyTakeaways && ragResult.keyTakeaways.length > 0 && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-4 space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    Key Research Takeaways:
                  </span>
                  <div className="space-y-1">
                    {ragResult.keyTakeaways.map((takeaway: string, tIdx: number) => (
                      <div key={tIdx} className="flex items-start gap-2 text-xs text-slate-200">
                        <span className="text-emerald-400 font-bold">•</span>
                        <span>{takeaway}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested Follow-up Questions */}
              {ragResult.suggestedFurtherReading && ragResult.suggestedFurtherReading.length > 0 && (
                <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3.5 space-y-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                    Recommended Follow-up Research Directions:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {ragResult.suggestedFurtherReading.map((item: string, fIdx: number) => (
                      <button
                        key={fIdx}
                        type="button"
                        onClick={() => {
                          setQueryInput(item);
                          handleExecuteSearch(item);
                        }}
                        className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-cyan-300 hover:border-cyan-500/50 hover:bg-slate-800 transition-colors text-left"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/40 p-12 text-center space-y-3">
              <BookOpen className="h-10 w-10 text-slate-600 mx-auto" />
              <h3 className="text-base font-semibold text-slate-300">
                Ready for Chemical Literature Retrieval
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Type a chemistry query or select a ChemRxivQuest benchmark above to retrieve PubMed peer-reviewed papers and trigger the ReAct reasoning agent.
              </p>
            </div>
          )}
        </div>

        {/* Right: Retrieved PubMed Primary Sources */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-cyan-400" />
                <h4 className="text-sm font-bold text-white">Retrieved PubMed Papers</h4>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                {articles.length} Source{articles.length !== 1 ? "s" : ""}
              </span>
            </div>

            {articles.length > 0 ? (
              <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
                {articles.map((art: PubMedArticle, idx: number) => (
                  <div
                    key={art.pmid || idx}
                    className="rounded-lg border border-slate-800 bg-slate-950 p-3 space-y-2 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="rounded bg-cyan-500/20 px-2 py-0.5 text-[10px] font-mono font-bold text-cyan-300 border border-cyan-500/30">
                        [{idx + 1}] PMID: {art.pmid}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">{art.pubdate}</span>
                    </div>

                    <h5 className="text-xs font-semibold text-white leading-snug">
                      {art.title}
                    </h5>

                    <div className="text-[11px] text-slate-400">
                      <span className="block text-slate-300 font-medium">{art.source}</span>
                      <span className="text-slate-500">{art.authors}</span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-900">
                      {art.doi && (
                        <span className="text-[10px] font-mono text-slate-500 truncate max-w-[160px]">
                          DOI: {art.doi}
                        </span>
                      )}
                      <a
                        href={art.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 ml-auto"
                      >
                        <span>NCBI</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-6 text-center text-xs text-slate-500">
                No active search yet. Query PubMed database above.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
