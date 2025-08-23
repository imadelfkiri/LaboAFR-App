
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

export interface AverageAnalysis {
    pci_brut: number;
    h2o: number;
    chlore: number;
    cendres: number;
    density: number;
    count: number;
}

export interface MixtureSession {
    id: string;
    timestamp: Timestamp;
    hallAF: any;
    ats: any;
    globalIndicators: any;
    availableFuels: Record<string, AverageAnalysis>;
}

export interface FuelCost {
    id: string;
    cost: number;
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
    
    if (snapshot.empty) return [];
    
    const fuelTypes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FuelType));
    
    populateHMap(fuelTypes);
    
    return [...new Map(fuelTypes.map(item => [item.name, item])).values()];
};

export async function getFournisseurs(): Promise<string[]> {
    // This function can be improved by fetching from a dedicated 'fournisseurs' collection
    // For now, we get it from existing results to ensure we only list suppliers with data.
    const resultsCollection = collection(db, 'resultats');
    const snapshot = await getDocs(resultsCollection);
    if (snapshot.empty) return [];

    const suppliers = snapshot.docs.map(doc => doc.data().fournisseur as string);
    return [...new Set(suppliers)].sort(); // Return unique sorted suppliers
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
     if (snapshot.empty) return [];

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

export async function getAverageAnalysisForFuels(
  fuelNames: string[] | null,
  dateRange: { from: Date, to: Date }
): Promise<Record<string, AverageAnalysis>> {
  
  let q = query(
    collection(db, 'resultats'), 
    where('date_arrivage', '>=', Timestamp.fromDate(dateRange.from)),
    where('date_arrivage', '<=', Timestamp.fromDate(dateRange.to))
  );

  const snapshot = await getDocs(q);
  const results = snapshot.docs.map(doc => doc.data());

  const fuelNamesToProcess = fuelNames ?? [...new Set(results.map(r => r.type_combustible))];

  const analysis: Record<string, {
    pci_brut: number[];
    h2o: number[];
    chlore: number[];
    cendres: number[];
    density: number[];
  }> = {};

  // Initialize
  fuelNamesToProcess.forEach(name => {
    analysis[name] = { pci_brut: [], h2o: [], chlore: [], cendres: [], density: [] };
  });

  // Populate
  results.forEach(res => {
    if (fuelNamesToProcess.includes(res.type_combustible)) {
      const target = analysis[res.type_combustible];
      if (typeof res.pci_brut === 'number') target.pci_brut.push(res.pci_brut);
      if (typeof res.h2o === 'number') target.h2o.push(res.h2o);
      if (typeof res.chlore === 'number') target.chlore.push(res.chlore);
      if (typeof res.cendres === 'number') target.cendres.push(res.cendres);
      if (typeof res.densite === 'number') target.density.push(res.densite);
    }
  });

  const finalAverages: Record<string, AverageAnalysis> = {};

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  for (const name in analysis) {
    const data = analysis[name];
    finalAverages[name] = {
      pci_brut: avg(data.pci_brut),
      h2o: avg(data.h2o),
      chlore: avg(data.chlore),
      cendres: avg(data.cendres),
      density: avg(data.density),
      count: data.pci_brut.length
    };
  }

  return finalAverages;
}

export async function saveMixtureSession(sessionData: Omit<MixtureSession, 'id' | 'timestamp'>): Promise<void> {
    const dataToSave = {
        ...sessionData,
        timestamp: Timestamp.now(),
    };
    await addDoc(collection(db, 'sessions_melange'), dataToSave);
}

export async function getMixtureSessions(from: Date, to: Date): Promise<MixtureSession[]> {
    const q = query(
        collection(db, 'sessions_melange'),
        where('timestamp', '>=', Timestamp.fromDate(from)),
        where('timestamp', '<=', Timestamp.fromDate(to)),
        orderBy('timestamp', 'desc')
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return [];

    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    } as MixtureSession));
}


export async function getFuelCosts(): Promise<Record<string, FuelCost>> {
    const costsCollection = collection(db, 'fuel_costs');
    const snapshot = await getDocs(costsCollection);
    if (snapshot.empty) return {};

    const costs: Record<string, FuelCost> = {};
    snapshot.forEach(doc => {
        costs[doc.id] = { id: doc.id, ...doc.data() } as FuelCost;
    });
    return costs;
}

export async function saveFuelCost(fuelName: string, cost: number): Promise<void> {
    const costRef = doc(db, 'fuel_costs', fuelName);
    await setDoc(costRef, { cost }, { merge: true });
}
    
