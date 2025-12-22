
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getLatestMixtureSession, type MixtureSession, getImpactAnalyses, type ImpactAnalysis, getFuelData, type FuelData, getThresholds, type MixtureThresholds } from '@/lib/data';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, BookOpen, Beaker, BarChart2, Flame } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, Cell, LabelList } from 'recharts';
import { useToast } from '@/hooks/use-toast';
import { IndicatorCard } from '@/components/mixture-calculator';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';


const formatNumber = (num: number | null | undefined, digits: number = 2) => {
    if (num === null || num === undefined || isNaN(num)) return '–';
    return num.toLocaleString('fr-FR', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
};

const InstallationCompositionCard = ({ name, flowRate, composition }: { name: string, flowRate: number, composition: { name: string, buckets: number, percentage: number }[] }) => {
    if (!composition || composition.length === 0) {
        return (
             <Card>
                <CardHeader>
                    <CardTitle className="text-lg">{name}</CardTitle>
                    <CardDescription>Débit: {formatNumber(flowRate, 1)} t/h</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-center text-muted-foreground p-4">Aucune donnée</p>
                </CardContent>
            </Card>
        )
    }
     return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle className="text-lg">{name}</CardTitle>
                <CardDescription>Débit: <span className="font-semibold text-white">{formatNumber(flowRate, 1)} t/h</span></CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Combustible</TableHead>
                            <TableHead className="text-right">Nb. Godets</TableHead>
                            <TableHead className="text-right">% Poids</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {composition.map(item => (
                            <TableRow key={item.name}>
                                <TableCell className="font-medium">{item.name}</TableCell>
                                <TableCell className="text-right">{item.buckets}</TableCell>
                                <TableCell className="text-right">{formatNumber(item.percentage, 1)}%</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
};


const IndicatorGrid = ({ indicators, title }: { indicators: Record<string, { value: number, unit: string, digits: number }> | null, title: string }) => {
    if (!indicators) return null;
    return (
        <div>
            <h3 className="text-md font-semibold text-neutral-300 mb-2">{title}</h3>
            <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
                {Object.entries(indicators).map(([key, { value, unit, digits }]) => (
                    <div key={key} className="bg-brand-muted/50 border border-brand-line/50 rounded-lg p-2 text-center">
                        <p className="text-xs text-muted-foreground">{key}</p>
                        <p className="text-md font-bold text-white">
                            {formatNumber(value, digits)}
                            <span className="text-xs text-muted-foreground ml-1">{unit}</span>
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function RapportSynthesePage() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [mixtureSession, setMixtureSession] = useState<MixtureSession | null>(null);
    const [latestImpact, setLatestImpact] = useState<ImpactAnalysis | null>(null);
    const [fuelDataMap, setFuelDataMap] = useState<Record<string, FuelData>>({});

    const fetchData = useCallback(async () => {
        try {
            const [sessionData, impactAnalyses, fuelData] = await Promise.all([
                getLatestMixtureSession(),
                getImpactAnalyses(),
                getFuelData(),
            ]);
            setMixtureSession(sessionData);
            setLatestImpact(impactAnalyses.length > 0 ? impactAnalyses[0] : null);
            setFuelDataMap(fuelData.reduce((acc, fd) => {
                acc[fd.nom_combustible] = fd;
                return acc;
            }, {} as Record<string, FuelData>));
        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const { afIndicators, totalIndicators, hallComposition, atsComposition, mixtureComposition, afFlow, goFlow } = useMemo(() => {
        if (!mixtureSession || !fuelDataMap || !mixtureSession.availableFuels) {
            return { afIndicators: null, totalIndicators: null, hallComposition: [], atsComposition: [], mixtureComposition: [], afFlow: 0, goFlow: 0 };
        }

        const hallState = mixtureSession.hallAF;
        const atsState = mixtureSession.ats;
        const directInputs = mixtureSession.directInputs || {};

        const afFlow = (hallState?.flowRate || 0) + (atsState?.flowRate || 0);
        const goFlow = (directInputs['Grignons GO1']?.flowRate || 0) + (directInputs['Grignons GO2']?.flowRate || 0);

        const processComposition = (fuels: Record<string, { buckets: number }>) => {
             if (!fuels) return { composition: [], totalWeight: 0 };
            const composition = Object.entries(fuels)
                .map(([name, data]) => ({ name, buckets: data.buckets || 0, weight: (data.buckets || 0) * (fuelDataMap[name]?.poids_godet || 1.5) }))
                .filter(item => item.buckets > 0);
            
            const totalWeight = composition.reduce((sum, item) => sum + item.weight, 0);
            
            return {
                composition: composition.map(item => ({...item, percentage: totalWeight > 0 ? (item.weight / totalWeight) * 100 : 0})).sort((a,b) => b.percentage - a.percentage),
                totalWeight
            };
        };

        const hallData = processComposition(hallState?.fuels);
        const atsData = processComposition(atsState?.fuels);

        const afIndicators = {
            'PCI': { value: mixtureSession.afIndicators.pci, unit: 'kcal/kg', digits: 0 },
            'Humidité': { value: mixtureSession.afIndicators.humidity, unit: '%', digits: 2 },
            'Cendres': { value: mixtureSession.afIndicators.ash, unit: '%', digits: 2 },
            'Chlore': { value: mixtureSession.afIndicators.chlorine, unit: '%', digits: 3 },
            'Pneus': { value: mixtureSession.afIndicators.tireRate, unit: '%', digits: 1 },
        };
        
         const totalAlternativeFlow = afFlow + goFlow;
         const weightedAvg = (key: 'pci' | 'humidity' | 'ash' | 'chlorine') => {
            if (totalAlternativeFlow === 0) return 0;
            const afValue = (mixtureSession.afIndicators as any)[key] || 0;
            const goAnalysis = mixtureSession.availableFuels['Grignons'];
            const goValue = goAnalysis ? (goAnalysis as any)[`${key === 'pci' ? 'pci_brut' : key}`] : 0;
            return (afValue * afFlow + goValue * goFlow) / totalAlternativeFlow;
         };
        
        const totalIndicators = {
            'PCI': { value: weightedAvg('pci'), unit: 'kcal/kg', digits: 0 },
            'Humidité': { value: weightedAvg('humidity'), unit: '%', digits: 2 },
            'Cendres': { value: weightedAvg('ash'), unit: '%', digits: 2 },
            'Chlore': { value: weightedAvg('chlorine'), unit: '%', digits: 3 },
        };


        const mixtureComp = [...hallData.composition, ...atsData.composition].reduce((acc, curr) => {
            const existing = acc.find(item => item.name === curr.name);
            if(existing) {
                existing.weight += curr.weight;
            } else {
                acc.push({ name: curr.name, weight: curr.weight });
            }
            return acc;
        }, [] as {name: string, weight: number}[]);

        const totalMixtureWeight = mixtureComp.reduce((sum, item) => sum + item.weight, 0);

        return { 
            afIndicators, 
            totalIndicators,
            hallComposition: hallData.composition,
            atsComposition: atsData.composition,
            mixtureComposition: mixtureComp.map(item => ({...item, percentage: totalMixtureWeight > 0 ? (item.weight / totalMixtureWeight) * 100 : 0})).sort((a,b) => b.percentage - a.percentage),
            afFlow,
            goFlow,
        };
    }, [mixtureSession, fuelDataMap]);

    const impactChartData = useMemo(() => {
        if (!latestImpact) return [];
        const { results } = latestImpact;
        const delta = (a?: number | null, b?: number | null) => (a ?? 0) - (b ?? 0);
        return [
            { name: "Fe2O3", value: delta(results.clinkerWithAsh.fe2o3, results.clinkerWithoutAsh.fe2o3) },
            { name: "LSF", value: delta(results.modulesAvec.lsf, results.modulesSans.lsf) },
            { name: "C3S", value: delta(results.c3sAvec, results.c3sSans) },
            { name: "MS", value: delta(results.modulesAvec.ms, results.modulesSans.ms) },
            { name: "AF", value: delta(results.modulesAvec.af, results.modulesSans.af) },
        ];
    }, [latestImpact]);

    const chartColors = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F'];

    if (loading) {
        return (
            <div className="p-4 md:p-6 lg:p-8 space-y-6">
                <Skeleton className="h-10 w-1/3" />
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <Skeleton className="h-64" />
                    <Skeleton className="h-64" />
                    <Skeleton className="h-64" />
                </div>
            </div>
        );
    }
    
    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-3">
                        <BookOpen className="h-8 w-8" />
                        Rapport de Synthèse
                    </h1>
                     {mixtureSession?.timestamp && (
                        <p className="text-sm text-muted-foreground mt-1">
                            Basé sur la session du {format(mixtureSession.timestamp.toDate(), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                        </p>
                    )}
                </div>
                <div className='flex items-center gap-4 text-right'>
                    <div>
                        <p className="text-xs text-muted-foreground">Débit AFs</p>
                        <p className="text-xl font-bold">{formatNumber(afFlow, 1)} t/h</p>
                    </div>
                     <div>
                        <p className="text-xs text-muted-foreground">Débit Grignons</p>
                        <p className="text-xl font-bold">{formatNumber(goFlow, 1)} t/h</p>
                    </div>
                </div>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Indicateurs de Performance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <IndicatorGrid indicators={afIndicators} title="Mélange AFs (sans GO)" />
                    <Separator />
                    <IndicatorGrid indicators={totalIndicators} title="Mélange Total Alternatifs (avec GO)" />
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <InstallationCompositionCard name="Hall des AF" composition={hallComposition} flowRate={mixtureSession?.hallAF?.flowRate || 0} />
                <InstallationCompositionCard name="ATS" composition={atsComposition} flowRate={mixtureSession?.ats?.flowRate || 0} />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><BarChart2 /> Répartition Globale du Mélange AFs (% Poids)</CardTitle>
                </CardHeader>
                <CardContent>
                    {mixtureComposition.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={mixtureComposition} margin={{ top: 20, right: 20, bottom: 0, left: -10}}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} unit="%" />
                                <Tooltip
                                    formatter={(value) => `${formatNumber(value as number, 1)}%`}
                                    contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
                                    cursor={{ fill: 'hsl(var(--muted))' }}
                                />
                                <Bar dataKey="percentage" name="% Poids">
                                    {mixtureComposition.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                                    ))}
                                    <LabelList dataKey="percentage" position="top" formatter={(value: number) => `${formatNumber(value, 1)}%`} fontSize={12} fill="hsl(var(--foreground))" />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <p className="text-center text-muted-foreground p-4">Aucune donnée pour le graphique.</p>}
                </CardContent>
            </Card>

             <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Activity /> Impact sur le Clinker (Δ Calculé - Sans Cendres)</CardTitle></CardHeader>
                <CardContent>
                     {impactChartData.length > 0 ? (
                         <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={impactChartData} margin={{ top: 20, right: 20, bottom: 0, left: -20}}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                                <Tooltip
                                    contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
                                    cursor={{ fill: 'hsl(var(--muted))' }}
                                />
                                <Bar dataKey="value" name="Variation">
                                    {impactChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.value < 0 ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'} />
                                    ))}
                                    <LabelList dataKey="value" position="top" formatter={(value: number) => formatNumber(value, 2)} fontSize={12} fill="hsl(var(--foreground))" />
                                </Bar>
                            </BarChart>
                         </ResponsiveContainer>
                     ) : <p className="text-center text-muted-foreground p-4">Aucune donnée d'impact.</p>}
                </CardContent>
            </Card>
        </div>
    );
}

