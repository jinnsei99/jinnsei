import { CuratedMolecule, DerivationTopic, NmrDataset, ProteinModel } from "../types";

export const CURATED_MOLECULES: CuratedMolecule[] = [
  {
    id: "sn2_transition_state",
    name: "SN2 Reaction Transition State [HO···CH3···Br]‡",
    formula: "[C H3 Br O H]‡-",
    category: "Reaction Intermediate",
    smiles: "[OH-]...C...Br",
    description: "Pentacoordinate carbon intermediate with trigonal bipyramidal geometry exhibiting Walden inversion.",
    keyEducationalConcept: "Frontier Molecular Orbital (FMO) overlap: Nucleophile HOMO (lone pair of OH⁻) attacks the σ* C-Br LUMO anti-periplanar (180°) relative to the leaving group.",
    molWeight: 112.93,
    logP: -0.42,
    tpsa: 20.2,
    reactiveSites: [
      {
        type: "Nucleophilic",
        location: "Hydroxide Oxygen (Incoming Nu)",
        explanation: "Carries partial negative charge (δ⁻); high-energy non-bonding HOMO lone pair donating electron density into C-Br σ* antibonding orbital.",
        orbital: "HOMO (n_O non-bonding lone pair)",
      },
      {
        type: "Electrophilic",
        location: "Central Pentacoordinate Carbon",
        explanation: "Transient sp²-like planar geometry with three equatorial C-H bonds and two axial partial bonds spanning 180°.",
        orbital: "LUMO (σ* C-Br anti-bonding)",
      },
      {
        type: "Nucleophilic",
        location: "Bromide Leaving Group",
        explanation: "Departing with partial negative charge (δ⁻) as the C-Br bond stretches and breaks.",
        orbital: "Departing σ lone pair",
      },
    ],
    stericNotes: "Steric crowding in the transition state causes severe rate reduction in tertiary substrates (tert-butyl bromide vs methyl bromide rate ratio ~ 1 : 100,000).",
    stabilityRationale: "Thermodynamically unstable saddle point on the potential energy surface ($E_a \\approx 75\\text{ kJ/mol}$). Stabilized in polar aprotic solvents (DMF, DMSO, Acetone) which do not cage the anionic nucleophile with hydrogen-bond networks.",
    unintuitiveAspect: "Students often believe the carbon momentarily has 5 full covalent bonds. In reality, it forms a 3-center 4-electron (3c-4e) bond across O-C-Br with bond orders of ~0.5 each.",
    sdfContent: `SN2_TS
ChemVerse 3D
 7  6  0  0  0  0  0  0  0  0999 V2000
    0.0000    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    0.0000    1.0800    0.0000 H   0  0  0  0  0  0  0  0  0  0  0  0
    0.9353   -0.5400    0.0000 H   0  0  0  0  0  0  0  0  0  0  0  0
   -0.9353   -0.5400    0.0000 H   0  0  0  0  0  0  0  0  0  0  0  0
    0.0000    0.0000    1.9500 Br  0  0  0  0  0  0  0  0  0  0  0  0
    0.0000    0.0000   -1.8500 O   0  0  0  0  0  0  0  0  0  0  0  0
    0.0000    0.8500   -2.2500 H   0  0  0  0  0  0  0  0  0  0  0  0
  1  2  1  0  0  0  0
  1  3  1  0  0  0  0
  1  4  1  0  0  0  0
  1  5  1  0  0  0  0
  1  6  1  0  0  0  0
  6  7  1  0  0  0  0
M  END`,
  },
  {
    id: "cyclohexane_chair",
    name: "Cyclohexane (Chair Conformer)",
    formula: "C6H12",
    category: "Conformational Analysis",
    smiles: "C1CCCCC1",
    description: "Strain-free conformation with alternating axial and equatorial hydrogens, avoiding all torsional and angle strain.",
    keyEducationalConcept: "Conformational equilibria & 1,3-diaxial interactions: Substituents in axial positions experience steric repulsion (steric clash / A-value) with axial hydrogens 3 carbons away.",
    molWeight: 84.16,
    logP: 3.44,
    tpsa: 0.0,
    reactiveSites: [
      {
        type: "Radical",
        location: "Equatorial C-H Bonds",
        explanation: "More accessible for radical abstraction due to less steric shielding than axial bonds.",
        orbital: "σ (C-H)",
      },
    ],
    stericNotes: "Chair-chair interconversion (ring flip) swaps all axial hydrogens to equatorial and vice-versa through half-chair and twist-boat transition states with an activation barrier of 45 kJ/mol.",
    stabilityRationale: "The chair conformer has virtually zero Baeyer angle strain (C-C-C angles are 109.5°) and zero Pitzer torsional strain (all adjacent C-H bonds are fully staggered with 60° dihedral angles).",
    unintuitiveAspect: "Equatorial substituents appear to point 'outwards', but they actually follow the tetrahedral zig-zag of the carbon skeleton. Axial bonds alternate pointing strictly parallel straight UP and straight DOWN.",
    sdfContent: `Cyclohexane_Chair
ChemVerse 3D
 18 18  0  0  0  0  0  0  0  0999 V2000
    1.2610    0.7280    0.2310 C   0  0  0  0  0  0  0  0  0  0  0  0
    0.0000    1.4560   -0.2310 C   0  0  0  0  0  0  0  0  0  0  0  0
   -1.2610    0.7280    0.2310 C   0  0  0  0  0  0  0  0  0  0  0  0
   -1.2610   -0.7280   -0.2310 C   0  0  0  0  0  0  0  0  0  0  0  0
    0.0000   -1.4560    0.2310 C   0  0  0  0  0  0  0  0  0  0  0  0
    1.2610   -0.7280   -0.2310 C   0  0  0  0  0  0  0  0  0  0  0  0
    2.1550    1.2440   -0.1280 H   0  0  0  0  0  0  0  0  0  0  0  0
    1.3090    0.7550    1.3250 H   0  0  0  0  0  0  0  0  0  0  0  0
    0.0000    2.4890    0.1280 H   0  0  0  0  0  0  0  0  0  0  0  0
    0.0000    1.5110   -1.3250 H   0  0  0  0  0  0  0  0  0  0  0  0
   -2.1550    1.2440   -0.1280 H   0  0  0  0  0  0  0  0  0  0  0  0
   -1.3090    0.7550    1.3250 H   0  0  0  0  0  0  0  0  0  0  0  0
   -2.1550   -1.2440    0.1280 H   0  0  0  0  0  0  0  0  0  0  0  0
   -1.3090   -0.7550   -1.3250 H   0  0  0  0  0  0  0  0  0  0  0  0
    0.0000   -2.4890   -0.1280 H   0  0  0  0  0  0  0  0  0  0  0  0
    0.0000   -1.5110    1.3250 H   0  0  0  0  0  0  0  0  0  0  0  0
    2.1550   -1.2440    0.1280 H   0  0  0  0  0  0  0  0  0  0  0  0
    1.3090   -0.7550   -1.3250 H   0  0  0  0  0  0  0  0  0  0  0  0
  1  2  1  0  0  0  0
  2  3  1  0  0  0  0
  3  4  1  0  0  0  0
  4  5  1  0  0  0  0
  5  6  1  0  0  0  0
  6  1  1  0  0  0  0
  1  7  1  0  0  0  0
  1  8  1  0  0  0  0
  2  9  1  0  0  0  0
  2 10  1  0  0  0  0
  3 11  1  0  0  0  0
  3 12  1  0  0  0  0
  4 13  1  0  0  0  0
  4 14  1  0  0  0  0
  5 15  1  0  0  0  0
  5 16  1  0  0  0  0
  6 17  1  0  0  0  0
  6 18  1  0  0  0  0
M  END`,
  },
  {
    id: "aspirin",
    name: "Aspirin (Acetylsalicylic Acid)",
    formula: "C9H8O4",
    category: "Organic Synthesis",
    smiles: "CC(=O)Oc1ccccc1C(=O)O",
    description: "Prototypical NSAID synthesized via O-acetylation of salicylic acid with acetic anhydride.",
    keyEducationalConcept: "Ester hydrolysis mechanism & dual functional group electronics (ortho-substituted carboxylate vs ester group interactions).",
    molWeight: 180.16,
    logP: 1.19,
    tpsa: 63.6,
    reactiveSites: [
      {
        type: "Electrophilic",
        location: "Ester Carbonyl Carbon (C=O)",
        explanation: "Susceptible to nucleophilic acyl substitution by serine residue (Ser530) in COX-1/COX-2 enzyme active sites, covalently acetylating the enzyme.",
        orbital: "π* (C=O)",
      },
      {
        type: "Acidic/Basic",
        location: "Carboxylic Acid Proton (-COOH)",
        explanation: "pKa ~ 3.5. Deprotonated at physiological pH (7.4) to form carboxylate anion, increasing water solubility.",
        orbital: "σ* (O-H)",
      },
    ],
    stericNotes: "The ortho-arrangement creates internal hydrogen bonding opportunities and steric hindrance that tilts the ester group out of coplanarity with the benzene ring.",
    stabilityRationale: "Aromatic stabilization energy of the benzene ring (~150 kJ/mol). Ester linkage is susceptible to base-catalyzed saponification or acid-catalyzed hydrolysis in moist environments.",
    unintuitiveAspect: "Aspirin does not inhibit COX enzymes through reversible binding; it irreversibly acetylates a catalytic serine, permanently knocking out pro-inflammatory prostaglandin synthesis.",
    sdfContent: `Aspirin
ChemVerse 3D
 13 13  0  0  0  0  0  0  0  0999 V2000
   -1.8900    0.3400    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
   -1.5000   -1.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
   -0.1500   -1.3400    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    0.8000   -0.3400    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    0.4100    1.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
   -0.9400    1.3400    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    2.2500   -0.7000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    3.1500    0.1200    0.0000 O   0  0  0  0  0  0  0  0  0  0  0  0
    2.5600   -1.9900    0.0000 O   0  0  0  0  0  0  0  0  0  0  0  0
    1.3700    2.0100    0.0000 O   0  0  0  0  0  0  0  0  0  0  0  0
    1.0000    3.3100    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    2.1000    4.1900    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
   -0.1700    3.6400    0.0000 O   0  0  0  0  0  0  0  0  0  0  0  0
  1  2  2  0  0  0  0
  2  3  1  0  0  0  0
  3  4  2  0  0  0  0
  4  5  1  0  0  0  0
  5  6  2  0  0  0  0
  6  1  1  0  0  0  0
  4  7  1  0  0  0  0
  7  8  1  0  0  0  0
  7  9  2  0  0  0  0
  5 10  1  0  0  0  0
 10 11  1  0  0  0  0
 11 12  1  0  0  0  0
 11 13  2  0  0  0  0
M  END`,
  },
  {
    id: "ferrocene",
    name: "Ferrocene [Fe(η5-C5H5)2]",
    formula: "C10H10Fe",
    category: "Organometallic",
    smiles: "[cH-]1cccc1.[cH-]1cccc1.[Fe+2]",
    description: "Prototypical sandwich metallocene satisfying the 18-electron rule with D5d/D5h conformational symmetry.",
    keyEducationalConcept: "Ligand Field Theory & 18-Electron Rule: Iron(II) d⁶ ion coordinates to two aromatic cyclopentadienyl anions (6π electrons each), yielding 6 + 2(6) = 18 electrons.",
    molWeight: 186.03,
    logP: 3.12,
    tpsa: 0.0,
    reactiveSites: [
      {
        type: "Nucleophilic",
        location: "Cyclopentadienyl Ring Carbons (Cp)",
        explanation: "Undergoes electrophilic aromatic substitution (Friedel-Crafts acylation) over 10^6 times faster than benzene due to rich Fe-to-ligand π-backdonation.",
        orbital: "Ligand-centered π orbital",
      },
      {
        type: "Acidic/Basic",
        location: "Central Iron(II) Core",
        explanation: "Reversible 1-electron oxidation to ferrocenium [Fe(Cp)2]⁺ ($E^\\circ = +0.40\\text{ V}$ vs SHE), widely used as internal electrochemical standard.",
        orbital: "d_{z^2}, d_{x^2-y^2}, d_{xy} non-bonding d-orbitals",
      },
    ],
    stericNotes: "Very low rotational barrier (~4 kJ/mol) between eclipsed ($D_{5h}$) and staggered ($D_{5d}$) conformers; freely rotates in solution at room temperature.",
    stabilityRationale: "Extreme thermal stability up to 400°C due to perfect spatial overlap between Fe 3d orbitals ($e_{1g}, e_{2g}$) and Cp π MOs.",
    unintuitiveAspect: "Despite being an organometallic compound with iron, it is unaffected by air, moisture, boiling concentrated HCl, or hot 10M NaOH.",
    sdfContent: `Ferrocene
ChemVerse 3D
 11 15  0  0  0  0  0  0  0  0999 V2000
    0.0000    0.0000    0.0000 Fe  0  0  0  0  0  0  0  0  0  0  0  0
    1.2140    0.0000    1.6500 C   0  0  0  0  0  0  0  0  0  0  0  0
    0.3750    1.1540    1.6500 C   0  0  0  0  0  0  0  0  0  0  0  0
   -0.9820    0.7140    1.6500 C   0  0  0  0  0  0  0  0  0  0  0  0
   -0.9820   -0.7140    1.6500 C   0  0  0  0  0  0  0  0  0  0  0  0
    0.3750   -1.1540    1.6500 C   0  0  0  0  0  0  0  0  0  0  0  0
    1.2140    0.0000   -1.6500 C   0  0  0  0  0  0  0  0  0  0  0  0
    0.3750    1.1540   -1.6500 C   0  0  0  0  0  0  0  0  0  0  0  0
   -0.9820    0.7140   -1.6500 C   0  0  0  0  0  0  0  0  0  0  0  0
   -0.9820   -0.7140   -1.6500 C   0  0  0  0  0  0  0  0  0  0  0  0
    0.3750   -1.1540   -1.6500 C   0  0  0  0  0  0  0  0  0  0  0  0
  1  2  1  0  0  0  0
  1  3  1  0  0  0  0
  1  4  1  0  0  0  0
  1  5  1  0  0  0  0
  1  6  1  0  0  0  0
  2  3  2  0  0  0  0
  3  4  1  0  0  0  0
  4  5  2  0  0  0  0
  5  6  1  0  0  0  0
  6  2  1  0  0  0  0
  7  8  2  0  0  0  0
  8  9  1  0  0  0  0
  9 10  2  0  0  0  0
 10 11  1  0  0  0  0
 11  7  1  0  0  0  0
M  END`,
  },
  {
    id: "enolate_resonance",
    name: "Acetone Enolate Anion [CH2=C(O⁻)CH3]",
    formula: "C3H5O-",
    category: "Organic Synthesis",
    smiles: "C=C([O-])C",
    description: "Ambident nucleophile demonstrating orbital (HOMO) vs electrostatic control in carbon vs oxygen alkylation.",
    keyEducationalConcept: "Hard-Soft Acid-Base (HSAB) Theory & Ambident Reactivity: The oxygen atom carries highest negative charge (hard nucleophile), while the alpha-carbon has the highest HOMO coefficient (soft nucleophile).",
    molWeight: 57.07,
    logP: -0.85,
    tpsa: 23.1,
    reactiveSites: [
      {
        type: "Nucleophilic",
        location: "Alpha-Carbon (C=C terminus)",
        explanation: "Soft nucleophilic site with largest orbital coefficient in the HOMO (π MO); attacks soft electrophiles (alkyl halides in aldol/alkylation).",
        orbital: "HOMO (π_2 non-bonding/antibonding node)",
      },
      {
        type: "Nucleophilic",
        location: "Enolate Oxygen (O⁻)",
        explanation: "Hard nucleophilic site with highest electrostatic negative charge density; attacks hard electrophiles (e.g. silyl chlorides TMS-Cl, protons).",
        orbital: "n_O lone pair / π_1 deep MO",
      },
    ],
    stericNotes: "Thermodynamic vs kinetic enolate control: hindered base (LDA, -78°C) abstracts less hindered proton yielding less substituted kinetic enolate.",
    stabilityRationale: "Resonance delocalization energy between the oxyanion and the carbanion resonance contributors ($CH_2^- - C(=O)CH_3 \\leftrightarrow CH_2=C(O^-)CH_3$).",
    unintuitiveAspect: "Although students write resonance forms with negative charge on carbon, electrostatic potential maps show >70% of the charge sits on oxygen, yet carbon is usually the nucleophilic atom in C-C bond formation!",
    sdfContent: `Enolate
ChemVerse 3D
  4  3  0  0  0  0  0  0  0  0999 V2000
   -1.2500    0.6000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    0.0000    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    0.2000   -1.3000    0.0000 O   0  0  0  0  0  0  0  0  0  0  0  0
    1.2500    0.8500    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
  1  2  2  0  0  0  0
  2  3  1  0  0  0  0
  2  4  1  0  0  0  0
M  END`,
  },
];

export const DERIVATION_TOPICS: DerivationTopic[] = [
  {
    id: "particle_in_a_box_1d",
    title: "1D Particle in an Infinite Potential Box",
    domain: "Quantum Mechanics",
    systemDescription: "A quantum particle of mass m confined to a 1-dimensional region between x = 0 and x = L, with infinite potential walls V(x) = ∞ outside.",
    fundamentalPostulates: [
      "Time-Independent Schrödinger Equation: \\hat{H}\\psi(x) = E\\psi(x)",
      "Hamiltonian in position representation: \\hat{H} = -\\frac{\\hbar^2}{2m}\\frac{d^2}{dx^2} + V(x)",
      "Boundary Conditions: \\psi(0) = 0 \\text{ and } \\psi(L) = 0 \\text{ (infinite potential walls)}",
      "Born Probability Normalization: \\int_0^L |\\psi(x)|^2 dx = 1",
    ],
    variablesGuide: [
      { symbol: "\\hbar", name: "Reduced Planck Constant", unit: "\\text{J}\\cdot\\text{s}", physicalMeaning: "Quantum scale factor (h / 2π = 1.05457 × 10⁻³⁴ J·s)" },
      { symbol: "m", name: "Particle Mass", unit: "\\text{kg}", physicalMeaning: "Inertial mass of the confined quantum particle" },
      { symbol: "L", name: "Box Width", unit: "\\text{m} \\text{ or } \\text{\\AA}", physicalMeaning: "Spatial confinement boundary length" },
      { symbol: "n", name: "Principal Quantum Number", unit: "\\text{dimensionless}", physicalMeaning: "Integer (1, 2, 3...) labeling quantized energy states and number of antinodes" },
      { symbol: "k", name: "Wavenumber", unit: "\\text{rad/m}", physicalMeaning: "Spatial frequency of the de Broglie standing wave (k = 2π/λ)" },
      { symbol: "E_n", name: "Quantized Energy Level", unit: "\\text{J} \\text{ or } \\text{eV}", physicalMeaning: "Discrete stationary state energy eigenvalue" },
    ],
    steps: [
      {
        stepNumber: 1,
        stepTitle: "Formulating the Differential Equation inside the Box",
        latexEquation: "-\\frac{\\hbar^2}{2m} \\frac{d^2\\psi(x)}{dx^2} = E\\psi(x) \\implies \\frac{d^2\\psi(x)}{dx^2} + k^2 \\psi(x) = 0",
        mathematicalOperation: "Setting V(x) = 0 for 0 < x < L, and defining wavenumber k^2 = \\frac{2mE}{\\hbar^2}",
        detailedExplanation: "Inside the potential well, the potential energy V(x) vanishes. Rearranging the Schrödinger differential equation yields a standard second-order linear homogeneous ODE with constant coefficients.",
        sympyEquivalent: "Eq(Derivative(psi(x), x, 2) + k**2 * psi(x), 0)",
        keyTakeaway: "The solutions are trigonometric harmonic oscillatory functions.",
      },
      {
        stepNumber: 2,
        stepTitle: "General Solution Ansatz",
        latexEquation: "\\psi(x) = A \\sin(kx) + B \\cos(kx)",
        mathematicalOperation: "Solving the characteristic polynomial r^2 + k^2 = 0 \\implies r = \\pm i k",
        detailedExplanation: "Using Euler's identity, the general solution is expressed as a linear superposition of sine and cosine stationary basis functions, where A and B are arbitrary complex integration constants.",
        sympyEquivalent: "dsolve(Derivative(psi(x), x, 2) + k**2 * psi(x), psi(x))",
        keyTakeaway: "Two boundary conditions are needed to determine the constants A and B.",
      },
      {
        stepNumber: 3,
        stepTitle: "Applying Boundary Condition at x = 0",
        latexEquation: "\\psi(0) = A \\sin(0) + B \\cos(0) = 0 \\implies B \\cdot 1 = 0 \\implies B = 0",
        mathematicalOperation: "Imposing wave function continuity at the infinite barrier x = 0",
        detailedExplanation: "Because the wave function must be zero where potential is infinite, setting x = 0 forces the cosine component to vanish entirely. The wave function simplifies to \\psi(x) = A \\sin(kx).",
        sympyEquivalent: "solve(Eq(A*sin(0) + B*cos(0), 0), B)",
        keyTakeaway: "The cosine term is eliminated by the node at the origin.",
      },
      {
        stepNumber: 4,
        stepTitle: "Applying Boundary Condition at x = L (Quantization Emergence!)",
        latexEquation: "\\psi(L) = A \\sin(kL) = 0 \\implies kL = n\\pi \\quad (n = 1, 2, 3, \\dots)",
        mathematicalOperation: "Non-trivial solution condition (A \\neq 0) forces argument of sine to integer multiples of π",
        detailedExplanation: "For a physical non-zero probability density, A cannot be zero. Therefore, \\sin(kL) must equal zero, which is satisfied only when kL = nπ. This boundary constraint is the direct mathematical origin of quantum discreteness!",
        sympyEquivalent: "solve(sin(k*L), k)",
        keyTakeaway: "Quantization is not an ad-hoc postulate; it arises naturally from the boundary conditions of wave mechanics.",
      },
      {
        stepNumber: 5,
        stepTitle: "Deriving the Quantized Energy Formula",
        latexEquation: "k = \\frac{n\\pi}{L} \\quad \\text{and} \\quad k^2 = \\frac{2mE}{\\hbar^2} \\implies \\frac{2mE_n}{\\hbar^2} = \\frac{n^2 \\pi^2}{L^2} \\implies E_n = \\frac{n^2 \\pi^2 \\hbar^2}{2m L^2} = \\frac{n^2 h^2}{8m L^2}",
        mathematicalOperation: "Substituting \\hbar = \\frac{h}{2\\pi} into the energy-wavenumber relation",
        detailedExplanation: "Equating the boundary-constrained wavenumber k to the definition of k in terms of energy E and mass m yields the discrete energy spectrum. Energy scales quadratically with quantum number n² and inversely with L² and m.",
        sympyEquivalent: "solve(Eq(2*m*E/hbar**2, (n*pi/L)**2), E)",
        keyTakeaway: "Zero-point energy (n = 1) is non-zero: E_1 = \\frac{h^2}{8mL^2}, conforming to Heisenberg's Uncertainty Principle.",
      },
      {
        stepNumber: 6,
        stepTitle: "Wavefunction Normalization",
        latexEquation: "\\int_0^L |\\psi_n(x)|^2 dx = A^2 \\int_0^L \\sin^2\\left(\\frac{n\\pi x}{L}\\right) dx = A^2 \\left(\\frac{L}{2}\\right) = 1 \\implies A = \\sqrt{\\frac{2}{L}}",
        mathematicalOperation: "Evaluating definite integral using identity \\sin^2(\\theta) = \\frac{1 - \\cos(2\\theta)}{2}",
        detailedExplanation: "Total probability of finding the particle somewhere within the box must be exactly unity (100%). Solving for the normalization constant A gives \\sqrt{2/L}.",
        sympyEquivalent: "integrate(sin(n*pi*x/L)**2, (x, 0, L))",
        keyTakeaway: "Final orthonormal eigenfunction: \\psi_n(x) = \\sqrt{\\frac{2}{L}} \\sin\\left(\\frac{n\\pi x}{L}\\right).",
      },
    ],
    finalForm: {
      latexEquation: "E_n = \\frac{n^2 h^2}{8mL^2}, \\quad \\psi_n(x) = \\sqrt{\\frac{2}{L}} \\sin\\left(\\frac{n\\pi x}{L}\\right) \\quad (n \\in \\mathbb{Z}^+)",
      interpretation: "The particle possesses discrete energy eigenvalues and exhibits spatial nodes (n - 1 internal zeros). The ground state n = 1 has strictly positive kinetic energy because spatial confinement Δx = L requires non-zero momentum uncertainty Δp ≥ ħ/(2L).",
    },
    commonPitfalls: [
      "Setting quantum number n = 0: if n = 0, ψ(x) = 0 everywhere, meaning no particle exists.",
      "Assuming the energy spacing is constant: ΔE = E_{n+1} - E_n = (2n + 1)h²/(8mL²), meaning energy levels spread further apart as n increases.",
    ],
  },
  {
    id: "eyring_transition_state",
    title: "Eyring-Polanyi Transition State Equation (TST)",
    domain: "Chemical Kinetics",
    systemDescription: "Statistical thermodynamic derivation of absolute chemical reaction rates through the activated complex (transition state ‡) quasi-equilibrium.",
    fundamentalPostulates: [
      "Quasi-equilibrium between reactants and activated complex: A + B \\rightleftharpoons [AB]^\\ddagger \\xrightarrow{k_\\ddagger} \\text{Products}",
      "Transmission coefficient \\kappa \\approx 1 (every crossing of barrier yields product)",
      "Rate constant: k = \\kappa \\nu^\\ddagger K^\\ddagger, \\text{ where } \\nu^\\ddagger = \\frac{k_B T}{h}",
      "Thermodynamic Relation: \\Delta G^\\ddagger = -RT \\ln K^\\ddagger = \\Delta H^\\ddagger - T\\Delta S^\\ddagger",
    ],
    variablesGuide: [
      { symbol: "k", name: "Reaction Rate Constant", unit: "\\text{s}^{-1} \\text{ or } \\text{M}^{-1}\\text{s}^{-1}", physicalMeaning: "Empirical rate coefficient of the macroscopic reaction" },
      { symbol: "k_B", name: "Boltzmann Constant", unit: "\\text{J}/\\text{K}", physicalMeaning: "1.380649 × 10⁻²³ J/K relating thermal energy to temperature" },
      { symbol: "h", name: "Planck Constant", unit: "\\text{J}\\cdot\\text{s}", physicalMeaning: "6.62607 × 10⁻³⁴ J·s fundamental quantum of action" },
      { symbol: "\\kappa", name: "Transmission Coefficient", unit: "\\text{dimensionless}", physicalMeaning: "Probability that activated complex proceeds to products rather than returning to reactants (often taken as ~1)" },
      { symbol: "\\Delta H^\\ddagger", name: "Enthalpy of Activation", unit: "\\text{kJ/mol}", physicalMeaning: "Bond deformation and electronic reorganization energy needed to reach transition state" },
      { symbol: "\\Delta S^\\ddagger", name: "Entropy of Activation", unit: "\\text{J}/(\\text{mol}\\cdot\\text{K})", physicalMeaning: "Change in disorder/conformational freedom upon forming transition state (negative for associative bimolecular reactions)" },
    ],
    steps: [
      {
        stepNumber: 1,
        stepTitle: "Expressing Rate Constant via Activated Complex Decomposition",
        latexEquation: "r = k_\\ddagger [AB^\\ddagger] = \\nu^\\ddagger [AB^\\ddagger] = \\left(\\frac{k_B T}{h}\\right) [AB^\\ddagger]",
        mathematicalOperation: "Statistical partition function separation of the reactive vibration mode along the reaction coordinate",
        detailedExplanation: "The loose vibration along the saddle point reaction coordinate has frequency ν‡. In the classical limit hν‡ << kBT, the partition function evaluates to kBT / (hν‡), giving the crossing frequency kBT / h.",
        sympyEquivalent: "k_crossing = k_B * T / h",
        keyTakeaway: "Universal frequency factor k_B T / h equals approximately 6.2 × 10¹² s⁻¹ at 298 K.",
      },
      {
        stepNumber: 2,
        stepTitle: "Linking to Thermodynamic Activation Free Energy",
        latexEquation: "K^\\ddagger = \\exp\\left(-\\frac{\\Delta G^\\ddagger}{RT}\\right) = \\exp\\left(\\frac{\\Delta S^\\ddagger}{R}\\right) \\exp\\left(-\\frac{\\Delta H^\\ddagger}{RT}\\right)",
        mathematicalOperation: "Applying fundamental thermodynamic relation \\Delta G = \\Delta H - T\\Delta S",
        detailedExplanation: "Substituting the Gibbs free energy of activation decomposes the equilibrium constant into an entropic prefactor and an enthalpic Boltzmann temperature dependence.",
        sympyEquivalent: "exp(-Delta_G / (R * T))",
        keyTakeaway: "Separates structural ordering (entropy) from electronic barrier (enthalpy).",
      },
      {
        stepNumber: 3,
        stepTitle: "Linearized Eyring Equation for Experimental Plotting",
        latexEquation: "\\ln\\left(\\frac{k}{T}\\right) = -\\frac{\\Delta H^\\ddagger}{R} \\cdot \\frac{1}{T} + \\ln\\left(\\frac{k_B}{h}\\right) + \\frac{\\Delta S^\\ddagger}{R}",
        mathematicalOperation: "Dividing by T and taking natural logarithm ln on both sides",
        detailedExplanation: "Plotting ln(k/T) vs 1/T yields a straight line with slope = -ΔH‡/R and y-intercept = ln(kB/h) + ΔS‡/R. This allows precise experimental determination of activation parameters without assuming Arrhenius empiricism.",
        sympyEquivalent: "Eq(ln(k/T), -Delta_H/(R*T) + ln(k_B/h) + Delta_S/R)",
        keyTakeaway: "A large negative y-intercept indicates a highly ordered, associative transition state (e.g. SN2, Diels-Alder cycloaddition).",
      },
    ],
    finalForm: {
      latexEquation: "k = \\frac{\\kappa k_B T}{h} e^{\\frac{\\Delta S^\\ddagger}{R}} e^{-\\frac{\\Delta H^\\ddagger}{RT}} \\implies \\ln\\left(\\frac{k}{T}\\right) = -\\frac{\\Delta H^\\ddagger}{R}\\frac{1}{T} + \\left[\\ln\\left(\\frac{k_B}{h}\\right) + \\frac{\\Delta S^\\ddagger}{R}\\right]",
      interpretation: "Provides molecular-level insight into Arrhenius parameters ($A \\leftrightarrow e^2 \\frac{k_B T}{h} e^{\\Delta S^\\ddagger/R}, E_a = \\Delta H^\\ddagger + RT$).",
    },
    commonPitfalls: [
      "Plotting ln(k) vs 1/T instead of ln(k/T) vs 1/T: Arrhenius plots use ln(k), while Eyring plots require dividing by T inside the logarithm.",
      "Units confusion in ΔS‡: ΔS‡ is in J/(mol·K), while ΔH‡ is in kJ/mol. Multiplying by 1000 is required when combining.",
    ],
  },
  {
    id: "michaelis_menten_kinetics",
    title: "Michaelis-Menten Steady-State Enzyme Kinetics",
    domain: "Chemical Kinetics",
    systemDescription: "Enzymatic catalysis of substrate S into product P via enzyme-substrate complex ES under Briggs-Haldane steady-state approximation.",
    fundamentalPostulates: [
      "Mechanism: E + S \\underset{k_{-1}}{\\overset{k_1}{\\rightleftharpoons}} ES \\xrightarrow{k_{\\text{cat}}} E + P",
      "Total Enzyme Conservation: [E]_0 = [E] + [ES]",
      "Quasi-Steady-State Approximation (QSSA): \\frac{d[ES]}{dt} = 0",
      "Initial Velocity: v_0 = k_{\\text{cat}} [ES]",
    ],
    variablesGuide: [
      { symbol: "v_0", name: "Initial Reaction Rate", unit: "\\text{M}/\\text{s}", physicalMeaning: "Velocity of product formation before substrate depletion or product inhibition" },
      { symbol: "V_{\\max}", name: "Maximum Velocity", unit: "\\text{M}/\\text{s}", physicalMeaning: "Theoretical saturation limit when 100% of enzyme active sites are occupied ([ES] = [E]₀)" },
      { symbol: "K_M", name: "Michaelis Constant", unit: "\\text{M} \\text{ (mol/L)}", physicalMeaning: "Substrate concentration [S] at which reaction velocity is exactly half-maximum (V_max / 2)" },
      { symbol: "k_{\\text{cat}}", name: "Turnover Number", unit: "\\text{s}^{-1}", physicalMeaning: "Number of substrate molecules converted to product per active site per second" },
    ],
    steps: [
      {
        stepNumber: 1,
        stepTitle: "Setting Up the Rate of Change of [ES]",
        latexEquation: "\\frac{d[ES]}{dt} = k_1 [E][S] - k_{-1} [ES] - k_{\\text{cat}} [ES] = 0",
        mathematicalOperation: "Applying Briggs-Haldane Quasi-Steady-State condition d[ES]/dt = 0",
        detailedExplanation: "After a rapid pre-steady-state burst, the rate of formation of [ES] from free enzyme E and substrate S balances its rate of breakdown (both backwards to E+S and forwards to E+P).",
        sympyEquivalent: "Eq(k1*E*S - (k_minus1 + k_cat)*ES, 0)",
        keyTakeaway: "[ES] concentration remains virtually constant during initial rate measurements.",
      },
      {
        stepNumber: 2,
        stepTitle: "Substituting Enzyme Conservation Law",
        latexEquation: "[E] = [E]_0 - [ES] \\implies k_1 ([E]_0 - [ES])[S] = (k_{-1} + k_{\\text{cat}}) [ES]",
        mathematicalOperation: "Eliminating unknown free enzyme concentration [E]",
        detailedExplanation: "We cannot directly measure free enzyme [E], but we know the total added enzyme [E]₀. Substituting [E] = [E]₀ - [ES] produces an equation containing only known [E]₀, [S], and [ES].",
        sympyEquivalent: "solve(k1*(E0 - ES)*S - (k_minus1 + k_cat)*ES, ES)",
        keyTakeaway: "Allows algebraic isolation of [ES].",
      },
      {
        stepNumber: 3,
        stepTitle: "Defining Michaelis Constant K_M and Solving for [ES]",
        latexEquation: "K_M = \\frac{k_{-1} + k_{\\text{cat}}}{k_1} \\implies [ES] = \\frac{[E]_0 [S]}{K_M + [S]}",
        mathematicalOperation: "Dividing through by k₁ and factoring terms",
        detailedExplanation: "Defining K_M groups the three microscopic rate constants into a single macroscopic affinity parameter. At high substrate [S] >> K_M, [ES] approaches [E]₀.",
        sympyEquivalent: "Eq(ES, E0 * S / (KM + S))",
        keyTakeaway: "K_M has concentration units (mol/L) and reflects apparent enzyme-substrate affinity.",
      },
      {
        stepNumber: 4,
        stepTitle: "Final Michaelis-Menten Velocity Equation",
        latexEquation: "v_0 = k_{\\text{cat}} [ES] = \\frac{k_{\\text{cat}} [E]_0 [S]}{K_M + [S]} = \\frac{V_{\\max} [S]}{K_M + [S]}",
        mathematicalOperation: "Setting V_{max} = k_{cat} [E]_0",
        detailedExplanation: "Multiplying [ES] by the catalytic rate constant k_cat gives the hyperbolic rate equation. At [S] = K_M, v_0 = V_max / 2.",
        sympyEquivalent: "Eq(v0, Vmax * S / (KM + S))",
        keyTakeaway: "Exhibits first-order kinetics at low [S] << K_M and zero-order saturation at high [S] >> K_M.",
      },
    ],
    finalForm: {
      latexEquation: "v_0 = \\frac{V_{\\max} [S]}{K_M + [S]}, \\quad \\text{Lineweaver-Burk: } \\frac{1}{v_0} = \\frac{K_M}{V_{\\max}} \\frac{1}{[S]} + \\frac{1}{V_{\\max}}",
      interpretation: "Hyperbolic velocity curve. The Lineweaver-Burk double reciprocal transformation gives slope = K_M / V_max, y-intercept = 1/V_max, and x-intercept = -1/K_M.",
    },
    commonPitfalls: [
      "Assuming K_M is equal to the dissociation constant K_d: K_M = (k_{-1} + k_{cat})/k_1 = K_d + k_{cat}/k_1. K_M = K_d only if k_{cat} << k_{-1} (Michaelis-Menten rapid equilibrium assumption).",
      "Using Lineweaver-Burk without weighting errors: double reciprocal plots disproportionately amplify experimental error at low substrate concentrations.",
    ],
  },
  {
    id: "gibbs_helmholtz",
    title: "Gibbs-Helmholtz Thermodynamic Equation",
    domain: "Thermodynamics",
    systemDescription: "Derivation of the temperature dependence of Gibbs free energy and chemical equilibrium constant at constant pressure.",
    fundamentalPostulates: [
      "Gibbs Free Energy Definition: G = H - TS",
      "Fundamental Thermodynamic Relation: dG = -S dT + V dP \\implies \\left(\\frac{\\partial G}{\\partial T}\\right)_P = -S",
      "Quotient Rule of Calculus applied to G / T",
    ],
    variablesGuide: [
      { symbol: "G", name: "Gibbs Free Energy", unit: "\\text{kJ/mol}", physicalMeaning: "Thermodynamic potential for spontaneity at constant T and P" },
      { symbol: "H", name: "Enthalpy", unit: "\\text{kJ/mol}", physicalMeaning: "Total heat content (internal energy + PV work)" },
      { symbol: "S", name: "Entropy", unit: "\\text{J}/(\\text{mol}\\cdot\\text{K})", physicalMeaning: "Microscopic state degeneracy / disorder measure" },
      { symbol: "T", name: "Absolute Temperature", unit: "\\text{K}", physicalMeaning: "Kelvin temperature scale" },
    ],
    steps: [
      {
        stepNumber: 1,
        stepTitle: "Differentiating G / T with respect to T at constant P",
        latexEquation: "\\left[\\frac{\\partial}{\\partial T}\\left(\\frac{G}{T}\\right)\\right]_P = \\frac{1}{T}\\left(\\frac{\\partial G}{\\partial T}\\right)_P - \\frac{G}{T^2}",
        mathematicalOperation: "Product / Quotient rule of differentiation",
        detailedExplanation: "Taking the partial derivative of G(T)/T produces two terms: the derivative of the numerator times 1/T plus G times the derivative of 1/T (-1/T²).",
        sympyEquivalent: "diff(G(T)/T, T)",
        keyTakeaway: "Isolates the temperature derivative of the dimensionless free energy ratio G/T.",
      },
      {
        stepNumber: 2,
        stepTitle: "Substituting Thermodynamic Relation (∂G/∂T)_P = -S",
        latexEquation: "\\left[\\frac{\\partial}{\\partial T}\\left(\\frac{G}{T}\\right)\\right]_P = \\frac{-S}{T} - \\frac{G}{T^2} = -\\frac{TS + G}{T^2}",
        mathematicalOperation: "Substituting fundamental Maxwell relation \\left(\\frac{\\partial G}{\\partial T}\\right)_P = -S",
        detailedExplanation: "Replacing (∂G/∂T)_P with -S allows factoring 1/T² outside the bracket.",
        sympyEquivalent: "-S/T - G/T**2",
        keyTakeaway: "Connects entropy S to the temperature derivative.",
      },
      {
        stepNumber: 3,
        stepTitle: "Substituting Enthalpy H = G + TS",
        latexEquation: "G = H - TS \\implies G + TS = H \\implies \\left[\\frac{\\partial}{\\partial T}\\left(\\frac{\\Delta G}{T}\\right)\\right]_P = -\\frac{\\Delta H}{T^2}",
        mathematicalOperation: "Direct substitution of enthalpy definition into the numerator",
        detailedExplanation: "Recognizing that G + TS is identically equal to enthalpy H eliminates the entropy term completely! This is the Gibbs-Helmholtz equation.",
        sympyEquivalent: "-H / T**2",
        keyTakeaway: "Directly leads to the van 't Hoff equation for equilibrium constants: \\frac{d\\ln K_{eq}}{dT} = \\frac{\\Delta H^\\circ}{RT^2}.",
      },
    ],
    finalForm: {
      latexEquation: "\\left[\\frac{\\partial(\\Delta G / T)}{\\partial T}\\right]_P = -\\frac{\\Delta H}{T^2} \\iff \\left[\\frac{\\partial(\\Delta G / T)}{\\partial(1/T)}\\right]_P = \\Delta H",
      interpretation: "Plotting ΔG/T vs 1/T yields a straight line with slope exactly equal to the reaction enthalpy ΔH. An exothermic reaction (ΔH < 0) becomes less favorable at higher temperatures.",
    },
    commonPitfalls: [
      "Forgetting constant pressure condition: this relation holds strictly at constant pressure P.",
      "Assuming ΔH is temperature-independent over huge ranges: Kirchhoff's law must be applied if ΔCp is large.",
    ],
  },
];

export const PRESET_NMR_DATASETS: NmrDataset[] = [
  {
    id: "ethanol_400mhz",
    compoundName: "Ethanol (CH3-CH2-OH)",
    nucleus: "1H",
    frequencyMHz: 400,
    solvent: "CDCl3",
    smiles: "CCO",
    fidTime: Array.from({ length: 512 }, (_, i) => i * 0.0039),
    fidSignalReal: Array.from({ length: 512 }, (_, i) => {
      const t = i * 0.0039;
      // Methyl triplet at 1.2 ppm (f ~ 480 Hz from ref), Methylene quartet at 3.7 ppm (f ~ 1480 Hz), Hydroxyl singlet at 2.6 ppm (f ~ 1040 Hz)
      return (
        3.0 * Math.exp(-t * 4.0) * Math.cos(2 * Math.PI * 120 * t) +
        2.0 * Math.exp(-t * 5.0) * Math.cos(2 * Math.PI * 370 * t) +
        1.0 * Math.exp(-t * 8.0) * Math.cos(2 * Math.PI * 260 * t) +
        (Math.random() - 0.5) * 0.1
      );
    }),
    fidSignalImag: Array.from({ length: 512 }, (_, i) => {
      const t = i * 0.0039;
      return (
        3.0 * Math.exp(-t * 4.0) * Math.sin(2 * Math.PI * 120 * t) +
        2.0 * Math.exp(-t * 5.0) * Math.sin(2 * Math.PI * 370 * t) +
        1.0 * Math.exp(-t * 8.0) * Math.sin(2 * Math.PI * 260 * t) +
        (Math.random() - 0.5) * 0.1
      );
    }),
    peaks: [
      {
        id: 1,
        shiftPpm: 1.25,
        intensity: 88.4,
        multiplicity: "t",
        integral: 3.0,
        assignedGroup: "-CH3 (Methyl Protons)",
        jCouplingHz: "7.1 Hz",
        notes: "Coupled to 2 adjacent methylene protons (n+1 rule = triplet with 1:2:1 intensity ratio).",
      },
      {
        id: 2,
        shiftPpm: 2.61,
        intensity: 32.1,
        multiplicity: "s",
        integral: 1.0,
        assignedGroup: "-OH (Hydroxyl Proton)",
        notes: "Broad singlet in CDCl3 due to rapid intermolecular proton exchange at room temperature.",
      },
      {
        id: 3,
        shiftPpm: 3.72,
        intensity: 64.2,
        multiplicity: "q",
        integral: 2.0,
        assignedGroup: "-CH2- (Methylene Protons)",
        jCouplingHz: "7.1 Hz",
        notes: "Deshielded by electronegative oxygen; coupled to 3 methyl protons (quartet with 1:3:3:1 ratio).",
      },
      {
        id: 4,
        shiftPpm: 7.26,
        intensity: 5.2,
        multiplicity: "s",
        integral: 0.05,
        assignedGroup: "Residual CHCl3 solvent peak",
        notes: "Standard reference benchmark in deuterochloroform.",
      },
    ],
    spectralNotes: "Classic AB3 spin system displaying first-order J-coupling scalar splittings. DP4-AI probability algorithm calculates 99.4% confidence match for ethanol.",
    dp4Score: 0.994,
  },
  {
    id: "ethyl_acetate_400mhz",
    compoundName: "Ethyl Acetate (CH3-COO-CH2-CH3)",
    nucleus: "1H",
    frequencyMHz: 400,
    solvent: "CDCl3",
    smiles: "CCOC(=O)C",
    fidTime: Array.from({ length: 512 }, (_, i) => i * 0.0039),
    fidSignalReal: Array.from({ length: 512 }, (_, i) => {
      const t = i * 0.0039;
      return (
        3.0 * Math.exp(-t * 3.5) * Math.cos(2 * Math.PI * 125 * t) +
        3.0 * Math.exp(-t * 3.5) * Math.cos(2 * Math.PI * 205 * t) +
        2.0 * Math.exp(-t * 4.5) * Math.cos(2 * Math.PI * 412 * t) +
        (Math.random() - 0.5) * 0.08
      );
    }),
    fidSignalImag: Array.from({ length: 512 }, (_, i) => {
      const t = i * 0.0039;
      return (
        3.0 * Math.exp(-t * 3.5) * Math.sin(2 * Math.PI * 125 * t) +
        3.0 * Math.exp(-t * 3.5) * Math.sin(2 * Math.PI * 205 * t) +
        2.0 * Math.exp(-t * 4.5) * Math.sin(2 * Math.PI * 412 * t) +
        (Math.random() - 0.5) * 0.08
      );
    }),
    peaks: [
      {
        id: 1,
        shiftPpm: 1.26,
        intensity: 85.0,
        multiplicity: "t",
        integral: 3.0,
        assignedGroup: "Ethyl -CH3",
        jCouplingHz: "7.2 Hz",
        notes: "Coupled to -O-CH2- protons.",
      },
      {
        id: 2,
        shiftPpm: 2.05,
        intensity: 92.0,
        multiplicity: "s",
        integral: 3.0,
        assignedGroup: "Acetyl -CO-CH3",
        notes: "Isolated singlet slightly deshielded by adjacent carbonyl π-electron withdrawing system.",
      },
      {
        id: 3,
        shiftPpm: 4.12,
        intensity: 61.0,
        multiplicity: "q",
        integral: 2.0,
        assignedGroup: "Ethoxy -O-CH2-",
        jCouplingHz: "7.2 Hz",
        notes: "Strongly deshielded by ester oxygen (shifted downfield to >4 ppm).",
      },
    ],
    spectralNotes: "Distinguishes between isomeric esters (e.g. methyl propanoate vs ethyl acetate) based on chemical shift positions of singlets vs quartets.",
    dp4Score: 0.988,
  },
];

export const CURATED_PROTEINS: ProteinModel[] = [
  {
    id: "crambin",
    name: "Crambin (Crambe hispanica seed protein)",
    organism: "Crambe hispanica",
    function: "Hydrophobic plant seed thionin with 3 disulfide bonds, famous benchmark in ultra-high resolution X-ray crystallography and protein folding.",
    sequence: "TTCCPSIVARSNFNVCRLPGTPEAICATYTGCIIIPGATCPGDYAN",
    length: 46,
    averagePlddt: 94.8,
    plddtPerResidue: [
      { residueIndex: 1, aminoAcid: "T", plddt: 91.2 },
      { residueIndex: 2, aminoAcid: "T", plddt: 93.4 },
      { residueIndex: 3, aminoAcid: "C", plddt: 96.1 },
      { residueIndex: 4, aminoAcid: "C", plddt: 96.5 },
      { residueIndex: 5, aminoAcid: "P", plddt: 95.0 },
      { residueIndex: 6, aminoAcid: "S", plddt: 96.2 },
      { residueIndex: 7, aminoAcid: "I", plddt: 97.4 },
      { residueIndex: 8, aminoAcid: "V", plddt: 97.8 },
      { residueIndex: 9, aminoAcid: "A", plddt: 98.1 },
      { residueIndex: 10, aminoAcid: "R", plddt: 97.5 },
      { residueIndex: 11, aminoAcid: "S", plddt: 96.8 },
      { residueIndex: 12, aminoAcid: "N", plddt: 95.4 },
      { residueIndex: 13, aminoAcid: "F", plddt: 96.1 },
      { residueIndex: 14, aminoAcid: "N", plddt: 97.2 },
      { residueIndex: 15, aminoAcid: "V", plddt: 96.8 },
      { residueIndex: 16, aminoAcid: "C", plddt: 98.0 },
      { residueIndex: 17, aminoAcid: "R", plddt: 95.2 },
      { residueIndex: 18, aminoAcid: "L", plddt: 94.8 },
      { residueIndex: 19, aminoAcid: "P", plddt: 93.1 },
      { residueIndex: 20, aminoAcid: "G", plddt: 92.5 },
      { residueIndex: 21, aminoAcid: "T", plddt: 94.0 },
      { residueIndex: 22, aminoAcid: "P", plddt: 95.3 },
      { residueIndex: 23, aminoAcid: "E", plddt: 96.4 },
      { residueIndex: 24, aminoAcid: "A", plddt: 97.1 },
      { residueIndex: 25, aminoAcid: "I", plddt: 97.8 },
      { residueIndex: 26, aminoAcid: "C", plddt: 98.3 },
      { residueIndex: 27, aminoAcid: "A", plddt: 97.5 },
      { residueIndex: 28, aminoAcid: "T", plddt: 96.4 },
      { residueIndex: 29, aminoAcid: "Y", plddt: 95.8 },
      { residueIndex: 30, aminoAcid: "T", plddt: 94.2 },
      { residueIndex: 31, aminoAcid: "G", plddt: 93.7 },
      { residueIndex: 32, aminoAcid: "C", plddt: 95.6 },
      { residueIndex: 33, aminoAcid: "I", plddt: 96.8 },
      { residueIndex: 34, aminoAcid: "I", plddt: 97.1 },
      { residueIndex: 35, aminoAcid: "I", plddt: 96.4 },
      { residueIndex: 36, aminoAcid: "P", plddt: 94.5 },
      { residueIndex: 37, aminoAcid: "G", plddt: 92.1 },
      { residueIndex: 38, aminoAcid: "A", plddt: 93.8 },
      { residueIndex: 39, aminoAcid: "T", plddt: 94.6 },
      { residueIndex: 40, aminoAcid: "C", plddt: 96.2 },
      { residueIndex: 41, aminoAcid: "P", plddt: 94.1 },
      { residueIndex: 42, aminoAcid: "G", plddt: 91.5 },
      { residueIndex: 43, aminoAcid: "D", plddt: 89.4 },
      { residueIndex: 44, aminoAcid: "Y", plddt: 88.2 },
      { residueIndex: 45, aminoAcid: "A", plddt: 86.5 },
      { residueIndex: 46, aminoAcid: "N", plddt: 82.0 },
    ],
    pdbContent: `HEADER    PLANT PROTEIN                           30-APR-81   1CRN
TITLE     WATER STRUCTURE OF A HYDROPHOBIC PROTEIN AT ATOMIC RESOLUTION.
ATOM      1  N   THR A   1      17.047  14.099   3.625  1.00 91.20           N
ATOM      2  CA  THR A   1      16.967  12.784   4.338  1.00 91.20           C
ATOM      3  C   THR A   1      15.685  12.755   5.133  1.00 91.20           C
ATOM      4  O   THR A   1      15.268  13.825   5.594  1.00 91.20           O
ATOM      5  CB  THR A   1      18.170  12.703   5.337  1.00 91.20           C
ATOM      6  N   THR A   2      15.115  11.555   5.265  1.00 93.40           N
ATOM      7  CA  THR A   2      13.856  11.469   6.002  1.00 93.40           C
ATOM      8  C   THR A   2      14.164  10.785   7.323  1.00 93.40           C
ATOM      9  O   THR A   2      14.988   9.873   7.446  1.00 93.40           O
ATOM     10  N   CYS A   3      13.484  11.234   8.368  1.00 96.10           N
ATOM     11  CA  CYS A   3      13.664  10.710   9.718  1.00 96.10           C
ATOM     12  C   CYS A   3      12.607  11.376  10.597  1.00 96.10           C
ATOM     13  O   CYS A   3      11.758  12.164  10.155  1.00 96.10           O
ATOM     14  CB  CYS A   3      13.568   9.183   9.754  1.00 96.10           C
ATOM     15  SG  CYS A   3      14.887   8.358   8.825  1.00 96.10           S
ATOM     16  N   CYS A   4      12.684  11.050  11.879  1.00 96.50           N
ATOM     17  CA  CYS A   4      11.724  11.597  12.827  1.00 96.50           C
ATOM     18  C   CYS A   4      10.334  10.985  12.628  1.00 96.50           C
ATOM     19  O   CYS A   4      10.138   9.782  12.802  1.00 96.50           O
ATOM     20  CB  CYS A   4      12.215  11.332  14.254  1.00 96.50           C
ATOM     21  SG  CYS A   4      13.822  12.083  14.618  1.00 96.50           S
ATOM     22  N   PRO A   5       9.349  11.796  12.259  1.00 95.00           N
ATOM     23  CA  PRO A   5       7.986  11.282  12.062  1.00 95.00           C
ATOM     24  C   PRO A   5       7.411  10.536  13.256  1.00 95.00           C
ATOM     25  O   PRO A   5       7.971  10.535  14.354  1.00 95.00           O
ATOM     26  N   SER A   6       6.297   9.907  12.997  1.00 96.20           N
ATOM     27  CA  SER A   6       5.602   9.141  14.019  1.00 96.20           C
ATOM     28  C   SER A   6       4.195   9.696  14.184  1.00 96.20           C
ATOM     29  O   SER A   6       3.714   9.827  15.309  1.00 96.20           O
ATOM     30  N   ILE A   7       3.541  10.024  13.069  1.00 97.40           N
ATOM     31  CA  ILE A   7       2.189  10.575  13.080  1.00 97.40           C
ATOM     32  C   ILE A   7       1.196   9.508  13.518  1.00 97.40           C
ATOM     33  O   ILE A   7       1.507   8.326  13.684  1.00 97.40           O
ATOM     34  N   VAL A   8      -0.010   9.957  13.719  1.00 97.80           N
ATOM     35  CA  VAL A   8      -1.077   9.083  14.168  1.00 97.80           C
ATOM     36  C   VAL A   8      -1.921   8.618  12.986  1.00 97.80           C
ATOM     37  O   VAL A   8      -1.748   9.060  11.854  1.00 97.80           O
ATOM     38  N   ALA A   9      -2.831   7.720  13.275  1.00 98.10           N
ATOM     39  CA  ALA A   9      -3.713   7.170  12.261  1.00 98.10           C
ATOM     40  C   ALA A   9      -4.708   6.257  12.966  1.00 98.10           C
ATOM     41  O   ALA A   9      -5.012   6.444  14.143  1.00 98.10           O
ATOM     42  N   ARG A  10      -5.201   5.271  12.235  1.00 97.50           N
ATOM     43  CA  ARG A  10      -6.170   4.321  12.756  1.00 97.50           C
ATOM     44  C   ARG A  10      -7.391   4.254  11.856  1.00 97.50           C
ATOM     45  O   ARG A  10      -7.794   3.178  11.411  1.00 97.50           O
TER
END`,
  },
  {
    id: "trp_cage",
    name: "Trp-cage Miniprotein (TC5b, 20 residues)",
    organism: "Synthetic Construct",
    function: "Fastest folding globular miniprotein known (folds in ~4 microseconds), stabilized by a central tryptophan core locked into a polyproline II helix pocket.",
    sequence: "NLYIQWLKDGGPSSGRPPPS",
    length: 20,
    averagePlddt: 91.5,
    plddtPerResidue: [
      { residueIndex: 1, aminoAcid: "N", plddt: 82.1 },
      { residueIndex: 2, aminoAcid: "L", plddt: 88.4 },
      { residueIndex: 3, aminoAcid: "Y", plddt: 93.2 },
      { residueIndex: 4, aminoAcid: "I", plddt: 95.0 },
      { residueIndex: 5, aminoAcid: "Q", plddt: 96.1 },
      { residueIndex: 6, aminoAcid: "W", plddt: 97.5 },
      { residueIndex: 7, aminoAcid: "L", plddt: 96.8 },
      { residueIndex: 8, aminoAcid: "K", plddt: 95.2 },
      { residueIndex: 9, aminoAcid: "D", plddt: 94.0 },
      { residueIndex: 10, aminoAcid: "G", plddt: 92.5 },
      { residueIndex: 11, aminoAcid: "G", plddt: 91.0 },
      { residueIndex: 12, aminoAcid: "P", plddt: 93.5 },
      { residueIndex: 13, aminoAcid: "S", plddt: 92.8 },
      { residueIndex: 14, aminoAcid: "S", plddt: 91.4 },
      { residueIndex: 15, aminoAcid: "G", plddt: 89.2 },
      { residueIndex: 16, aminoAcid: "R", plddt: 90.1 },
      { residueIndex: 17, aminoAcid: "P", plddt: 92.6 },
      { residueIndex: 18, aminoAcid: "P", plddt: 91.8 },
      { residueIndex: 19, aminoAcid: "P", plddt: 86.4 },
      { residueIndex: 20, aminoAcid: "S", plddt: 75.3 },
    ],
    pdbContent: `HEADER    DE NOVO PROTEIN                         14-JAN-02   1L2Y
TITLE     NMR STRUCTURE OF TRP-CAGE MINIPROTEIN CONSTRUCT TC5B
ATOM      1  N   ASN     1      -1.391  -4.358   2.698  1.00 82.10           N
ATOM      2  CA  ASN     1      -0.627  -3.327   1.970  1.00 82.10           C
ATOM      3  C   ASN     1       0.793  -3.238   2.540  1.00 82.10           C
ATOM      4  O   ASN     1       1.416  -2.185   2.455  1.00 82.10           O
ATOM      5  N   LEU     2       1.284  -4.321   3.125  1.00 88.40           N
ATOM      6  CA  LEU     2       2.618  -4.331   3.722  1.00 88.40           C
ATOM      7  C   LEU     2       2.610  -3.411   4.945  1.00 88.40           C
ATOM      8  O   LEU     2       1.558  -3.078   5.485  1.00 88.40           O
ATOM      9  N   TYR     3       3.791  -2.983   5.367  1.00 93.20           N
ATOM     10  CA  TYR     3       3.945  -2.099   6.520  1.00 93.20           C
ATOM     11  C   TYR     3       4.819  -2.766   7.581  1.00 93.20           C
ATOM     12  O   TYR     3       5.807  -3.412   7.253  1.00 93.20           O
ATOM     13  N   ILE     4       4.444  -2.585   8.847  1.00 95.00           N
ATOM     14  CA  ILE     4       5.176  -3.170   9.967  1.00 95.00           C
ATOM     15  C   ILE     4       4.333  -4.275  10.609  1.00 95.00           C
ATOM     16  O   ILE     4       3.127  -4.148  10.796  1.00 95.00           O
ATOM     17  N   GLN     5       4.990  -5.364  10.970  1.00 96.10           N
ATOM     18  CA  GLN     5       4.326  -6.491  11.609  1.00 96.10           C
ATOM     19  C   GLN     5       4.484  -7.747  10.748  1.00 96.10           C
ATOM     20  O   GLN     5       5.599  -8.134  10.377  1.00 96.10           O
TER
END`,
  },
];
