import express, { Request, Response } from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));

// Lazy initialize Gemini client
let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is missing");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Health check endpoint
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "ChemVerse Server", timestamp: new Date().toISOString() });
});

// 1. Structure Tutor AI Endpoint
app.post("/api/tutor/structure", async (req: Request, res: Response) => {
  try {
    const { moleculeName, smiles, formula, atomFocus, queryContext } = req.body;
    const ai = getAI();

    const prompt = `You are a world-class Cheminformatics and Organic Chemistry Professor tutoring undergraduate students in the 'ChemVerse' platform.
Your goal is to provide a deeply pedagogical, transparent "Anti-Black-Box" analysis of the given molecular structure.

Target Molecule:
- Name: ${moleculeName || "Custom Molecule"}
- SMILES: ${smiles || "N/A"}
- Formula: ${formula || "N/A"}
${atomFocus ? `- Student Clicked Atom / Functional Group: ${atomFocus}` : ""}
${queryContext ? `- Specific Student Question: ${queryContext}` : ""}

Please generate an in-depth structured JSON response covering:
1. "stericAnalysis": Discussion of steric hindrance, conformational preferences (e.g. chair/boat, syn/anti, eclipsed/staggered, 1,3-diaxial interactions, A-values if applicable), and geometric crowding.
2. "reactiveSites": Explicit identification of nucleophilic sites (high electron density, lone pairs, π-bonds, HOMO) and electrophilic sites (carbocations, carbonyl carbons, low electron density, LUMO), plus polar bonds and dipole moments.
3. "stabilityRationale": Why this molecule/conformer is thermodynamically or kinetically stable vs unstable (e.g. resonance delocalization, aromaticity Huckel 4n+2 rule, hyperconjugation, ring strain, hydrogen bonding).
4. "unintuitiveNuances": Common misconceptions and unintuitive aspects students often misunderstand about this system.
5. "chainOfThought": Transparent step-by-step reasoning steps leading to these conclusions.
6. "quizQuestions": 2 quick self-check multiple-choice questions for the student with question, options (array of 4 strings), correctIndex (0-3), and explanation.

Respond strictly in valid JSON format matching this schema:
{
  "summary": "Concise 2-sentence executive overview",
  "stericAnalysis": "...",
  "reactiveSites": [
    { "type": "Nucleophilic" | "Electrophilic" | "Radical" | "Acidic/Basic", "location": "...", "explanation": "...", "orbital": "HOMO/LUMO/n/pi/sigma*" }
  ],
  "stabilityRationale": "...",
  "unintuitiveNuances": "...",
  "chainOfThought": [
    "Step 1: Analyzed hybridization and formal charges...",
    "Step 2: Evaluated resonance contributors and delocalization energy..."
  ],
  "quizQuestions": [
    {
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "correctIndex": 0,
      "explanation": "..."
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });

    const text = response.text || "{}";
    const data = JSON.parse(text);
    res.json({ success: true, data });
  } catch (error: any) {
    console.error("Structure tutor error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to generate structure tutoring analysis",
    });
  }
});

// 2. Quantum / Physical Chemistry Equation Derivation AI Endpoint
app.post("/api/tutor/derivation", async (req: Request, res: Response) => {
  try {
    const { topicId, topicTitle, customEquation, startCondition, endCondition } = req.body;
    const ai = getAI();

    const prompt = `You are a Theoretical Physical Chemistry and Quantum Mechanics Professor using SymPy-style symbolic rigor to teach undergraduate students.
Topic: ${topicTitle || topicId || "Quantum Mechanics Derivation"}
${customEquation ? `Input Base Equation: ${customEquation}` : ""}
${startCondition ? `Starting Postulates/Assumptions: ${startCondition}` : ""}
${endCondition ? `Target Quantity to Derive: ${endCondition}` : ""}

Provide a rigorous, step-by-step algebraic and calculus derivation that breaks down the math into transparent sequential steps with LaTeX formatted equations and physical interpretations for EVERY variable and operator symbol.

Respond strictly in valid JSON matching this schema:
{
  "title": "Full title of derivation",
  "domain": "Quantum Mechanics" | "Thermodynamics" | "Chemical Kinetics" | "Statistical Mechanics" | "Spectroscopy",
  "physicalSystem": "Description of the physical system (e.g. 1D infinite square well, transition state activated complex)",
  "fundamentalPostulates": [
    "Postulate 1: Time-independent Schrödinger equation H_psi = E_psi",
    "Postulate 2: ..."
  ],
  "variablesGuide": [
    { "symbol": "LaTeX symbol e.g. \\\\hbar", "name": "Reduced Planck Constant", "unit": "J\\\\cdot s", "physicalMeaning": "Quantum of angular momentum" }
  ],
  "steps": [
    {
      "stepNumber": 1,
      "stepTitle": "Setting up the Differential Equation",
      "latexEquation": "-\\frac{\\\\hbar^2}{2m} \\frac{d^2\\\\psi(x)}{dx^2} + V(x)\\\\psi(x) = E\\\\psi(x)",
      "mathematicalOperation": "Substitution of Hamiltonian operator in position representation",
      "detailedExplanation": "Inside the box 0 < x < L, potential V(x) = 0. The equation simplifies to an ordinary second-order linear ODE.",
      "sympyEquivalent": "Eq(-hbar**2/(2*m)*diff(psi(x), x, 2), E*psi(x))",
      "keyTakeaway": "..."
    }
  ],
  "finalForm": {
    "latexEquation": "...",
    "interpretation": "Physical interpretation of the derived result (e.g. zero-point energy, quantization integer n)"
  },
  "commonPitfalls": [
    "Forgetting to apply continuity of derivative at finite boundaries",
    "Confusing energy levels with wave functions"
  ]
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    });

    const text = response.text || "{}";
    const data = JSON.parse(text);
    res.json({ success: true, data });
  } catch (error: any) {
    console.error("Derivation tutor error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to generate derivation steps",
    });
  }
});

// 3. Literature Search & RAG Q&A (PubMed + ChemRxivQuest style ReAct Agent)
app.post("/api/literature/search", async (req: Request, res: Response) => {
  try {
    const { query, field = "chemistry" } = req.body;
    if (!query) {
      return res.status(400).json({ success: false, error: "Query is required" });
    }

    // Step A: Search PubMed NCBI E-Utilities API
    const term = encodeURIComponent(`${query} AND (${field}[Title/Abstract] OR chemistry[Title/Abstract] OR synthesis[Title/Abstract])`);
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${term}&retmode=json&retmax=5&sort=relevance`;
    
    let articles: any[] = [];
    try {
      const searchRes = await fetch(searchUrl, { headers: { "User-Agent": "ChemVerse/1.0" } });
      const searchJson = await searchRes.json();
      const idList = searchJson.esearchresult?.idlist || [];

      if (idList.length > 0) {
        const idsStr = idList.join(",");
        const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${idsStr}&retmode=json`;
        const summaryRes = await fetch(summaryUrl, { headers: { "User-Agent": "ChemVerse/1.0" } });
        const summaryJson = await summaryRes.json();
        const result = summaryJson.result || {};

        articles = idList.map((id: string) => {
          const item = result[id] || {};
          return {
            pmid: id,
            title: item.title || "No title",
            source: item.source || "Academic Journal",
            pubdate: item.pubdate || "Recent",
            authors: (item.authors || []).map((a: any) => a.name).slice(0, 3).join(", ") + (item.authors?.length > 3 ? " et al." : ""),
            doi: item.articleids?.find((x: any) => x.idtype === "doi")?.value || "",
            url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
          };
        });
      }
    } catch (apiErr) {
      console.warn("PubMed API fetch fallback:", apiErr);
    }

    // Step B: Use Gemini to synthesize literature context + RAG reasoning
    const ai = getAI();
    const ragPrompt = `You are an expert Chemical Literature RAG Agent built on the ChemRxivQuest benchmark and paper-qa paradigms.
The student has asked the following academic research question:
"${query}"

Retrieved Scientific Papers from PubMed Database:
${JSON.stringify(articles, null, 2)}

Perform a transparent ReAct (Reasoning + Action) chain-of-thought analysis:
1. Analyze the student query and decompose into key chemical/molecular mechanisms.
2. Evaluate retrieved evidence, cross-reference scientific consensus, reaction mechanisms, and quantitative findings.
3. Formulate an evidence-grounded answer with explicit citation brackets like [1], [2] referencing the papers.

Respond strictly in JSON format:
{
  "question": "${query.replace(/"/g, '\\"')}",
  "reActThoughtTrace": [
    { "stage": "Decomposition", "thought": "Identified target mechanism and relevant chemical domain..." },
    { "stage": "Evidence Retrieval", "thought": "Extracted key findings from retrieved literature..." },
    { "stage": "Synthesis & Cross-Validation", "thought": "Resolved discrepancies in experimental yields/mechanisms..." }
  ],
  "synthesizedAnswer": "Comprehensive academic explanation with [1], [2] citation markers, mechanism breakdowns, and quantitative insights.",
  "keyTakeaways": [
    "Key takeaway 1...",
    "Key takeaway 2...",
    "Key takeaway 3..."
  ],
  "confidenceScore": 0.94,
  "suggestedFurtherReading": [
    "Sub-topic or follow-up question 1",
    "Sub-topic or follow-up question 2"
  ]
}`;

    const ragResponse = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: ragPrompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });

    const ragData = JSON.parse(ragResponse.text || "{}");
    res.json({
      success: true,
      articles,
      rag: ragData,
    });
  } catch (error: any) {
    console.error("Literature search error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to execute literature search and RAG synthesis",
    });
  }
});

// 4. ESMFold Protein Structure Prediction Proxy Endpoint
app.post("/api/biochem/esmfold", async (req: Request, res: Response) => {
  try {
    const { sequence, proteinName } = req.body;
    if (!sequence || typeof sequence !== "string") {
      return res.status(400).json({ success: false, error: "Amino acid sequence is required" });
    }

    const cleanSeq = sequence.replace(/[^A-Za-z]/g, "").toUpperCase();
    if (cleanSeq.length < 5 || cleanSeq.length > 400) {
      return res.status(400).json({
        success: false,
        error: "Sequence must be between 5 and 400 amino acids for real-time web prediction",
      });
    }

    let pdbText = "";
    try {
      const esmRes = await fetch("https://api.esmatlas.com/v1/predict/", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: cleanSeq,
      });

      if (esmRes.ok) {
        pdbText = await esmRes.text();
      } else {
        console.warn("ESMFold API returned status:", esmRes.status);
      }
    } catch (esmErr) {
      console.warn("ESMFold fetch failed, fallback will be used:", esmErr);
    }

    res.json({
      success: true,
      sequence: cleanSeq,
      proteinName: proteinName || "Predicted Polypeptide",
      pdb: pdbText || null,
      length: cleanSeq.length,
    });
  } catch (error: any) {
    console.error("ESMFold error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to process ESMFold prediction",
    });
  }
});

// 5. NMR Spectral Interpretation & DP4-AI Agent Endpoint
app.post("/api/nmr/interpret", async (req: Request, res: Response) => {
  try {
    const { peaks, solvent, frequencyMHz, nucleus, proposedSmiles, proposedName } = req.body;
    const ai = getAI();

    const prompt = `You are a Senior Analytical Chemist and NMR Spectroscopy expert specializing in DP4-AI computational structure verification.
Analyze the following experimental NMR spectrum and provide assignment verification:

Nucleus: ${nucleus || "1H"} (${frequencyMHz || 400} MHz)
Solvent: ${solvent || "CDCl3"}
Proposed Structure: ${proposedName || "Unknown"} (SMILES: ${proposedSmiles || "N/A"})
Detected Peak List (Chemical Shift ppm, Multiplicity, Integration, Coupling Constants J in Hz):
${JSON.stringify(peaks, null, 2)}

Provide a structured analytical report:
1. Peak-by-peak structural assignment (which proton/carbon in the molecule corresponds to each peak).
2. DP4-AI style probability score & confidence assessment for the proposed structure.
3. Analysis of splitting patterns (n+1 rule, Pascal's triangle, dihedral Karplus relation if applicable).
4. Solvent residue & impurity checks (e.g. residual CHCl3 at 7.26 ppm, H2O at 1.56 ppm in CDCl3).

Respond strictly in JSON matching this schema:
{
  "overallMatchConfidence": 96.5,
  "dp4Score": 0.965,
  "structuralSummary": "...",
  "peakAssignments": [
    { "shiftPpm": 1.25, "multiplicity": "t", "integral": 3, "assignedGroup": "-CH3 (methyl adjacent to methylene)", "jCouplingHz": "7.1 Hz", "notes": "..." }
  ],
  "couplingAnalysis": "...",
  "solventArtifacts": "...",
  "pedagogicalKeyPoints": [
    "Point 1...",
    "Point 2..."
  ]
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    });

    const data = JSON.parse(response.text || "{}");
    res.json({ success: true, data });
  } catch (error: any) {
    console.error("NMR interpret error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to interpret NMR spectrum",
    });
  }
});

// Vite middleware & Static serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[ChemVerse] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
