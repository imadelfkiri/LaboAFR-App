
import { collection, getDocs, doc, writeBatch } from "firebase/firestore";
import { db } from "./firebase";

export const H_MAP: Record<string, number> = {};

export interface FuelType {
    name: string;
    icon: string;
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

export let FUEL_TYPE_SUPPLIERS_MAP: Record<string, string[]> = {};

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
        FUEL_TYPE_SUPPLIERS_MAP = map;
        return map;
    }
    
    querySnapshot.forEach((doc) => {
        map[doc.id] = doc.data().suppliers;
    });

    FUEL_TYPE_SUPPLIERS_MAP = map;
    return map;
}
