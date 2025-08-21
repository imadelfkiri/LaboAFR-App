
// src/lib/data.ts
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, writeBatch, query, where, getDoc, arrayUnion, orderBy, Timestamp, setDoc } from 'firebase/firestore';
import { db, firebaseAppPromise } from './firebase';

export const H_MAP: Record<string, number> = {};

export interface FuelType {
    id?: string;
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
    { name: "Grignons", hValue: 5.0 },
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

function populateHMap(fuelTypes: FuelType[]) {
    H_MAP['default'] = 6.0; // Default fallback
    fuelTypes.forEach(ft => {
        H_MAP[ft.name] = ft.hValue;
    });
}

const seedInitialData = async () => {
    await firebaseAppPromise;
    console.log("Checking if initial data seeding is required...");

    const checkPromises = [
        getDocs(collection(db, 'fuel_types')),
        getDocs(collection(db, 'fournisseurs')),
        getDocs(collection(db, 'specifications')),
        getDocs(collection(db, 'fuel_supplier_map'))
    ];

    const snapshots = await Promise.all(checkPromises);
    const isEmpty = snapshots.some(snapshot => snapshot.empty);

    if (isEmpty) {
        console.log("One or more collections are empty. Seeding all initial data...");
        const batch = writeBatch(db);

        // Seed Fuel Types
        INITIAL_FUEL_TYPES.forEach(fuel => {
            const docRef = doc(db, 'fuel_types', fuel.name.replace(/ /g, '_'));
            batch.set(docRef, fuel);
        });

        // Seed Fournisseurs
        INITIAL_FOURNISSEURS.forEach(fournisseur => {
            const docRef = doc(db, 'fournisseurs', fournisseur);
            batch.set(docRef, { name: fournisseur });
        });

        // Seed Specifications
        INITIAL_SPECIFICATIONS_DATA.forEach(spec => {
            const docRef = doc(collection(db, 'specifications'));
            batch.set(docRef, spec);
        });

        // Seed Fuel Supplier Map
        const supplierMap: Record<string, string[]> = {};
        INITIAL_SPECIFICATIONS_DATA.forEach(spec => {
            if (!supplierMap[spec.type_combustible]) {
                supplierMap[spec.type_combustible] = [];
            }
            if (!supplierMap[spec.type_combustible].includes(spec.fournisseur)) {
                supplierMap[spec.type_combustible].push(spec.fournisseur);
            }
        });
        Object.entries(supplierMap).forEach(([fuelType, suppliers]) => {
            const docRef = doc(db, 'fuel_supplier_map', fuelType);
            batch.set(docRef, { suppliers });
        });

        await batch.commit();
        console.log("All initial data seeded successfully.");
    } else {
        console.log("Initial data already exists. Seeding skipped.");
    }
};


export async function getFuelSupplierMap(): Promise<Record<string, string[]>> {
    await firebaseAppPromise;
    const mapCollection = collection(db, 'fuel_supplier_map');
    const snapshot = await getDocs(mapCollection);
    
    if (snapshot.empty) {
        console.warn("fuel_supplier_map collection is empty.");
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
        await setDoc(fuelDocRef, { suppliers: [supplier] });
    }
}


export async function getFuelTypes(): Promise<FuelType[]> {
    await firebaseAppPromise;
    const fuelTypesCollection = collection(db, 'fuel_types');
    const snapshot = await getDocs(fuelTypesCollection);

    if (snapshot.empty) {
        return [];
    }
    
    const fuelTypes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FuelType));
    
    populateHMap(fuelTypes);

    return fuelTypes;
};


export async function getFuelTypesSortedByRecency(): Promise<FuelType[]> {
    await firebaseAppPromise;

    const allFuelTypes = await getFuelTypes();
    if (allFuelTypes.length === 0) return [];

    const resultsQuery = query(collection(db, "resultats"), orderBy("date_creation", "desc"));
    const resultsSnapshot = await getDocs(resultsQuery);

    const fuelRecencyMap = new Map<string, number>();

    resultsSnapshot.forEach(doc => {
        const result = doc.data();
        const fuelType = result.type_combustible;
        const timestamp = result.date_creation as Timestamp;

        if (fuelType && !fuelRecencyMap.has(fuelType)) {
             fuelRecencyMap.set(fuelType, timestamp?.seconds || 0);
        }
    });

    const usedFuelTypes = allFuelTypes.filter(ft => fuelRecencyMap.has(ft.name));
    const unusedFuelTypes = allFuelTypes.filter(ft => !fuelRecencyMap.has(ft.name));

    usedFuelTypes.sort((a, b) => {
        const recencyA = fuelRecencyMap.get(a.name) || 0;
        const recencyB = fuelRecencyMap.get(b.name) || 0;
        return recencyB - recencyA;
    });

    unusedFuelTypes.sort((a, b) => a.name.localeCompare(b.name));

    return [...usedFuelTypes, ...unusedFuelTypes];
}


export async function getFournisseurs(): Promise<string[]> {
    await firebaseAppPromise;
    const fournisseursCollection = collection(db, 'fournisseurs');
    const snapshot = await getDocs(fournisseursCollection);
    
    if (snapshot.empty) {
        return [];
    }

    const suppliers = snapshot.docs.map(doc => doc.data().name as string);
    return [...new Set(suppliers)];
};

async function updateSpecMap() {
    SPEC_MAP.clear();
    const specs = await getSpecifications(true);
    specs.forEach(spec => {
        SPEC_MAP.set(`${spec.type_combustible}|${spec.fournisseur}`, spec);
    });
}

export async function getSpecifications(forceDbRead = false): Promise<Specification[]> {
    await firebaseAppPromise;
    if (!forceDbRead && SPEC_MAP.size > 0) {
        return Array.from(SPEC_MAP.values());
    }

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
    
    await addDoc(collection(db, 'specifications'), spec);
    await updateSpecMap();
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

// Export the seeding function so it can be called from a component.
export { seedInitialData };
