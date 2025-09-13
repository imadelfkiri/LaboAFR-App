// app/calcul-impact/page.tsx
"use client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Flame, Beaker, Gauge, Save, Trash2, FileDown, Wind, Zap } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getLatestMixtureSession, getAverageAshAnalysisForFuels, getFuelData, type MixtureSession, type AshAnalysis, type FuelData, getRawMealPresets, saveRawMealPreset, deleteRawMealPreset, type RawMealPreset } from '@/lib/data';
import ImpactTableHorizontal from "@/components/impact-table-horizontal";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';


// --- Type Definitions ---
export type OxideAnalysis = {
    [key: string]: number | undefined | null;
    pf?: number | null; sio2?: number | null; al2o3?: number | null; fe2o3?: number | null;
    cao?: number | null; mgo?: number | null; so3?: number | null; k2o?: number | null;
    tio2?: number | null; mno?: number | null; p2o5?: number | null;
};
export const OXIDE_KEYS: (keyof OxideAnalysis)[] = ['pf', 'sio2', 'al2o3', 'fe2o3', 'cao', 'mgo', 'so3', 'k2o', 'tio2', 'mno', 'p2o5'];
export const OXIDE_LABELS: Record<keyof OxideAnalysis, string> = {
    pf: 'PF', sio2: 'SiO2', al2o3: 'Al2O3', fe2o3: 'Fe2O3',
    cao: 'CaO', mgo: 'MgO', so3: 'SO3', k2o: 'K2O',
    tio2: 'TiO2', mno: 'MnO', p2o5: 'P2O5'
};
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
    rawMealFlow: number, rawMealAnalysis: OxideAnalysis, afFlow: number, afAshAnalysis: OxideAnalysis, grignonsFlow: number, grignonsAshAnalysis: OxideAnalysis, petCokePrecaFlow: number, petCokePrecaAsh: OxideAnalysis, petCokeTuyereFlow: number, petCokeTuyereAsh: OxideAnalysis, fuelDataMap: Record<string, FuelData>, so3Target: number, pfClinkerTarget: number, freeLime: number
) => {
    return useMemo(() => {
        const clinkerize = (input: OxideAnalysis, targetPf: number) => {
            const sumNonVolatile = OXIDE_KEYS.reduce((acc, key) => {
                if (key !== 'pf' && input[key] != null) {
                    return acc + (input[key] as number);
                }
                return acc;
            }, 0);
            
            const factor = sumNonVolatile > 0 ? (100 - targetPf) / sumNonVolatile : 0;

            const clinkerized: OxideAnalysis = { pf: targetPf };
             OXIDE_KEYS.forEach(key => {
                if (key !== 'pf' && input[key] != null) {
                    clinkerized[key] = (input[key] as number) * factor;
                }
            });
            return clinkerized;
        };

        const clinkerWithoutAsh = clinkerize(rawMealAnalysis, pfClinkerTarget);

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
        
        const rawMealNonVolatileFlow = rawMealFlow * (100 - (rawMealAnalysis.pf ?? 0)) / 100;
        const clinkerProduction = rawMealNonVolatileFlow;
        const totalClinkerWithAshFlow = clinkerProduction + totalAshFlow;

        const clinkerWithAsh_preNormalization: OxideAnalysis = {};
        OXIDE_KEYS.forEach(key => {
             const rawMealOxideFlow = rawMealNonVolatileFlow * ((clinkerize(rawMealAnalysis, 0)[key] ?? 0) / 100);
             const ashOxideFlow = totalAshFlow * ((averageAshAnalysis[key] ?? 0) / 100);
             const totalOxideFlow = rawMealOxideFlow + ashOxideFlow;

             if (totalClinkerWithAshFlow > 0) {
                clinkerWithAsh_preNormalization[key] = (totalOxideFlow / totalClinkerWithAshFlow) * 100;
             } else {
                clinkerWithAsh_preNormalization[key] = 0;
             }
        });

        // --- Normalization Step for SO3 and PF ---
        const clinkerWithAsh: OxideAnalysis = {};
        const sumPreNormalization = OXIDE_KEYS.reduce((acc, key) => {
            if (key !== 'so3' && key !== 'pf') {
                return acc + (clinkerWithAsh_preNormalization[key] ?? 0);
            }
            return acc;
        }, 0);
        
        const dilutionFactor = sumPreNormalization > 0 
            ? (100 - so3Target - pfClinkerTarget) / sumPreNormalization
            : 0;

        OXIDE_KEYS.forEach(key => {
            if (key === 'so3') {
                clinkerWithAsh[key] = so3Target;
            } else if (key === 'pf') {
                 clinkerWithAsh[key] = pfClinkerTarget;
            } else {
                 clinkerWithAsh[key] = (clinkerWithAsh_preNormalization[key] ?? 0) * dilutionFactor;
            }
        });
        
        const modulesSans = calculateModules(clinkerWithoutAsh);
        const c3sSans = calculateC3S(clinkerWithoutAsh, freeLime);
        const modulesAvec = calculateModules(clinkerWithAsh);
        const c3sAvec = calculateC3S(clinkerWithAsh, freeLime);
        const modulesCendres = calculateModules(averageAshAnalysis);


        return { clinkerWithoutAsh, clinkerWithAsh, averageAshAnalysis, modulesSans, modulesAvec, modulesCendres, c3sSans, c3sAvec };
    }, [rawMealFlow, rawMealAnalysis, afFlow, afAshAnalysis, grignonsFlow, grignonsAshAnalysis, petCokePrecaFlow, petCokePrecaAsh, petCokeTuyereFlow, petCokeTuyereAsh, fuelDataMap, so3Target, pfClinkerTarget, freeLime]);
};

// --- Components ---
const OxideInputRow = ({ analysis, onAnalysisChange }: { analysis: OxideAnalysis, onAnalysisChange: (newAnalysis: OxideAnalysis) => void }) => {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-11 gap-2">
            {OXIDE_KEYS.map(key => (
                 <div key={key} className="flex-1 min-w-[70px]">
                    <label htmlFor={`raw-meal-${key}`} className="text-xs text-neutral-400">{OXIDE_LABELS[key]}</label>
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
                <Button variant="ghost" size="sm" className="bg-transparent border-brand-accent/50 text-brand-accent/90 hover:bg-brand-accent/10 hover:text-brand-accent">
                    <Save className="h-4 w-4 mr-1" /> Preset
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

    const [rawMealFlow, setRawMealFlow] = usePersistentState<number>('calculImpact_rawMealFlow', 180);
    const [rawMealAnalysis, setRawMealAnalysis] = usePersistentState<OxideAnalysis>('calculImpact_rawMealAnalysis', initialOxideState);
    const [clinkerFactor, setClinkerFactor] = usePersistentState<number>('calculImpact_clinkerFactor', 0.6);
    const [freeLime, setFreeLime] = usePersistentState<number>('calculImpact_freeLime', 1.5);
    const [so3Target, setSo3Target] = usePersistentState<number>('calculImpact_so3Target', 1.4);
    const [pfClinkerTarget, setPfClinkerTarget] = usePersistentState<number>('calculImpact_pfClinker', 0.5);


    const [latestSession, setLatestSession] = useState<MixtureSession | null>(null);
    const [afAshAnalysis, setAfAshAnalysis] = useState<OxideAnalysis>({});
    const [grignonsAshAnalysis, setGrignonsAshAnalysis] = useState<OxideAnalysis>({});
    const [petCokePrecaAsh, setPetCokePrecaAsh] = useState<OxideAnalysis>({});
    const [petCokeTuyereAsh, setPetCokeTuyereAsh] = useState<OxideAnalysis>({});
    
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
    
    const { clinkerWithoutAsh, clinkerWithAsh, averageAshAnalysis, modulesSans, modulesAvec, modulesCendres, c3sSans, c3sAvec } = useClinkerCalculations(
        rawMealFlow, rawMealAnalysis, afFlow, afAshAnalysis, grignonsFlow, grignonsAshAnalysis, petCokePrecaFlow, petCokePrecaAsh, petCokeTuyereFlow, petCokeTuyereAsh, fuelDataMap, so3Target, pfClinkerTarget, freeLime
    );

    const debitClinker = useMemo(() => (rawMealFlow * clinkerFactor), [rawMealFlow, clinkerFactor]);

    const handleDeletePreset = async (id: string) => {
        await deleteRawMealPreset(id);
        toast({ title: "Preset supprimé." });
        fetchPresets();
    };

    const deltaChartData = useMemo(() => {
        const delta = (a?: number | null, b?: number | null) => (a ?? 0) - (b ?? 0);
        return [
            { name: 'Fe2O3', value: delta(clinkerWithAsh.fe2o3, clinkerWithoutAsh.fe2o3) },
            { name: 'CaO', value: delta(clinkerWithAsh.cao, clinkerWithoutAsh.cao) },
            { name: 'LSF', value: delta(modulesAvec.lsf, modulesSans.lsf) },
            { name: 'C3S', value: delta(c3sAvec, c3sSans) }
        ];
    }, [clinkerWithAsh, clinkerWithoutAsh, modulesAvec, modulesSans, c3sAvec, c3sSans]);

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
    <div className="mx-auto w-full max-w-[90rem] px-4 py-6 space-y-6">
      <section>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6 mb-6">
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
               <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">PF Clinker (%)</CardTitle>
                    <Zap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <Input type="number" step="0.1" value={pfClinkerTarget} onChange={e => setPfClinkerTarget(parseFloat(e.target.value) || 0)} className="bg-transparent border-0 text-2xl font-bold text-white p-0 h-auto focus-visible:ring-0" />
                </CardContent>
              </Card>
          </div>
      </section>
      
      <section className="pt-4 space-y-6">
        <div>
            <ImpactTableHorizontal
                rawMealAnalysis={rawMealAnalysis}
                onRawMealChange={setRawMealAnalysis}
                presets={presets}
                onPresetLoad={(id) => { const p = presets.find(p => p.id === id); if(p) setRawMealAnalysis(p.analysis); }}
                onPresetSave={fetchPresets}
                onPresetDelete={handleDeletePreset}
                cendresMelange={averageAshAnalysis}
                clinkerSans={clinkerWithoutAsh}
                clinkerAvec={clinkerWithAsh}
                modulesCendres={modulesCendres}
                modulesSans={modulesSans}
                modulesAvec={modulesAvec}
                c3sSans={c3sSans}
                c3sAvec={c3sAvec}
                showDelta={true}
            />
        </div>
        <Card>
            <CardHeader>
                <CardTitle>Impact sur les Indicateurs Clés</CardTitle>
                <CardDescription>Variation absolue (Avec Cendres - Sans Cendres)</CardDescription>
            </CardHeader>
            <CardContent>
                 <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={deltaChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <Tooltip
                            contentStyle={{
                                background: "hsl(var(--background))",
                                border: "1px solid hsl(var(--border))",
                                color: "hsl(var(--foreground))"
                            }}
                            cursor={{ fill: 'hsl(var(--muted))' }}
                        />
                        <Bar dataKey="value" name="Variation" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
      </section>

    </div>
  )
}
