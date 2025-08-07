
import { collection, getDocs, doc, writeBatch, query, setDoc, orderBy, serverTimestamp, getDoc, addDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "./firebase";

export const H_MAP: Record<string, number> = {};

export interface FuelType {
    name: string;
    icon: string;
    hValue: number;
    createdAt?: { seconds: number; nanoseconds: number; };
}

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
