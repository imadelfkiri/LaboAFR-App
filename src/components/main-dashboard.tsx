
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getLatestMixtureSession, type MixtureSession, getImpactAnalyses, type ImpactAnalysis, getLatestIndicatorData, getAverageAnalysisForFuels as getAverageAnalysisForFuelTypes, type AverageAnalysis, getUniqueFuelTypes, getSpecifications, type Specification } from '@/lib/data';
import { Skeleton } from "@/components/ui/skeleton";
import { Droplets, Wind, Percent, BarChart, Thermometer, Flame, Activity, Archive, LayoutDashboard, ChevronDown, Recycle, Leaf } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bar, BarChart as RechartsBarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid, Cell, LabelList } from 'recharts';
import { subDays, format, startOfWeek, endOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KeyIndicatorCard } from './cards/KeyIndicatorCard';
import { ImpactCard, ImpactData } from './cards/ImpactCard';
import CountUp from 'react-countup';
import { motion } from "framer-motion";
import { usePathname } from 'next/navigation';


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

const formatNumber = (num: number | null | undefined, digits: number = 2) => {
    if (num === null || num === undefined || isNaN(num)) return '0,00';
    return num.toLocaleString('fr-FR', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
};

const CustomHistoryTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-brand-surface border border-brand-accent rounded-lg shadow-lg p-3 text-xs">
                <p className="font-bold text-brand-accent mb-2">{label}</p>
                {payload.map((pld: any) => (
                    <div key={pld.dataKey} className="text-brand-text">
                        {`${pld.name}: `}
                        <span className="font-bold">{pld.value.toLocaleString('fr-FR', { minimumFractionDigits: chartMetric === 'pci' ? 0 : 2, maximumFractionDigits: chartMetric === 'pci' ? 0 : 2 })}</span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
  };

const COLORS = ["#10b981", "#22c55e", "#3b82f6", "#8b5cf6", "#facc15", "#ef4444", "#0ea5e9"];
type ChartMetric = 'pci' | 'chlore';
let chartMetric: ChartMetric = 'pci';

export function MainDashboard() {
    const [loading, setLoading] = useState(true);
    const [mixtureSession, setMixtureSession] = useState<MixtureSession | null>(null);
    const [latestImpact, setLatestImpact] = useState<ImpactAnalysis | null>(null);
    const [keyIndicators, setKeyIndicators] = useState<{ tsr: number; } | null>(null);
    const [weeklyAverages, setWeeklyAverages] = useState<Record<string, AverageAnalysis>>({});
    const [specifications, setSpecifications] = useState<Record<string, Specification>>({});
    const [selectedChartMetric, setChartMetric] = useState<ChartMetric>('pci');
    const debitClinker = usePersistentValue<number>('debitClinker', 0);
    const pathname = usePathname();

    chartMetric = selectedChartMetric;

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const today = new Date();
            const startOfCurrentWeek = startOfWeek(today, { locale: fr });
            const endOfCurrentWeek = endOfWeek(today, { locale: fr });

            const [sessionData, impactAnalyses, indicatorData, uniqueFuels, specs] = await Promise.all([
                getLatestMixtureSession(),
                getImpactAnalyses(),
                getLatestIndicatorData(),
                getUniqueFuelTypes(),
                getSpecifications(),
            ]);

            const fuelNames = uniqueFuels.filter(name => name.toLowerCase() !== 'grignons' && name.toLowerCase() !== 'pet-coke');
            const weeklyAvgsData = await getAverageAnalysisForFuelTypes(fuelNames, { from: startOfCurrentWeek, to: endOfCurrentWeek });

            const specsMap: Record<string, Specification> = {};
            specs.forEach(spec => {
                const key = `${spec.type_combustible}|${spec.fournisseur}`;
                specsMap[key] = spec;
            });
            
            setSpecifications(specsMap);
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
    }, [fetchData, pathname]);

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
            .map(([name, data]) => {
                const spec = Object.values(specifications).find(s => s.type_combustible === name);
                let isConform = true;
                if (spec) {
                    if (selectedChartMetric === 'pci' && spec.PCI_min != null && data.pci_brut < spec.PCI_min) {
                        isConform = false;
                    }
                    if (selectedChartMetric === 'chlore' && spec.Cl_max != null && data.chlore > spec.Cl_max) {
                        isConform = false;
                    }
                }
                
                return {
                    name,
                    pci: data.pci_brut,
                    chlore: data.chlore,
                    isConform: spec ? isConform : null, // null if no spec
                }
            });
    }, [weeklyAverages, specifications, selectedChartMetric]);
    

    const mixtureIndicators = useMemo(() => {
        if (!mixtureSession?.globalIndicators) return null;
        const indicators = mixtureSession.globalIndicators;
        return [
            { label: "PCI", value: indicators.pci, unit: "kcal/kg", icon: Thermometer, decimals: 0 },
            { label: "Humidité", value: indicators.humidity, unit: "%", icon: Droplets, decimals: 1 },
            { label: "Cendres", value: indicators.ash, unit: "%", icon: Percent, decimals: 1 },
            { label: "Chlorures", value: indicators.chlorine, unit: "%", icon: Wind, decimals: 2 },
        ];
    }, [mixtureSession]);

    const impactIndicators = useMemo<ImpactData | null>(() => {
        if (!latestImpact) return null;
        const { results } = latestImpact;
        const delta = (a?: number | null, b?: number | null) => (a ?? 0) - (b ?? 0);
        return {
            'Fe2O3': delta(results.clinkerWithAsh.fe2o3, results.clinkerWithoutAsh.fe2o3),
            'CaO': delta(results.clinkerWithAsh.cao, results.clinkerWithoutAsh.cao),
            'LSF': delta(results.modulesAvec.lsf, results.modulesSans.lsf),
            'C3S': delta(results.c3sAvec, results.c3sSans),
            'MS': delta(results.modulesAvec.ms, results.modulesSans.ms),
            'AF': delta(results.modulesAvec.af, results.modulesSans.af),
        };
    }, [latestImpact]);


    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-10 w-1/3" />
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
                    <Skeleton className="h-40" />
                    <Skeleton className="h-40" />
                    <Skeleton className="h-40" />
                </div>
                <div className="grid gap-6 md:grid-cols-1">
                    <Skeleton className="h-96" />
                </div>
            </div>
        );
    }
    
    return (
        <motion.div
            className="space-y-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
        >
             <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <h1 className="text-3xl font-bold tracking-tight text-primary">
                    Tableau de Bord
                </h1>
                 {mixtureSession?.timestamp && (
                    <p className="text-sm text-muted-foreground">
                        Données de la session du {format(mixtureSession.timestamp.toDate(), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                    </p>
                )}
            </div>

             <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                <KeyIndicatorCard tsr={keyIndicators?.tsr} consumption={calorificConsumption} />
                
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2 text-white">
                            <Recycle className="text-green-400 h-5 w-5" />
                            Indicateurs du Mélange
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4">
                        {mixtureIndicators ? mixtureIndicators.map(ind => (
                            <div key={ind.label} className="p-3 rounded-lg bg-brand-muted border border-brand-line/50">
                                <p className="text-sm text-muted-foreground flex items-center gap-1.5"><ind.icon className="h-4 w-4" />{ind.label}</p>
                                <p className="text-xl font-bold">
                                    <CountUp
                                        end={ind.value}
                                        decimals={ind.decimals}
                                        duration={1.5}
                                        useGrouping={ind.label !== 'PCI'}
                                    />
                                    <span className="text-xs ml-1 opacity-80">{ind.unit}</span>
                                </p>
                            </div>
                        )) : <p className="text-muted-foreground text-center p-4 col-span-2">Aucune session de mélange.</p>}
                    </CardContent>
                </Card>

                <ImpactCard title="Impact sur le Clinker" data={impactIndicators} lastUpdate={latestImpact?.createdAt.toDate()} />
            </div>

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle className="text-white">Moyenne par Combustible (Semaine en cours)</CardTitle>
                        </div>
                        <Select value={selectedChartMetric} onValueChange={(value: ChartMetric) => setChartMetric(value)}>
                            <SelectTrigger className="w-[180px] bg-brand-muted border-brand-line">
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
                                <defs>
                                    <linearGradient id="chartGradientConform" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="rgba(16, 185, 129, 0.8)" />
                                        <stop offset="100%" stopColor="rgba(16, 185, 129, 0.1)" />
                                    </linearGradient>
                                     <linearGradient id="chartGradientNonConform" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="rgba(239, 68, 68, 0.8)" />
                                        <stop offset="100%" stopColor="rgba(239, 68, 68, 0.1)" />
                                    </linearGradient>
                                     <linearGradient id="chartGradientNeutral" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="rgba(0,224,161,0.8)" />
                                        <stop offset="100%" stopColor="rgba(0,224,161,0.1)" />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#141C2F" />
                                <XAxis dataKey="name" stroke="#A0AEC0" fontSize={12} />
                                <YAxis stroke="#A0AEC0" fontSize={12} />
                                <Tooltip content={<CustomHistoryTooltip />} cursor={{ fill: 'hsl(var(--brand-muted))' }}/>
                                <Bar dataKey={selectedChartMetric} name={selectedChartMetric === 'pci' ? 'PCI (kcal/kg)' : 'Chlore (%)'} radius={8}>
                                    {chartData.map((entry, index) => {
                                        let fillUrl;
                                        if (entry.isConform === true) {
                                            fillUrl = "url(#chartGradientConform)";
                                        } else if (entry.isConform === false) {
                                            fillUrl = "url(#chartGradientNonConform)";
                                        } else {
                                            fillUrl = "url(#chartGradientNeutral)";
                                        }
                                        return <Cell key={`cell-${index}`} fill={fillUrl} />;
                                    })}
                                    <LabelList 
                                        dataKey={selectedChartMetric} 
                                        position="top" 
                                        formatter={(value: number) => selectedChartMetric === 'pci' ? Math.round(value) : value.toFixed(2)}
                                        fontSize={12} 
                                        fill="hsl(var(--foreground))" 
                                    />
                                </Bar>
                            </RechartsBarChart>
                        ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground">Aucune donnée pour la période.</div>
                        )}
                    </ResponsiveContainer>
                </CardContent>
            </Card>

        </motion.div>
    );
}
