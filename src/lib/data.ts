
// src/lib/data.ts
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, writeBatch, query, where, getDoc, arrayUnion, orderBy, Timestamp, setDoc,getCountFromServer } from 'firebase/firestore';
import { db } from './firebase';

export const H_MAP: Record<string, number> = {};

export interface FuelType {
    id?: string;
    name: string;
    hValue: number;
}

export interface Specification {
    id:string;
    type_combustible: string;
    fournisseur: string;
    PCI_min?: number | null;
    H2O_max?: number | null;
    Cl_max?: number | null;
    Cendres_max?: number | null;
    Soufre_max?: number | null;
}

export const SPEC_MAP = new Map<string, Specification>();

function populateHMap(fuelTypes: FuelType[]) {
    H_MAP['default'] = 6.0; // Default fallback
    fuelTypes.forEach(ft => {
        H_MAP[ft.name] = ft.hValue;
    });
}

export async function getFuelSupplierMap(): Promise<Record<string, string[]>> {
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
            // Ensure unique suppliers
            map[doc.id] = [...new Set(data.suppliers)];
        }
    });

    return map;
}

export async function addSupplierToFuel(fuelType: string, supplier: string): Promise<void> {
    const fuelDocRef = doc(db, 'fuel_supplier_map', fuelType);
    const docSnap = await getDoc(fuelDocRef);

    if (docSnap.exists()) {
        const existingSuppliers = docSnap.data().suppliers || [];
        if (!existingSuppliers.includes(supplier)) {
            await updateDoc(fuelDocRef, {
                suppliers: arrayUnion(supplier)
            });
        }
    } else {
        await setDoc(fuelDocRef, { suppliers: [supplier] });
    }
}


export async function getFuelTypes(): Promise<FuelType[]> {
    const fuelTypesCollection = collection(db, 'fuel_types');
    const q = query(fuelTypesCollection, orderBy("name"));
    const snapshot = await getDocs(q);
    
    const fuelTypes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FuelType));
    
    populateHMap(fuelTypes);
    
    // Remove duplicates by name, just in case
    const uniqueFuelTypes = Array.from(new Map(fuelTypes.map(item => [item['name'], item])).values());

    return uniqueFuelTypes;
};

export async function getFournisseurs(): Promise<string[]> {
    const fournisseursCollection = collection(db, 'fournisseurs');
    const snapshot = await getDocs(fournisseursCollection);
    
    const suppliers = snapshot.docs.map(doc => doc.data().name as string);
    return [...new Set(suppliers)]; // Return unique suppliers
};

async function updateSpecMap() {
    SPEC_MAP.clear();
    const specs = await getSpecifications(true); // Force read from DB
    specs.forEach(spec => {
        SPEC_MAP.set(`${spec.type_combustible}|${spec.fournisseur}`, spec);
    });
}

export async function getSpecifications(forceDbRead = false): Promise<Specification[]> {
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
    const q = query(collection(db, "specifications"), where("type_combustible", "==", spec.type_combustible), where("fournisseur", "==", spec.fournisseur));
    const existing = await getDocs(q);
    if (!existing.empty) {
            throw new Error("Une spécification pour ce combustible et ce fournisseur existe déjà.");
    }
    
    await addDoc(collection(db, 'specifications'), spec);
    await updateSpecMap();
};

export async function updateSpecification(id: string, specUpdate: Partial<Omit<Specification, 'id'>>) {
    const specRef = doc(db, 'specifications', id);
    await updateDoc(specRef, specUpdate);
    await updateSpecMap();
};

export async function deleteSpecification(id: string) {
    const specRef = doc(db, 'specifications', id);
    await deleteDoc(specRef);
    await updateSpecMap();
};
