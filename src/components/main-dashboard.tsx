
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { getLatestMixtureSession, type MixtureSession, getImpactAnalyses, type ImpactAnalysis, getAverageAnalysisForFuels, type AverageAnalysis, getUniqueFuelTypes, getSpecifications, type Specification, getLatestIndicatorData, getThresholds, ImpactThresholds, MixtureThresholds, getResultsForPeriod } from '@/lib/data';
import { Skeleton } from "@/components/ui/skeleton";
import { Recycle, Leaf, LayoutDashboard, CalendarIcon, Flame, Droplets, Percent, Wind } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bar, BarChart as RechartsBarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid, Cell, LabelList } from 'recharts';
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
import CountUp from 'react-countup';
import { motion } from 'framer-motion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getDocs, query, collection, where, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Switch } from "@/components/ui/switch";
import { Label as UILabel } from "@/components/ui/label";


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
    const [keyIndicators, setKeyIndicators] = useState<{ tsr: number; } | null>(null);
    
    const [chartData, setChartData] = useState<any[]>([]);
    const [indicator, setIndicator] = useState("pci");
    const [showColors, setShowColors] = useState(true);

    const [dateRange, setDateRange] = useState({
        from: startOfWeek(new Date(), { weekStartsOn: 1 }),
        to: endOfWeek(new Date(), { weekStartsOn: 1 }),
    });

    const [specs, setSpecs] = useState<Record<string, Partial<Specification>>>({});

    const [thresholds, setThresholds] = useState<{ melange?: MixtureThresholds, impact?: ImpactThresholds }>({});
    const debitClinker = usePersistentValue<number>('debitClinker', 0);
    const pathname = usePathname();
    
    const [openCalendar, setOpenCalendar] = useState(false);
    const cache = useRef(new Map());


    const fetchSpecs = async () => {
        const snap = await getDocs(collection(db, "specifications"));
        const data: Record<string, Partial<Specification>> = {};
        snap.docs.forEach((doc) => {
            const d = doc.data();
            const fournisseur = d.Fournisseur || d.fournisseur || "Inconnu";
            data[fournisseur] = {
                PCI_min: d["PCI Min (kcal/kg)"] || d.PCImin,
                H2O_max: d["H2O Max (%)"] || d.H2Omax,
                Cl_max: d["Cl- Max (%)"] || d.Clmax,
                Cendres_max: d["Cendres Max (%)"] || d.Cendresmax,
            };
        });
        setSpecs(data);
    };

    const getColor = (fournisseur: string, value: number) => {
        const s = specs[fournisseur];
        if (!s || !showColors) return "#38BDF8"; // bleu neutre

        switch (indicator) {
            case "pci":
                if (value < 5000 || value > 6500) return "#EF4444"; // rouge
                if (value >= 5500 && value <= 6000) return "#10B981"; // vert
                return "#FACC15"; // jaune
            case "chlorures":
                if (value < 0.5) return "#10B981";
                if (value >= 0.5 && value <= 0.8) return "#FACC15";
                return "#EF4444";
            case "h2o":
                if (value < 5) return "#10B981";
                if (value >= 5 && value <= 8) return "#FACC15";
                return "#EF4444";
            case "cendres":
                if (value < 15) return "#10B981";
                if (value > 20) return "#EF4444";
                return "#FACC15";
            default:
                return "#6B7280";
        }
    };
    
    const fetchChartData = useCallback(async () => {
        if (!dateRange?.from || !dateRange?.to) return;
        
        const key = `${indicator}_${dateRange.from.toISOString()}_${dateRange.to.toISOString()}`;
        if (cache.current.has(key)) {
            setChartData(cache.current.get(key));
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
            const key = `${combustible} — ${fournisseur}`;

            if (!acc[key]) {
                acc[key] = { name: key, total: 0, count: 0 };
            }
            const indicatorKey = indicator === 'chlorures' ? 'chlore' : indicator;
            acc[key].total += d[indicatorKey] || 0;
            acc[key].count++;
            return acc;
        }, {});

        const results = Object.values(grouped).map((f: any) => ({
            name: f.name,
            value: f.total / f.count || 0,
        }));
        
        cache.current.set(key, results);
        setChartData(results);
    }, [dateRange, indicator]);


    useEffect(() => {
        fetchData();
        fetchSpecs();
    }, [pathname]);

     useEffect(() => {
        fetchChartData();
    }, [fetchChartData]);

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
                
                setMixtureSession(sessionData);
                setLatestImpact(impactAnalyses.length > 0 ? impactAnalyses[0] : null);
                setKeyIndicators(indicatorData);
                setThresholds(thresholdsData);

            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAndSetData();
    }, []);


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

            <Card className="bg-[#0B101A]/80 border border-gray-800 p-6 rounded-xl shadow-lg">
                <CardHeader>
                    <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-3">
                         <h2 className="text-lg font-semibold text-white">
                            📊 Moyenne {indicator.toUpperCase()} par Fournisseur
                        </h2>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center space-x-2">
                                <Switch
                                id="color-toggle"
                                checked={showColors}
                                onCheckedChange={setShowColors}
                                />
                                <UILabel htmlFor="color-toggle" className="text-gray-300 text-sm">
                                Mise en forme conditionnelle
                                </UILabel>
                            </div>
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
                                    {dateRange?.from && dateRange?.to
                                        ? `${format(dateRange.from, "dd MMM", { locale: fr })} → ${format(dateRange.to, "dd MMM yyyy", { locale: fr })}`
                                        : "Choisir une période"}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="p-0 bg-[#0B101A] border border-gray-800">
                                    <Calendar
                                    mode="range"
                                    selected={dateRange}
                                    onSelect={setDateRange as any}
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
                                />
                                <Tooltip
                                    contentStyle={{
                                    backgroundColor: "#1A2233",
                                    borderRadius: 8,
                                    color: "#fff",
                                    }}
                                    formatter={(v:number) => v.toFixed(2)}
                                />
                                <Bar
                                    dataKey="value"
                                    radius={[8, 8, 0, 0]}
                                    label={{
                                    position: "top",
                                    fill: "#e5e7eb",
                                    fontSize: 11,
                                    }}
                                >
                                    {chartData.map((entry, index) => {
                                        const [combustible, fournisseur] = entry.name.split(' — ');
                                        return <Cell key={`cell-${index}`} fill={getColor(fournisseur, entry.value)} />
                                    })}
                                </Bar>
                            </RechartsBarChart>
                        ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground">Aucune donnée pour la période.</div>
                        )}
                    </ResponsiveContainer>
                     {dateRange?.from && dateRange?.to && (
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
