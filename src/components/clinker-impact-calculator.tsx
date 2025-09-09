
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { getLatestMixtureSession, getAverageAshAnalysisForFuels, type MixtureSession, type AshAnalysis, getFuelData, type FuelData } from '@/lib/data';
import { Calculator, Beaker, FileDown, Flame, ArrowRight } from 'lucide-react';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';


type OxideAnalysis = {
    [key: string]: number | undefined;
    pourcentage_cendres?: number;
    paf?: number; sio2?: number; al2o3?: number; fe2o3?: number;
    cao?: number; mgo?: number; so3?: number; k2o?: number;
    tio2?: number; mno?: number; p2o5?: number;
};

const OXIDE_KEYS: (keyof OxideAnalysis)[] = ['paf', 'sio2', 'al2o3', 'fe2o3', 'cao', 'mgo', 'so3', 'k2o', 'tio2', 'mno', 'p2o5'];


const initialOxideState: OxideAnalysis = {
    paf: 34.5, sio2: 13.5, al2o3: 3.5, fe2o3: 2.2, cao: 42.5, mgo: 1.5, so3: 0.5, k2o: 0.8, tio2: 0.2, mno: 0.1, p2o5: 0.1
};

const calculateModules = (analysis: OxideAnalysis) => {
    const s = analysis.sio2 || 0;
    const a = analysis.al2o3 || 0;
    const f = analysis.fe2o3 || 0;
    const c = analysis.cao || 0;

    const ms_denom = a + f;
    const af_denom = f;
    const lsf_denom = (2.8 * s) + (1.18 * a) + (0.65 * f);

    return {
        ms: ms_denom > 0 ? s / ms_denom : 0,
        af: af_denom > 0 ? a / af_denom : 0,
        lsf: lsf_denom > 0 ? (100 * c) / lsf_denom : 0,
    };
};

const calculateC3S = (analysis: OxideAnalysis, freeLime: number) => {
  const s = analysis.sio2 || 0;
  const a = analysis.al2o3 || 0;
  const f = analysis.fe2o3 || 0;
  const c = analysis.cao  || 0;
  const so3 = analysis.so3 || 0;

  const effectiveCao = c - freeLime - 1.07 * so3; // CaO utile
  const c3s = (4.07 * effectiveCao) - (7.60 * s) - (6.72 * a) - (1.43 * f);
  return Math.max(0, c3s);
};

const useClinkerCalculations = (
    rawMealFlow: number,
    rawMealAnalysis: OxideAnalysis,
    afFlow: number,
    afAshAnalysis: OxideAnalysis,
    grignonsFlow: number,
    grignonsAshAnalysis: OxideAnalysis,
    petCokePrecaFlow: number,
    petCokePrecaAsh: OxideAnalysis,
    petCokeTuyereFlow: number,
    petCokeTuyereAsh: OxideAnalysis,
    fuelDataMap: Record<string, FuelData>
) => {
    return useMemo(() => {
        const clinkerize = (inputAnalysis: OxideAnalysis) => {
            const pf = inputAnalysis.paf || 0;
            if (pf >= 100) { 
                const emptyOxides: OxideAnalysis = {};
                OXIDE_KEYS.forEach(key => { emptyOxides[key] = 0; });
                return emptyOxides;
            }
            const factor = 100 / (100 - pf);
            const clinkerAnalysis: OxideAnalysis = {};
            
            OXIDE_KEYS.forEach(key => {
                if (key !== 'paf') {
                     clinkerAnalysis[key] = (inputAnalysis[key] || 0) * factor;
                }
            });
            clinkerAnalysis.paf = 0.20; // Standard target PF for clinker

            return clinkerAnalysis;
        }

        // --- Clinker Sans Cendres ---
        const clinkerWithoutAsh = clinkerize(rawMealAnalysis);

        // --- Sources combustibles (on ne filtre pas par analyse ici)
        const fuelSources = [
          { name: "AF",            flow: afFlow,            analysis: afAshAnalysis },
          { name: "Grignons",      flow: grignonsFlow,      analysis: grignonsAshAnalysis },
          { name: "PetCokePreca",  flow: petCokePrecaFlow,  analysis: petCokePrecaAsh },
          { name: "PetCokeTuyere", flow: petCokeTuyereFlow, analysis: petCokeTuyereAsh },
        ].filter(s => s.flow > 0);

        // Trouve la clé la plus proche dans fuelDataMap
        const findFuelKey = (raw: string) => {
          const norm = (s: string) => s.toLowerCase().replace(/[\s_\-]/g, '');
          const target = norm(raw);
          const keys = Object.keys(fuelDataMap || {});
          // match exact après normalisation
          let hit = keys.find(k => norm(k) === target);
          if (hit) return hit;
          // quelques heuristiques robustes
          hit = keys.find(k => /pet.?coke/.test(norm(k)) && /pet.?coke/.test(target));
          if (hit) return hit;
          hit = keys.find(k => /grignon/.test(norm(k)) && /grignon/.test(target));
          if (hit) return hit;
          hit = keys.find(k => /af|csr|dmb|alt/.test(norm(k)) && /af|csr|dmb|alt/.test(target));
          return hit || raw;
        };

        const resolveAshPercent = (name: string, analysis: OxideAnalysis): number => {
          if (analysis?.pourcentage_cendres != null) return Number(analysis.pourcentage_cendres);
          const fk = findFuelKey(name);
          const fd = fuelDataMap?.[fk];
          const tc: any = fd && ((fd as any).taux_cendres ?? (fd as any).pourcentage_cendres ?? (fd as any).cendres);
          return tc != null ? Number(tc) : 0;
        };

        // === Débit total de cendres (t/h)
        const totalAshFlow = fuelSources.reduce((sum, source) => {
          const ashPercent = resolveAshPercent(source.name, source.analysis); // %
          const ashFrac = ashPercent / 100;
          return sum + (source.flow * ashFrac);
        }, 0);

        // === Analyse moyenne des cendres (pondérée par débit de cendres)
        const averageAshAnalysis: OxideAnalysis = {};
        if (totalAshFlow > 0) {
          OXIDE_KEYS.forEach((key) => {
            const oxideFlowInAsh = fuelSources.reduce((sum, source) => {
              const ashFrac = resolveAshPercent(source.name, source.analysis) / 100;
              const oxideFracInAsh = ((source.analysis[key] ?? 0) as number) / 100;
              return sum + (source.flow * ashFrac * oxideFracInAsh);
            }, 0);
            (averageAshAnalysis as any)[key] = (oxideFlowInAsh / totalAshFlow) * 100;
          });
        }

        // === Clinker AVEC cendres : on additionne les flux d’oxydes (cru + cendres)
        const totalOxideFlows: OxideAnalysis = {};
        // Cru
        OXIDE_KEYS.forEach((key) => {
          totalOxideFlows[key] = rawMealFlow * ((rawMealAnalysis[key] || 0) / 100);
        });
        // Cendres
        fuelSources.forEach((source) => {
          const ashFrac = resolveAshPercent(source.name, source.analysis) / 100;
          OXIDE_KEYS.forEach((key) => {
            const oxideFracInAsh = ((source.analysis[key] ?? 0) as number) / 100;
            totalOxideFlows[key] = (totalOxideFlows[key] || 0) + (source.flow * ashFrac * oxideFracInAsh);
          });
        });

        const totalMaterialFlow = rawMealFlow + totalAshFlow;
        const mixedRawAnalysis: OxideAnalysis = {};
        if (totalMaterialFlow > 0) {
          OXIDE_KEYS.forEach((key) => {
            mixedRawAnalysis[key] = ((totalOxideFlows[key] || 0) / totalMaterialFlow) * 100;
          });
        }

        const clinkerWithAsh = clinkerize(mixedRawAnalysis);

        // (optionnel) Traçabilité console pour vérifier la prise en compte du Pet-Coke
        if (process.env.NODE_ENV !== "production") {
          console.table(
            fuelSources.map(s => ({
              fuel: s.name,
              flow_th: s.flow,
              ash_percent: resolveAshPercent(s.name, s.analysis),
              SUM_OXIDES: ['sio2','al2o3','fe2o3','cao','mgo','so3','k2o','tio2','mno','p2o5']
                .reduce((acc,k)=> acc + (Number(s.analysis[k] || 0)), 0).toFixed(2),
              SiO2: s.analysis.sio2 ?? 0,
              Fe2O3: s.analysis.fe2o3 ?? 0,
              CaO: s.analysis.cao ?? 0,
            }))
          );
        }

        return { clinkerWithoutAsh, clinkerWithAsh, averageAshAnalysis };
    }, [rawMealFlow, rawMealAnalysis, afFlow, afAshAnalysis, grignonsFlow, grignonsAshAnalysis, petCokePrecaFlow, petCokePrecaAsh, petCokeTuyereFlow, petCokeTuyereAsh, fuelDataMap]);
};

const OxideInputRow = ({ analysis, onAnalysisChange }: { analysis: OxideAnalysis, onAnalysisChange: (newAnalysis: OxideAnalysis) => void }) => {
    const handleInputChange = (oxide: keyof OxideAnalysis, value: string) => {
        const numValue = parseFloat(value);
        onAnalysisChange({
            ...analysis,
            [oxide]: isNaN(numValue) ? undefined : numValue,
        });
    };
    
    return (
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {OXIDE_KEYS.map(key => (
                 <div key={key}>
                    <Label htmlFor={`raw-meal-${key}`} className="text-xs uppercase">{key}</Label>
                    <Input
                        id={`raw-meal-${key}`}
                        type="number"
                        step="any"
                        value={analysis[key] ?? ''}
                        onChange={e => handleInputChange(key, e.target.value)}
                        className="h-9"
                    />
                </div>
            ))}
        </div>
    );
};


export function ClinkerImpactCalculator() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [fuelDataMap, setFuelDataMap] = useState<Record<string, FuelData>>({});

    // Inputs
    const [rawMealFlow, setRawMealFlow] = useState(200);
    const [rawMealAnalysis, setRawMealAnalysis] = useState<OxideAnalysis>(initialOxideState);
    const [clinkerFactor, setClinkerFactor] = useState(0.66);
    const [freeLime, setFreeLime] = useState(1.5);

    // Auto-loaded data
    const [latestSession, setLatestSession] = useState<MixtureSession | null>(null);
    const [afAshAnalysis, setAfAshAnalysis] = useState<OxideAnalysis>({});
    const [grignonsAshAnalysis, setGrignonsAshAnalysis] = useState<OxideAnalysis>({});
    const [petCokePrecaAsh, setPetCokePrecaAsh] = useState<OxideAnalysis>({});
    const [petCokeTuyereAsh, setPetCokeTuyereAsh] = useState<OxideAnalysis>({});

    const afFlow = useMemo(() => {
        if (!latestSession) return 0;
        let totalAfFlow = 0;
        const processInstallation = (installation: any) => {
            if (!installation || !installation.flowRate || !installation.fuels) return 0;
            const nonGrignonsFuels = Object.keys(installation.fuels).filter(f => f.toLowerCase() !== 'grignons');
            if (nonGrignonsFuels.length > 0) {
                 const nonGrignonsBuckets = nonGrignonsFuels.reduce((sum, fuelName) => sum + (installation.fuels[fuelName]?.buckets || 0), 0);
                 const totalBuckets = Object.values(installation.fuels).reduce((sum: number, fuel: any) => sum + (fuel.buckets || 0), 0);
                 if (totalBuckets > 0) {
                    return installation.flowRate * (nonGrignonsBuckets / totalBuckets);
                 }
            }
            return 0;
        };
        totalAfFlow += processInstallation(latestSession.hallAF);
        totalAfFlow += processInstallation(latestSession.ats);
        return totalAfFlow;
    }, [latestSession]);
    
    const grignonsFlow = useMemo(() => {
        if (!latestSession) return 0;
        let totalGrignonsFlow = 0;
        if (latestSession.directInputs) {
            totalGrignonsFlow += latestSession.directInputs['Grignons GO1']?.flowRate || 0;
            totalGrignonsFlow += latestSession.directInputs['Grignons GO2']?.flowRate || 0;
        } else if ((latestSession as any).grignons) { // backward compat
            totalGrignonsFlow += (latestSession as any).grignons.flowRate || 0;
        }
        return totalGrignonsFlow;
    }, [latestSession]);

    const petCokePrecaFlow = useMemo(() => latestSession?.directInputs?.['Pet-Coke Preca']?.flowRate || 0, [latestSession]);
    const petCokeTuyereFlow = useMemo(() => latestSession?.directInputs?.['Pet-Coke Tuyere']?.flowRate || 0, [latestSession]);


    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [session, allFuelData] = await Promise.all([
                getLatestMixtureSession(),
                getFuelData(),
            ]);

            const fuelDataMap = allFuelData.reduce((acc, fd) => {
                acc[fd.nom_combustible] = fd;
                return acc;
            }, {} as Record<string, FuelData>);
            setFuelDataMap(fuelDataMap);

            if (!session) {
                toast({ variant: "destructive", title: "Aucune session de mélange trouvée", description: "Veuillez d'abord enregistrer une session dans la page 'Calcul de Mélange'." });
                setLoading(false);
                return;
            }
            setLatestSession(session);

            const allAfFuelsInSession: Record<string, number> = {};
             [session.hallAF, session.ats].forEach(installation => {
                if (!installation?.fuels) return;
                for (const fuelName in installation.fuels) {
                    if (fuelName.toLowerCase() !== 'grignons') {
                        const buckets = installation.fuels[fuelName].buckets || 0;
                        if (buckets > 0) {
                            const poidsGodet = fuelDataMap[fuelName]?.poids_godet || 1.5;
                            allAfFuelsInSession[fuelName] = (allAfFuelsInSession[fuelName] || 0) + (buckets * poidsGodet);
                        }
                    }
                }
            });

            const afFuelNames = Object.keys(allAfFuelsInSession);
            const afFuelWeights = Object.values(allAfFuelsInSession);
            
            // Cherche toutes les variantes "pet coke" disponibles côté données
            const petKeys = Object.keys(fuelDataMap || {}).filter(k =>
              /pet.?coke/i.test(k.replace(/\s|_/g, ''))
            );
            const petQueryNames = petKeys.length ? petKeys : ['Pet-Coke'];

            const [avgAfAsh, avgGrignonsAsh, avgPetCokeAsh] = await Promise.all([
                getAverageAshAnalysisForFuels(afFuelNames, afFuelWeights),
                getAverageAshAnalysisForFuels(['Grignons']),
                getAverageAshAnalysisForFuels(petQueryNames),
            ]);

            setAfAshAnalysis(avgAfAsh);
            setGrignonsAshAnalysis(avgGrignonsAsh || {});
            
            const petCokeFallback: OxideAnalysis = {
              sio2: 2.0, al2o3: 2.0, fe2o3: 6.0, cao: 1.5, mgo: 0.7, so3: 2.0, k2o: 0.3, tio2: 0.2, mno: 0.1, p2o5: 0.2, paf: 0
            };
            
            const petCokeAnalysis = (avgPetCokeAsh && Object.keys(avgPetCokeAsh).length > 1) ? avgPetCokeAsh : petCokeFallback;
            setPetCokePrecaAsh(petCokeAnalysis);
            setPetCokeTuyereAsh(petCokeAnalysis);

        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les données initiales." });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const { clinkerWithoutAsh, clinkerWithAsh, averageAshAnalysis } = useClinkerCalculations(
        rawMealFlow, rawMealAnalysis,
        afFlow, afAshAnalysis,
        grignonsFlow, grignonsAshAnalysis,
        petCokePrecaFlow, petCokePrecaAsh,
        petCokeTuyereFlow, petCokeTuyereAsh,
        fuelDataMap
    );
    
    const clinkerFlow = useMemo(() => rawMealFlow * clinkerFactor, [rawMealFlow, clinkerFactor]);

    const renderResultCell = (value: number | undefined, options: { decimals?: number, suffix?: string } = {}) => {
        const { decimals = 2, suffix = '' } = options;
        if (value === undefined || isNaN(value)) return <span className="text-muted-foreground">-</span>;
        return `${value.toFixed(decimals)}${suffix}`;
    };

    const getDiffClass = (valWith: number | undefined, valWithout: number | undefined) => {
        if (valWith === undefined || valWithout === undefined) return "";
        const diff = valWith - valWithout;
        if (Math.abs(diff) < 0.01) return "";
        return diff > 0 ? "text-red-600" : "text-green-600";
    }

    const renderResultRow = (
        label: string,
        key: keyof OxideAnalysis | 'ms' | 'af' | 'lsf' | 'c3s',
        options: { decimals?: number, suffix?: string } = {}
    ) => {
        let rawValue: number | undefined, ashValue: number | undefined, withoutValue: number | undefined, withValue: number | undefined;

        if (key === 'paf') {
            rawValue = rawMealAnalysis.paf;
            ashValue = averageAshAnalysis.paf;
            withoutValue = clinkerWithoutAsh.paf;
            withValue = clinkerWithAsh.paf;
        } else if (OXIDE_KEYS.includes(key as any)) {
            rawValue = rawMealAnalysis[key as keyof OxideAnalysis];
            ashValue = averageAshAnalysis[key as keyof OxideAnalysis];
            withoutValue = clinkerWithoutAsh[key as keyof OxideAnalysis];
            withValue = clinkerWithAsh[key as keyof OxideAnalysis];
        } else {
            const rawModules = calculateModules(rawMealAnalysis);
            const ashModules = calculateModules(averageAshAnalysis);
            const withoutModules = calculateModules(clinkerWithoutAsh);
            const withModules = calculateModules(clinkerWithAsh);
            
            if(key === 'c3s') {
                rawValue = undefined; 
                ashValue = undefined;
                withoutValue = calculateC3S(clinkerWithoutAsh, freeLime);
                withValue = calculateC3S(clinkerWithAsh, freeLime);
            } else {
                rawValue = rawModules[key as 'ms' | 'af' | 'lsf'];
                ashValue = ashModules[key as 'ms' | 'af' | 'lsf'];
                withoutValue = withoutModules[key as 'ms' | 'af' | 'lsf'];
                withValue = withModules[key as 'ms' | 'af' | 'lsf'];
            }
        }
        
        const diffClass = getDiffClass(withValue, withoutValue);

        return (
            <TableRow key={key}>
                <TableHead>{label}</TableHead>
                <TableCell className="text-right tabular-nums">{renderResultCell(rawValue, options)}</TableCell>
                <TableCell className="text-right tabular-nums">{renderResultCell(ashValue, options)}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">{renderResultCell(withoutValue, options)}</TableCell>
                <TableCell className={`text-right tabular-nums font-bold ${diffClass}`}>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span>{renderResultCell(withValue, options)}</span>
                            </TooltipTrigger>
                            {withValue !== undefined && withoutValue !== undefined && (
                                <TooltipContent>
                                    <p>Diff: {(withValue - withoutValue).toFixed(3)}</p>
                                </TooltipContent>
                            )}
                        </Tooltip>
                    </TooltipProvider>
                </TableCell>
            </TableRow>
        );
    };

    if (loading) {
        return <div className="space-y-4"><Skeleton className="h-48 w-full" /><Skeleton className="h-96 w-full" /></div>;
    }
    
    if (!latestSession) {
        return (
            <Card>
                <CardContent className="p-8 text-center">
                    <p className="text-lg font-medium">Aucune session de mélange active.</p>
                    <p className="text-muted-foreground">Veuillez d'abord enregistrer une session dans la page "Calcul de Mélange" pour utiliser cet outil.</p>
                </CardContent>
            </Card>
        );
    }
    
    const toNum = (v: string) => {
      const x = parseFloat(v.replace(',', '.'));
      return Number.isFinite(x) ? x : 0;
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Beaker className="h-5 w-5 text-blue-500" /> Paramètres du Cru et du Clinker</CardTitle>
                        <CardDescription>Entrez la composition de la farine, son débit, et le facteur de clinkérisation.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                            <div>
                                <Label htmlFor="raw-meal-flow">Débit Farine (t/h)</Label>
                                <Input id="raw-meal-flow" type="number" value={rawMealFlow} onChange={e => setRawMealFlow(parseFloat(e.target.value) || 0)} />
                            </div>
                            <div>
                                <Label htmlFor="clinker-factor">Facteur de clinkérisation</Label>
                                <Input id="clinker-factor" type="number" step="0.01" value={clinkerFactor} onChange={e => setClinkerFactor(parseFloat(e.target.value) || 0)} />
                            </div>
                        </div>
                         <div className="flex items-center justify-center gap-4 p-3 bg-muted rounded-lg">
                            <Label>Débit Clinker (t/h)</Label>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            <span className="text-lg font-bold text-primary">{clinkerFlow.toFixed(2)}</span>
                        </div>
                        <OxideInputRow analysis={rawMealAnalysis} onAnalysisChange={setRawMealAnalysis} />
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                             <CardTitle className="flex items-center gap-2"><Flame className="h-5 w-5 text-orange-500" /> Débits des Combustibles</CardTitle>
                            <CardDescription>Les débits sont chargés depuis la dernière session de calcul de mélange.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/30">
                                <div><Label>Débit AFs (t/h)</Label><Input value={afFlow.toFixed(2)} readOnly disabled /></div>
                                <div><Label>Débit Grignons (t/h)</Label><Input value={grignonsFlow.toFixed(2)} readOnly disabled /></div>
                                <div><Label>Débit Pet-Coke Préca (t/h)</Label><Input value={petCokePrecaFlow.toFixed(2)} readOnly disabled /></div>
                                <div><Label>Débit Pet-Coke Tuyère (t/h)</Label><Input value={petCokeTuyereFlow.toFixed(2)} readOnly disabled /></div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                     <div>
                        <CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5 text-green-600" /> Résultats de l'Impact sur le Clinker</CardTitle>
                        <CardDescription>Tableau comparatif de la composition chimique avant et après l'ajout des cendres de combustibles.</CardDescription>
                     </div>
                     <Button variant="outline"><FileDown className="mr-2 h-4 w-4" /> Exporter</Button>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Paramètre</TableHead>
                                <TableHead className="text-right">Farine Brute</TableHead>
                                <TableHead className="text-right">Cendres Mélange</TableHead>
                                <TableHead className="text-right">Clinker sans Cendres</TableHead>
                                <TableHead className="text-right">Clinker avec Cendres</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {renderResultRow('PF (%)', 'paf', { decimals: 2 })}
                            {renderResultRow('SiO₂ (%)', 'sio2', { decimals: 2 })}
                            {renderResultRow('Al₂O₃ (%)', 'al2o3', { decimals: 2 })}
                            {renderResultRow('Fe₂O₃ (%)', 'fe2o3', { decimals: 2 })}
                            {renderResultRow('CaO (%)', 'cao', { decimals: 2 })}
                            {renderResultRow('MgO (%)', 'mgo', { decimals: 2 })}
                            {renderResultRow('SO₃ (%)', 'so3', { decimals: 2 })}
                            {renderResultRow('K₂O (%)', 'k2o', { decimals: 2 })}
                            {renderResultRow('TiO₂ (%)', 'tio2', { decimals: 3 })}
                            {renderResultRow('MnO (%)', 'mno', { decimals: 3 })}
                            {renderResultRow('P₂O₅ (%)', 'p2o5', { decimals: 3 })}
                            <TableRow className="bg-muted/30 font-bold"><TableCell colSpan={5} className="py-2"></TableCell></TableRow>
                            {renderResultRow('MS', 'ms', { decimals: 2 })}
                            {renderResultRow('A/F', 'af', { decimals: 2 })}
                            {renderResultRow('LSF', 'lsf', { decimals: 2 })}
                            {renderResultRow('C₃S (Alite)', 'c3s', { decimals: 2 })}
                        </TableBody>
                    </Table>
                    <div className="mt-4 p-4 border rounded-lg max-w-xs">
                        <Label htmlFor="free-lime">Chaux Libre (%)</Label>
                        <Input
                            id="free-lime"
                            type="number"
                            step="0.1"
                            value={freeLime}
                            onChange={e => setFreeLime(parseFloat(e.target.value) || 0)}
                            className="mt-1"
                        />
                         <p className="text-xs text-muted-foreground mt-2">
                            Ajustez cette valeur pour affiner le calcul du C₃S (Alite).
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

    