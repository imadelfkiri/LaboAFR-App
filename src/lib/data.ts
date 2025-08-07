
import { collection, getDocs, doc, writeBatch, query, setDoc, getDoc, addDoc, updateDoc, deleteDoc, where } from "firebase/firestore";
import { db } from "./firebase";

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

const LOCAL_STORAGE_KEY = 'fueltrack_specifications';

function initializeLocalStorage() {
    if (typeof window !== 'undefined') {
        const storedSpecs = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (!storedSpecs) {
            const initialData = INITIAL_SPECIFICATIONS_DATA.map((spec, index) => ({
                id: `spec_${index}_${Date.now()}`,
                ...spec
            }));
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initialData));
        }
    }
}

initializeLocalStorage();

// Populate H_MAP from the constant
INITIAL_FUEL_TYPES.forEach(ft => {
    H_MAP[ft.name] = ft.hValue;
});

// These functions return constants, so they are synchronous
export function getFuelTypes(): FuelType[] {
    return INITIAL_FUEL_TYPES;
};

export function getFournisseurs(): string[] {
    return INITIAL_FOURNISSEURS;
};

// This function now returns local data
export const getSpecifications = (): Specification[] => {
    if (typeof window === 'undefined') {
        return [];
    }
    const storedSpecs = localStorage.getItem(LOCAL_STORAGE_KEY);
    const specifications = storedSpecs ? JSON.parse(storedSpecs) : [];
    
    SPEC_MAP.clear();
    specifications.forEach((spec: Specification) => {
        SPEC_MAP.set(`${spec.type_combustible}|${spec.fournisseur}`, spec);
    });
    return specifications;
};

export const addSpecification = (spec: Omit<Specification, 'id'>) => {
    const specifications = getSpecifications();
    const exists = specifications.some(s => s.type_combustible === spec.type_combustible && s.fournisseur === spec.fournisseur);
    if (exists) {
        throw new Error("Une spécification pour ce combustible et ce fournisseur existe déjà.");
    }
    const newSpec = { ...spec, id: `spec_${Date.now()}` };
    const updatedSpecs = [...specifications, newSpec];
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedSpecs));
};

export const updateSpecification = (id: string, specUpdate: Partial<Specification>) => {
    let specifications = getSpecifications();
    const specIndex = specifications.findIndex(s => s.id === id);
    if (specIndex > -1) {
        specifications[specIndex] = { ...specifications[specIndex], ...specUpdate };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(specifications));
    }
};

export const deleteSpecification = (id: string) => {
    let specifications = getSpecifications();
    const updatedSpecs = specifications.filter(s => s.id !== id);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedSpecs));
};

// This function is kept for potential future use but won't be called by default
export async function seedDatabase() {
    console.log("Seeding is now managed locally via localStorage.");
}
