
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, where, onSnapshot, Timestamp, QueryConstraint } from 'firebase/firestore';
import { db, firebaseAppPromise } from '@/lib/firebase';
import { format, startOfDay, endOfDay, eachDayOfInterval, isValid, parseISO } from 'date-fns';
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
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    Line,
} from 'recharts';

import { getFuelTypes, FuelType } from '@/lib/data';
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
    date: string;
    pci_brut?: number;
    h2o?: number;
    chlore?: number;
    cendres?: number;
}

type MetricKey = 'pci_brut' | 'h2o' | 'chlore' | 'cendres';

const METRICS: { key: MetricKey; name: string; color: string; icon: React.ElementType }[] = [
    { key: 'pci_brut', name: 'PCI (kcal/kg)', color: '#22c55e', icon: Fuel },
    { key: 'h2o', name: 'H₂O (%)', color: '#3b82f6', icon: Droplets },
    { key: 'chlore', name: 'Chlore (%)', color: '#f97316', icon: Wind },
    { key: 'cendres', name: 'Cendres (%)', color: '#8b5cf6', icon: Percent },
];

export function StatisticsDashboard() {
    const [results, setResults] = useState<Result[]>([]);
    const [loading, setLoading] = useState(true);
    const [initialDataLoaded, setInitialDataLoaded] = useState(false);
    
    // Filters
    const [selectedFuelType, setSelectedFuelType] = useState<string>("");
    const [selectedFournisseur, setSelectedFournisseur] = useState<string>("");
    const [dateRange, setDateRange] = useState<DateRange | undefined>();

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
                await firebaseAppPromise;
                const [fuels, resultsSnapshot] = await Promise.all([
                    getFuelTypes(),
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

    const chartData = useMemo(() => {
        const filtered = results.filter(result => {
            const dateArrivage = normalizeDate(result.date_arrivage);
            if (!dateArrivage || !isValid(dateArrivage)) return false;

            const fuelTypeMatch = !selectedFuelType || result.type_combustible === selectedFuelType;
            const fournisseurMatch = !selectedFournisseur || result.fournisseur === selectedFournisseur;
            const dateMatch = !dateRange || (
                (!dateRange.from || dateArrivage >= startOfDay(dateRange.from)) &&
                (!dateRange.to || dateArrivage <= endOfDay(dateRange.to))
            );
            return fuelTypeMatch && fournisseurMatch && dateMatch;
        });
        
        if (filtered.length === 0) return [];
        
        const groupedByDay: { [key: string]: { [key in MetricKey]: number[] } } = {};
        
        filtered.forEach(r => {
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
            const entry: ChartData = { date: format(parseISO(date), 'd MMM', { locale: fr }) };
            METRICS.forEach(({ key }) => {
                const dayValues = values[key];
                if (dayValues.length > 0) {
                    entry[key] = dayValues.reduce((a, b) => a + b, 0) / dayValues.length;
                }
            });
            return entry;
        });

        return data.sort((a, b) => {
            const dateA = new Date(a.date.split(' ').reverse().join('-') + ' ' + new Date().getFullYear());
            const dateB = new Date(b.date.split(' ').reverse().join('-') + ' ' + new Date().getFullYear());
            return dateA.getTime() - dateB.getTime()
        });
    }, [results, selectedFuelType, selectedFournisseur, dateRange]);


    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-background border rounded-lg shadow-lg p-3">
                    <p className="font-bold text-foreground">{`${label}`}</p>
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
        <div className="space-y-4">
            <Card>
                <CardContent className="p-4 flex flex-col md:flex-row gap-4">
                    <Select value={selectedFuelType} onValueChange={setSelectedFuelType}>
                        <SelectTrigger className="w-full md:w-1/3">
                            <SelectValue placeholder="Sélectionner un type..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="">Tous les types</SelectItem>
                            {allFuelTypes.map(f => <SelectItem key={f.name} value={f.name}>{f.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                     <Select value={selectedFournisseur} onValueChange={setSelectedFournisseur}>
                        <SelectTrigger className="w-full md:w-1/3">
                            <SelectValue placeholder="Sélectionner un fournisseur..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="">Tous les fournisseurs</SelectItem>
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
                {METRICS.map(({ key, name, color, icon: Icon }) => (
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
                                    <LineChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="date" />
                                        <YAxis domain={['auto', 'auto']} />
                                        <Tooltip content={<CustomTooltip />}/>
                                        <Legend />
                                        <Line type="monotone" dataKey={key} name={name} stroke={color} strokeWidth={2} dot={false} />
                                    </LineChart>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-muted-foreground">
                                        Aucune donnée à afficher.
                                    </div>
                                )}
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}

