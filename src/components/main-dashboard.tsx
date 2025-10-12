

"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getLatestMixtureSession, type MixtureSession, getImpactAnalyses, type ImpactAnalysis, getLatestIndicatorData, getMixtureSessions, getStocks, Stock, getAverageAnalysisForFuels as getAverageAnalysisForFuelTypes, AverageAnalysis, getUniqueFuelTypes } from '@/lib/data';
import { Skeleton } from "@/components/ui/skeleton";
import { Droplets, Wind, Percent, BarChart, Thermometer, Flame, TrendingUp, Activity, Archive, LayoutDashboard, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { KeyIndicatorCard } from './cards/KeyIndicatorCard';
import { FlowRateCard, FlowData } from './cards/FlowRateCard';
import { ImpactCard, ImpactData } from './cards/ImpactCard';
import { Bar, BarChart as RechartsBarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid, Cell, LabelList } from 'recharts';
import { subDays, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


// Hook to read from localStorage without causing hydration issues
function usePersistentValue<T>(key: string, defaultValue: T): T {
    const [state, setState] = useState<T>(defaultValue);

    useEffect(() => {
        try {
            if (typeof window === 'undefined') {
                return;
            }
            const storedValue = localStorage.getItem(key);
            if (storedValue !== null) {
                setState(JSON.parse(storedValue));
            }
        } catch {
            setState(defaultValue);
        }
    }, [key]);
    
    return state;
}

// Simplified StatCard for local use
function StatCard({ label, value, icon: Icon, unit }: { label: string; value: string; icon: React.ElementType, unit?: string }) {
  return (
    <div className="rounded-2xl bg-brand-surface/60 border border-brand-line/60 p-4 shadow-soft">
      <div className="flex items-start justify-between">
        <span className="text-sm text-neutral-300">{label}</span>
        {Icon ? <div className="opacity-70"><Icon className="h-5 w-5"/></div> : null}
      </div>
      <div className="mt-2 text-3xl font-bold text-white">{value}<span className="text-lg text-muted-foreground ml-1">{unit}</span></div>
    </div>
  );
}

const formatNumber = (num: number | null | undefined, digits: number = 2) => {
    if (num === null || num === undefined || isNaN(num)) return '0.00';
    return num.toLocaleString('fr-FR', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
};

const CustomHistoryTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-background/80 backdrop-blur-sm border border-border rounded-lg shadow-lg p-3 text-xs">
                <p className="font-bold text-foreground">{label}</p>
                {payload.map((pld: any) => (
                    <div key={pld.dataKey} style={{ color: pld.color }}>
                        {`${pld.name}: ${pld.value.toFixed(2)}`}
                    </div>
                ))}
            </div>
        );
    }
    return null;
  };

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

type ChartMetric = 'pci' | 'chlore';

export function MainDashboard() {
    const [loading, setLoading] = useState(true);
    const [mixtureSession, setMixtureSession] = useState<MixtureSession | null>(null);
    const [latestImpact, setLatestImpact] = useState<ImpactAnalysis | null>(null);
    const [keyIndicators, setKeyIndicators] = useState<{ tsr: number; } | null>(null);
    const [weeklyAverages, setWeeklyAverages] = useState<Record<string, AverageAnalysis>>({});
    const [chartMetric, setChartMetric] = useState<ChartMetric>('pci');
    const debitClinker = usePersistentValue<number>('debitClinker', 0);


    const fetchData = useCallback(async () => {
        try {
            const sevenDaysAgo = subDays(new Date(), 7);
            const today = new Date();

            const [sessionData, impactAnalyses, indicatorData, uniqueFuels] = await Promise.all([
                getLatestMixtureSession(),
                getImpactAnalyses(),
                getLatestIndicatorData(),
                getUniqueFuelTypes(),
            ]);

            const fuelNames = uniqueFuels.filter(name => name.toLowerCase() !== 'grignons' && name.toLowerCase() !== 'pet-coke');

            const weeklyAvgsData = await getAverageAnalysisForFuelTypes(fuelNames, { from: sevenDaysAgo, to: today });

            setMixtureSession(sessionData);
            setLatestImpact(impactAnalyses.length > 0 ? impactAnalyses[0] : null);
            setKeyIndicators(indicatorData);
            setWeeklyAverages(weeklyAvgsData);
        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        } finally {
            setLoading(false);
        }
    }, []);


    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const mixtureIndicators = useMemo(() => {
        if (!mixtureSession?.globalIndicators) return null;
        const indicators = mixtureSession.globalIndicators;
        return [
            { label: "PCI", value: formatNumber(indicators.pci, 0), unit: "kcal/kg", icon: Thermometer },
            { label: "Chlorures", value: formatNumber(indicators.chlorine, 3), unit: "%", icon: Wind },
            { label: "Taux Pneus", value: formatNumber(indicators.tireRate, 2), unit: "%", icon: BarChart },
            { label: "Cendres", value: formatNumber(indicators.ash, 2), unit: "%", icon: Percent },
            { label: "H₂O", value: formatNumber(indicators.humidity, 2), unit: "%", icon: Droplets },
        ];
    }, [mixtureSession]);
    
    const impactData: ImpactData[] | null = useMemo(() => {
        if (!latestImpact) return null;
        const { results } = latestImpact;
        const delta = (a?: number | null, b?: number | null) => (a ?? 0) - (b ?? 0);
        return [
            { label: "% Fe2O3", value: delta(results.clinkerWithAsh.fe2o3, results.clinkerWithoutAsh.fe2o3) },
            { label: "LSF", value: delta(results.modulesAvec.lsf, results.modulesSans.lsf) },
            { label: "C3S", value: delta(results.c3sAvec, results.c3sSans) },
            { label: "MS", value: delta(results.modulesAvec.ms, results.modulesSans.ms) },
            { label: "AF", value: delta(results.modulesAvec.af, results.modulesSans.af) },
        ];
    }, [latestImpact]);

    const calorificConsumption = useMemo(() => {
        if (!mixtureSession || !debitClinker || debitClinker === 0 || !mixtureSession.availableFuels) return 0;
        
        const getPci = (fuelName: string) => mixtureSession.availableFuels[fuelName]?.pci_brut || 0;
        const getPetCokePci = () => getPci('Pet Coke') || getPci('Pet-Coke') || getPci('Pet-Coke Preca') || getPci('Pet-Coke Tuyere');

        let afEnergyWeightedSum = 0;

        const processInstallation = (installation: any) => {
             if (!installation?.fuels || !installation.flowRate || installation.flowRate === 0) return;
             
             let installationTotalWeight = 0;
             const fuelWeights: Record<string, number> = {};

             for (const [fuel, data] of Object.entries(installation.fuels as Record<string, {buckets: number}>)) {
                 const weight = (data.buckets || 0) * (mixtureSession.availableFuels[fuel]?.poids_godet || 1.5);
                 installationTotalWeight += weight;
                 fuelWeights[fuel] = weight;
             }
             
             if(installationTotalWeight === 0) return;

             for (const [fuel, data] of Object.entries(installation.fuels as Record<string, {buckets: number}>)) {
                if (fuel.toLowerCase().includes('grignons') || fuel.toLowerCase().includes('pet coke')) continue;
                
                const pci = getPci(fuel);
                const weight = fuelWeights[fuel] || 0;
                
                const proportion = weight / installationTotalWeight;
                const weightedEnergy = pci * proportion * installation.flowRate;
                
                afEnergyWeightedSum += weightedEnergy;
             }
        }
        
        processInstallation(mixtureSession.hallAF);
        processInstallation(mixtureSession.ats);
        
        const energyAFs = afEnergyWeightedSum / 1000;

        const grignonsFlow = (mixtureSession.directInputs?.['Grignons GO1']?.flowRate || 0) + (mixtureSession.directInputs?.['Grignons GO2']?.flowRate || 0);
        const energyGrignons = grignonsFlow * getPci('Grignons') / 1000;

        const petCokeFlow = (mixtureSession.directInputs?.['Pet-Coke Preca']?.flowRate || 0) + (mixtureSession.directInputs?.['Pet-Coke Tuyere']?.flowRate || 0);
        const energyPetCoke = petCokeFlow * getPetCokePci() / 1000;

        const energyTotalGcal = energyAFs + energyGrignons + energyPetCoke;

        return debitClinker > 0 
            ? (energyTotalGcal * 1000000) / (debitClinker * 1000)
            : 0;
    }, [mixtureSession, debitClinker]);

    const chartData = useMemo(() => {
        return Object.entries(weeklyAverages)
            .filter(([, data]) => data && data.count > 0)
            .map(([name, data]) => ({
                name,
                pci: data.pci_brut,
                chlore: data.chlore,
            }));
    }, [weeklyAverages]);


    if (loading) {
        return (
            <div className="p-4 md:p-6 space-y-6">
                <Skeleton className="h-32 w-full" />
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
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                <LayoutDashboard className="h-8 w-8" />
                Tableau de Bord
            </h1>

            <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle className="flex items-center gap-2">Moyenne par Combustible</CardTitle>
                                    <CardDescription>Moyenne des 7 derniers jours</CardDescription>
                                </div>
                                <Select value={chartMetric} onValueChange={(value: ChartMetric) => setChartMetric(value)}>
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue placeholder="Choisir un indicateur" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pci">PCI (kcal/kg)</SelectItem>
                                        <SelectItem value="chlore">Chlore (%)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardHeader>
                        <CardContent>
                             <ResponsiveContainer width="100%" height={350}>
                                {chartData.length > 0 ? (
                                    <RechartsBarChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                        <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                                        <Tooltip content={<CustomHistoryTooltip />} />
                                        <Bar dataKey={chartMetric} name={chartMetric === 'pci' ? 'PCI (kcal/kg)' : 'Chlore (%)'}>
                                            <LabelList 
                                                dataKey={chartMetric} 
                                                position="top" 
                                                formatter={(value: number) => chartMetric === 'pci' ? Math.round(value) : value.toFixed(2)}
                                                fontSize={12} 
                                                fill="hsl(var(--foreground))" 
                                            />
                                            {chartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </RechartsBarChart>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-muted-foreground">Aucune donnée pour la période.</div>
                                )}
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-1 space-y-6">
                    <KeyIndicatorCard tsr={keyIndicators?.tsr} consumption={calorificConsumption} />
                    <Card>
                        <CardHeader><CardTitle className="flex items-center gap-2"><Flame /> Indicateurs du Mélange</CardTitle></CardHeader>
                        <CardContent className="grid gap-4 grid-cols-2">
                             {mixtureIndicators ? mixtureIndicators.map(ind => (
                                <div key={ind.label} className="p-3 rounded-lg bg-brand-muted/70">
                                    <p className="text-xs text-muted-foreground">{ind.label}</p>
                                    <p className="text-xl font-bold">{ind.value}<span className="text-xs ml-1">{ind.unit}</span></p>
                                </div>
                            )) : <p className="col-span-2 text-center text-muted-foreground p-4">Aucune session de mélange.</p>}
                        </CardContent>
                    </Card>
                     <ImpactCard title="Impact sur le Clinker" data={impactData} lastUpdate={latestImpact?.createdAt.toDate()} />
                </div>

            </section>
        </div>
    );
}
