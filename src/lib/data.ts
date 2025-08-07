
import { collection, getDocs, doc, writeBatch, query, setDoc, getDoc, addDoc, updateDoc, deleteDoc, where, orderBy } from "firebase/firestore";
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

let isSeeding = false;
let isInitialized = false;

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

INITIAL_FUEL_TYPES.forEach(ft => {
    H_MAP[ft.name] = ft.hValue;
});

export function getFuelTypes(): FuelType[] {
    return INITIAL_FUEL_TYPES;
};

export function getFournisseurs(): string[] {
    return INITIAL_FOURNISSEURS;
};

export async function getSpecifications(): Promise<Specification[]> {
    const q = query(collection(db, "specifications"));
    const querySnapshot = await getDocs(q);
    const specifications: Specification[] = [];
    querySnapshot.forEach((doc) => {
        specifications.push({ id: doc.id, ...doc.data() } as Specification);
    });

    SPEC_MAP.clear();
    specifications.forEach((spec: Specification) => {
        SPEC_MAP.set(`${spec.type_combustible}|${spec.fournisseur}`, spec);
    });

    return specifications;
};

export async function addSpecification(spec: Omit<Specification, 'id'>) {
    const q = query(collection(db, "specifications"), where("type_combustible", "==", spec.type_combustible), where("fournisseur", "==", spec.fournisseur));
    const existing = await getDocs(q);
    if (!existing.empty) {
        throw new Error("Une spécification pour ce combustible et ce fournisseur existe déjà.");
    }
    await addDoc(collection(db, "specifications"), spec);
};

export async function updateSpecification(id: string, specUpdate: Partial<Omit<Specification, 'id'>>) {
    const specRef = doc(db, "specifications", id);
    await updateDoc(specRef, specUpdate);
};

export async function deleteSpecification(id: string) {
    await deleteDoc(doc(db, "specifications", id));
};

export async function seedDatabase() {
    if (isInitialized || isSeeding) return;
    isSeeding = true;
    
    try {
        const flagRef = doc(db, "meta", "initialized");
        const flagDoc = await getDoc(flagRef);

        if (!flagDoc.exists()) {
            console.log("Seeding database with initial specifications...");
            const batch = writeBatch(db);
            INITIAL_SPECIFICATIONS_DATA.forEach(spec => {
                const docRef = doc(collection(db, "specifications"));
                batch.set(docRef, spec);
            });
            batch.set(flagRef, { seeded: true });
            await batch.commit();
            console.log("Database seeded successfully.");
        }
        isInitialized = true;
    } catch (error) {
        console.error("Error seeding database: ", error);
        // Do not re-throw, to allow app to function with local data if seeding fails
    } finally {
        isSeeding = false;
    }
}
