
// src/lib/data.ts
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, writeBatch, query, where, getDoc, arrayUnion, orderBy, Timestamp } from 'firebase/firestore';
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

export async function getFuelSupplierMap(): Promise<Record<string, string[]>> {
    await firebaseAppPromise;
    const mapCollection = collection(db, 'fuel_supplier_map');
    const snapshot = await getDocs(mapCollection);
    
    if (snapshot.empty) {
        console.warn("fuel_supplier_map collection is empty. Falling back to specifications.");
        return {};
    }

    const map: Record<string, string[]> = {};
    snapshot.forEach(doc => {
        const data = doc.data();
        if (data.suppliers && Array.isArray(data.suppliers)) {
            map[doc.id] = data.suppliers;
        }
    });

    return map;
}

export async function addSupplierToFuel(fuelType: string, supplier: string): Promise<void> {
    await firebaseAppPromise;
    const fuelDocRef = doc(db, 'fuel_supplier_map', fuelType);

    const docSnap = await getDoc(fuelDocRef);

    if (docSnap.exists()) {
        await updateDoc(fuelDocRef, {
            suppliers: arrayUnion(supplier)
        });
    } else {
        await writeBatch(db).set(fuelDocRef, { suppliers: [supplier] }).commit();
    }
}


// This function will now be called from the component to ensure it runs.
export async function seedSpecifications() {
    await firebaseAppPromise;
    const specsCollection = collection(db, 'specifications');
    const snapshot = await getDocs(specsCollection);

    if (snapshot.empty) {
        console.log("Specifications collection is empty. Seeding now...");
        const batch = writeBatch(db);
        INITIAL_SPECIFICATIONS_DATA.forEach(spec => {
            const docRef = doc(collection(db, 'specifications'));
            batch.set(docRef, spec);
        });
        await batch.commit();
        console.log("Specifications seeded successfully.");
    } else {
        console.log("Specifications collection already exists.");
    }
}


export async function getFuelTypes(): Promise<FuelType[]> {
    await firebaseAppPromise;
    const fuelTypesCollection = collection(db, 'fuel_types');
    const snapshot = await getDocs(fuelTypesCollection);
    
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


export async function getFuelTypesSortedByRecency(): Promise<FuelType[]> {
    await firebaseAppPromise;

    // 1. Get all available fuel types
    const allFuelTypes = await getFuelTypes();
    const allFuelTypeNames = allFuelTypes.map(ft => ft.name);

    // 2. Get all results to determine recency
    const resultsQuery = query(collection(db, "resultats"), orderBy("date_creation", "desc"));
    const resultsSnapshot = await getDocs(resultsQuery);

    const fuelRecencyMap = new Map<string, number>();

    resultsSnapshot.forEach(doc => {
        const result = doc.data();
        const fuelType = result.type_combustible;
        const timestamp = result.date_creation as Timestamp;

        if (fuelType && !fuelRecencyMap.has(fuelType)) {
             // Use seconds as a simple numeric value for sorting.
            fuelRecencyMap.set(fuelType, timestamp?.seconds || 0);
        }
    });

    // 3. Separate used and unused fuel types
    const usedFuelTypes = allFuelTypes.filter(ft => fuelRecencyMap.has(ft.name));
    const unusedFuelTypes = allFuelTypes.filter(ft => !fuelRecencyMap.has(ft.name));

    // 4. Sort used fuel types by recency (most recent first)
    usedFuelTypes.sort((a, b) => {
        const recencyA = fuelRecencyMap.get(a.name) || 0;
        const recencyB = fuelRecencyMap.get(b.name) || 0;
        return recencyB - recencyA; // Descending order
    });

    // 5. Sort unused fuel types alphabetically
    unusedFuelTypes.sort((a, b) => a.name.localeCompare(b.name));

    // 6. Combine the lists
    return [...usedFuelTypes, ...unusedFuelTypes];
}


export async function getFournisseurs(): Promise<string[]> {
    await firebaseAppPromise;
    const fournisseursCollection = collection(db, 'fournisseurs');
    const snapshot = await getDocs(fournisseursCollection);
    
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
