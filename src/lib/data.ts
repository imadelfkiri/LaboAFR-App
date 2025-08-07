
// src/lib/data.ts
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, writeBatch, query, where, getDoc } from 'firebase/firestore';
import { db, firebaseAppPromise } from './firebase';

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
    { type_combustible: 'Plastiques', fournisseur: 'Bichara', H2O_max: 10, PCI_min: 4200, Cl_max: 1, Cendres_max: 15, Soufre_max: null },
    { type_combustible: 'Plastiques', fournisseur: 'Ssardi', H2O_max: 18, PCI_min: 4200, Cl_max: 1, Cendres_max: 15, Soufre_max: null },
    { type_combustible: 'Plastiques', fournisseur: 'ValRecete', H2O_max: 15, PCI_min: 4300, Cl_max: 1, Cendres_max: 15, Soufre_max: 0.5 },
    { type_combustible: 'Plastiques', fournisseur: 'Valtradec', H2O_max: 10, PCI_min: 6000, Cl_max: 1, Cendres_max: 15, Soufre_max: 0.5 },
    { type_combustible: 'Pneus', fournisseur: 'Aliapur', H2O_max: 1, PCI_min: 6800, Cl_max: 0.3, Cendres_max: 1, Soufre_max: null },
    { type_combustible: 'Pneus', fournisseur: 'RJL', H2O_max: 1, PCI_min: 6800, Cl_max: 0.3, Cendres_max: 1, Soufre_max: null },
];

function populateHMap() {
    INITIAL_FUEL_TYPES.forEach(ft => {
        H_MAP[ft.name] = ft.hValue;
    });
}

populateHMap();

let isSeeding = false;
let seedingPromise: Promise<void> | null = null;
export async function seedDatabase() {
    if (isSeeding) return seedingPromise;
    seedingPromise = (async () => {
        if (isSeeding) return;
        isSeeding = true;
        try {
            await firebaseAppPromise;
            const seedCheckDoc = doc(db, 'internal', 'seed_check');
            const docSnap = await getDoc(seedCheckDoc);
            if (docSnap.exists()) {
                console.log("Database already seeded.");
                return;
            }

            console.log("Seeding database with initial data...");
            const batch = writeBatch(db);
            
            const uniqueFuelTypes = [...new Map(INITIAL_FUEL_TYPES.map(item => [item['name'], item])).values()];
            uniqueFuelTypes.forEach(fuelType => {
                const docRef = doc(collection(db, 'fuel_types'));
                batch.set(docRef, fuelType);
            });
            
            const uniqueFournisseurs = [...new Set(INITIAL_FOURNISSEURS)];
            uniqueFournisseurs.forEach(fournisseur => {
                const docRef = doc(collection(db, 'fournisseurs'));
                batch.set(docRef, { name: fournisseur });
            });
            
            const uniqueSpecifications = [...new Map(INITIAL_SPECIFICATIONS_DATA.map(item => [`${item.type_combustible}-${item.fournisseur}`, item])).values()];
            uniqueSpecifications.forEach(spec => {
                const docRef = doc(collection(db, 'specifications'));
                batch.set(docRef, spec);
            });

            batch.set(seedCheckDoc, { seeded: true, timestamp: new Date() });

            await batch.commit();
            console.log("Database seeded successfully.");
        } catch (error) {
            console.error("Error seeding database:", error);
        } finally {
            isSeeding = false;
        }
    })();
    return seedingPromise;
}


export async function getFuelTypes(): Promise<FuelType[]> {
    await firebaseAppPromise;
    const fuelTypesCollection = collection(db, 'fuel_types');
    const snapshot = await getDocs(fuelTypesCollection);
    
    // This is a fallback to initial data if the collection is empty, but the seeding should prevent this.
    if (snapshot.empty) {
        console.log("No fuel types found, returning initial data for display.");
        return INITIAL_FUEL_TYPES;
    }

    const fuelTypes = snapshot.docs.map(doc => doc.data() as FuelType);
    
    // Update H_MAP dynamically
    fuelTypes.forEach(ft => {
        H_MAP[ft.name] = ft.hValue;
    });

    return fuelTypes;
};

export async function getFournisseurs(): Promise<string[]> {
    await firebaseAppPromise;
    const fournisseursCollection = collection(db, 'fournisseurs');
    const snapshot = await getDocs(fournisseursCollection);
    
    // Fallback
    if (snapshot.empty) {
        console.log("No fournisseurs found, returning initial data for display.");
        return INITIAL_FOURNISSEURS;
    }

    const suppliers = snapshot.docs.map(doc => doc.data().name as string);
    return [...new Set(suppliers)]; // Ensure uniqueness
};

async function updateSpecMap() {
    SPEC_MAP.clear();
    const specs = await getSpecifications(true); // get from db
    specs.forEach(spec => {
        SPEC_MAP.set(`${spec.type_combustible}|${spec.fournisseur}`, spec);
    });
}

export async function getSpecifications(forceDbRead = false): Promise<Specification[]> {
    await firebaseAppPromise;
    const specsCollection = collection(db, 'specifications');
    const snapshot = await getDocs(specsCollection);

    if (snapshot.empty && !forceDbRead) {
        console.log("No specifications found in DB, returning initial data for display.");
        return INITIAL_SPECIFICATIONS_DATA.map((spec, index) => ({ id: `initial-${index}`, ...spec }));
    }
    
    if(snapshot.empty && forceDbRead) {
        return [];
    }

    const specs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Specification));
    
    SPEC_MAP.clear();
    specs.forEach(spec => {
        SPEC_MAP.set(`${spec.type_combustible}|${spec.fournisseur}`, spec);
    });

    return specs;
};

export async function addSpecification(spec: Omit<Specification, 'id'>) {
    await firebaseAppPromise;
    const q = query(collection(db, "specifications"), where("type_combustible", "==", spec.type_combustible), where("fournisseur", "==", spec.fournisseur));
    const existing = await getDocs(q);
if (!existing.empty) {
        throw new Error("Une spécification pour ce combustible et ce fournisseur existe déjà.");
    }

    // Also add the new fournisseur to the 'fournisseurs' collection if it doesn't exist
    const founisseurQuery = query(collection(db, "fournisseurs"), where("name", "==", spec.fournisseur));
    const existingFournisseur = await getDocs(founisseurQuery);
    if(existingFournisseur.empty){
        await addDoc(collection(db, 'fournisseurs'), {name: spec.fournisseur});
    }

    const docRef = await addDoc(collection(db, 'specifications'), spec);
    await updateSpecMap();
    return docRef;
};

export async function updateSpecification(id: string, specUpdate: Partial<Omit<Specification, 'id'>>) {
    await firebaseAppPromise;
    const specRef = doc(db, 'specifications', id);
    await updateDoc(specRef, specUpdate);
    await updateSpecMap();
};

export async function deleteSpecification(id: string) {
    await firebaseAppPromise;
    const specRef = doc(db, 'specifications', id);
    await deleteDoc(specRef);
    await updateSpecMap();
};
