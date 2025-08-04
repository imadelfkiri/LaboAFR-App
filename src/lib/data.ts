
import { collection, getDocs, doc, writeBatch, query, orderBy, serverTimestamp } from "firebase/firestore";
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
    h2o: string;
    pci: string;
    chlorures: string;
    cendres: string;
    soufre: string;
    granulometrie: string;
}

export const INITIAL_FUEL_TYPES: Omit<FuelType, 'createdAt'>[] = [
    { name: "Textile", icon: "👗", hValue: 6.0 },
    { name: "RDF", icon: "🔁", hValue: 6.0 },
    { name: "Pneus", icon: "🚗", hValue: 6.5 },
    { name: "Plastiques", icon: "🧴", hValue: 7.0 },
    { name: "Pet Coke", icon: "🔥", hValue: 3.5 },
    { name: "Mélange", icon: "🧪", hValue: 6.0 },
    { name: "Grignons", icon: "🫒", hValue: 6.0 },
    { name: "DMB", icon: "🧱", hValue: 6.5 },
    { name: "Charbon", icon: "🪨", hValue: 4.5 },
    { name: "Caoutchouc", icon: "🛞", hValue: 6.8 },
    { name: "CSR", icon: "♻️", hValue: 6.0 },
    { name: "Boues", icon: "💧", hValue: 5.5 },
    { name: "Bois", icon: "🌲", hValue: 6.0 },
].map(fuel => ({ ...fuel }));


export const getFuelTypes = async (): Promise<FuelType[]> => {
    const fuelTypesCollectionRef = collection(db, "fuel_types");
    const q = query(fuelTypesCollectionRef, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    const types: FuelType[] = [];

    if (querySnapshot.empty) {
        console.log("Fuel types collection is empty, seeding with initial data...");
        const batch = writeBatch(db);
        
        INITIAL_FUEL_TYPES.forEach((fuelType: any) => {
            const docRef = doc(fuelTypesCollectionRef, fuelType.name);
            batch.set(docRef, { ...fuelType, createdAt: serverTimestamp() });
            types.push({ name: fuelType.name, icon: fuelType.icon });
            H_MAP[fuelType.name] = fuelType.hValue;
        });
        await batch.commit();
        console.log("Seeding complete.");
        // Re-fetch to get sorted data
        const newSnapshot = await getDocs(q);
        newSnapshot.forEach(doc => {
            const data = doc.data();
            if (!types.some(t => t.name === data.name)) {
                types.push({ name: data.name, icon: data.icon });
                 if (data.hValue !== undefined) {
                    H_MAP[data.name] = data.hValue;
                }
            }
        });
        return types;
    }

    querySnapshot.forEach((doc) => {
        const data = doc.data();
        types.push({ name: data.name, icon: data.icon });
        // Also update H_MAP dynamically
        if (data.hValue !== undefined) {
            H_MAP[data.name] = data.hValue;
        }
    });
    return types;
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
    {combustible: "Grignons d'olives", fournisseur: "Ain Seddeine", h2o: "<20%", pci: ">3700", chlorures: "<0.5%", cendres: "<5%", soufre: "/", granulometrie: "/"},
    {combustible: "DMB", fournisseur: "MTR", h2o: "<15%", pci: ">4300", chlorures: "<0.6%", cendres: "<15%", soufre: "<0.5%", granulometrie: "<100 mm"},
    {combustible: "Plastiques", fournisseur: "ValRecete", h2o: "<15%", pci: ">4300", chlorures: "<1%", cendres: "<15%", soufre: "<0.5%", granulometrie: "<100 mm"},
    {combustible: "Plastiques", fournisseur: "Bichara", h2o: "<10%", pci: ">4200", chlorures: "<1%", cendres: "<15%", soufre: "/", granulometrie: "<70 mm"},
    {combustible: "Plastiques", fournisseur: "Valtradec", h2o: "<10%", pci: ">6000", chlorures: "<1%", cendres: "<15%", soufre: "<0.5%", granulometrie: "<30 mm"},
    {combustible: "Plastiques", fournisseur: "Ssardi", h2o: "<18%", pci: ">4200", chlorures: "<1%", cendres: "<15%", soufre: "/", granulometrie: "<25 mm"},
    {combustible: "CSR", fournisseur: "Polluclean", h2o: "<16.5%", pci: ">4000", chlorures: "<1%", cendres: "<15%", soufre: "/", granulometrie: "<100 mm"},
    {combustible: "CSR", fournisseur: "SMBRM", h2o: "<14%", pci: ">5000", chlorures: "<0.6%", cendres: "<%", soufre: "/", granulometrie: "< mm"},
    {combustible: "Pneus", fournisseur: "RJL", h2o: "<1%", pci: ">6800", chlorures: "<0.3%", cendres: "<1%", soufre: "/", granulometrie: "<100 mm"},
    {combustible: "Pneus", fournisseur: "Aliapur", h2o: "<1%", pci: ">6800", chlorures: "<0.3%", cendres: "<1%", soufre: "/", granulometrie: "<100 mm"}
];

export const getSpecifications = async (): Promise<Specification[]> => {
    const specificationsCollectionRef = collection(db, "specifications");
    const querySnapshot = await getDocs(specificationsCollectionRef);
    const specifications: Specification[] = [];

    if (querySnapshot.empty) {
        console.log("Specifications collection is empty, seeding with initial data...");
        const batch = writeBatch(db);
        INITIAL_SPECIFICATIONS.forEach(spec => {
            const docRef = doc(collection(db, "specifications"));
            batch.set(docRef, spec);
        });
        await batch.commit();
        console.log("Specifications seeding complete.");
        // Re-fetch to get the generated IDs
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

    