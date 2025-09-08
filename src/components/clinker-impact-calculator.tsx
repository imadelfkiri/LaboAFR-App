
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
const ASH_OXIDE_KEYS: Exclude<keyof OxideAnalysis, 'pourcentage_cendres'>[] = ['paf', 'sio2', 'al2o3', 'fe2o3', 'cao', 'mgo', 'so3', 'k2o', 'tio2', 'mno', 'p2o5'];


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
    const c = analysis.cao || 0;
    const effectiveCao = c - freeLime;
    return (4.07 * effectiveCao) - (7.60 * s) - (6.72 * a) - (1.43 * f);
}

const useClinkerCalculations = (
    rawMealFlow: number,
    rawMealAnalysis: OxideAnalysis,
    afFlow: number,
    afAshAnalysis: OxideAnalysis,
    grignonsFlow: number,
    grignonsAshAnalysis: OxideAnalysis,
    petCokePrecaFlow: number,
    petCokePrecaAshAnalysis: OxideAnalysis,
    petCokeTuyereFlow: number,
    petCokeTuyereAshAnalysis: OxideAnalysis
) => {
    return useMemo(() => {
        const clinkerize = (inputAnalysis: OxideAnalysis) => {
            const clinkerizableOxidesSum = OXIDE_KEYS.reduce((sum, key) => {
                if (key !== 'paf' && inputAnalysis[key] !== undefined) {
                    sum += inputAnalysis[key] || 0;
                }
                return sum;
            }, 0);

            if (clinkerizableOxidesSum === 0) return {};
            
            const factor = 99.8 / clinkerizableOxidesSum;

            const clinkerAnalysis: OxideAnalysis = { paf: 0.2 };
            
            OXIDE_KEYS.forEach(key => {
                if (key !== 'paf' && inputAnalysis[key] !== undefined) {
                    clinkerAnalysis[key] = (inputAnalysis[key] || 0) * factor;
                }
            });
            
            return clinkerAnalysis;
        }

        const clinkerizeWithoutAsh = (inputAnalysis: OxideAnalysis) => {
            const paf = inputAnalysis.paf || 0;
            if (paf >= 100) return {};
            
            const clinkerizableOxides = OXIDE_KEYS.reduce((sum, key) => {
                 if (key !== 'paf' && inputAnalysis[key] !== undefined) {
                    sum += inputAnalysis[key] || 0;
                }
                return sum;
            }, 0);

            if (clinkerizableOxides === 0) return {};
            
            const factor = 99.8 / clinkerizableOxides;

            const clinkerAnalysis: OxideAnalysis = { paf: 0.2 };
            
            OXIDE_KEYS.forEach(key => {
                if (key !== 'paf' && inputAnalysis[key] !== undefined) {
                    clinkerAnalysis[key] = (inputAnalysis[key] || 0) * factor;
                }
            });

            return clinkerAnalysis;
        }

        // --- Clinker Sans Cendres ---
        const clinkerWithoutAsh = clinkerizeWithoutAsh(rawMealAnalysis);

        // --- Clinker Avec Cendres ---
        const totalOxideFlows: OxideAnalysis = {};
        
        // Farine
        OXIDE_KEYS.forEach(key => {
            totalOxideFlows[key] = rawMealFlow * ((rawMealAnalysis[key] || 0) / 100);
        });

        // Cendres des combustibles
        const fuelSources = [
            { flow: afFlow, analysis: afAshAnalysis },
            { flow: grignonsFlow, analysis: grignonsAshAnalysis },
            { flow: petCokePrecaFlow, analysis: petCokePrecaAshAnalysis },
            { flow: petCokeTuyereFlow, analysis: petCokeTuyereAshAnalysis },
        ];

        fuelSources.forEach(source => {
            if (source.flow > 0 && source.analysis) {
                const ashContent = (source.analysis.pourcentage_cendres || 0) / 100;
                ASH_OXIDE_KEYS.forEach(key => {
                    const oxidePercentInAsh = (source.analysis[key] || 0) / 100;
                    totalOxideFlows[key] = (totalOxideFlows[key] || 0) + (source.flow * ashContent * oxidePercentInAsh);
                });
            }
        });
        
        const totalMaterialFlowWithAsh = rawMealFlow + fuelSources.reduce((sum, s) => sum + s.flow * ((s.analysis.pourcentage_cendres || 0) / 100), 0);
        const totalPafFlow = rawMealFlow * ((rawMealAnalysis.paf || 0) / 100);

        const mixedRawAnalysis: OxideAnalysis = {};
        const totalClinkerizableFlow = Object.entries(totalOxideFlows).reduce((sum, [key, value]) => key === 'paf' ? sum : sum + (value || 0), 0);

        if (totalClinkerizableFlow > 0) {
             OXIDE_KEYS.forEach(key => {
                if (key !== 'paf') {
                    mixedRawAnalysis[key] = ((totalOxideFlows[key] || 0) / totalClinkerizableFlow) * (100 - ((totalPafFlow / totalMaterialFlowWithAsh) * 100));
                }
            });
            mixedRawAnalysis.paf = (totalPafFlow / totalMaterialFlowWithAsh) * 100;
        }

        const clinkerWithAsh = clinkerize(mixedRawAnalysis);
        
        // --- Analyse moyenne des cendres ---
        const totalAshFlow = fuelSources.reduce((sum, source) => {
             return sum + source.flow * ((source.analysis.pourcentage_cendres || 0) / 100);
        }, 0);

        const averageAshAnalysis: OxideAnalysis = {};
        if (totalAshFlow > 0) {
            ASH_OXIDE_KEYS.forEach(key => {
                const totalOxideInAshFlow = fuelSources.reduce((sum, source) => {
                    const ashContentPercent = source.analysis.pourcentage_cendres || 0;
                    const oxidePercentInAsh = source.analysis[key] || 0;
                    return sum + source.flow * (ashContentPercent / 100) * (oxidePercentInAsh / 100);
                }, 0);
                averageAshAnalysis[key] = (totalOxideInAshFlow / totalAshFlow) * 100;
            });
        }
        
        return { clinkerWithoutAsh, clinkerWithAsh, averageAshAnalysis };
    }, [rawMealFlow, rawMealAnalysis, afFlow, afAshAnalysis, grignonsFlow, grignonsAshAnalysis, petCokePrecaFlow, petCokePrecaAshAnalysis, petCokeTuyereFlow, petCokeTuyereAshAnalysis]);
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
    
    const [petCokePrecaFlow, setPetCokePrecaFlow] = useState(1.5);
    const [petCokePrecaAsh, setPetCokePrecaAsh] = useState<OxideAnalysis>({ paf: 0, pourcentage_cendres: 10, sio2: 45, al2o3: 25, fe2o3: 15, cao: 5 });
    
    const [petCokeTuyereFlow, setPetCokeTuyereFlow] = useState(1.0);
    const [petCokeTuyereAsh, setPetCokeTuyereAsh] = useState<OxideAnalysis>({ paf: 0, pourcentage_cendres: 10, sio2: 45, al2o3: 25, fe2o3: 15, cao: 5 });

    // Auto-loaded data
    const [latestSession, setLatestSession] = useState<MixtureSession | null>(null);
    const [afAshAnalysis, setAfAshAnalysis] = useState<OxideAnalysis>({});
    const [grignonsAshAnalysis, setGrignonsAshAnalysis] = useState<OxideAnalysis>({});

    const afFlow = useMemo(() => {
        if (!latestSession) return 0;
        let totalAfFlow = 0;
        if (latestSession.hallAF?.flowRate && latestSession.hallAF.fuels) {
             const nonGrignonsFuels = Object.keys(latestSession.hallAF.fuels).filter(f => f.toLowerCase() !== 'grignons').length > 0;
             if (nonGrignonsFuels) totalAfFlow += latestSession.hallAF.flowRate;
        }
         if (latestSession.ats?.flowRate && latestSession.ats.fuels) {
             const nonGrignonsFuels = Object.keys(latestSession.ats.fuels).filter(f => f.toLowerCase() !== 'grignons').length > 0;
             if (nonGrignonsFuels) totalAfFlow += latestSession.ats.flowRate;
        }
        return totalAfFlow;
    }, [latestSession]);
    
    const grignonsFlow = useMemo(() => latestSession?.grignons?.flowRate || 0, [latestSession]);

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

            const allAfFuels: Record<string, number> = {};
            [session.hallAF, session.ats].forEach(installation => {
                if (!installation?.fuels) return;
                for (const fuelName in installation.fuels) {
                    if (fuelName.toLowerCase() !== 'grignons') {
                        const buckets = installation.fuels[fuelName].buckets || 0;
                        if (buckets > 0) {
                            const poidsGodet = fuelDataMap[fuelName]?.poids_godet || 1.5;
                            allAfFuels[fuelName] = (allAfFuels[fuelName] || 0) + (buckets * poidsGodet);
                        }
                    }
                }
            });
            
            const afFuelNames = Object.keys(allAfFuels);
            const afFuelWeights = Object.values(allAfFuels);

            const [avgAfAsh, avgGrignonsAsh] = await Promise.all([
                getAverageAshAnalysisForFuels(afFuelNames, afFuelWeights),
                getAverageAshAnalysisForFuels(['Grignons']),
            ]);

            setAfAshAnalysis(avgAfAsh);
            setGrignonsAshAnalysis(avgGrignonsAsh || {});

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
        petCokeTuyereFlow, petCokeTuyereAsh
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

        if (key === 'paf' || OXIDE_KEYS.includes(key as any)) {
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

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Beaker className="h-5 w-5 text-blue-500" /> Analyse de la Farine</CardTitle>
                        <CardDescription>Entrez la composition chimique, le débit de votre farine, et le facteur de clinkérisation.</CardDescription>
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
                             <CardTitle className="flex items-center gap-2"><Flame className="h-5 w-5 text-orange-500" /> Débits et Cendres des Combustibles</CardTitle>
                            <CardDescription>Les débits des AFs sont automatiques. Entrez les données pour les Pet-Cokes.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/30">
                                <div><Label>Débit AFs (t/h)</Label><Input value={afFlow.toFixed(2)} readOnly disabled /></div>
                                <div><Label>Débit Grignons (t/h)</Label><Input value={grignonsFlow.toFixed(2)} readOnly disabled /></div>
                            </div>

                            <div className="space-y-2">
                                <Label>Pet Coke Précalcinateur</Label>
                                <div className="grid grid-cols-2 gap-4">
                                     <div><Label htmlFor="pet-coke-preca-flow" className="text-xs">Débit (t/h)</Label><Input id="pet-coke-preca-flow" type="number" value={petCokePrecaFlow} onChange={e => setPetCokePrecaFlow(parseFloat(e.target.value) || 0)} /></div>
                                     <div><Label htmlFor="pet-coke-preca-ash" className="text-xs">% Cendres</Label><Input id="pet-coke-preca-ash" type="number" value={petCokePrecaAsh.pourcentage_cendres ?? ''} onChange={e => setPetCokePrecaAsh(prev => ({...prev, pourcentage_cendres: parseFloat(e.target.value) || 0}))} /></div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Pet Coke Tuyère</Label>
                                <div className="grid grid-cols-2 gap-4">
                                     <div><Label htmlFor="pet-coke-tuyere-flow" className="text-xs">Débit (t/h)</Label><Input id="pet-coke-tuyere-flow" type="number" value={petCokeTuyereFlow} onChange={e => setPetCokeTuyereFlow(parseFloat(e.target.value) || 0)} /></div>
                                     <div><Label htmlFor="pet-coke-tuyere-ash" className="text-xs">% Cendres</Label><Input id="pet-coke-tuyere-ash" type="number" value={petCokeTuyereAsh.pourcentage_cendres ?? ''} onChange={e => setPetCokeTuyereAsh(prev => ({...prev, pourcentage_cendres: parseFloat(e.target.value) || 0}))} /></div>
                                </div>
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
    

    

    



