

import { collection, getDocs, doc, writeBatch, query, setDoc, orderBy, serverTimestamp, getDoc, addDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "./firebase";

export const H_MAP: Record<string, number> = {};

export interface FuelType {
    name: string;
    hValue: number;
    createdAt?: { seconds: number; nanoseconds: number; };
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

// Map to hold specifications for easy lookup. Key: "fuelType|fournisseur"
export const SPEC_MAP = new Map<string, Specification>();


export const INITIAL_FUEL_TYPES: Omit<FuelType, 'createdAt'>[] = [
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

INITIAL_FUEL_TYPES.forEach(ft => {
    if (ft.hValue !== undefined) H_MAP[ft.name] = ft.hValue;
});

// Populate SPEC_MAP from initial data
if (SPEC_MAP.size === 0) {
    INITIAL_SPECIFICATIONS_DATA.forEach((spec, index) => {
        const id = `spec-${index}`;
        const fullSpec: Specification = { id, ...spec };
        SPEC_MAP.set(`${fullSpec.type_combustible}|${fullSpec.fournisseur}`, fullSpec);
    });
}


export const getFuelTypes = (): FuelType[] => {
    return INITIAL_FUEL_TYPES.map(ft => ({...ft}));
};

export const getFournisseurs = (): string[] => {
    return [...INITIAL_FOURNISSEURS];
};

export const getSpecifications = (): Specification[] => {
    return Array.from(SPEC_MAP.values()).sort((a,b) => 
        a.type_combustible.localeCompare(b.type_combustible) || a.fournisseur.localeCompare(b.fournisseur)
    );
};

export const addSpecification = (spec: Omit<Specification, 'id'>) => {
    const id = `spec-${Date.now()}`;
    const newSpec: Specification = {id, ...spec};
    const key = `${newSpec.type_combustible}|${newSpec.fournisseur}`;
    
    // Check for duplicates
    for (const s of SPEC_MAP.values()) {
        if (s.type_combustible === newSpec.type_combustible && s.fournisseur === newSpec.fournisseur) {
            throw new Error("Une spécification pour ce combustible et ce fournisseur existe déjà.");
        }
    }
    
    SPEC_MAP.set(key, newSpec);
};

export const updateSpecification = (id: string, spec: Specification) => {
     const key = `${spec.type_combustible}|${spec.fournisseur}`;
     
     // Find old key to delete if it's different
     for(let [k, v] of SPEC_MAP.entries()){
         if(v.id === id && k !== key){
             SPEC_MAP.delete(k);
         }
     }

     SPEC_MAP.set(key, spec);
};

export const deleteSpecification = (id: string) => {
    for (const [key, value] of SPEC_MAP.entries()) {
        if (value.id === id) {
            SPEC_MAP.delete(key);
            break;
        }
    }
};
