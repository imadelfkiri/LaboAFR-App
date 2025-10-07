

"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, where, onSnapshot, Timestamp, QueryConstraint } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format, startOfDay, endOfDay, eachDayOfInterval, isValid, parseISO, getYear, getMonth, startOfYear, endOfYear, subYears, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { DateRange } from "react-day-picker";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from '@/hooks/use-toast';
import {
    ResponsiveContainer,
    LineChart,
    BarChart,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    Line,
    Bar,
    Cell,
    LabelList,
    ReferenceLine
} from 'recharts';

import { getFuelTypes, FuelType, getSpecifications, SPEC_MAP, Specification } from '@/lib/data';
import { CalendarIcon, Fuel, Truck, LineChart as LineChartIcon, Droplets, Percent, Wind } from "lucide-react";


interface Result {
    id: string;
    date_arrivage: { seconds: number; nanoseconds: number } | string;
    type_combustible: string;
    fournisseur: string;
    pci_brut: number;
    h2o: number;
    chlore: number;
    cendres: number;
}

interface ChartData {
    date: string; // Keep as yyyy-MM-dd for sorting
    pci_brut?: number;
    h2o?: number;
    chlore?: number;
    cendres?: number;
}

type MetricKey = 'pci_brut' | 'h2o' | 'chlore' | 'cendres';
type SpecKey = 'PCI_min' | 'H2O_max' | 'Cl_max' | 'Cendres_max';


const METRICS: { key: MetricKey; name: string; color: string; icon: React.ElementType, chartType: 'line' | 'bar', specKey: SpecKey | null }[] = [
    { key: 'pci_brut', name: 'PCI (kcal/kg)', color: '#22c55e', icon: Fuel, chartType: 'line', specKey: 'PCI_min' },
    { key: 'h2o', name: 'H₂O (%)', color: '#3b82f6', icon: Droplets, chartType: 'line', specKey: 'H2O_max' },
    { key: 'chlore', name: 'Chlore (%)', color: '#f97316', icon: Wind, chartType: 'line', specKey: 'Cl_max' },
    { key: 'cendres', name: 'Cendres (%)', color: '#8b5cf6', icon: Percent, chartType: 'bar', specKey: 'Cendres_max' },
];

export default function StatisticsDashboard() {
    const [results, setResults] = useState<Result[]>([]);
    const [loading, setLoading] = useState(true);
    const [initialDataLoaded, setInitialDataLoaded] = useState(false);
    
    // Filters
    const [selectedFuelType, setSelectedFuelType] = useState<string>("all");
    const [selectedFournisseur, setSelectedFournisseur] = useState<string>("all");
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [selectedComparisonMetric, setSelectedComparisonMetric] = useState<MetricKey>('cendres');


    // Data for filters
    const [allFuelTypes, setAllFuelTypes] = useState<FuelType[]>([]);
    const [allFournisseurs, setAllFournisseurs] = useState<string[]>([]);

    const { toast } = useToast();
    
    const normalizeDate = (date: { seconds: number; nanoseconds: number } | string): Date | null => {
        if (typeof date === 'string') {
            const parsed = parseISO(date);
            return isValid(parsed) ? parsed : null;
        }
        if (date && typeof date.seconds === 'number') {
            return new Timestamp(date.seconds, date.nanoseconds).toDate();
        }
        return null;
    };


    useEffect(() => {
        const fetchDropdownData = async () => {
            try {
                const [fuels, specs, resultsSnapshot] = await Promise.all([
                    getFuelTypes(),
                    getSpecifications(),
                    onSnapshot(collection(db, "resultats"), (snapshot) => {
                         const suppliers = [...new Set(snapshot.docs.map(doc => doc.data().fournisseur as string))].sort();
                         setAllFournisseurs(suppliers);

                         const resultsData: Result[] = [];
                         snapshot.forEach((doc) => {
                            resultsData.push({ id: doc.id, ...doc.data() } as Result);
                         });
                         setResults(resultsData);

                         if (!initialDataLoaded) {
                            setLoading(false);
                            setInitialDataLoaded(true);
                         }
                    })
                ]);
                setAllFuelTypes(fuels);
            } catch (error) {
                console.error("Erreur de chargement des données de filtre:", error);
                toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les listes de filtres." });
                setLoading(false);
            }
        };

        fetchDropdownData();
    }, [toast, initialDataLoaded]);
    
    const filteredResults = useMemo(() => {
        return results.filter(result => {
            const dateArrivage = normalizeDate(result.date_arrivage);
            if (!dateArrivage || !isValid(dateArrivage)) return false;

            const fuelTypeMatch = selectedFuelType === 'all' || result.type_combustible === selectedFuelType;
            const fournisseurMatch = selectedFournisseur === 'all' || result.fournisseur === selectedFournisseur;
            const dateMatch = !dateRange || (
                (!dateRange.from || dateArrivage >= startOfDay(dateRange.from)) &&
                (!dateRange.to || dateArrivage <= endOfDay(dateRange.to))
            );
            return fuelTypeMatch && fournisseurMatch && dateMatch;
        });
    }, [results, selectedFuelType, selectedFournisseur, dateRange]);


    const chartData = useMemo(() => {
        if (filteredResults.length === 0) return [];
        
        const groupedByDay: { [key: string]: { [key in MetricKey]: number[] } } = {};
        
        filteredResults.forEach(r => {
            const date = normalizeDate(r.date_arrivage);
            if (date && isValid(date)) {
                const dayKey = format(startOfDay(date), 'yyyy-MM-dd');
                if (!groupedByDay[dayKey]) {
                    groupedByDay[dayKey] = { pci_brut: [], h2o: [], chlore: [], cendres: [] };
                }
                METRICS.forEach(({ key }) => {
                    const value = r[key];
                    if (typeof value === 'number' && isFinite(value)) {
                        groupedByDay[dayKey][key].push(value);
                    }
                });
            }
        });
        
        const data: ChartData[] = Object.entries(groupedByDay).map(([date, values]) => {
            const entry: ChartData = { date: date }; // Keep date as yyyy-MM-dd
            METRICS.forEach(({ key }) => {
                const dayValues = values[key];
                if (dayValues.length > 0) {
                    entry[key] = dayValues.reduce((a, b) => a + b, 0) / dayValues.length;
                }
            });
            return entry;
        });

        // Sort by date chronologically
        return data.sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());

    }, [filteredResults]);

    const comparisonChartData = useMemo(() => {
        const now = new Date();
        const currentYear = getYear(now);
        const lastYear = currentYear - 1;

        const baseFilteredResults = results.filter(r => {
            const fuelTypeMatch = selectedFuelType === 'all' || r.type_combustible === selectedFuelType;
            const fournisseurMatch = selectedFournisseur === 'all' || r.fournisseur === selectedFournisseur;
            return fuelTypeMatch && fournisseurMatch;
        });
        
        const currentYearResults = baseFilteredResults.filter(r => {
            const date = normalizeDate(r.date_arrivage);
            return date && getYear(date) === currentYear;
        });

        const lastYearResults = baseFilteredResults.filter(r => {
            const date = normalizeDate(r.date_arrivage);
            return date && getYear(date) === lastYear;
        });
        
        const monthlyAvgCurrentYear = Array.from({ length: 12 }, (_, i) => {
            const monthResults = currentYearResults.filter(r => getMonth(normalizeDate(r.date_arrivage)!) === i);
            if (monthResults.length === 0) return { period: format(new Date(currentYear, i), 'MMM', { locale: fr }), value: null };
            
            const monthValues = monthResults.map(r => r[selectedComparisonMetric]).filter((v): v is number => typeof v === 'number');
            const avg = monthValues.length > 0 ? monthValues.reduce((a, b) => a + b, 0) / monthValues.length : null;
            return { period: format(new Date(currentYear, i), 'MMM', { locale: fr }), value: avg };
        });

        const lastYearValues = lastYearResults.map(r => r[selectedComparisonMetric]).filter((v): v is number => typeof v === 'number');
        const avgLastYear = lastYearValues.length > 0 ? lastYearValues.reduce((a, b) => a + b, 0) / lastYearValues.length : null;

        const currentYearValues = currentYearResults.map(r => r[selectedComparisonMetric]).filter((v): v is number => typeof v === 'number');
        const avgCurrentYear = currentYearValues.length > 0 ? currentYearValues.reduce((a, b) => a + b, 0) / currentYearValues.length : null;

        return [
            { period: String(lastYear), value: avgLastYear },
            { period: String(currentYear), value: avgCurrentYear },
            ...monthlyAvgCurrentYear
        ];
    }, [results, selectedComparisonMetric, selectedFuelType, selectedFournisseur]);


    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const formattedLabel = payload[0].payload.date 
                ? format(parseISO(label), 'd MMMM yyyy', { locale: fr })
                : label;

            return (
                <div className="bg-background border rounded-lg shadow-lg p-3">
                    <p className="font-bold text-foreground">{formattedLabel}</p>
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

    const valueFormatter = (value: number) => {
      if (value === null || value === undefined) return '';
      switch (selectedComparisonMetric) {
        case 'pci_brut': return value.toFixed(0);
        case 'h2o': return value.toFixed(1);
        case 'cendres': return value.toFixed(1);
        case 'chlore': return value.toFixed(2);
        default: return value.toFixed(2);
      }
    };
    
    const dynamicTitle = useMemo(() => {
        let metricPart = METRICS.find(m => m.key === selectedComparisonMetric)?.name || '';
        if (selectedFuelType !== 'all') {
            metricPart += ` ${selectedFuelType}`;
        }
        if (selectedFournisseur !== 'all') {
            metricPart += ` ${selectedFournisseur}`;
        }
        return `Suivi ${metricPart}`;
    }, [selectedComparisonMetric, selectedFuelType, selectedFournisseur]);
    
    const yAxisDomainMax = useMemo(() => {
        const maxValue = Math.max(...comparisonChartData.map(d => d.value ?? 0).filter(v => v !== null));
        return isFinite(maxValue) ? maxValue * 1.2 : 'auto';
    }, [comparisonChartData]);


    if (loading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
                    <Skeleton className="h-64" />
                    <Skeleton className="h-64" />
                    <Skeleton className="h-64" />
                    <Skeleton className="h-64" />
                </div>
            </div>
        );
    }
    
    return (
        <div className="space-y-6">
            <Card>
                <CardContent className="p-4 flex flex-col md:flex-row gap-4">
                    <Select value={selectedFuelType} onValueChange={setSelectedFuelType}>
                        <SelectTrigger className="w-full md:w-1/3">
                            <SelectValue placeholder="Sélectionner un type..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tous les types</SelectItem>
                            {allFuelTypes.map(f => <SelectItem key={f.name} value={f.name}>{f.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                     <Select value={selectedFournisseur} onValueChange={setSelectedFournisseur}>
                        <SelectTrigger className="w-full md:w-1/3">
                            <SelectValue placeholder="Sélectionner un fournisseur..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tous les fournisseurs</SelectItem>
                            {allFournisseurs.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                id="date"
                                variant={"outline"}
                                className="w-full md:w-1/3 justify-start text-left font-normal"
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateRange?.from ? (
                                    dateRange.to ? (
                                    <>
                                        {format(dateRange.from, "d MMM y", { locale: fr })} -{" "}
                                        {format(dateRange.to, "d MMM y", { locale: fr })}
                                    </>
                                    ) : (
                                        format(dateRange.from, "d MMM y", { locale: fr })
                                    )
                                ) : (
                                    <span>Sélectionner une date</span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
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
                </CardContent>
            </Card>
            
            <div className="grid gap-6 md:grid-cols-2">
                {METRICS.map(({ key, name, color, icon: Icon, chartType, specKey }) => {
                    const ChartComponent = chartType === 'bar' ? BarChart : LineChart;
                    const spec = SPEC_MAP.get(`${selectedFuelType}|${selectedFournisseur}`);
                    const specValue = specKey && spec ? spec[specKey] : null;

                    const CustomYAxisTick = (props: any) => {
                        const { x, y, payload } = props;
                        // Ne pas afficher le tick si c'est la même valeur que le seuil
                        if (specValue !== null && payload.value === specValue) {
                            return null;
                        }
                        return (
                            <g transform={`translate(${x},${y})`}>
                                <text x={0} y={0} dy={4} textAnchor="end" fill="#666" fontSize={12}>
                                    {payload.value}
                                </text>
                            </g>
                        );
                    };

                    return (
                        <Card key={key}>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Icon className="h-5 w-5" style={{ color }}/>
                                    Évolution de {name}
                                </CardTitle>
                                <CardDescription>Moyenne journalière basée sur les filtres</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    {chartData.length > 0 ? (
                                        <ChartComponent data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis 
                                                dataKey="date" 
                                                tickFormatter={(value) => format(parseISO(value), 'd MMM', { locale: fr })}
                                            />
                                            <YAxis domain={['auto', 'auto']} tick={<CustomYAxisTick />} />

                                            <Tooltip content={<CustomTooltip />}/>
                                            <Legend />
                                            {chartType === 'line' ? (
                                                <Line type="monotone" dataKey={key} name={name} stroke={color} strokeWidth={2} dot={false} />
                                            ) : (
                                                <Bar dataKey={key} name={name} fill={color} />
                                            )}
                                            {specValue !== null && specValue !== undefined && (
                                                <ReferenceLine y={specValue} label={{ value: specValue, fill: 'red', position: 'insideLeft' }} stroke="red" strokeDasharray="3 3" />
                                            )}
                                        </ChartComponent>
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-muted-foreground">
                                            Aucune donnée à afficher.
                                        </div>
                                    )}
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

             <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-center flex-1">{dynamicTitle}</CardTitle>
                        <Select value={selectedComparisonMetric} onValueChange={(value) => setSelectedComparisonMetric(value as MetricKey)}>
                            <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Choisir un indicateur..." />
                            </SelectTrigger>
                            <SelectContent>
                                {METRICS.map(m => (
                                    <SelectItem key={m.key} value={m.key}>{m.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                        {comparisonChartData.length > 0 ? (
                            <BarChart data={comparisonChartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.2)" />
                                <XAxis dataKey="period" />
                                <YAxis domain={[0, yAxisDomainMax]} tickFormatter={(value) => value.toFixed(0)} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="value">
                                    {comparisonChartData.map((entry, index) => {
                                        let color = "hsl(var(--primary))"; // Default color for months
                                        if (entry.period === String(getYear(new Date()) - 1)) color = "#8884d8"; // last year
                                        if (entry.period === String(getYear(new Date()))) color = "#ffc658"; // current year
                                        return <Cell key={`cell-${index}`} fill={color} />;
                                    })}
                                    <LabelList 
                                        dataKey="value" 
                                        position="top" 
                                        formatter={valueFormatter}
                                        fill="hsl(var(--foreground))"
                                        fontSize={12}
                                    />
                                </Bar>
                            </BarChart>
                        ) : (
                             <div className="flex items-center justify-center h-full text-muted-foreground">
                                Aucune donnée à afficher.
                            </div>
                        )}
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    );
}
