export type ChemModule = 
  | "structure_tutor"
  | "quantum_derivations"
  | "literature_rag"
  | "spectral_nmr"
  | "biochem_esmfold"
  | "edge_gnn";

export interface AtomCoord {
  serial: number;
  elem: string;
  x: number;
  y: number;
  z: number;
  charge?: number;
  bFactor?: number; // plDDT for proteins
  resName?: string;
  resSeq?: number;
  isNucleophile?: boolean;
  isElectrophile?: boolean;
  formalCharge?: number;
  hybridization?: string;
}

export interface CuratedMolecule {
  id: string;
  name: string;
  formula: string;
  category: "Organic Synthesis" | "Conformational Analysis" | "Organometallic" | "Biomolecule" | "Stereochemistry" | "Reaction Intermediate";
  smiles: string;
  description: string;
  keyEducationalConcept: string;
  sdfContent: string;
  molWeight: number;
  logP: number;
  tpsa: number;
  reactiveSites: Array<{
    type: "Nucleophilic" | "Electrophilic" | "Radical" | "Acidic/Basic";
    location: string;
    explanation: string;
    orbital: string;
  }>;
  stericNotes: string;
  stabilityRationale: string;
  unintuitiveAspect: string;
}

export interface DerivationVariable {
  symbol: string;
  name: string;
  unit: string;
  physicalMeaning: string;
}

export interface DerivationStep {
  stepNumber: number;
  stepTitle: string;
  latexEquation: string;
  mathematicalOperation: string;
  detailedExplanation: string;
  sympyEquivalent?: string;
  keyTakeaway: string;
}

export interface DerivationTopic {
  id: string;
  title: string;
  domain: "Quantum Mechanics" | "Thermodynamics" | "Chemical Kinetics" | "Statistical Mechanics" | "Spectroscopy";
  systemDescription: string;
  fundamentalPostulates: string[];
  variablesGuide: DerivationVariable[];
  steps: DerivationStep[];
  finalForm: {
    latexEquation: string;
    interpretation: string;
  };
  commonPitfalls: string[];
}

export interface PubMedArticle {
  pmid: string;
  title: string;
  source: string;
  pubdate: string;
  authors: string;
  doi?: string;
  url: string;
  abstractSnippet?: string;
}

export interface ReActStep {
  stage: string;
  thought: string;
}

export interface RagLiteratureResult {
  question: string;
  reActThoughtTrace: ReActStep[];
  synthesizedAnswer: string;
  keyTakeaways: string[];
  confidenceScore: number;
  suggestedFurtherReading: string[];
}

export interface NmrPeak {
  id: number;
  shiftPpm: number;
  intensity: number;
  multiplicity: "s" | "d" | "t" | "q" | "dd" | "m" | "sept";
  integral: number;
  assignedGroup: string;
  jCouplingHz?: string;
  notes?: string;
}

export interface NmrDataset {
  id: string;
  compoundName: string;
  nucleus: "1H" | "13C";
  frequencyMHz: number;
  solvent: string;
  smiles: string;
  fidTime: number[]; // Time in seconds (0 to 2s)
  fidSignalReal: number[];
  fidSignalImag: number[];
  peaks: NmrPeak[];
  spectralNotes: string;
  dp4Score: number;
}

export interface ProteinModel {
  id: string;
  name: string;
  organism: string;
  function: string;
  sequence: string;
  length: number;
  averagePlddt: number;
  pdbContent: string;
  plddtPerResidue: Array<{ residueIndex: number; aminoAcid: string; plddt: number }>;
}

export interface GnnNodeEmbedding {
  atomIndex: number;
  element: string;
  degree: number;
  hybridization: string;
  valenceElectrons: number;
  electronegativity: number;
  latentVector: number[];
}

export interface GnnPrediction {
  smiles: string;
  molWeight: number;
  logP: number;
  tpsa: number;
  hBondDonors: number;
  hBondAcceptors: number;
  rotatableBonds: number;
  qedScore: number; // Drug-likeness 0-1
  sasScore: number; // Synthetic Accessibility 1-10
  lipinskiPass: boolean;
  nodeEmbeddings: GnnNodeEmbedding[];
  adjacencyMatrix: number[][];
}
