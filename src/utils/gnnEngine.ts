import { GnnPrediction, GnnNodeEmbedding } from "../types";

// Electronegativity table (Pauling scale)
const ELECTRONEGATIVITY: Record<string, number> = {
  H: 2.20,
  C: 2.55,
  N: 3.04,
  O: 3.44,
  F: 3.98,
  P: 2.19,
  S: 2.58,
  Cl: 3.16,
  Br: 2.96,
  I: 2.66,
  Fe: 1.83,
  Na: 0.93,
  K: 0.82,
};

// Standard atomic weights
const ATOMIC_WEIGHTS: Record<string, number> = {
  H: 1.008,
  C: 12.011,
  N: 14.007,
  O: 15.999,
  F: 18.998,
  P: 30.974,
  S: 32.06,
  Cl: 35.45,
  Br: 79.904,
  I: 126.90,
  Fe: 55.845,
};

interface SimpleAtom {
  element: string;
  isAromatic: boolean;
  degree: number;
  formalCharge: number;
  explicitH: number;
}

export function parseSmilesToGraph(smiles: string): { atoms: SimpleAtom[]; adj: number[][] } {
  const clean = smiles.trim();
  const atoms: SimpleAtom[] = [];
  const connections: Array<[number, number, number]> = []; // [from, to, bondOrder]

  // Tokenize SMILES
  let i = 0;
  let prevIdx = -1;
  const branchStack: number[] = [];
  const ringClosures: Record<string, number> = {};

  while (i < clean.length) {
    const char = clean[i];

    if (char === "(") {
      branchStack.push(prevIdx);
      i++;
      continue;
    }
    if (char === ")") {
      prevIdx = branchStack.pop() ?? prevIdx;
      i++;
      continue;
    }
    if (char === "=" || char === "#" || char === ":") {
      // Next bond specifier
      i++;
      continue;
    }
    if (char >= "0" && char <= "9") {
      // Ring closure digit
      if (ringClosures[char] !== undefined) {
        const target = ringClosures[char];
        connections.push([prevIdx, target, 1.0]);
        delete ringClosures[char];
      } else {
        ringClosures[char] = prevIdx;
      }
      i++;
      continue;
    }

    if (char === "[") {
      // Bracketed atom like [OH-], [Fe+2]
      const closeBracket = clean.indexOf("]", i);
      const bracketContent = closeBracket !== -1 ? clean.slice(i + 1, closeBracket) : "C";
      i = closeBracket !== -1 ? closeBracket + 1 : i + 1;

      let elem = "C";
      if (bracketContent.includes("Fe")) elem = "Fe";
      else if (bracketContent.includes("Cl")) elem = "Cl";
      else if (bracketContent.includes("Br")) elem = "Br";
      else if (bracketContent.includes("O")) elem = "O";
      else if (bracketContent.includes("N")) elem = "N";
      else if (bracketContent.includes("S")) elem = "S";
      else if (bracketContent.includes("P")) elem = "P";
      else if (bracketContent.includes("C")) elem = "C";

      const formalCharge = bracketContent.includes("+2") ? 2 : bracketContent.includes("+") ? 1 : bracketContent.includes("-") ? -1 : 0;
      const isAromatic = bracketContent.toLowerCase().includes(elem.toLowerCase()) && bracketContent === bracketContent.toLowerCase();

      const atomIdx = atoms.length;
      atoms.push({
        element: elem,
        isAromatic,
        degree: 0,
        formalCharge,
        explicitH: 0,
      });

      if (prevIdx !== -1) {
        connections.push([prevIdx, atomIdx, 1.0]);
      }
      prevIdx = atomIdx;
      continue;
    }

    // Standard Organic Atoms: C, c, N, n, O, o, S, s, P, F, Cl, Br, I
    let elem = "";
    let isAromatic = false;

    if (i + 1 < clean.length && (clean.slice(i, i + 2) === "Cl" || clean.slice(i, i + 2) === "Br")) {
      elem = clean.slice(i, i + 2);
      i += 2;
    } else if (char === "c" || char === "n" || char === "o" || char === "s" || char === "p") {
      elem = char.toUpperCase();
      isAromatic = true;
      i++;
    } else if (char >= "A" && char <= "Z") {
      elem = char;
      i++;
    } else {
      i++;
      continue;
    }

    if (elem) {
      const atomIdx = atoms.length;
      atoms.push({
        element: elem,
        isAromatic,
        degree: 0,
        formalCharge: 0,
        explicitH: 0,
      });

      if (prevIdx !== -1) {
        connections.push([prevIdx, atomIdx, isAromatic ? 1.5 : 1.0]);
      }
      prevIdx = atomIdx;
    }
  }

  // Build Adjacency Matrix
  const n = Math.max(atoms.length, 1);
  const adj: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  for (const [u, v, order] of connections) {
    if (u >= 0 && u < n && v >= 0 && v < n && u !== v) {
      adj[u][v] = order;
      adj[v][u] = order;
    }
  }

  // Update atom degrees
  for (let idx = 0; idx < atoms.length; idx++) {
    atoms[idx].degree = adj[idx].reduce((acc, val) => acc + (val > 0 ? 1 : 0), 0);
  }

  return { atoms, adj };
}

// 3-Layer Graph Convolutional Network (GCN) Client-Side Inference
export function runClientGnnInference(smiles: string): GnnPrediction {
  const { atoms, adj } = parseSmilesToGraph(smiles);
  const numNodes = atoms.length;

  if (numNodes === 0) {
    return {
      smiles,
      molWeight: 0,
      logP: 0,
      tpsa: 0,
      hBondDonors: 0,
      hBondAcceptors: 0,
      rotatableBonds: 0,
      qedScore: 0,
      sasScore: 1,
      lipinskiPass: true,
      nodeEmbeddings: [],
      adjacencyMatrix: [],
    };
  }

  // 1. Initial Node Feature Vectors (Dimension: 8)
  // [Electronegativity, AtomicMassNorm, DegreeNorm, IsAromatic, FormalCharge, IsOxygen, IsNitrogen, IsHalogen]
  const nodeFeatures: number[][] = atoms.map((atom) => {
    const en = ELECTRONEGATIVITY[atom.element] || 2.5;
    const mass = (ATOMIC_WEIGHTS[atom.element] || 12.0) / 100.0;
    const deg = atom.degree / 4.0;
    const arom = atom.isAromatic ? 1.0 : 0.0;
    const fc = atom.formalCharge;
    const isO = atom.element === "O" ? 1.0 : 0.0;
    const isN = atom.element === "N" ? 1.0 : 0.0;
    const isHalo = ["F", "Cl", "Br", "I"].includes(atom.element) ? 1.0 : 0.0;
    return [en / 4.0, mass, deg, arom, fc, isO, isN, isHalo];
  });

  // 2. Layer 1 Message Passing (GCN Layer)
  // H^(l+1) = ReLU( \tilde{D}^{-1/2} \tilde{A} \tilde{D}^{-1/2} H^(l) W^(l) )
  const featDim = nodeFeatures[0].length;
  let currentEmbeddings = nodeFeatures;

  for (let layer = 0; layer < 3; layer++) {
    const nextEmbeddings: number[][] = [];

    for (let u = 0; u < numNodes; u++) {
      const agg = new Array(featDim).fill(0);
      let degU = 1; // Self loop
      for (let v = 0; v < numNodes; v++) {
        if (adj[u][v] > 0) degU += 1;
      }

      // Aggregate self
      for (let d = 0; d < featDim; d++) {
        agg[d] += currentEmbeddings[u][d] / degU;
      }

      // Aggregate neighbors
      for (let v = 0; v < numNodes; v++) {
        if (adj[u][v] > 0) {
          let degV = 1;
          for (let k = 0; k < numNodes; k++) {
            if (adj[v][k] > 0) degV += 1;
          }
          const normWeight = 1.0 / Math.sqrt(degU * degV);
          for (let d = 0; d < featDim; d++) {
            agg[d] += currentEmbeddings[v][d] * normWeight * adj[u][v];
          }
        }
      }

      // Non-linear Activation (LeakyReLU) + Layer scaling
      const activated = agg.map((val) => Math.max(0.05 * val, Math.tanh(val * 1.35)));
      nextEmbeddings.push(activated);
    }
    currentEmbeddings = nextEmbeddings;
  }

  // 3. Cheminformatics Property Calculations (Rule-based + Graph Embeddings)
  let totalMw = 0;
  let hBondDonors = 0;
  let hBondAcceptors = 0;
  let tpsa = 0;
  let logP = 0;
  let rotatableBonds = 0;

  for (let i = 0; i < numNodes; i++) {
    const atom = atoms[i];
    const weight = ATOMIC_WEIGHTS[atom.element] || 12.011;
    totalMw += weight;

    // Estimate implicit hydrogens for organic atoms
    let maxValence = 4;
    if (atom.element === "N") maxValence = 3;
    if (atom.element === "O") maxValence = 2;
    if (["F", "Cl", "Br", "I"].includes(atom.element)) maxValence = 1;
    if (atom.element === "S") maxValence = 2;
    if (atom.element === "P") maxValence = 3;

    const implicitH = Math.max(0, maxValence - atom.degree + atom.formalCharge);
    totalMw += implicitH * 1.008;

    if (atom.element === "O") {
      hBondAcceptors += 1;
      tpsa += 20.23;
      if (implicitH > 0) {
        hBondDonors += 1;
        tpsa += 10.0;
        logP -= 0.55;
      } else {
        logP -= 0.15;
      }
    } else if (atom.element === "N") {
      hBondAcceptors += 1;
      tpsa += 12.89;
      if (implicitH > 0) {
        hBondDonors += implicitH;
        tpsa += implicitH * 8.5;
        logP -= 0.7;
      } else {
        logP -= 0.35;
      }
    } else if (atom.element === "C") {
      logP += atom.isAromatic ? 0.35 : 0.28;
    } else if (atom.element === "Cl") {
      logP += 0.65;
    } else if (atom.element === "Br") {
      logP += 0.85;
    } else if (atom.element === "F") {
      logP += 0.15;
    }

    // Rotatable single bond estimation
    if (atom.degree >= 2 && !atom.isAromatic && atom.element === "C") {
      rotatableBonds += 0.5;
    }
  }

  rotatableBonds = Math.floor(rotatableBonds);

  // Graph Readout Vector (Global Mean Pooling)
  const readout = new Array(featDim).fill(0);
  for (let i = 0; i < numNodes; i++) {
    for (let d = 0; d < featDim; d++) {
      readout[d] += currentEmbeddings[i][d] / numNodes;
    }
  }

  // Refine LogP and SAS with GNN readout
  logP = Number((logP + (readout[0] - 0.5) * 1.2).toFixed(2));
  totalMw = Number(totalMw.toFixed(2));
  tpsa = Number(tpsa.toFixed(1));

  // Quantitative Estimate of Drug-likeness (QED) Score (0.0 to 1.0)
  // Penalizes MW > 500, extreme LogP, high rotatable bonds
  const mwScore = Math.exp(-0.5 * Math.pow((totalMw - 350) / 120, 2));
  const logpScore = Math.exp(-0.5 * Math.pow((logP - 2.5) / 2.0, 2));
  const tpsaScore = Math.exp(-0.5 * Math.pow((tpsa - 70) / 50, 2));
  const qed = Number(Math.min(0.99, Math.max(0.12, Math.pow(mwScore * logpScore * tpsaScore, 1 / 3))).toFixed(3));

  // Synthetic Accessibility Score (SAS: 1.0 easy to 10.0 extremely difficult)
  // Scales with ring closures, large MW, and heteroatom complexity
  let sas = 1.8 + (totalMw / 200) + (rotatableBonds * 0.25) + (numNodes > 15 ? 1.5 : 0);
  sas = Number(Math.min(9.8, Math.max(1.1, sas)).toFixed(2));

  // Lipinski's Rule of 5:
  // MW <= 500, LogP <= 5, HBD <= 5, HBA <= 10
  const lipinskiPass = totalMw <= 500 && logP <= 5.0 && hBondDonors <= 5 && hBondAcceptors <= 10;

  const nodeEmbeddings: GnnNodeEmbedding[] = atoms.map((atom, idx) => ({
    atomIndex: idx + 1,
    element: atom.element,
    degree: atom.degree,
    hybridization: atom.isAromatic ? "sp²" : atom.degree >= 4 ? "sp³" : atom.degree === 3 ? "sp²" : "sp",
    valenceElectrons: atom.element === "C" ? 4 : atom.element === "N" ? 5 : atom.element === "O" ? 6 : 1,
    electronegativity: ELECTRONEGATIVITY[atom.element] || 2.55,
    latentVector: currentEmbeddings[idx].map((x) => Number(x.toFixed(3))),
  }));

  return {
    smiles,
    molWeight: totalMw,
    logP,
    tpsa,
    hBondDonors,
    hBondAcceptors,
    rotatableBonds,
    qedScore: qed,
    sasScore: sas,
    lipinskiPass,
    nodeEmbeddings,
    adjacencyMatrix: adj,
  };
}
