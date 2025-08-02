import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";

export const H_MAP: Record<string, number> = {
  "Pneus": 6.5,
  "Bois": 6.0,
  "CSR": 6.0,
  "Grignons": 6.0,
  "Boues": 5.5,
  "Pet Coke": 3.5,
  "Charbon": 4.5,
  "Caoutchouc": 6.8,
  "Textile": 6.0,
  "Plastiques": 7.0,
  "DMB": 6.5,
  "Mélange": 6.0,
  "RDF": 6.0,
};

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
    const querySnapshot = await getDocs(collection(db, "fuel_types"));
    const types: FuelType[] = [];
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


export const FOURNISSEURS = [
    "Ain Seddeine",
    "Aliapur",
    "Bichara",
    "Géocycle",
    "MTR",
    "NAJD",
    "Polluclean",
    "SMBRM",
    "Sotraforest",
    "Ssardi",
    "ValRecete",
    "Valtradec"
].sort();
