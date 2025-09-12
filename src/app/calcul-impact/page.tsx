// app/calcul-impact/page.tsx
"use client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { DeltaPill } from "@/components/badges/DeltaPill"
import { Button } from "@/components/ui/button"
import { Flame, Beaker, Gauge, Save, Trash2, FileDown, Wind } from "lucide-react"
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getLatestMixtureSession, getAverageAshAnalysisForFuels, getFuelData, type MixtureSession, type AshAnalysis, type FuelData, getRawMealPresets, saveRawMealPreset, deleteRawMealPreset, type RawMealPreset } from '@/lib/data';

// --- Type Definitions ---
type OxideAnalysis = {
    [key: string]: number | undefined;
    pf?: number; sio2?: number; al2o3?: number; fe2o3?: number;
    cao?: number; mgo?: number; so3?: number; k2o?: number;
    tio2?: number; mno?: number; p2o5?: number;
};
const OXIDE_KEYS: (keyof OxideAnalysis)[] = ['pf', 'sio2', 'al2o3', 'fe2o3', 'cao', 'mgo', 'so3', 'k2o', 'tio2', 'mno', 'p2o5'];
const initialOxideState: OxideAnalysis = { pf: 34.5, sio2: 13.5, al2o3: 3.5, fe2o3: 2.2, cao: 42.5, mgo: 1.5, so3: 0.5, k2o: 0.8, tio2: 0.2, mno: 0.1, p2o5: 0.1 };

// --- LocalStorage Hook ---
function usePersistentState<T>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [state, setState] = useState<T>(() => {
        try {
            if (typeof window === 'undefined') {
                return defaultValue;
            }
            const storedValue = localStorage.getItem(key);
            return storedValue ? JSON.parse(storedValue) : defaultValue;
        } catch {
            return defaultValue;
        }
    });

    useEffect(() => {
        try {
            if (typeof window !== 'undefined') {
                localStorage.setItem(key, JSON.stringify(state));
            }
        } catch (error) {
            console.error("Could not save to localStorage", error);
        }
    }, [key, state]);

    return [state, setState];
}


// --- Hooks and Logic ---
const calculateModules = (analysis: OxideAnalysis) => {
    const s = analysis.sio2 || 0, a = analysis.al2o3 || 0, f = analysis.fe2o3 || 0, c = analysis.cao || 0;
    const ms_denom = a + f, af_denom = f, lsf_denom = (2.8 * s) + (1.18 * a) + (0.65 * f);
    return {
        ms: ms_denom > 0 ? s / ms_denom : 0,
        af: af_denom > 0 ? a / af_denom : 0,
        lsf: lsf_denom > 0 ? (100 * c) / lsf_denom : 0,
    };
};

const calculateC3S = (analysis: OxideAnalysis, freeLime: number) => {
  const s = analysis.sio2 || 0, a = analysis.al2o3 || 0, f = analysis.fe2o3 || 0, c = analysis.cao  || 0, so3 = analysis.so3 || 0;
  const effectiveCao = c - freeLime - 0.7 * so3; 
  const c3s = (4.071 * effectiveCao) - (7.60 * s) - (6.718 * a) - (1.43 * f) - (2.852 * so3);
  return Math.max(0, c3s);
};

const useClinkerCalculations = (
    rawMealFlow: number, rawMealAnalysis: OxideAnalysis, afFlow: number, afAshAnalysis: OxideAnalysis, grignonsFlow: number, grignonsAshAnalysis: OxideAnalysis, petCokePrecaFlow: number, petCokePrecaAsh: OxideAnalysis, petCokeTuyereFlow: number, petCokeTuyereAsh: OxideAnalysis, fuelDataMap: Record<string, FuelData>, so3Target: number
) => {
    return useMemo(() => {
        const clinkerize = (input: OxideAnalysis) => {
            const pf = input.pf || 0;
            const factor = pf < 100 ? 100 / (100 - pf) : 0;
            const clinker: OxideAnalysis = { pf: 0.5 };
            OXIDE_KEYS.forEach(key => {
                if (key !== 'pf' && input[key] !== undefined) clinker[key] = (input[key] as number) * factor;
            });
            return clinker;
        };

        const clinkerWithoutAsh = clinkerize(rawMealAnalysis);

        const resolveAshPercent = (name: string, analysis: OxideAnalysis) => Number((analysis as any)?.pourcentage_cendres ?? fuelDataMap[name]?.taux_cendres ?? 0);

        const fuelSources = [
          { name: "AF", flow: afFlow, analysis: afAshAnalysis },
          { name: "Grignons", flow: grignonsFlow, analysis: grignonsAshAnalysis },
          { name: "Pet-Coke Preca", flow: petCokePrecaFlow, analysis: petCokePrecaAsh },
          { name: "Pet-Coke Tuyere", flow: petCokeTuyereFlow, analysis: petCokeTuyereAsh },
        ].filter(s => s.flow > 0 && s.analysis && Object.keys(s.analysis).length > 0);

        const totalAshFlow = fuelSources.reduce((sum, s) => sum + (s.flow * (resolveAshPercent(s.name, s.analysis) / 100)), 0);

        const averageAshAnalysis: OxideAnalysis = {};
        if (totalAshFlow > 0) {
            OXIDE_KEYS.forEach(key => {
                const totalOxideInAsh = fuelSources.reduce((sum, s) => {
                    const ashPercent = resolveAshPercent(s.name, s.analysis) / 100;
                    const oxidePercentInAsh = (s.analysis[key] ?? 0) / 100;
                    return sum + (s.flow * ashPercent * oxidePercentInAsh);
                }, 0);
                averageAshAnalysis[key] = (totalOxideInAsh / totalAshFlow) * 100;
            });
        }
        
        const clinkerizedRawMealFlows: OxideAnalysis = {};
        OXIDE_KEYS.forEach(key => {
            clinkerizedRawMealFlows[key] = (rawMealFlow * (100 - (rawMealAnalysis.pf ?? 0))/100) * ((clinkerWithoutAsh[key] ?? 0) / 100);
        });

        const ashFlows: OxideAnalysis = {};
        OXIDE_KEYS.forEach(key => {
            ashFlows[key] = totalAshFlow * ((averageAshAnalysis[key] ?? 0) / 100);
        });
        
        const clinkerWithAshFlows: OxideAnalysis = {};
        OXIDE_KEYS.forEach(key => {
            clinkerWithAshFlows[key] = (clinkerizedRawMealFlows[key] ?? 0) + (ashFlows[key] ?? 0);
        });

        const clinkerProduction = rawMealFlow * (100 - (rawMealAnalysis.pf ?? 0)) / 100;
        const totalClinkerWithAshFlow = clinkerProduction + totalAshFlow;

        const clinkerWithAsh_preSO3: OxideAnalysis = {};
        if (totalClinkerWithAshFlow > 0) {
            OXIDE_KEYS.forEach(key => {
                clinkerWithAsh_preSO3[key] = ((clinkerWithAshFlows[key] ?? 0) / totalClinkerWithAshFlow) * 100;
            });
        }
        clinkerWithAsh_preSO3.pf = 0.5;

        // --- SO3 Normalization Step ---
        const clinkerWithAsh: OxideAnalysis = {};
        const calculatedSO3 = clinkerWithAsh_preSO3.so3 ?? 0;
        
        const dilutionFactor = (calculatedSO3 !== 100) 
            ? (100 - so3Target) / (100 - calculatedSO3) 
            : 0;

        OXIDE_KEYS.forEach(key => {
            if (key === 'so3') {
                clinkerWithAsh[key] = so3Target;
            } else if (key !== 'pf') {
                 clinkerWithAsh[key] = (clinkerWithAsh_preSO3[key] ?? 0) * dilutionFactor;
            }
        });
        clinkerWithAsh.pf = 0.5;

        return { clinkerWithoutAsh, clinkerWithAsh, averageAshAnalysis };
    }, [rawMealFlow, rawMealAnalysis, afFlow, afAshAnalysis, grignonsFlow, grignonsAshAnalysis, petCokePrecaFlow, petCokePrecaAsh, petCokeTuyereFlow, petCokeTuyereAsh, fuelDataMap, so3Target]);
};

// --- Components ---
const OxideInputRow = ({ analysis, onAnalysisChange }: { analysis: OxideAnalysis, onAnalysisChange: (newAnalysis: OxideAnalysis) => void }) => {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-11 gap-2">
            {OXIDE_KEYS.map(key => (
                 <div key={key} className="flex-1 min-w-[70px]">
                    <label htmlFor={`raw-meal-${key}`} className="text-xs uppercase text-neutral-400">{key}</label>
                    <Input
                        id={`raw-meal-${key}`} type="number" step="any"
                        value={analysis[key] ?? ''}
                        onChange={e => onAnalysisChange({ ...analysis, [key]: parseFloat(e.target.value) || undefined })}
                        className="h-9 bg-brand-surface/80 border-brand-line/80 text-white"
                    />
                </div>
            ))}
        </div>
    );
};

const SavePresetDialog = ({ currentAnalysis, onSave }: { currentAnalysis: OxideAnalysis, onSave: () => void }) => {
    const [name, setName] = useState("");
    const { toast } = useToast();

    const handleSave = async () => {
        if (!name.trim()) {
            toast({ variant: "destructive", title: "Erreur", description: "Veuillez donner un nom au preset." });
            return;
        }
        await saveRawMealPreset(name, currentAnalysis);
        toast({ title: "Succès", description: `Preset "${name}" sauvegardé.` });
        onSave();
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="bg-transparent border-brand-accent/50 text-brand-accent/90 hover:bg-brand-accent/10 hover:text-brand-accent">
                    <Save className="h-4 w-4 mr-2" /> Sauvegarder Preset
                </Button>
            </DialogTrigger>
            <DialogContent className="bg-brand-surface border-brand-line text-white">
                <DialogHeader>
                    <DialogTitle>Sauvegarder l'analyse du cru</DialogTitle>
                    <DialogDescription>Donnez un nom à ce préréglage pour le réutiliser plus tard.</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <label htmlFor="preset-name" className="text-sm text-neutral-300">Nom du Preset</label>
                    <Input id="preset-name" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Cru standard Hiver" className="mt-1 bg-brand-bg border-brand-line text-white" />
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="secondary">Annuler</Button></DialogClose>
                    <DialogClose asChild><Button onClick={handleSave} className="bg-brand-accent text-black hover:bg-brand-accent/80">Sauvegarder</Button></DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// --- Page Component ---
export default function CalculImpactPage() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [fuelDataMap, setFuelDataMap] = useState<Record<string, FuelData>>({});

    const [rawMealFlow, setRawMealFlow] = usePersistentState<number>('calculImpact_rawMealFlow', 200);
    const [rawMealAnalysis, setRawMealAnalysis] = usePersistentState<OxideAnalysis>('calculImpact_rawMealAnalysis', initialOxideState);
    const [clinkerFactor, setClinkerFactor] = usePersistentState<number>('calculImpact_clinkerFactor', 0.66);
    const [freeLime, setFreeLime] = usePersistentState<number>('calculImpact_freeLime', 1.5);
    const [so3Target, setSo3Target] = usePersistentState<number>('calculImpact_so3Target', 1.4);


    const [latestSession, setLatestSession] = useState<MixtureSession | null>(null);
    const [afAshAnalysis, setAfAshAnalysis] = useState<OxideAnalysis>({});
    const [grignonsAshAnalysis, setGrignonsAshAnalysis] = useState<OxideAnalysis>({});
    const [petCokePrecaAsh, setPetCokePrecaAsh] = useState<OxideAnalysis>({});
    const [petCokeTuyereAsh, setPetCokeTuyereAsh] =useState<OxideAnalysis>({});
    
    const [presets, setPresets] = useState<RawMealPreset[]>([]);

    const fetchPresets = useCallback(async () => {
        const fetchedPresets = await getRawMealPresets();
        setPresets(fetchedPresets);
    }, []);

    useEffect(() => {
        const fetchInitialPresets = async () => {
            const fetchedPresets = await getRawMealPresets();
            setPresets(fetchedPresets);
            // Only set from preset if localStorage is empty
            const savedAnalysis = localStorage.getItem('calculImpact_rawMealAnalysis');
            if (!savedAnalysis && fetchedPresets.length > 0) {
                 setRawMealAnalysis(fetchedPresets[0].analysis);
            }
        };
        fetchInitialPresets();
    }, [setRawMealAnalysis]);


    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [session, allFuelData, mealPresets] = await Promise.all([ getLatestMixtureSession(), getFuelData(), getRawMealPresets() ]);
            
            const fuelDataMap = allFuelData.reduce((acc, fd) => ({ ...acc, [fd.nom_combustible]: fd }), {} as Record<string, FuelData>);
            setFuelDataMap(fuelDataMap);
            setPresets(mealPresets);

            const savedAnalysis = localStorage.getItem('calculImpact_rawMealAnalysis');
            if (mealPresets.length > 0 && !savedAnalysis) {
                 setRawMealAnalysis(mealPresets[0].analysis);
            }

            if (!session) {
                toast({ variant: "destructive", title: "Aucune session de mélange trouvée" });
                setLoading(false);
                return;
            }
            setLatestSession(session);

            const allAfFuelsInSession = Object.entries(session.hallAF?.fuels || {}).concat(Object.entries(session.ats?.fuels || {}))
                .filter(([name]) => name.toLowerCase() !== 'grignons')
                .reduce((acc, [name, data]) => {
                    const weight = (data.buckets || 0) * (fuelDataMap[name]?.poids_godet || 1.5);
                    acc[name] = (acc[name] || 0) + weight;
                    return acc;
                }, {} as Record<string, number>);

            const afFuelNames = Object.keys(allAfFuelsInSession);
            const afFuelWeights = Object.values(allAfFuelsInSession);

            const petKeys = Object.keys(fuelDataMap).filter(k => /pet.?coke/i.test(k.replace(/\s|_/g, '')));
            const [avgAfAsh, avgGrignonsAsh, avgPetCokeAsh] = await Promise.all([
                getAverageAshAnalysisForFuels(afFuelNames, afFuelWeights),
                getAverageAshAnalysisForFuels(['Grignons']),
                getAverageAshAnalysisForFuels(petKeys.length ? petKeys : ['Pet-Coke']),
            ]);

            setAfAshAnalysis(avgAfAsh);
            setGrignonsAshAnalysis(avgGrignonsAsh || {});
            const petCokeAnalysis = (avgPetCokeAsh && Object.keys(avgPetCokeAsh).length > 1) ? avgPetCokeAsh : {};
            setPetCokePrecaAsh(petCokeAnalysis);
            setPetCokeTuyereAsh(petCokeAnalysis);

        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les données initiales." });
        } finally {
            setLoading(false);
        }
    }, [toast, setRawMealAnalysis]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const afFlow = useMemo(() => latestSession?.globalIndicators.flow || 0, [latestSession]);
    const grignonsFlow = useMemo(() => (latestSession?.directInputs?.['Grignons GO1']?.flowRate || 0) + (latestSession?.directInputs?.['Grignons GO2']?.flowRate || 0), [latestSession]);
    const petCokePrecaFlow = useMemo(() => latestSession?.directInputs?.['Pet-Coke Preca']?.flowRate || 0, [latestSession]);
    const petCokeTuyereFlow = useMemo(() => latestSession?.directInputs?.['Pet-Coke Tuyere']?.flowRate || 0, [latestSession]);
    
    const { clinkerWithoutAsh, clinkerWithAsh, averageAshAnalysis } = useClinkerCalculations(
        rawMealFlow, rawMealAnalysis, afFlow, afAshAnalysis, grignonsFlow, grignonsAshAnalysis, petCokePrecaFlow, petCokePrecaAsh, petCokeTuyereFlow, petCokeTuyereAsh, fuelDataMap, so3Target
    );

    const debitClinker = useMemo(() => (rawMealFlow * clinkerFactor), [rawMealFlow, clinkerFactor]);

    const handleDeletePreset = async (id: string) => {
        await deleteRawMealPreset(id);
        toast({ title: "Preset supprimé." });
        fetchPresets();
    };

    const n = (x: number | undefined) => x !== undefined ? <span className="tabular-nums">{x.toFixed(2)}</span> : "-";
    const colorize = (x: number | undefined, mode: "base" | "compare") => {
        if (x === undefined) return "-";
        const cls = mode === "compare" ? "bg-emerald-500/10 text-emerald-300 ring-1 ring-inset ring-emerald-500/20 rounded-md px-2 py-1" : "text-neutral-200";
        return <span className={`tabular-nums ${cls}`}>{x.toFixed(2)}</span>;
    };
    
    const mkRow = (label: string, key: keyof OxideAnalysis | 'ms' | 'af' | 'lsf' | 'c3s') => {
        const analyses = { raw: rawMealAnalysis, ash: averageAshAnalysis, without: clinkerWithoutAsh, with: clinkerWithAsh };
        const modules = {
            raw: calculateModules(rawMealAnalysis), ash: calculateModules(averageAshAnalysis),
            without: calculateModules(clinkerWithoutAsh), with: calculateModules(clinkerWithAsh)
        };
        const c3sVals = { without: calculateC3S(clinkerWithoutAsh, freeLime), with: calculateC3S(clinkerWithAsh, freeLime) };

        let valRaw, valAsh, valWithout, valWith;

        if (key === 'c3s') {
            valWithout = c3sVals.without; valWith = c3sVals.with;
        } else if (['ms', 'af', 'lsf'].includes(key)) {
            valRaw = modules.raw[key as 'ms'|'af'|'lsf']; valAsh = modules.ash[key as 'ms'|'af'|'lsf'];
            valWithout = modules.without[key as 'ms'|'af'|'lsf']; valWith = modules.with[key as 'ms'|'af'|'lsf'];
        } else {
            valRaw = analyses.raw[key as keyof OxideAnalysis]; valAsh = analyses.ash[key as keyof OxideAnalysis];
            valWithout = analyses.without[key as keyof OxideAnalysis]; valWith = analyses.with[key as keyof OxideAnalysis];
        }

        const delta = (valWith !== undefined && valWithout !== undefined && valWithout !== 0) ? ((valWith - valWithout) / Math.max(Math.abs(valWithout), 1e-9)) * 100 : 0;

        return {
            param: label, fb: n(valRaw), cm: n(valAsh),
            cs: colorize(valWithout, "base"), cac: colorize(valWith, "compare"),
            delta: <DeltaPill delta={delta} />
        };
    };

    const tableData = [
        ...OXIDE_KEYS.map(key => mkRow(key.toUpperCase(), key)),
        mkRow("---", "pf"), // Separator
        mkRow("MS", 'ms'), mkRow("A/F", 'af'), mkRow("LSF", 'lsf'),
        mkRow("---", "pf"), // Separator
        mkRow("C₃S (Alite)", 'c3s')
    ];
    
    const rows = tableData.filter(row => row.param !== "---");
    const columns = [
        { key: "param", label: "Paramètre" }, { key: "fb", label: "Farine Brute", align: "right" as const },
        { key: "cm", label: "Cendres Mélange", align: "right" as const }, { key: "cs", label: "Clinker sans Cendres", align: "right" as const },
        { key: "cac", label: "Clinker avec Cendres", align: "right" as const }, { key: "delta", label: "Δ (%)", align: "right" as const },
    ];
    
    if (loading) {
        return (
            <div className="mx-auto w-full max-w-7xl px-4 py-6 space-y-6">
                <Skeleton className="h-12 w-1/3" />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Skeleton className="h-28"/><Skeleton className="h-28"/><Skeleton className="h-28"/><Skeleton className="h-28"/></div>
                <div className="space-y-3 pt-6"><Skeleton className="h-8 w-1/4" /><Skeleton className="h-64 w-full" /></div>
            </div>
        );
    }
  
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
                <h1 className="text-2xl font-semibold text-white tracking-tight">Calcul d’Impact Clinker</h1>
                <p className="text-sm text-neutral-300/80">Analyse de l'impact chimique des combustibles sur la composition du clinker</p>
            </div>
            <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => console.log("exporting...")}><FileDown className="mr-2 h-4 w-4" /> Exporter</Button>
            </div>
        </div>
      
      <section>
          <h2 className="text-lg font-medium text-white mb-3">Paramètres de Simulation</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Débit Farine (t/h)</CardTitle>
                    <Beaker className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <Input type="number" value={rawMealFlow} onChange={e => setRawMealFlow(parseFloat(e.target.value) || 0)} className="bg-transparent border-0 text-2xl font-bold text-white p-0 h-auto focus-visible:ring-0" />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Facteur de clinkérisation</CardTitle>
                    <Gauge className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <Input type="number" step="0.01" value={clinkerFactor} onChange={e => setClinkerFactor(parseFloat(e.target.value) || 0)} className="bg-transparent border-0 text-2xl font-bold text-white p-0 h-auto focus-visible:ring-0" />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Débit Clinker (t/h)</CardTitle>
                    <Flame className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-brand-accent">{debitClinker.toFixed(2)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Chaux Libre (calcul C₃S)</CardTitle>
                </CardHeader>
                <CardContent>
                    <Input type="number" step="0.1" value={freeLime} onChange={e => setFreeLime(parseFloat(e.target.value) || 0)} className="bg-transparent border-0 text-2xl font-bold text-white p-0 h-auto focus-visible:ring-0" />
                </CardContent>
              </Card>
               <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Cible SO₃ Clinker (%)</CardTitle>
                    <Wind className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <Input type="number" step="0.1" value={so3Target} onChange={e => setSo3Target(parseFloat(e.target.value) || 0)} className="bg-transparent border-0 text-2xl font-bold text-white p-0 h-auto focus-visible:ring-0" />
                </CardContent>
              </Card>
          </div>
          
          <div className="p-4 rounded-2xl bg-brand-surface/60 border border-brand-line/60">
              <div className="flex justify-between items-center mb-3">
                  <h3 className="text-base font-medium text-neutral-200">Analyse de la Farine Brute</h3>
                  <div className="flex items-center gap-2">
                       <Select onValueChange={(id) => { const p = presets.find(p => p.id === id); if(p) setRawMealAnalysis(p.analysis); }}>
                           <SelectTrigger className="w-[180px] h-9 text-sm bg-brand-surface border-brand-line"><SelectValue placeholder="Charger Preset..." /></SelectTrigger>
                           <SelectContent className="bg-brand-surface border-brand-line text-white">
                               {presets.map(p => (
                                   <div key={p.id} className="flex items-center justify-between pr-2">
                                       <SelectItem value={p.id} className="flex-grow">{p.name}</SelectItem>
                                       <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); handleDeletePreset(p.id); }}><Trash2 className="h-3 w-3 text-red-500/80" /></Button>
                                   </div>
                               ))}
                           </SelectContent>
                       </Select>
                      <SavePresetDialog currentAnalysis={rawMealAnalysis} onSave={fetchPresets} />
                  </div>
              </div>
              <OxideInputRow analysis={rawMealAnalysis} onAnalysisChange={setRawMealAnalysis} />
          </div>
      </section>

      <section className="space-y-3 pt-4 overflow-hidden rounded-2xl border border-brand-line/60 bg-brand-surface/60">
        <h2 className="text-lg font-medium text-white px-4 pt-4">Résultats de l’Impact sur le Clinker</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-brand-surface/90 backdrop-blur supports-[backdrop-filter]:bg-brand-surface/60">
                  <tr>
                      {columns.map((c) => (
                          <th key={c.key} className={`px-4 py-3 text-left font-medium text-neutral-300 border-b border-brand-line/60 ${c.align === "right" ? "text-right" : ""}`}>
                              {c.label}
                          </th>
                      ))}
                  </tr>
              </thead>
              <tbody>
                  {rows.map((r, idx) => (
                      <tr key={idx} className="border-b border-brand-line/40 even:bg-brand-muted/30 hover:bg-brand-muted/50 transition-colors">
                          {columns.map((c) => (
                              <td key={c.key} className={`px-4 py-3 text-neutral-200 ${c.align === "right" ? "text-right tabular-nums" : ""}`}>
                                  {r[c.key as keyof typeof r]}
                              </td>
                          ))}
                      </tr>
                  ))}
              </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
