
import { collection, getDocs, doc, writeBatch } from "firebase/firestore";
import { db } from "./firebase";

export const H_MAP: Record<string, number> = {};

export interface FuelType {
    name: string;
    icon: string;
}

export interface Specification {
    id: string;
    combustible: string;
    fournisseur: string;
    H2O_max: number;
    PCI_min: number;
    chlorures_max: number;
    cendres_max: number;
    soufre_max?: number;
    granulometrie_max_mm?: number;
}


export const INITIAL_FUEL_TYPES: (FuelType & { hValue: number })[] = [
    { name: "Bois", icon: "🌲", hValue: 6.0 },
    { name: "Boues", icon: "💧", hValue: 5.5 },
    { name: "CSR", icon: "♻️", hValue: 6.0 },
    { name: "Caoutchouc", icon: "🛞", hValue: 6.8 },
    { name: "Charbon", icon: "🪨", hValue: 4.5 },
    { name: "DMB", icon: "🧱", hValue: 6.5 },
    { name: "Grignons", icon: "🫒", hValue: 6.0 },
    { name: "Mélange", icon: "🧪", hValue: 6.0 },
    { name: "Pet Coke", icon: "🔥", hValue: 3.5 },
    { name: "Plastiques", icon: "🧴", hValue: 7.0 },
    { name: "Pneus", icon: "🚗", hValue: 6.5 },
    { name: "RDF", icon: "🔁", hValue: 6.0 },
    { name: "Textile", icon: "👗", hValue: 6.0 }
].sort((a, b) => a.name.localeCompare(b.name));


export const getFuelTypes = async (): Promise<FuelType[]> => {
    const fuelTypesCollectionRef = collection(db, "fuel_types");
    const querySnapshot = await getDocs(fuelTypesCollectionRef);
    const types: FuelType[] = [];

    if (querySnapshot.empty) {
        console.log("Fuel types collection is empty, seeding with initial data...");
        const batch = writeBatch(db);
        INITIAL_FUEL_TYPES.forEach(fuelType => {
            const docRef = doc(fuelTypesCollectionRef, fuelType.name);
            batch.set(docRef, fuelType);
            types.push({ name: fuelType.name, icon: fuelType.icon });
            H_MAP[fuelType.name] = fuelType.hValue;
        });
        await batch.commit();
        console.log("Seeding complete.");
        return types.sort((a, b) => a.name.localeCompare(b.name));
    }

    querySnapshot.forEach((doc) => {
        const data = doc.data();
        types.push({ name: data.name, icon: data.icon });
        // Also update H_MAP dynamically
        if (data.hValue !== undefined) {
            H_MAP[data.name] = data.hValue;
        }
    });
    return types.sort((a, b) => a.name.localeCompare(b.name));
};


const INITIAL_FOURNISSEURS = [
    "Ain Seddeine", "Aliapur", "Bichara", "Géocycle", "MTR", "ONEE",
    "NAJD", "Polluclean", "SMBRM", "Sotraforest", "Ssardi", "RJL", "CNAPP",
    "ValRecete", "Valtradec"
].sort();

export const getFournisseurs = async (): Promise<string[]> => {
    const fournisseursCollectionRef = collection(db, "fournisseurs");
    const querySnapshot = await getDocs(fournisseursCollectionRef);
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

    return fournisseurs.sort();
};

const INITIAL_FUEL_TYPE_SUPPLIERS_MAP: Record<string, string[]> = {
    "Bois": ["Sotraforest", "CNAPP", "SMBRM"],
    "Boues": ["ONEE"],
    "CSR": ["SMBRM", "Polluclean"],
    "Caoutchouc": ["Bichara", "SMBRM"],
    "Charbon": [],
    "DMB": ["MTR"],
    "Grignons": ["Ain Seddeine"],
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

const INITIAL_SPECIFICATIONS: Omit<Specification, 'id'>[] = [
    { combustible: "Pneus", fournisseur: "Aliapur", H2O_max: 3, PCI_min: 7500, chlorures_max: 0.3, cendres_max: 18, soufre_max: 1.8, granulometrie_max_mm: 350 },
    { combustible: "Pneus", fournisseur: "RJL", H2O_max: 3, PCI_min: 7500, chlorures_max: 0.3, cendres_max: 18, soufre_max: 1.8, granulometrie_max_mm: 350 },
    { combustible: "Plastiques", fournisseur: "ValRecete", H2O_max: 15, PCI_min: 4300, chlorures_max: 1, cendres_max: 15, soufre_max: 0.5, granulometrie_max_mm: 100 },
    { combustible: "CSR", fournisseur: "Polluclean", H2O_max: 20, PCI_min: 4000, chlorures_max: 0.8, cendres_max: 20, soufre_max: 0.6, granulometrie_max_mm: 80 },
    { combustible: "Bois", fournisseur: "Sotraforest", H2O_max: 25, PCI_min: 3500, chlorures_max: 0.1, cendres_max: 5 },
    { combustible: "Boues", fournisseur: "ONEE", H2O_max: 80, PCI_min: 2500, chlorures_max: 0.2, cendres_max: 30 },
];

export const getSpecifications = async (): Promise<Specification[]> => {
    const specificationsCollectionRef = collection(db, "specifications");
    const querySnapshot = await getDocs(specificationsCollectionRef);
    const specifications: Specification[] = [];

    if (querySnapshot.empty) {
        console.log("Specifications collection is empty, seeding with initial data...");
        const batch = writeBatch(db);
        INITIAL_SPECIFICATIONS.forEach(spec => {
            const docRef = doc(specificationsCollectionRef); // Auto-generated ID
            batch.set(docRef, spec);
        });
        await batch.commit();
        console.log("Specifications seeding complete.");
        // Re-fetch to get the generated IDs, or simply return the initial data for the first run
        const seededSnapshot = await getDocs(specificationsCollectionRef);
        seededSnapshot.forEach(doc => {
            specifications.push({ id: doc.id, ...doc.data() } as Specification);
        });
        return specifications;
    }

    querySnapshot.forEach((doc) => {
        specifications.push({ id: doc.id, ...doc.data() } as Specification);
    });
    return specifications;
};
