import React, { useEffect, useRef, useState, useCallback } from "react";
import { RotateCw, ZoomIn, ZoomOut, Maximize2, RefreshCw, Eye, Sparkles, Layers, ShieldCheck } from "lucide-react";

declare global {
  interface Window {
    $3Dmol?: any;
  }
}

interface Viewer3DProps {
  id?: string;
  data: string; // PDB, SDF, or MOL format
  format?: "sdf" | "pdb" | "mol";
  title?: string;
  isProtein?: boolean;
  highlightSites?: Array<{ type: string; location: string }>;
  onAtomClick?: (atomInfo: { elem: string; serial?: number; resName?: string; charge?: number; raw: any }) => void;
  colorScheme?: "element" | "plddt" | "charge" | "fmo";
}

export const Viewer3D: React.FC<Viewer3DProps> = ({
  id = "chemverse-3d-viewer",
  data,
  format = "sdf",
  title = "3D Molecular Canvas",
  isProtein = false,
  highlightSites,
  onAtomClick,
  colorScheme = "element",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerInstanceRef = useRef<any>(null);

  const [styleMode, setStyleMode] = useState<"stick" | "sphere" | "cartoon" | "line">(isProtein ? "cartoon" : "stick");
  const [surfaceMode, setSurfaceMode] = useState<"none" | "vdw" | "sas" | "esp">("none");
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [selectedAtom, setSelectedAtom] = useState<string | null>(null);
  const [viewerReady, setViewerReady] = useState<boolean>(false);

  // Initialize or update 3Dmol viewer
  const initViewer = useCallback(() => {
    if (!containerRef.current) return;

    if (window.$3Dmol) {
      // Clear container
      containerRef.current.innerHTML = "";
      const config = { backgroundColor: 0x030712 }; // Slate-950
      const viewer = window.$3Dmol.createViewer(containerRef.current, config);
      viewerInstanceRef.current = viewer;

      const model = viewer.addModel(data, format);

      // Apply Style based on type & mode
      if (isProtein) {
        if (colorScheme === "plddt") {
          // Color by B-factor (plDDT)
          // >90: #0053D6, 70-90: #65CBF3, 50-70: #FFDB13, <50: #FF7D45
          const colorFunc = (atom: any) => {
            const b = atom.b || 85;
            if (b >= 90) return "#1d4ed8"; // Deep Blue (Very High)
            if (b >= 70) return "#06b6d4"; // Cyan (Confident)
            if (b >= 50) return "#eab308"; // Yellow (Low)
            return "#f97316"; // Orange (Very Low)
          };
          viewer.setStyle({}, { cartoon: { colorfunc: colorFunc } });
        } else {
          viewer.setStyle({}, { cartoon: { color: "spectrum" } });
        }
      } else {
        if (styleMode === "sphere") {
          viewer.setStyle({}, { sphere: { scale: 0.85 }, stick: { radius: 0.15 } });
        } else if (styleMode === "line") {
          viewer.setStyle({}, { line: {} });
        } else {
          // Default Stick / Ball & Stick
          viewer.setStyle(
            {},
            {
              stick: { radius: 0.18, colorscheme: "Jmol" },
              sphere: { scale: 0.28, colorscheme: "Jmol" },
            }
          );
        }

        // Highlight reactive sites if requested
        if (highlightSites && highlightSites.length > 0) {
          highlightSites.forEach((site) => {
            if (site.type === "Nucleophilic") {
              viewer.addStyle({ elem: "O" }, { sphere: { color: "#38bdf8", scale: 0.45 } });
            } else if (site.type === "Electrophilic") {
              viewer.addStyle({ elem: "C" }, { sphere: { color: "#f43f5e", scale: 0.42 } });
            }
          });
        }
      }

      // Add Surface if requested
      if (surfaceMode !== "none") {
        try {
          if (surfaceMode === "esp") {
            viewer.addSurface(window.$3Dmol.SurfaceType.VDW, {
              opacity: 0.75,
              colorscheme: {
                gradient: "rwb",
                min: -0.05,
                max: 0.05,
                prop: "charge",
              },
            });
          } else if (surfaceMode === "sas") {
            viewer.addSurface(window.$3Dmol.SurfaceType.SAS, {
              opacity: 0.6,
              color: "white",
            });
          } else {
            viewer.addSurface(window.$3Dmol.SurfaceType.VDW, {
              opacity: 0.65,
              colorscheme: "Jmol",
            });
          }
        } catch (surfErr) {
          console.warn("Surface render warning:", surfErr);
        }
      }

      // Set atom click handler for interactive structure tutoring
      model.setClickable({}, true, (atom: any) => {
        const atomLabel = `${atom.elem}${atom.serial ? ` #${atom.serial}` : ""} (${atom.resName || "Mol"})`;
        setSelectedAtom(atomLabel);
        if (onAtomClick) {
          onAtomClick({
            elem: atom.elem,
            serial: atom.serial,
            resName: atom.resName,
            charge: atom.charge,
            raw: atom,
          });
        }
      });

      viewer.zoomTo();
      viewer.render();
      setViewerReady(true);
    } else {
      // Fallback loader if 3Dmol script is still settling
      const timeout = setTimeout(() => {
        if (window.$3Dmol) {
          initViewer();
        }
      }, 400);
      return () => clearTimeout(timeout);
    }
  }, [data, format, isProtein, styleMode, surfaceMode, colorScheme, highlightSites, onAtomClick]);

  useEffect(() => {
    initViewer();
  }, [initViewer]);

  // Handle auto-spin
  useEffect(() => {
    let animId: number;
    if (isSpinning && viewerInstanceRef.current) {
      const spin = () => {
        if (viewerInstanceRef.current) {
          viewerInstanceRef.current.rotate(0.6, "y");
          animId = requestAnimationFrame(spin);
        }
      };
      animId = requestAnimationFrame(spin);
    }
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [isSpinning]);

  const handleZoom = (delta: number) => {
    if (viewerInstanceRef.current) {
      viewerInstanceRef.current.zoom(delta > 0 ? 1.2 : 0.8, 200);
    }
  };

  const handleReset = () => {
    if (viewerInstanceRef.current) {
      viewerInstanceRef.current.zoomTo();
      viewerInstanceRef.current.render();
    }
  };

  return (
    <div id={id} className="relative flex flex-col rounded-xl border border-slate-800 bg-slate-900/90 shadow-2xl overflow-hidden backdrop-blur-md">
      {/* 3D Toolbar Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-2.5 bg-slate-950/60">
        <div className="flex items-center gap-2">
          <div className="flex h-2.5 w-2.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-xs font-semibold tracking-wide uppercase text-slate-300 font-mono">
            {title}
          </span>
          {selectedAtom && (
            <span className="rounded bg-cyan-500/20 px-2 py-0.5 text-[11px] font-mono text-cyan-300 border border-cyan-500/30">
              Selected: {selectedAtom}
            </span>
          )}
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-1.5 text-xs">
          {/* Style Mode Selector */}
          {!isProtein ? (
            <div className="flex rounded-lg border border-slate-800 bg-slate-900 p-0.5">
              <button
                type="button"
                onClick={() => setStyleMode("stick")}
                className={`rounded px-2 py-1 text-xs transition-colors ${
                  styleMode === "stick" ? "bg-cyan-500 text-slate-950 font-semibold" : "text-slate-400 hover:text-slate-200"
                }`}
                title="Stick / Ball-and-Stick"
              >
                Ball & Stick
              </button>
              <button
                type="button"
                onClick={() => setStyleMode("sphere")}
                className={`rounded px-2 py-1 text-xs transition-colors ${
                  styleMode === "sphere" ? "bg-cyan-500 text-slate-950 font-semibold" : "text-slate-400 hover:text-slate-200"
                }`}
                title="Space-filling Van der Waals Spheres"
              >
                Spacefill (VDW)
              </button>
            </div>
          ) : (
            <div className="flex rounded-lg border border-slate-800 bg-slate-900 p-0.5">
              <button
                type="button"
                onClick={() => setStyleMode("cartoon")}
                className={`rounded px-2 py-1 text-xs transition-colors ${
                  styleMode === "cartoon" ? "bg-cyan-500 text-slate-950 font-semibold" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Ribbon Cartoon
              </button>
              <button
                type="button"
                onClick={() => setStyleMode("stick")}
                className={`rounded px-2 py-1 text-xs transition-colors ${
                  styleMode === "stick" ? "bg-cyan-500 text-slate-950 font-semibold" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                All-Atom
              </button>
            </div>
          )}

          {/* Surface Toggle */}
          <div className="flex rounded-lg border border-slate-800 bg-slate-900 p-0.5">
            <button
              type="button"
              onClick={() => setSurfaceMode(surfaceMode === "none" ? "vdw" : surfaceMode === "vdw" ? "esp" : "none")}
              className={`flex items-center gap-1 rounded px-2 py-1 transition-colors ${
                surfaceMode !== "none" ? "bg-indigo-600 text-white font-medium" : "text-slate-400 hover:text-slate-200"
              }`}
              title="Toggle Molecular Electron Density Surface"
            >
              <Layers className="h-3.5 w-3.5" />
              <span>{surfaceMode === "none" ? "Surface: Off" : surfaceMode === "vdw" ? "Surface: VDW" : "Surface: ESP"}</span>
            </button>
          </div>

          {/* Interactive Utility Buttons */}
          <button
            type="button"
            onClick={() => setIsSpinning(!isSpinning)}
            className={`rounded-lg border border-slate-800 p-1.5 transition-colors ${
              isSpinning ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40" : "bg-slate-900 text-slate-400 hover:text-slate-200"
            }`}
            title={isSpinning ? "Pause Auto-Rotation" : "Start Auto-Rotation"}
          >
            <RotateCw className={`h-3.5 w-3.5 ${isSpinning ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => handleZoom(1)}
            className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 text-slate-400 hover:text-slate-200"
            title="Zoom In"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleZoom(-1)}
            className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 text-slate-400 hover:text-slate-200"
            title="Zoom Out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 text-slate-400 hover:text-slate-200"
            title="Reset Camera Position"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Main 3D Canvas Viewport */}
      <div className="relative h-[380px] w-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 cursor-grab active:cursor-grabbing">
        <div ref={containerRef} className="h-full w-full" />

        {/* Floating plDDT Legend for Protein Mode */}
        {isProtein && colorScheme === "plddt" && (
          <div className="absolute bottom-3 left-3 flex flex-col gap-1 rounded-lg border border-slate-800 bg-slate-950/85 p-2.5 text-[11px] backdrop-blur-md shadow-lg pointer-events-none">
            <div className="flex items-center gap-1.5 font-semibold text-slate-300 mb-0.5">
              <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" />
              <span>AlphaFold / ESMFold plDDT Confidence</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-700" />
                <span className="text-slate-300">Very High (&gt;90)</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-cyan-500" />
                <span className="text-slate-300">Confident (70-90)</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
                <span className="text-slate-300">Low (50-70)</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
                <span className="text-slate-300">Very Low (&lt;50)</span>
              </div>
            </div>
          </div>
        )}

        {/* Floating Hints */}
        <div className="absolute bottom-3 right-3 rounded-lg bg-slate-950/80 px-2.5 py-1 text-[11px] text-slate-400 border border-slate-800/80 pointer-events-none backdrop-blur-sm">
          <span>Click atom for tutoring insights • Drag to rotate • Scroll to zoom</span>
        </div>
      </div>
    </div>
  );
};
