

// NOTE: This file has been modified to use in-memory data instead of Firebase
// to work around the persistent App Check configuration issue.
// All data will reset on page reload.

export const H_MAP: Record<string, number> = {};

export interface FuelType {
    name: string;
    hValue: number;
}

export interface Specification {
    id: string;
    type_combustible: string;
    fournisseur: string;
    PCI_min?: number | null;
    H2O_max?: number | null;
    Cl_max?: number | null;
    Cendres_max?: number | null;
    Soufre_max?: number | null;
}

// In-memory store
let specifications: Specification[] = [];
let isInitialized = false;

// Using a Map for quick lookups
export const SPEC_MAP = new Map<string, Specification>();

const INITIAL_FUEL_TYPES: FuelType[] = [
    { name: "Textile", hValue: 6.0 },
    { name: "RDF", hValue: 6.0 },
    { name: "Pneus", hValue: 6.5 },
    { name: "Plastiques", hValue: 7.0 },
    { name: "Pet Coke", hValue: 3.5 },
    { name: "Mélange", hValue: 6.0 },
    { name: "Grignons d'olives", hValue: 6.0 },
    { name: "DMB", hValue: 6.5 },
    { name: "Charbon", hValue: 4.5 },
    { name: "Caoutchouc", hValue: 6.8 },
    { name: "CSR", hValue: 6.0 },
    { name: "Boues", hValue: 5.5 },
    { name: "Bois", hValue: 6.0 },
];

const INITIAL_FOURNISSEURS = [
    "Ain Seddeine", "Aliapur", "Bichara", "Géocycle", "MTR", "ONEE",
    "NAJD", "Polluclean", "SMBRM", "Sotraforest", "Ssardi", "RJL", "CNAPP",
    "ValRecete", "Valtradec"
];

const INITIAL_SPECIFICATIONS_DATA: Omit<Specification, 'id'>[] = [
    { type_combustible: 'CSR', fournisseur: 'Polluclean', H2O_max: 16.5, PCI_min: 4000, Cl_max: 1, Cendres_max: 15, Soufre_max: null },
    { type_combustible: 'CSR', fournisseur: 'SMBRM', H2O_max: 14, PCI_min: 5000, Cl_max: 0.6, Cendres_max: 15, Soufre_max: null },
    { type_combustible: 'DMB', fournisseur: 'MTR', H2O_max: 15, PCI_min: 4300, Cl_max: 0.6, Cendres_max: 15, Soufre_max: 0.5 },
    { type_combustible: "Grignons d'olives", fournisseur: 'Ain Seddeine', H2O_max: 20, PCI_min: 3700, Cl_max: 0.5, Cendres_max: 5, Soufre_max: null },
    { type_combustible: 'Plastiques', fournisseur: 'Bichara', H2O_max: 10, PCI_min: 4200, Cl_max: 1, Cendres_max: 15, Soufre_max: null },
    { type_combustible: 'Plastiques', fournisseur: 'Ssardi', H2O_max: 18, PCI_min: 4200, Cl_max: 1, Cendres_max: 15, Soufre_max: null },
    { type_combustible: 'Plastiques', fournisseur: 'ValRecete', H2O_max: 15, PCI_min: 4300, Cl_max: 1, Cendres_max: 15, Soufre_max: 0.5 },
    { type_combustible: 'Plastiques', fournisseur: 'Valtradec', H2O_max: 10, PCI_min: 6000, Cl_max: 1, Cendres_max: 15, Soufre_max: 0.5 },
    { type_combustible: 'Pneus', fournisseur: 'Aliapur', H2O_max: 1, PCI_min: 6800, Cl_max: 0.3, Cendres_max: 1, Soufre_max: null },
    { type_combustible: 'Pneus', fournisseur: 'RJL', H2O_max: 1, PCI_min: 6800, Cl_max: 0.3, Cendres_max: 1, Soufre_max: null },
];

function initializeData() {
    if (isInitialized) return;

    // Populate H_MAP
    INITIAL_FUEL_TYPES.forEach(ft => {
        H_MAP[ft.name] = ft.hValue;
    });

    // Populate specifications and SPEC_MAP
    specifications = INITIAL_SPECIFICATIONS_DATA.map((spec, index) => ({
        id: (index + 1).toString(),
        ...spec
    }));
    
    updateSpecMap();
    isInitialized = true;
}

function updateSpecMap() {
    SPEC_MAP.clear();
    specifications.forEach(spec => {
        SPEC_MAP.set(`${spec.type_combustible}|${spec.fournisseur}`, spec);
    });
}

// Ensure data is initialized on first import
initializeData();

export async function seedDatabase() {
    // This function now does nothing, as data is handled in-memory.
    // It's kept for compatibility with components that call it.
    initializeData();
    return Promise.resolve();
}


export function getFuelTypes(): FuelType[] {
    return [...INITIAL_FUEL_TYPES];
};

export function getFournisseurs(): string[] {
    return [...INITIAL_FOURNISSEURS];
};

export async function getSpecifications(): Promise<Specification[]> {
    return Promise.resolve([...specifications]);
};

export async function addSpecification(spec: Omit<Specification, 'id'>) {
    const existing = specifications.find(s => s.type_combustible === spec.type_combustible && s.fournisseur === spec.fournisseur);
    if (existing) {
        throw new Error("Une spécification pour ce combustible et ce fournisseur existe déjà.");
    }
    const newSpec = {
        id: (Date.now() + Math.random()).toString(),
        ...spec
    };
    specifications.push(newSpec);
    updateSpecMap();
    return Promise.resolve();
};

export async function updateSpecification(id: string, specUpdate: Partial<Omit<Specification, 'id'>>) {
    const index = specifications.findIndex(s => s.id === id);
    if (index === -1) {
        throw new Error("Specification not found.");
    }
    specifications[index] = { ...specifications[index], ...specUpdate };
    updateSpecMap();
    return Promise.resolve();
};

export async function deleteSpecification(id: string) {
    specifications = specifications.filter(s => s.id !== id);
    updateSpecMap();
    return Promise.resolve();
};
