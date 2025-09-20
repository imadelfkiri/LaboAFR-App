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
    taux_metal?: number;
    count: number;
}

export interface MixtureSession {
    id: string;
    timestamp: Timestamp;
    hallAF: any;
    ats: any;
    directInputs: any;
    globalIndicators: any;
    availableFuels: Record<string, AverageAnalysis>;
    analysisDateRange?: { from: Timestamp; to: Timestamp };
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
    poids_godet: number;
    teneur_hydrogene: number;
    taux_cendres?: number;
}

export interface MixtureScenario {
    id: string;
    nom_scenario: string;
    date_creation: Timestamp;
    donnees_hall: any;
    donnees_ats: any;
    donnees_grignons: any;
}

export interface AshAnalysis {
    id?: string;
    date_arrivage?: Timestamp;
    type_combustible?: string;
    fournisseur?: string;
    pourcentage_cendres?: number | null;
    pf?: number | null;
    sio2?: number | null;
    al2o3?: number | null;
    fe2o3?: number | null;
    cao?: number | null;
    mgo?: number | null;
    so3?: number | null;
    k2o?: number | null;
    tio2?: number | null;
    mno?: number | null;
    p2o5?: number | null;
}

interface ResultToSave {
    date_arrivage: Timestamp;
    type_analyse: string;
    type_combustible: string;
    fournisseur: string;
    pcs: number;
    h2o: number;
    chlore: number | null;
    cendres: number | null;
    remarques: string | null;
    taux_metal: number | null;
    pci_brut: number;
}

export type RawMealAnalysis = {
    [key: string]: number | undefined | null;
    pf?: number | null; sio2?: number | null; al2o3?: number | null; fe2o3?: number | null;
    cao?: number | null; mgo?: number | null; so3?: number | null; k2o?: number | null;
    tio2?: number | null; mno?: number | null; p2o5?: number | null;
};

export interface RawMealPreset {
    id: string;
    name: string;
    analysis: RawMealAnalysis;
    createdAt: Timestamp;
}

// Nouvelle interface pour l'historique des calculs d'impact
export interface ImpactAnalysis {
    id?: string;
    createdAt: Timestamp;
    parameters: {
        rawMealFlow: number;
        clinkerFactor: number;
        freeLime: number;
        so3Target: number;
        pfClinkerTarget: number;
        realFreeLime: number;
        afFlow: number;
        grignonsFlow: number;
        petCokePrecaFlow: number;
        petCokeTuyereFlow: number;
    };
    inputs: {
        rawMealAnalysis: RawMealAnalysis;
        realClinkerAnalysis: RawMealAnalysis;
        averageAshAnalysis: AshAnalysis;
    };
    results: {
        clinkerWithoutAsh: RawMealAnalysis;
        clinkerWithAsh: RawMealAnalysis;
        modulesFarine: any;
        modulesCendres: any;
        modulesSans: any;
        modulesAvec: any;
        modulesReel: any;
        c3sSans: number;
        c3sAvec: number;
        c3sReel: number;
    };
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

export async function getUniqueFuelTypes(): Promise<string[]> {
    const stocksCollection = collection(db, 'stocks');
    const snapshot = await getDocs(stocksCollection);
    if (snapshot.empty) return [];

    const fuelTypes = snapshot.docs.map(doc => doc.data().nom_combustible as string);
    return [...new Set(fuelTypes)];
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
  dateRange: { from: Date; to: Date }
): Promise<Record<string, AverageAnalysis>> {
  const analyses: Record<string, AverageAnalysis> = {};
  if (!fuelNames || fuelNames.length === 0) return analyses;

  const start = Timestamp.fromDate(startOfDay(dateRange.from));
  const end = Timestamp.fromDate(endOfDay(dateRange.to));

  // Step 1: Fetch all results within the date range, without filtering by fuel type yet.
  const q = query(
    collection(db, 'resultats'),
    where('date_arrivage', '>=', start),
    where('date_arrivage', '<=', end)
  );
  const snapshot = await getDocs(q);
  const resultsInDateRange = snapshot.docs.map(doc => doc.data());

  // Step 2: Group results by fuel type in memory.
  const resultsByType: Record<string, any[]> = {};
  fuelNames.forEach(name => {
    resultsByType[name] = [];
  });
  
  resultsInDateRange.forEach(data => {
    // Only consider fuels we are interested in.
    if (resultsByType[data.type_combustible]) {
      resultsByType[data.type_combustible].push(data);
    }
  });

  // Step 3: Identify fuels for which no analysis was found in the date range.
  const fuelsWithoutAnalysis = fuelNames.filter(name => resultsByType[name].length === 0);

  // Step 4: For those fuels, fetch the single most recent analysis, regardless of date.
  if (fuelsWithoutAnalysis.length > 0) {
    await Promise.all(fuelsWithoutAnalysis.map(async (fuelName) => {
        const latestQuery = query(
            collection(db, 'resultats'),
            where('type_combustible', '==', fuelName),
            orderBy('date_arrivage', 'desc'),
            limit(1)
        );
        const latestSnapshot = await getDocs(latestQuery);
        if (!latestSnapshot.empty) {
            // Add the latest result to be processed.
            resultsByType[fuelName] = latestSnapshot.docs.map(d => d.data());
        }
    }));
  }
  
  // Step 5: Calculate averages for all fuels.
  for (const fuelName of fuelNames) {
      let fuelResults = resultsByType[fuelName];
      const count = fuelResults.length;

      if (count === 0) {
          analyses[fuelName] = { pci_brut: 0, h2o: 0, chlore: 0, cendres: 0, count: 0, taux_metal: 0 };
          continue;
      }
      
      const sum = fuelResults.reduce((acc, curr) => {
          acc.pci_brut += curr.pci_brut || 0;
          acc.h2o += curr.h2o || 0;
          acc.chlore += curr.chlore || 0;
          acc.cendres += curr.cendres || 0;
          acc.taux_metal += curr.taux_metal || 0;
          return acc;
      }, { pci_brut: 0, h2o: 0, chlore: 0, cendres: 0, taux_metal: 0 });

      analyses[fuelName] = {
          pci_brut: sum.pci_brut / count,
          h2o: sum.h2o / count,
          chlore: sum.chlore / count,
          cendres: sum.cendres / count,
          taux_metal: sum.taux_metal / count,
          count: count,
      };
  }
  return analyses;
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

export async function saveFuelCost(fuelName: string, cost: number): Promise<void> {
    const costRef = doc(db, 'fuel_costs', fuelName);
    await setDoc(costRef, { cost }, { merge: true });
}


// --- Stock Management Functions ---

export async function getStocks(): Promise<Stock[]> {
    const stocksCollection = collection(db, 'stocks');
    const q = query(stocksCollection, orderBy("nom_combustible"));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        const fuelTypes = await getUniqueFuelTypesFromResultats();
        if (fuelTypes.length === 0) return []; // No fuels to create stocks for
        
        const batch = writeBatch(db);
        fuelTypes.forEach(ft => {
            const stockRef = doc(collection(db, 'stocks'));
            batch.set(stockRef, { nom_combustible: ft, stock_actuel_tonnes: 0 });
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

// --- Mixture Scenarios (for simulator) ---

export async function saveMixtureScenario(scenario: Omit<MixtureScenario, 'id' | 'date_creation'>): Promise<void> {
    const dataToSave = {
        ...scenario,
        date_creation: Timestamp.now(),
    };
    await addDoc(collection(db, 'scenarios_melange'), dataToSave);
}

export async function getMixtureScenarios(): Promise<MixtureScenario[]> {
    const scenariosCollection = collection(db, 'scenarios_melange');
    const q = query(scenariosCollection, orderBy("date_creation", "desc"));
    const snapshot = await getDocs(q);

    if (snapshot.empty) return [];

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MixtureScenario));
}

export async function updateMixtureScenario(id: string, data: Partial<Omit<MixtureScenario, 'id'>>): Promise<void> {
    const scenarioRef = doc(db, 'scenarios_melange', id);
    await updateDoc(scenarioRef, data);
}

export async function deleteMixtureScenario(id: string): Promise<void> {
    const scenarioRef = doc(db, 'scenarios_melange', id);
    await deleteDoc(scenarioRef);
}

// --- Ash Analysis Functions ---

export async function getAshAnalyses(): Promise<AshAnalysis[]> {
    const analysesCollection = collection(db, 'analyses_cendres');
    const q = query(analysesCollection, orderBy("date_arrivage", "desc"));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return [];
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AshAnalysis));
}

export async function getAverageAshAnalysisForFuels(
  fuelNames: string[],
  weights?: number[]
): Promise<AshAnalysis> {
  const finalAverages: AshAnalysis = {};

  if (!fuelNames || fuelNames.length === 0) {
    return {};
  }

  const q = query(collection(db, 'analyses_cendres'), where('type_combustible', 'in', fuelNames));
  const snapshot = await getDocs(q);
  const dbResults = snapshot.docs.map(doc => doc.data() as AshAnalysis);

  const analysesByFuel: Record<string, AshAnalysis[]> = {};
  fuelNames.forEach(name => {
    analysesByFuel[name] = [];
  });
  dbResults.forEach(res => {
    if (res.type_combustible && analysesByFuel[res.type_combustible]) {
      analysesByFuel[res.type_combustible].push(res);
    }
  });

  const averageByFuel: Record<string, AshAnalysis> = {};
  const keysToAverage: (keyof AshAnalysis)[] = ['pf', 'pourcentage_cendres', 'sio2', 'al2o3', 'fe2o3', 'cao', 'mgo', 'so3', 'k2o', 'tio2', 'mno', 'p2o5'];

  for (const fuelName of fuelNames) {
    const fuelAnalyses = analysesByFuel[fuelName];
    const avg: AshAnalysis = {};
    if (fuelAnalyses.length > 0) {
      for (const key of keysToAverage) {
        const values = fuelAnalyses.map(a => a[key]).filter(v => typeof v === 'number') as number[];
        if (values.length > 0) {
          (avg as any)[key] = values.reduce((sum, val) => sum + val, 0) / values.length;
        }
      }
    }
    averageByFuel[fuelName] = avg;
  }
  
  if (!weights || weights.length !== fuelNames.length) {
    // Simple average if no weights provided
    keysToAverage.forEach(key => {
        const allValues = fuelNames.map(name => averageByFuel[name]?.[key]).filter(v => typeof v === 'number') as number[];
        if (allValues.length > 0) {
           (finalAverages as any)[key] = allValues.reduce((sum, val) => sum + val, 0) / allValues.length;
        }
    });
    return finalAverages;
  }
  
  // Weighted average
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  if (totalWeight === 0) return {};

  keysToAverage.forEach(key => {
    let weightedSum = 0;
    let weightForSum = 0;
    for (let i = 0; i < fuelNames.length; i++) {
        const fuelName = fuelNames[i];
        const weight = weights[i];
        const avgValue = averageByFuel[fuelName]?.[key];
        if (typeof avgValue === 'number' && typeof weight === 'number') {
            weightedSum += avgValue * weight;
            weightForSum += weight;
        }
    }
    if (weightForSum > 0) {
      (finalAverages as any)[key] = weightedSum / weightForSum;
    }
  });

  return finalAverages;
}


export async function addAshAnalysis(data: Omit<AshAnalysis, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'analyses_cendres'), data);
    return docRef.id;
}

export async function addManyAshAnalyses(data: Omit<AshAnalysis, 'id'>[]): Promise<void> {
    const batch = writeBatch(db);
    const analysesCollection = collection(db, 'analyses_cendres');

    data.forEach(analysis => {
        const docRef = doc(analysesCollection);
        batch.set(docRef, analysis);
    });

    await batch.commit();
}


export async function updateAshAnalysis(id: string, data: Partial<Omit<AshAnalysis, 'id'>>): Promise<void> {
    const analysisRef = doc(db, 'analyses_cendres', id);
    await updateDoc(analysisRef, data);
}

export async function deleteAshAnalysis(id: string): Promise<void> {
    const analysisRef = doc(db, 'analyses_cendres', id);
    await deleteDoc(analysisRef);
}

export async function deleteAllResults(): Promise<void> {
    const resultsCollection = collection(db, 'resultats');
    const snapshot = await getDocs(resultsCollection);

    if (snapshot.empty) {
        return;
    }

    const batch = writeBatch(db);
    snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
    });

    await batch.commit();
}

export async function addManyResults(results: ResultToSave[]): Promise<void> {
    const batch = writeBatch(db);
    const resultsCollection = collection(db, 'resultats');

    results.forEach(result => {
        const docRef = doc(resultsCollection);
        batch.set(docRef, result);
    });

    await batch.commit();
}

export async function updateResult(id: string, data: Partial<ResultToSave>): Promise<void> {
    const resultRef = doc(db, 'resultats', id);
    await updateDoc(resultRef, data);
}

// --- Raw Meal Presets ---

export async function getRawMealPresets(): Promise<RawMealPreset[]> {
    const presetsCollection = collection(db, 'raw_meal_presets');
    const q = query(presetsCollection, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return [];
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RawMealPreset));
}

export async function saveRawMealPreset(name: string, analysis: RawMealAnalysis): Promise<void> {
    const preset: Omit<RawMealPreset, 'id'> = {
        name,
        analysis,
        createdAt: Timestamp.now(),
    };
    await addDoc(collection(db, 'raw_meal_presets'), preset);
}

export async function deleteRawMealPreset(id: string): Promise<void> {
    await deleteDoc(doc(db, 'raw_meal_presets', id));
}

// --- Impact Analysis History ---

export async function saveImpactAnalysis(analysis: Omit<ImpactAnalysis, 'id' | 'createdAt'>): Promise<string> {
    const dataToSave = {
        ...analysis,
        createdAt: Timestamp.now(),
    };
    const docRef = await addDoc(collection(db, 'impact_analyses'), dataToSave);
    return docRef.id;
}

export async function getImpactAnalyses(): Promise<ImpactAnalysis[]> {
    const analysesCollection = collection(db, 'impact_analyses');
    const q = query(analysesCollection, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return [];
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ImpactAnalysis));
}

export async function deleteImpactAnalysis(id: string): Promise<void> {
    const analysisRef = doc(db, 'impact_analyses', id);
    await deleteDoc(analysisRef);
}
