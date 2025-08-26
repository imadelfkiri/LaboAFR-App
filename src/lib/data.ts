
// src/lib/data.ts
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, writeBatch, query, where, getDoc, arrayUnion, orderBy, Timestamp, setDoc,getCountFromServer, limit } from 'firebase/firestore';
import { db } from './firebase';
import { startOfDay, endOfDay } from 'date-fns';

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
    // Adding new fields for global mixture spec
    pci_min?: number | null;
    humidity_max?: number | null;
    ash_max?: number | null;
    chlorine_max?: number | null;
    tireRate_max?: number | null;
}

export interface AverageAnalysis {
    pci_brut: number;
    h2o: number;
    chlore: number;
    cendres: number;
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

export interface Stock {
    id: string;
    nom_combustible: string;
    stock_actuel_tonnes: number;
    dernier_arrivage_date?: Timestamp | null;
    dernier_arrivage_quantite?: number | null;
}

export interface Arrivage {
    id: string;
    type_combustible: string;
    quantite: number;
    date_arrivage: Timestamp;
}

export interface FuelData {
    id: string;
    nom_combustible: string;
    densite: number;
    teneur_hydrogene: number;
}


export const SPEC_MAP = new Map<string, Specification>();

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
    
    // Return unique fuel types by name
    return [...new Map(fuelTypes.map(item => [item.name, item])).values()];
};

export async function addFuelType(fuelType: Omit<FuelType, 'id'>): Promise<void> {
    const q = query(collection(db, 'fuel_types'), where("name", "==", fuelType.name));
    const existing = await getDocs(q);

    if (!existing.empty) {
        throw new Error("Un type de combustible avec ce nom existe déjà.");
    }
    
    await addDoc(collection(db, 'fuel_types'), fuelType);
}

export async function getFournisseurs(): Promise<string[]> {
    // This function can be improved by fetching from a dedicated 'fournisseurs' collection
    // For now, we get it from existing results to ensure we only list suppliers with data.
    const resultsCollection = collection(db, 'resultats');
    const snapshot = await getDocs(resultsCollection);
    if (snapshot.empty) return [];

    const suppliers = snapshot.docs.map(doc => doc.data().fournisseur as string);
    return [...new Set(suppliers)].sort(); // Return unique sorted suppliers
};

export async function getFuelSupplierCombinations(): Promise<{ fuel: string, supplier: string }[]> {
    const resultsCollection = collection(db, 'resultats');
    const snapshot = await getDocs(resultsCollection);
    if (snapshot.empty) return [];

    const combinations = new Map<string, { fuel: string, supplier: string }>();
    snapshot.docs.forEach(doc => {
        const data = doc.data();
        const key = `${data.type_combustible}|${data.fournisseur}`;
        if (!combinations.has(key)) {
            combinations.set(key, { fuel: data.type_combustible, supplier: data.fournisseur });
        }
    });

    return Array.from(combinations.values()).sort((a, b) => {
        const fuelCompare = a.fuel.localeCompare(b.fuel);
        if (fuelCompare !== 0) return fuelCompare;
        return a.supplier.localeCompare(b.supplier);
    });
}

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
  fuelNames: string[],
  dateRange: { from: Date, to: Date }
): Promise<Record<string, AverageAnalysis>> {
  
  if (fuelNames.length === 0) {
    return {};
  }
  
  const q = query(
    collection(db, 'resultats'),
    where('date_arrivage', '>=', Timestamp.fromDate(dateRange.from)),
    where('date_arrivage', '<=', Timestamp.fromDate(dateRange.to)),
    where('type_combustible', 'in', fuelNames)
  );

  const snapshot = await getDocs(q);
  const dbResults = snapshot.docs.map(doc => doc.data());

  const analysis: Record<string, {
    pci_brut: number[];
    h2o: number[];
    chlore: number[];
    cendres: number[];
  }> = {};

  // Initialize analysis object for all requested fuel names
  fuelNames.forEach(name => {
    analysis[name] = { pci_brut: [], h2o: [], chlore: [], cendres: [] };
  });

  // Populate with data from the database
  dbResults.forEach(res => {
    const fuelName = res.type_combustible;
    if (analysis[fuelName]) {
      const target = analysis[fuelName];
      if (typeof res.pci_brut === 'number') target.pci_brut.push(res.pci_brut);
      if (typeof res.h2o === 'number') target.h2o.push(res.h2o);
      if (typeof res.chlore === 'number') target.chlore.push(res.chlore);
      if (typeof res.cendres === 'number') target.cendres.push(res.cendres);
    }
  });

  const finalAverages: Record<string, AverageAnalysis> = {};
  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  for (const name of fuelNames) {
    const data = analysis[name];
    finalAverages[name] = {
      pci_brut: avg(data.pci_brut),
      h2o: avg(data.h2o),
      chlore: avg(data.chlore),
      cendres: avg(data.cendres),
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


export async function getLatestMixtureSession(): Promise<MixtureSession | null> {
    const q = query(
        collection(db, 'sessions_melange'),
        orderBy('timestamp', 'desc'),
        limit(1)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as MixtureSession;
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

export async function saveFuelCost(fuelName: string, supplierName: string, cost: number): Promise<void> {
    const costId = `${fuelName}|${supplierName}`;
    const costRef = doc(db, 'fuel_costs', costId);
    await setDoc(costRef, { cost }, { merge: true });
}


// --- Stock Management Functions ---

export async function getStocks(): Promise<Stock[]> {
    const stocksCollection = collection(db, 'stocks');
    const q = query(stocksCollection, orderBy("nom_combustible"));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        const fuelTypes = await getFuelTypes();
        const batch = writeBatch(db);
        fuelTypes.forEach(ft => {
            const stockRef = doc(db, 'stocks', ft.name);
            batch.set(stockRef, { nom_combustible: ft.name, stock_actuel_tonnes: 0 });
        });
        await batch.commit();
        const newSnapshot = await getDocs(q);
        return newSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Stock));
    }

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Stock));
}


export async function updateStock(id: string, data: Partial<Stock>): Promise<void> {
    const stockRef = doc(db, 'stocks', id);
    await updateDoc(stockRef, data);
}

export async function addArrivage(typeCombustibleId: string, quantite: number, dateArrivage: Date): Promise<void> {
    const stockRef = doc(db, 'stocks', typeCombustibleId);
    const stockDoc = await getDoc(stockRef);

    if (!stockDoc.exists()) {
        throw new Error("Le combustible sélectionné n'existe pas dans les stocks.");
    }

    const currentStock = stockDoc.data().stock_actuel_tonnes || 0;
    const newStock = currentStock + quantite;

    const batch = writeBatch(db);

    batch.update(stockRef, {
        stock_actuel_tonnes: newStock,
        dernier_arrivage_date: Timestamp.fromDate(dateArrivage),
        dernier_arrivage_quantite: quantite
    });

    const arrivageRef = doc(collection(db, 'arrivages'));
    batch.set(arrivageRef, {
        type_combustible: stockDoc.data().nom_combustible,
        quantite,
        date_arrivage: Timestamp.fromDate(dateArrivage)
    });

    await batch.commit();
}


export async function getArrivages(dateRange: { from: Date, to: Date }): Promise<Arrivage[]> {
    const q = query(
        collection(db, 'arrivages'),
        where('date_arrivage', '>=', Timestamp.fromDate(dateRange.from)),
        where('date_arrivage', '<=', Timestamp.fromDate(dateRange.to)),
        orderBy('date_arrivage', 'desc')
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return [];

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Arrivage));
}

export async function calculateAndApplyYesterdayConsumption(): Promise<Record<string, number>> {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const startOfYesterday = startOfDay(yesterday);
    const endOfYesterday = endOfDay(yesterday);

    const sessions = await getMixtureSessions(startOfYesterday, endOfYesterday);

    if (sessions.length === 0) {
        console.log("No mixture sessions found for yesterday.");
        return {};
    }

    const totalConsumptionByFuel: Record<string, number> = {};
    let totalOperatingHours = 0;

    sessions.forEach(session => {
        // We assume each session represents a state for a period of time.
        // A simple approach is to average the consumption rate over the day.
        // Let's assume each session's flow rate is valid for (24 / num_sessions) hours.
        const sessionDurationHours = 24 / sessions.length;
        totalOperatingHours += sessionDurationHours;

        const installations = [session.hallAF, session.ats];
        installations.forEach(installation => {
            if (!installation || !installation.flowRate || !installation.fuels) return;
            
            const totalBuckets = Object.values(installation.fuels).reduce((sum: number, fuel: any) => sum + (fuel.buckets || 0), 0);
            if (totalBuckets === 0) return;

            Object.entries(installation.fuels).forEach(([fuelName, fuelData]: [string, any]) => {
                if (fuelData.buckets > 0) {
                    const fuelProportion = fuelData.buckets / totalBuckets;
                    // flowRate is in t/h, so consumption is in tonnes
                    const fuelConsumption = installation.flowRate * sessionDurationHours * fuelProportion;

                    if (!totalConsumptionByFuel[fuelName]) {
                        totalConsumptionByFuel[fuelName] = 0;
                    }
                    totalConsumptionByFuel[fuelName] += fuelConsumption;
                }
            });
        });
    });

    if (Object.keys(totalConsumptionByFuel).length === 0) {
        return {};
    }

    const stocks = await getStocks();
    const stockMap = new Map(stocks.map(s => [s.nom_combustible, s]));
    const batch = writeBatch(db);

    for (const fuelName in totalConsumptionByFuel) {
        const stockInfo = stockMap.get(fuelName);
        if (stockInfo) {
            const consumedQty = totalConsumptionByFuel[fuelName];
            const newStock = stockInfo.stock_actuel_tonnes - consumedQty;
            const stockRef = doc(db, 'stocks', stockInfo.id);
            batch.update(stockRef, { stock_actuel_tonnes: newStock < 0 ? 0 : newStock });
        }
    }

    await batch.commit();
    return totalConsumptionByFuel;
}


// --- Fuel Data (donnees_combustibles) Functions ---

export async function getFuelData(): Promise<FuelData[]> {
    const fuelDataCollection = collection(db, 'donnees_combustibles');
    const snapshot = await getDocs(fuelDataCollection);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FuelData));
}

export async function addFuelData(data: Omit<FuelData, 'id'>): Promise<void> {
    const q = query(collection(db, 'donnees_combustibles'), where("nom_combustible", "==", data.nom_combustible));
    const existing = await getDocs(q);

    if (!existing.empty) {
        throw new Error("Des données pour ce combustible existent déjà.");
    }
    await addDoc(collection(db, 'donnees_combustibles'), data);
}

export async function updateFuelData(id: string, data: Partial<Omit<FuelData, 'id'>>): Promise<void> {
    const fuelDataRef = doc(db, 'donnees_combustibles', id);
    await updateDoc(fuelDataRef, data);
}

export async function deleteFuelData(id: string): Promise<void> {
    const fuelDataRef = doc(db, 'donnees_combustibles', id);
    await deleteDoc(fuelDataRef);
}

export async function getUniqueFuelTypesFromResultats(): Promise<string[]> {
    const resultsCollection = collection(db, 'resultats');
    const snapshot = await getDocs(resultsCollection);
    if (snapshot.empty) return [];

    const fuelTypes = snapshot.docs.map(doc => doc.data().type_combustible as string);
    return [...new Set(fuelTypes)];
}

const GLOBAL_MIXTURE_SPEC_ID = "_GLOBAL_MIXTURE_";

export async function getGlobalMixtureSpecification(): Promise<Specification | null> {
    const specRef = doc(db, 'specifications', GLOBAL_MIXTURE_SPEC_ID);
    const docSnap = await getDoc(specRef);

    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Specification;
    } else {
        console.log("No global mixture specification found.");
        return null;
    }
}

export async function saveGlobalMixtureSpecification(spec: Partial<Specification>): Promise<void> {
    const specRef = doc(db, 'specifications', GLOBAL_MIXTURE_SPEC_ID);
    // Use setDoc with merge to create the document if it doesn't exist, or update it if it does.
    await setDoc(specRef, {
        ...spec,
        type_combustible: "Mélange Global", // Add identifiers to distinguish it
        fournisseur: "Système"
    }, { merge: true });
}
