
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getLatestMixtureSession, getStocks, getSpecifications, type MixtureSession, type Stock, SPEC_MAP } from '@/lib/data';
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from './cards/StatCard';
import { Flame, Droplets, Wind, Percent, Archive, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Result {
  id: string;
  date_arrivage: { seconds: number; nanoseconds: number };
  type_combustible: string;
  fournisseur: string;
  pci_brut: number;
}

const formatNumber = (num: number | null | undefined, digits: number = 0) => {
    if (num === null || num === undefined || isNaN(num)) return '-';
    return num.toLocaleString('fr-FR', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
};

export function MainDashboard() {
    const [loading, setLoading] = useState(true);
    const [session, setSession] = useState<MixtureSession | null>(null);
    const [stocks, setStocks] = useState<Stock[]>([]);
    const [latestResults, setLatestResults] = useState<Result[]>([]);

    const fetchInitialData = useCallback(async () => {
        try {
            const [sessionData, stockData] = await Promise.all([
                getLatestMixtureSession(),
                getStocks(),
                getSpecifications(), // To populate SPEC_MAP
            ]);
            setSession(sessionData);
            setStocks(stockData);
        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        }
    }, []);

    useEffect(() => {
        fetchInitialData();
        
        const q = query(collection(db, "resultats"), orderBy("date_arrivage", "desc"), limit(5));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const resultsData: Result[] = [];
            querySnapshot.forEach((doc) => {
                resultsData.push({ id: doc.id, ...(doc.data() as any) });
            });
            setLatestResults(resultsData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [fetchInitialData]);

    const getResultStatus = (result: Result) => {
        const spec = SPEC_MAP.get(`${result.type_combustible}|${result.fournisseur}`);
        if (!spec) return true; // Conform if no spec
        if (spec.PCI_min && result.pci_brut < spec.PCI_min) return false;
        return true;
    }
    
    const lowStockThreshold = 100; // in tonnes
    const lowStocks = useMemo(() => stocks.filter(s => s.stock_actuel_tonnes < lowStockThreshold), [stocks]);

    if (loading) {
        return (
            <div className="p-4 md:p-6 space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Skeleton className="h-24" />
                    <Skeleton className="h-24" />
                    <Skeleton className="h-24" />
                    <Skeleton className="h-24" />
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                    <Skeleton className="h-80" />
                    <Skeleton className="h-80" />
                </div>
            </div>
        );
    }
    
    return (
        <div className="p-4 md:p-6 space-y-6">
            <section>
                <h2 className="text-xl font-semibold text-white mb-3">Dernier Mélange Enregistré</h2>
                {session ? (
                    <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                       <StatCard label="Débit total" value={`${formatNumber(session.globalIndicators?.flow, 1)} t/h`} icon={<Flame />} />
                       <StatCard label="PCI moyen" value={`${formatNumber(session.globalIndicators?.pci, 0)} kcal/kg`} icon={<Flame />} />
                       <StatCard label="Humidité moy." value={`${formatNumber(session.globalIndicators?.humidity, 2)} %`} icon={<Droplets />} />
                       <StatCard label="% Cendres moy." value={`${formatNumber(session.globalIndicators?.ash, 2)} %`} icon={<Percent />} />
                       <StatCard label="% Chlorures" value={`${formatNumber(session.globalIndicators?.chlorine, 3)} %`} icon={<Wind />} />
                    </div>
                ) : (
                    <Card className="flex items-center justify-center h-24">
                        <p className="text-muted-foreground">Aucune session de mélange enregistrée.</p>
                    </Card>
                )}
            </section>
            
            <section className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Archive className="text-primary"/>
                            Niveaux de Stock
                        </CardTitle>
                        {lowStocks.length > 0 && <CardDescription className="text-amber-400">{lowStocks.length} stock(s) bas.</CardDescription>}
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-72">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Combustible</TableHead>
                                        <TableHead className="text-right">Stock Actuel (tonnes)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {stocks.map(stock => (
                                        <TableRow key={stock.id} className={stock.stock_actuel_tonnes < lowStockThreshold ? "bg-amber-800/20" : ""}>
                                            <TableCell className="font-medium">{stock.nom_combustible}</TableCell>
                                            <TableCell className="text-right font-bold tabular-nums">
                                                {formatNumber(stock.stock_actuel_tonnes, 1)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Dernières Analyses</CardTitle>
                        <CardDescription>Les 5 analyses les plus récentes.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <ScrollArea className="h-72">
                            <Table>
                                 <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Combustible</TableHead>
                                        <TableHead className="text-right">PCI (kcal/kg)</TableHead>
                                        <TableHead className="text-center">Statut</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {latestResults.map(result => {
                                        const isConform = getResultStatus(result);
                                        return (
                                            <TableRow key={result.id}>
                                                <TableCell className="text-muted-foreground">
                                                    {format(result.date_arrivage.seconds * 1000, "d MMM", { locale: fr })}
                                                </TableCell>
                                                <TableCell className="font-medium">{result.type_combustible}</TableCell>
                                                <TableCell className="text-right font-bold tabular-nums">{formatNumber(result.pci_brut)}</TableCell>
                                                <TableCell className="text-center">
                                                    {isConform ? (
                                                        <span className="inline-flex items-center gap-1.5 text-xs text-green-400">
                                                            <CheckCircle2 className="h-3.5 w-3.5" /> Conforme
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 text-xs text-red-400">
                                                            <AlertTriangle className="h-3.5 w-3.5" /> Non Conforme
                                                        </span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </section>
        </div>
    );
}
