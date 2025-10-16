
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { getLatestMixtureSession, type MixtureSession, getImpactAnalyses, type ImpactAnalysis, getAverageAnalysisForFuels, type AverageAnalysis, getUniqueFuelTypes, getSpecifications, type Specification, getLatestIndicatorData, getThresholds, ImpactThresholds, MixtureThresholds, getResultsForPeriod } from '@/lib/data';
import { Skeleton } from "@/components/ui/skeleton";
import { Recycle, Leaf, LayoutDashboard, CalendarIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bar, BarChart as RechartsBarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid, Cell, LabelList } from 'recharts';
import { startOfWeek, endOfWeek, format, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { KeyIndicatorCard } from './cards/KeyIndicatorCard';
import { ImpactCard, ImpactData } from './cards/ImpactCard';
import { IndicatorCard } from './mixture-calculator';
import CountUp from 'react-countup';
import { motion } from 'framer-motion';


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
    const [chartData, setChartData] = useState<any[]>([]);
    const [specifications, setSpecifications] = useState<Record<string, Specification>>({});
    const [thresholds, setThresholds] = useState<{ melange?: MixtureThresholds, impact?: ImpactThresholds }>({});
    const [selectedChartMetric, setChartMetric] = useState<ChartMetric>('pci');
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
      from: subDays(new Date(), 7),
      to: new Date(),
    });
    const debitClinker = usePersistentValue<number>('debitClinker', 0);
    const pathname = usePathname();

    chartMetric = selectedChartMetric;

    const fetchChartData = useCallback(async () => {
        if (!dateRange?.from || !dateRange.to) return;
        try {
            const results = await getResultsForPeriod(dateRange);
            
            const groupedBySupplier = results.reduce((acc, d) => {
                const supplier = d.fournisseur || "Inconnu";
                if (!acc[supplier]) acc[supplier] = { pciList: [], clList: [] };
                if (d.pci_brut) acc[supplier].pciList.push(d.pci_brut);
                if (d.chlore) acc[supplier].clList.push(d.chlore);
                return acc;
            }, {} as Record<string, { pciList: number[], clList: number[] }>);

            const chartResults = Object.entries(groupedBySupplier).map(([supplier, data]) => {
                const avgPci = data.pciList.length > 0 ? data.pciList.reduce((a, b) => a + b, 0) / data.pciList.length : 0;
                const avgChlore = data.clList.length > 0 ? data.clList.reduce((a, b) => a + b, 0) / data.clList.length : 0;
                return { name: supplier, pci: avgPci, chlore: avgChlore };
            });
            
            setChartData(chartResults);

        } catch (error) {
            console.error("Error fetching chart data:", error);
        }
    }, [dateRange]);
    
    useEffect(() => {
        fetchChartData();
    }, [dateRange, fetchChartData]);

    const fetchData = useCallback(() => {
        setLoading(true);
        const fetchAndSetData = async () => {
            try {
                const [sessionData, impactAnalyses, indicatorData, specs, thresholdsData] = await Promise.all([
                    getLatestMixtureSession(),
                    getImpactAnalyses(),
                    getLatestIndicatorData(),
                    getSpecifications(),
                    getThresholds(),
                ]);
                
                const specsMap: Record<string, Specification> = {};
                specs.forEach(spec => {
                    const key = `${spec.type_combustible}|${spec.fournisseur}`;
                    specsMap[key] = spec;
                });
                
                setSpecifications(specsMap);
                setMixtureSession(sessionData);
                setLatestImpact(impactAnalyses.length > 0 ? impactAnalyses[0] : null);
                setKeyIndicators(indicatorData);
                setThresholds(thresholdsData);
                await fetchChartData();

            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAndSetData();
    }, [fetchChartData]);

    useEffect(() => {
        fetchData();
    }, [pathname, fetchData]);

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

    const mixtureIndicators = useMemo(() => {
        if (!mixtureSession?.globalIndicators) return null;
        const indicators = mixtureSession.globalIndicators;
        return {
          'PCI': indicators.pci,
          'Chlorures': indicators.chlorine,
          'Cendres': indicators.ash,
          'Humidité': indicators.humidity,
          'TauxPneus': indicators.tireRate,
        };
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

    const getBarColor = (pci: number) => {
        const pciSeuils = thresholds.melange;
        if (!pciSeuils) return "#10B981"; // Default green
        if ((pciSeuils.pci_min != null && pci < pciSeuils.pci_min) || (pciSeuils.pci_max != null && pci > pciSeuils.pci_max)) return "#ef4444"; // red
        if ((pciSeuils.pci_vert_min != null && pci >= pciSeuils.pci_vert_min) && (pciSeuils.pci_vert_max != null && pci <= pciSeuils.pci_vert_max)) return "#10b981"; // green
        return "#facc15"; // yellow
    };

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
                
                 {mixtureIndicators ? (
                    <IndicatorCard data={mixtureIndicators} thresholds={thresholds.melange} />
                ) : (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2 text-white">
                                <Recycle className="text-green-400 h-5 w-5" />
                                Indicateurs du Mélange
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                             <p className="text-muted-foreground text-center p-8">Aucune session de mélange.</p>
                        </CardContent>
                    </Card>
                )}


                <ImpactCard title="Impact sur le Clinker" data={impactIndicators} thresholds={thresholds.impact} lastUpdate={latestImpact?.createdAt.toDate()} />
            </div>

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle className="text-white">Moyenne par Fournisseur</CardTitle>
                        </div>
                        <div className='flex items-center gap-2'>
                           <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    id="date"
                                    variant={"outline"}
                                    className={cn(
                                        "w-[300px] justify-start text-left font-normal bg-brand-muted border-brand-line",
                                        !dateRange && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {dateRange?.from ? (
                                        dateRange.to ? (
                                            <>
                                                {format(dateRange.from, "dd MMM", {locale: fr})} -{" "}
                                                {format(dateRange.to, "dd MMM yyyy", {locale: fr})}
                                            </>
                                        ) : (
                                            format(dateRange.from, "PPP", {locale: fr})
                                        )
                                    ) : (
                                        <span>Choisir une période</span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 bg-brand-surface border-brand-line" align="end">
                                <Calendar
                                    initialFocus
                                    mode="range"
                                    defaultMonth={dateRange?.from}
                                    selected={dateRange}
                                    onSelect={setDateRange}
                                    numberOfMonths={2}
                                    locale={fr}
                                />
                            </PopoverContent>
                        </Popover>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                     <ResponsiveContainer width="100%" height={350}>
                        {chartData.length > 0 ? (
                            <RechartsBarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#141C2F" />
                                <XAxis dataKey="name" stroke="#A0AEC0" fontSize={10} interval={0} angle={-30} textAnchor="end" height={80} />
                                <YAxis stroke="#A0AEC0" fontSize={12} />
                                <Tooltip content={<CustomHistoryTooltip />} cursor={{ fill: 'hsl(var(--brand-muted))' }}/>
                                <Bar dataKey={selectedChartMetric} name={selectedChartMetric === 'pci' ? 'PCI (kcal/kg)' : 'Chlore (%)'} radius={8}>
                                    {chartData.map((entry, index) => (
                                         <Cell key={`cell-${index}`} fill={getBarColor(entry.pci)} />
                                    ))}
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
                     {dateRange?.from && dateRange.to && (
                        <div className="text-gray-400 text-sm mt-3 text-right">
                            Période : {format(dateRange.from, "dd MMM yyyy", { locale: fr })} →{" "}
                            {format(dateRange.to, "dd MMM yyyy", { locale: fr })}
                        </div>
                    )}
                </CardContent>
            </Card>

        </motion.div>
    );
}

