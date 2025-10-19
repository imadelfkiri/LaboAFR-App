

"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getDocs, query, collection, where, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Skeleton } from "@/components/ui/skeleton";
import { Recycle, Leaf, LayoutDashboard, CalendarIcon, Flame, Droplets, Percent, Wind, Switch as SwitchIcon, ChevronDown, LineChart as LineChartIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bar, BarChart as RechartsBarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid, Cell, LabelList, ReferenceLine, Label, LineChart, Line } from 'recharts';
import { startOfWeek, endOfWeek, format, subDays, startOfMonth, endOfMonth, subMonths, subWeeks } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { KeyIndicatorCard } from './cards/KeyIndicatorCard';
import { ImpactCard, ImpactData } from './cards/ImpactCard';
import { IndicatorCard } from './mixture-calculator';
import type { IndicatorKey } from './mixture-calculator';
import CountUp from 'react-countup';
import { motion } from 'framer-motion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label as UILabel } from "@/components/ui/label";
import { getLatestMixtureSession, type MixtureSession, getImpactAnalyses, type ImpactAnalysis, getSpecifications, type Specification, getLatestIndicatorData, getThresholds, ImpactThresholds, MixtureThresholds, KeyIndicatorThresholds, getResultsForPeriod, getMixtureSessions, getImpactAnalysesForPeriod, SPEC_MAP, getAverageAnalysisForFuels } from '@/lib/data';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

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

export function MainDashboard() {
    const [loading, setLoading] = useState(true);
    const [mixtureSession, setMixtureSession] = useState<MixtureSession | null>(null);
    const [latestImpact, setLatestImpact] = useState<ImpactAnalysis | null>(null);
    
    const [chartData, setChartData] = useState<any[]>([]);
    const [indicator, setIndicator] = useState("pci");
    const [showColors, setShowColors] = useState(true);

    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: startOfWeek(new Date(), { weekStartsOn: 1 }),
        to: endOfWeek(new Date(), { weekStartsOn: 1 }),
    });

    const [thresholds, setThresholds] = useState<{ melange?: MixtureThresholds, impact?: ImpactThresholds, indicateurs?: KeyIndicatorThresholds }>({});
    const debitClinker = usePersistentValue<number>('debitClinker', 0);
    
    const [openCalendar, setOpenCalendar] = useState(false);
    const cache = useRef(new Map());

    // History state for modal
    const [historySessions, setHistorySessions] = useState<MixtureSession[]>([]);
    const [historyImpacts, setHistoryImpacts] = useState<ImpactAnalysis[]>([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [historyChartIndicator, setHistoryChartIndicator] = useState<{key: IndicatorKey | 'tsr' | 'consumption' | string; name: string, type: 'mixture' | 'key' | 'impact'} | null>(null);
    const [historyDateRange, setHistoryDateRange] = useState<DateRange | undefined>({ from: subDays(new Date(), 30), to: new Date() });
    const [petCokeAnalysis, setPetCokeAnalysis] = useState<{pci_brut: number} | null>(null);

    const fetchSpecs = useCallback(async () => {
        await getSpecifications(); // This populates SPEC_MAP
    }, []);

    const fetchChartData = useCallback(async () => {
        if (!dateRange?.from || !dateRange?.to) return;
        
        const cacheKey = `${indicator}_${dateRange.from.toISOString()}_${dateRange.to.toISOString()}`;
        if (cache.current.has(cacheKey)) {
            setChartData(cache.current.get(cacheKey));
            return;
        }

        const q = query(
            collection(db, "resultats"),
            where("date_arrivage", ">=", Timestamp.fromDate(dateRange.from)),
            where("date_arrivage", "<=", Timestamp.fromDate(dateRange.to)),
            orderBy("date_arrivage", "asc")
        );

        const snap = await getDocs(q);
        const docs = snap.docs.map((d) => d.data());

        const grouped = docs.reduce((acc: any, d: any) => {
            const fournisseur = d.fournisseur || "Inconnu";
            const combustible = d.type_combustible || "N/A";
            const key = `${combustible}|${fournisseur}`;

            if (!acc[key]) {
                acc[key] = { name: key, total: 0, count: 0 };
            }
            
            let value = 0;
            if (indicator === "pci") value = d["pci_brut"] || d.pci || 0;
            if (indicator === "chlorures") value = d["chlore"] || d.chlorures || 0;
            if (indicator === "h2o") value = d["h2o"] || 0;
            if (indicator === "cendres") value = d["cendres"] || 0;
            value = Number(value) || 0;

            acc[key].total += value;
            acc[key].count++;
            return acc;
        }, {});

        const results = Object.values(grouped).map((f: any) => ({
            name: f.name,
            value: f.total / f.count || 0,
        }));
        
        cache.current.set(cacheKey, results);
        setChartData(results);
    }, [dateRange, indicator]);

    const fetchHistoryData = useCallback(async () => {
        if (!historyDateRange?.from || !historyDateRange?.to || !historyChartIndicator) return;
        
        setIsHistoryLoading(true);
        try {
            if (historyChartIndicator.type === 'mixture' || historyChartIndicator.type === 'key') {
                const sessions = await getMixtureSessions(historyDateRange.from, historyDateRange.to);
                setHistorySessions(sessions);
                setHistoryImpacts([]);
            } else if (historyChartIndicator.type === 'impact') {
                const impacts = await getImpactAnalysesForPeriod(historyDateRange.from, historyDateRange.to);
                setHistoryImpacts(impacts);
                setHistorySessions([]);
            }
        } catch(error) {
            console.error("Error fetching history sessions:", error);
        } finally {
            setIsHistoryLoading(false);
        }
    }, [historyDateRange, historyChartIndicator]);

    useEffect(() => {
        if (historyChartIndicator) {
            fetchHistoryData();
        }
    }, [historyChartIndicator, fetchHistoryData]);


    useEffect(() => {
        const loadInitialData = async () => {
            setLoading(true);
            try {
                const [sessionData, impactAnalyses, thresholdsData, petCokeAvg] = await Promise.all([
                    getLatestMixtureSession(),
                    getImpactAnalyses(),
                    getThresholds(),
                    getAverageAnalysisForFuels(['Pet-Coke', 'Pet Coke', 'Pet-Coke Preca', 'Pet-Coke Tuyere'])
                ]);
                
                setMixtureSession(sessionData);
                setLatestImpact(impactAnalyses.length > 0 ? impactAnalyses[0] : null);
                setThresholds(thresholdsData);

                const petCokeData = petCokeAvg['Pet-Coke'] || petCokeAvg['Pet Coke'] || petCokeAvg['Pet-Coke Preca'] || petCokeAvg['Pet-Coke Tuyere'];
                if (petCokeData && petCokeData.pci_brut) {
                    setPetCokeAnalysis({ pci_brut: petCokeData.pci_brut });
                }
                await fetchSpecs();

            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };

        loadInitialData();
    }, [fetchSpecs]);

    useEffect(() => {
        fetchChartData();
    }, [fetchChartData]);

    const { calorificConsumption, substitutionRate } = useMemo(() => {
        if (!mixtureSession || !mixtureSession.availableFuels) return { calorificConsumption: 0, substitutionRate: 0 };

        const getPci = (fuelName: string) => mixtureSession.availableFuels[fuelName]?.pci_brut || 0;
        
        const getPetCokePci = () => {
            return petCokeAnalysis?.pci_brut || 0;
        }

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
                if (fuel.toLowerCase().includes('grignons') || /pet.?coke/i.test(fuel.replace(/\s|_/g, ''))) continue;
                
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
        const energyAlternatives = energyAFs + energyGrignons;

        const tsr = energyTotalGcal > 0 ? (energyAlternatives / energyTotalGcal) * 100 : 0;
        
        const consumption = debitClinker > 0 
            ? (energyTotalGcal * 1000000) / (debitClinker * 1000)
            : 0;
        
        return { calorificConsumption: consumption, substitutionRate: tsr };
    }, [mixtureSession, debitClinker, petCokeAnalysis]);

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
    
    const valueFormatter = (value: number) => {
        if (indicator === "chlorures") {
            return value.toFixed(2);
        }
        return value.toFixed(0);
    };

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            const [combustible, fournisseur] = data.name.split("|");
            const key = `${combustible}|${fournisseur}`;
            const seuil = SPEC_MAP.get(key);
            let seuilText = "";

            if (indicator === "pci" && seuil?.PCI_min != null) seuilText = `Seuil min: ${seuil.PCI_min.toFixed(0)}`;
            if (indicator === "h2o" && seuil?.H2O_max != null) seuilText = `Seuil max: ${seuil.H2O_max.toFixed(2)}`;
            if (indicator === "chlorures" && seuil?.Cl_max != null) seuilText = `Seuil max: ${seuil.Cl_max.toFixed(2)}`;
            if (indicator === "cendres" && seuil?.Cendres_max != null) seuilText = `Seuil max: ${seuil.Cendres_max.toFixed(2)}`;

            return (
                <div className="bg-[#1A2233] border border-gray-700 rounded-lg shadow-lg p-3 text-white text-sm">
                    <p className="font-bold mb-2">{combustible} - {fournisseur}</p>
                    <p><span className="font-semibold">Valeur :</span> {data.value.toFixed(2)}</p>
                    {seuilText && <p className="text-gray-400">{seuilText}</p>}
                </div>
            );
        }
        return null;
    };

    const handleIndicatorDoubleClick = useCallback((key: IndicatorKey | 'tsr' | 'consumption' | string, name: string) => {
        let type: 'mixture' | 'key' | 'impact';
        if (['pci', 'humidity', 'ash', 'chlorine', 'tireRate'].includes(key)) {
            type = 'mixture';
        } else if (['tsr', 'consumption'].includes(key)) {
            type = 'key';
        } else {
            type = 'impact';
        }
        setHistoryChartIndicator({ key, name, type });
    }, []);

    const historyChartData = useMemo(() => {
        if (!historyChartIndicator) return [];

        if (historyChartIndicator.type === 'impact') {
            if (!historyImpacts || historyImpacts.length === 0) return [];
            return historyImpacts
                .map(impact => {
                    const { results } = impact;
                    const delta = (a?: number | null, b?: number | null) => (a ?? 0) - (b ?? 0);
                    let value;
                    switch(historyChartIndicator.key) {
                        case 'Fe2O3': value = delta(results.clinkerWithAsh.fe2o3, results.clinkerWithoutAsh.fe2o3); break;
                        case 'CaO': value = delta(results.clinkerWithAsh.cao, results.clinkerWithoutAsh.cao); break;
                        case 'LSF': value = delta(results.modulesAvec.lsf, results.modulesSans.lsf); break;
                        case 'C3S': value = delta(results.c3sAvec, results.c3sSans); break;
                        case 'MS': value = delta(results.modulesAvec.ms, results.modulesSans.ms); break;
                        case 'AF': value = delta(results.modulesAvec.af, results.modulesSans.af); break;
                        default: value = 0;
                    }
                    return { date: impact.createdAt.toDate(), value };
                })
                .sort((a, b) => a.date.valueOf() - b.date.valueOf())
                .map(item => ({ date: format(item.date, 'dd/MM HH:mm'), value: item.value }));
        }

        if (!historySessions || historySessions.length === 0) return [];
        
        return historySessions
            .map(session => {
                let value;
                if(historyChartIndicator.key === 'tsr') {
                    const getPci = (fuelName: string) => session.availableFuels[fuelName]?.pci_brut || 0;
                    const getPetCokePci = () => getPci('Pet Coke') || getPci('Pet-Coke') || getPci('Pet-Coke Preca') || getPci('Pet-Coke Tuyere');
                    let afEnergyWeightedSum = 0;
                     const processInstallation = (installation: any) => {
                        if (!installation?.fuels || !installation.flowRate || installation.flowRate === 0) return;
                        let installationTotalWeight = 0;
                        const fuelWeights: Record<string, number> = {};
                        for (const [fuel, data] of Object.entries(installation.fuels as Record<string, {buckets: number}>)) {
                            const weight = (data.buckets || 0) * (session.availableFuels[fuel]?.poids_godet || 1.5);
                            installationTotalWeight += weight;
                            fuelWeights[fuel] = weight;
                        }
                        if(installationTotalWeight === 0) return;
                        for (const [fuel, data] of Object.entries(installation.fuels as Record<string, {buckets: number}>)) {
                            if (fuel.toLowerCase().includes('grignons') || fuel.toLowerCase().includes('pet coke')) continue;
                            const pci = getPci(fuel);
                            const weight = fuelWeights[fuel] || 0;
                            const proportion = weight / installationTotalWeight;
                            afEnergyWeightedSum += pci * proportion * installation.flowRate;
                        }
                    }
                    processInstallation(session.hallAF);
                    processInstallation(session.ats);
                    const energyAFs = afEnergyWeightedSum / 1000;
                    const grignonsFlow = (session.directInputs?.['Grignons GO1']?.flowRate || 0) + (session.directInputs?.['Grignons GO2']?.flowRate || 0);
                    const energyGrignons = grignonsFlow * getPci('Grignons') / 1000;
                    const petCokeFlow = (session.directInputs?.['Pet-Coke Preca']?.flowRate || 0) + (session.directInputs?.['Pet-Coke Tuyere']?.flowRate || 0);
                    const energyPetCoke = petCokeFlow * getPetCokePci() / 1000;
                    const energyTotal = energyAFs + energyGrignons + energyPetCoke;
                    const energyAlternatives = energyAFs + energyGrignons;
                    value = energyTotal > 0 ? (energyAlternatives / energyTotal) * 100 : 0;
                } else if (historyChartIndicator.key === 'consumption') {
                    if (!debitClinker || debitClinker === 0) return { date: session.timestamp.toDate(), value: 0 };
                    const getPci = (fuelName: string) => session.availableFuels[fuelName]?.pci_brut || 0;
                    const getPetCokePci = () => getPci('Pet Coke') || getPci('Pet-Coke') || getPci('Pet-Coke Preca') || getPci('Pet-Coke Tuyere');
                    let afEnergyWeightedSum = 0;
                    const processInstallation = (installation: any) => {
                        if (!installation?.fuels || !installation.flowRate || installation.flowRate === 0) return;
                        let installationTotalWeight = 0;
                        const fuelWeights: Record<string, number> = {};
                        for (const [fuel, data] of Object.entries(installation.fuels as Record<string, {buckets: number}>)) {
                            const weight = (data.buckets || 0) * (session.availableFuels[fuel]?.poids_godet || 1.5);
                            installationTotalWeight += weight;
                            fuelWeights[fuel] = weight;
                        }
                        if(installationTotalWeight === 0) return;
                        for (const [fuel, data] of Object.entries(installation.fuels as Record<string, {buckets: number}>)) {
                            if (fuel.toLowerCase().includes('grignons') || fuel.toLowerCase().includes('pet coke')) continue;
                            const pci = getPci(fuel);
                            const weight = fuelWeights[fuel] || 0;
                            const proportion = weight / installationTotalWeight;
                            afEnergyWeightedSum += pci * proportion * installation.flowRate;
                        }
                    }
                    processInstallation(session.hallAF);
                    processInstallation(session.ats);
                    const energyAFs = afEnergyWeightedSum / 1000;
                    const grignonsFlow = (session.directInputs?.['Grignons GO1']?.flowRate || 0) + (session.directInputs?.['Grignons GO2']?.flowRate || 0);
                    const energyGrignons = grignonsFlow * getPci('Grignons') / 1000;
                    const petCokeFlow = (session.directInputs?.['Pet-Coke Preca']?.flowRate || 0) + (session.directInputs?.['Pet-Coke Tuyere']?.flowRate || 0);
                    const energyPetCoke = petCokeFlow * getPetCokePci() / 1000;
                    const energyTotalGcal = energyAFs + energyGrignons + energyPetCoke;
                    value = (energyTotalGcal * 1000000) / (debitClinker * 1000);
                } else {
                    value = session.globalIndicators[historyChartIndicator.key as IndicatorKey];
                }

                return {
                    date: session.timestamp.toDate(),
                    value: value
                }
            })
            .filter(item => typeof item.value === 'number')
            .sort((a, b) => a.date.valueOf() - b.date.valueOf())
            .map(item => ({
                date: format(item.date, 'dd/MM HH:mm'),
                value: item.value
            }));
    }, [historySessions, historyImpacts, historyChartIndicator, debitClinker]);

    const CustomHistoryTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-background/80 backdrop-blur-sm border border-border rounded-lg shadow-lg p-3">
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
                <KeyIndicatorCard 
                  tsr={substitutionRate} 
                  consumption={calorificConsumption} 
                  thresholds={thresholds.indicateurs}
                  onIndicatorDoubleClick={(key, name) => handleIndicatorDoubleClick(key, name)}
                />
                
                 {mixtureIndicators ? (
                    <IndicatorCard data={mixtureIndicators} thresholds={thresholds.melange} onIndicatorDoubleClick={(key, name) => handleIndicatorDoubleClick(key, name)} />
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


                <ImpactCard title="Impact sur le Clinker" data={impactIndicators} thresholds={thresholds.impact} lastUpdate={latestImpact?.createdAt.toDate()} onIndicatorDoubleClick={(key, name) => handleIndicatorDoubleClick(key, name)}/>
            </div>

             <Dialog open={!!historyChartIndicator} onOpenChange={(open) => !open && setHistoryChartIndicator(null)}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Historique de l'Indicateur : {historyChartIndicator?.name}</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <ResponsiveContainer width="100%" height={400}>
                                {isHistoryLoading ? (
                                    <Skeleton className="h-full w-full" />
                                ) : historyChartData.length > 0 ? (
                                    <LineChart data={historyChartData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                        <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} domain={['dataMin', 'auto']} />
                                        <Tooltip content={<CustomHistoryTooltip />} />
                                        <Line type="monotone" dataKey="value" name={historyChartIndicator?.name} stroke="hsl(var(--primary))" dot={false} strokeWidth={2} />
                                    </LineChart>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-muted-foreground">
                                        Aucune donnée historique pour cet indicateur dans la période sélectionnée.
                                    </div>
                                )}
                            </ResponsiveContainer>
                    </div>
                </DialogContent>
            </Dialog>

            <Card className="bg-[#0B101A]/80 border border-gray-800 p-6 rounded-xl shadow-lg">
                <CardHeader>
                    <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-3">
                         <h2 className="text-lg font-semibold text-white">
                            📊 Moyenne {indicator.toUpperCase()} par Fournisseur
                        </h2>
                        <div className="flex items-center gap-4">
                           <Select value={indicator} onValueChange={setIndicator}>
                                <SelectTrigger className="w-[180px] bg-[#1A2233] text-gray-300 border-gray-700">
                                    <SelectValue placeholder="Indicateur" />
                                </SelectTrigger>
                                <SelectContent className="bg-[#0B101A] text-gray-300">
                                    <SelectItem value="pci">🔥 PCI</SelectItem>
                                    <SelectItem value="chlorures">🧪 Chlorures</SelectItem>
                                    <SelectItem value="h2o">💧 H₂O</SelectItem>
                                    <SelectItem value="cendres">⚱️ Cendres</SelectItem>
                                </SelectContent>
                            </Select>

                            <Popover open={openCalendar} onOpenChange={setOpenCalendar}>
                                <PopoverTrigger asChild>
                                    <Button
                                    variant="outline"
                                    className="bg-[#1A2233] text-gray-300 border-gray-700 hover:bg-[#24304b]"
                                    >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {dateRange?.from && dateRange.to
                                        ? `${format(dateRange.from, "dd MMM", { locale: fr })} → ${format(dateRange.to, "dd MMM yyyy", { locale: fr })}`
                                        : "Choisir une période"}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="p-0 bg-[#0B101A] border border-gray-800">
                                    <Calendar
                                    mode="range"
                                    selected={dateRange}
                                    onSelect={setDateRange}
                                    numberOfMonths={2}
                                    locale={fr}
                                    className="text-gray-300"
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                     <ResponsiveContainer width="100%" height={330}>
                        {chartData.length > 0 ? (
                            <RechartsBarChart data={chartData}>
                                 <XAxis
                                    dataKey="name"
                                    stroke="#aaa"
                                    fontSize={11}
                                    angle={-25}
                                    textAnchor="end"
                                    height={70}
                                    tick={{ fill: "#ccc" }}
                                    tickFormatter={(value: string) => value.replace('|', ' - ')}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar
                                    dataKey="value"
                                    radius={[8, 8, 0, 0]}
                                >
                                     <LabelList 
                                        dataKey="value"
                                        position="top"
                                        formatter={valueFormatter}
                                        fill="#e5e7eb"
                                        fontSize={11}
                                    />
                                    {chartData.map((entry, index) => {
                                        const [combustible, fournisseur] = entry.name.split("|");
                                        const key = `${combustible}|${fournisseur}`;
                                        const seuils = SPEC_MAP.get(key);
                                        
                                        const colorDefault = "hsl(215 39% 30%)"; // blue-ish
                                        const colorConform = "hsl(142 71% 45%)"; // green
                                        const colorNonConform = "hsl(0 84% 60%)"; // red
                                        let color = colorDefault;

                                        if (showColors && seuils) {
                                            const value = entry.value;
                                            let isConform = true;
                                            switch (indicator) {
                                                case "pci":
                                                    if (seuils.PCI_min != null && value < seuils.PCI_min) isConform = false;
                                                    break;
                                                case "h2o":
                                                    if (seuils.H2O_max != null && value > seuils.H2O_max) isConform = false;
                                                    break;
                                                case "chlorures":
                                                     if (seuils.Cl_max != null && value > seuils.Cl_max) isConform = false;
                                                    break;
                                                case "cendres":
                                                    if (seuils.Cendres_max != null && value > seuils.Cendres_max) isConform = false;
                                                    break;
                                            }
                                            color = isConform ? colorConform : colorNonConform;
                                        }

                                        return (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={color}
                                                className="bar"
                                            />
                                        );
                                    })}
                                </Bar>
                            </RechartsBarChart>
                        ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground">Aucune donnée pour la période.</div>
                        )}
                    </ResponsiveContainer>
                     {dateRange?.from && dateRange.to && (
                        <div className="text-gray-400 text-sm mt-3 text-right">
                           Période :{" "}
                           {format(dateRange.from, "dd MMM yyyy", { locale: fr })} →{" "}
                           {format(dateRange.to, "dd MMM yyyy", { locale: fr })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    );
}
