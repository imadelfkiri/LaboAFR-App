
import { collection, getDocs, doc, writeBatch, query, setDoc, orderBy, serverTimestamp, getDoc, addDoc, updateDoc, deleteDoc, runTransaction } from "firebase/firestore";
import { db } from "./firebase";

export const H_MAP: Record<string, number> = {};

export interface FuelType {
    name: string;
    icon: string;
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
    { name: "Textile", icon: "👗", hValue: 6.0 },
    { name: "RDF", icon: "🔁", hValue: 6.0 },
    { name: "Pneus", icon: "🚗", hValue: 6.5 },
    { name: "Plastiques", icon: "🧴", hValue: 7.0 },
    { name: "Pet Coke", icon: "🔥", hValue: 3.5 },
    { name: "Mélange", icon: "🧪", hValue: 6.0 },
    { name: "Grignons d'olives", icon: "🫒", hValue: 6.0 },
    { name: "DMB", icon: "🧱", hValue: 6.5 },
    { name: "Charbon", icon: "🪨", hValue: 4.5 },
    { name: "Caoutchouc", icon: "🛞", hValue: 6.8 },
    { name: "CSR", icon: "♻️", hValue: 6.0 },
    { name: "Boues", icon: "💧", hValue: 5.5 },
    { name: "Bois", icon: "🌲", hValue: 6.0 },
];


export const getFuelTypes = async (): Promise<FuelType[]> => {
    const fuelTypesCollectionRef = collection(db, "fuel_types");
    
    const q = query(fuelTypesCollectionRef, orderBy("createdAt", "asc"));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
        console.log("Fuel types collection is empty, seeding with initial data...");
        const batch = writeBatch(db);
        const typesToReturn: FuelType[] = [];
        
        INITIAL_FUEL_TYPES.forEach((fuelType) => {
            const docRef = doc(fuelTypesCollectionRef, fuelType.name);
            const dataWithTimestamp = { ...fuelType, createdAt: serverTimestamp() };
            batch.set(docRef, dataWithTimestamp);
            typesToReturn.push({ ...fuelType, createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 } });
        });
        await batch.commit();
        console.log("Seeding complete.");

        typesToReturn.sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0));
        
        typesToReturn.forEach(t => {
            if (t.hValue !== undefined) H_MAP[t.name] = t.hValue;
        });

        return typesToReturn;
    }

    const types: FuelType[] = [];
    querySnapshot.forEach((doc) => {
        const data = doc.data() as FuelType;
        if (data.name !== "TEST") {
            types.push(data);
            if (data.hValue !== undefined) {
                H_MAP[data.name] = data.hValue;
            }
        }
    });
    
    types.forEach(t => {
        if (t.hValue !== undefined) H_MAP[t.name] = t.hValue;
    });

    return types;
};

export const fixFuelTypesMissingCreatedAt = async () => {
    const ref = collection(db, "fuel_types");
    const snapshot = await getDocs(ref);
    const batch = writeBatch(db);
    let updatesMade = false;

    snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (!data.createdAt) {
            updatesMade = true;
            const docRef = doc(ref, docSnap.id);
            batch.update(docRef, { createdAt: serverTimestamp() });
        }
    });

    if (updatesMade) {
        try {
            await batch.commit();
            console.log("Mise à jour terminée : Tous les documents fuel_types ont maintenant un champ createdAt.");
        } catch(error) {
            console.error("Erreur lors de la mise à jour des createdAt", error);
        }
    }
};

const INITIAL_FOURNISSEURS = [
    "Ain Seddeine", "Aliapur", "Bichara", "Géocycle", "MTR", "ONEE",
    "NAJD", "Polluclean", "SMBRM", "Sotraforest", "Ssardi", "RJL", "CNAPP",
    "ValRecete", "Valtradec"
];

export const getFournisseurs = async (): Promise<string[]> => {
    const fournisseursCollectionRef = collection(db, "fournisseurs");
    const querySnapshot = await getDocs(query(fournisseursCollectionRef, orderBy("name", "asc")));
    const fournisseurs: string[] = [];

    if (querySnapshot.empty) {
        console.log("Fournisseurs collection is empty, seeding with initial data...");
        const batch = writeBatch(db);
        INITIAL_FOURNISSEURS.forEach(name => {
            const docRef = doc(fournisseursCollectionRef, name);
            batch.set(docRef, { name });
            fournisseurs.push(name);
        });
        await batch.commit();
        console.log("Seeding complete.");
        return fournisseurs.sort();
    }

    querySnapshot.forEach((doc) => {
        fournisseurs.push(doc.data().name);
    });

    return fournisseurs;
};

const INITIAL_FUEL_TYPE_SUPPLIERS_MAP: Record<string, string[]> = {
    "Bois": ["Sotraforest", "CNAPP", "SMBRM"],
    "Boues": ["ONEE"],
    "CSR": ["SMBRM", "Polluclean"],
    "Caoutchouc": ["Bichara", "SMBRM"],
    "Charbon": [],
    "DMB": ["MTR"],
    "Grignons d'olives": ["Ain Seddeine"],
    "Mélange": ["SMBRM"],
    "Pet Coke": [],
    "Plastiques": ["Bichara", "ValRecete", "Ssardi", "Valtradec", "NAJD"],
    "Pneus": ["Aliapur", "RJL", "SMBRM"],
    "RDF": ["Géocycle"],
    "Textile": ["SMBRM"]
};

export const getFuelSupplierMap = async (): Promise<Record<string, string[]>> => {
    const mapCollectionRef = collection(db, "fuel_supplier_map");
    const querySnapshot = await getDocs(mapCollectionRef);
    const map: Record<string, string[]> = {};

    if (querySnapshot.empty) {
        console.log("Fuel supplier map is empty, seeding with initial data...");
        const batch = writeBatch(db);
        Object.entries(INITIAL_FUEL_TYPE_SUPPLIERS_MAP).forEach(([fuel, suppliers]) => {
            const docRef = doc(mapCollectionRef, fuel);
            batch.set(docRef, { suppliers });
            map[fuel] = suppliers;
        });
        await batch.commit();
        console.log("Seeding complete.");
        return map;
    }
    
    querySnapshot.forEach((doc) => {
        map[doc.id] = doc.data().suppliers;
    });

    return map;
}

// --- Specifications Logic ---
const cleanSpecData = (spec: any): Omit<Specification, 'id'> => {
    const cleaned: any = {
        type_combustible: spec.type_combustible,
        fournisseur: spec.fournisseur,
    };
    const fields: (keyof Omit<Specification, 'id' | 'type_combustible' | 'fournisseur'>)[] = ['PCI_min', 'H2O_max', 'Cl_max', 'Cendres_max', 'Soufre_max'];
    fields.forEach(field => {
        cleaned[field] = spec[field] === undefined || spec[field] === '' ? null : spec[field];
    });
    return cleaned;
};

const INITIAL_SPECIFICATIONS: Omit<Specification, 'id'>[] = [
    { type_combustible: 'CSR', fournisseur: 'Polluclean', H2O_max: 16.5, PCI_min: 4000, Cl_max: 1, Cendres_max: 15, Soufre_max: null },
    { type_combustible: 'CSR', fournisseur: 'SMBRM', H2O_max: 14, PCI_min: 5000, Cl_max: 0.6, Cendres_max: null, Soufre_max: null },
    { type_combustible: 'DMB', fournisseur: 'MTR', H2O_max: 15, PCI_min: 4300, Cl_max: 0.6, Cendres_max: 15, Soufre_max: 0.5 },
    { type_combustible: "Grignons d'olives", fournisseur: 'Ain Seddeine', H2O_max: 20, PCI_min: 3700, Cl_max: 0.5, Cendres_max: 5, Soufre_max: null },
    { type_combustible: 'Plastiques', fournisseur: 'Bichara', H2O_max: 10, PCI_min: 4200, Cl_max: 1, Cendres_max: 15, Soufre_max: null },
    { type_combustible: 'Plastiques', fournisseur: 'Ssardi', H2O_max: 18, PCI_min: 4200, Cl_max: 1, Cendres_max: 15, Soufre_max: null },
    { type_combustible: 'Plastiques', fournisseur: 'ValRecete', H2O_max: 15, PCI_min: 4300, Cl_max: 1, Cendres_max: 15, Soufre_max: 0.5 },
    { type_combustible: 'Plastiques', fournisseur: 'Valtradec', H2O_max: 10, PCI_min: 6000, Cl_max: 1, Cendres_max: 15, Soufre_max: 0.5 },
    { type_combustible: 'Pneus', fournisseur: 'Aliapur', H2O_max: 1, PCI_min: 6800, Cl_max: 0.3, Cendres_max: 1, Soufre_max: null },
    { type_combustible: 'Pneus', fournisseur: 'RJL', H2O_max: 1, PCI_min: 6800, Cl_max: 0.3, Cendres_max: 1, Soufre_max: null },
];

async function seedSpecifications() {
    console.log("Seeding initial specifications...");
    const specsCollectionRef = collection(db, "specifications");
    const batch = writeBatch(db);
    
    INITIAL_SPECIFICATIONS.forEach(spec => {
        const docRef = doc(specsCollectionRef); 
        batch.set(docRef, cleanSpecData(spec));
    });

    try {
        await batch.commit();
        console.log("Initial specifications seeded successfully.");
    } catch(error) {
        console.error("Error seeding specifications:", error);
    }
}

export const getSpecifications = async (): Promise<Specification[]> => {
    const specsCollectionRef = collection(db, "specifications");
    let querySnapshot = await getDocs(query(specsCollectionRef, orderBy("type_combustible"), orderBy("fournisseur")));

    // If the collection is empty, seed it with initial data.
    if (querySnapshot.empty) {
        console.log("Specifications collection is empty. Seeding data...");
        await seedSpecifications();
        // Re-fetch the data after seeding
        querySnapshot = await getDocs(query(specsCollectionRef, orderBy("type_combustible"), orderBy("fournisseur")));
    }
    
    const specs: Specification[] = [];
    SPEC_MAP.clear(); // Clear the map before populating

    querySnapshot.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() } as Specification;
        specs.push(data);
        SPEC_MAP.set(`${data.type_combustible}|${data.fournisseur}`, data);
    });

    return specs;
};


export const addSpecification = async (spec: Omit<Specification, 'id'>) => {
    await addDoc(collection(db, "specifications"), cleanSpecData(spec));
};

export const updateSpecification = async (id: string, spec: Partial<Specification>) => {
    const specDocRef = doc(db, "specifications", id);
    await updateDoc(specDocRef, cleanSpecData(spec));
};

export const deleteSpecification = async (id: string) => {
    const specDocRef = doc(db, "specifications", id);
    await deleteDoc(specDocRef);
};

    