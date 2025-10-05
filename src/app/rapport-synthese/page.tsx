
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getLatestMixtureSession, type MixtureSession, getImpactAnalyses, type ImpactAnalysis } from '@/lib/data';
import { Skeleton } from "@/components/ui/skeleton";
import { Flame, Activity, BookOpen, Beaker } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImpactCard, ImpactData } from '@/components/cards/ImpactCard';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const formatNumber = (num: number | null | undefined, digits: number = 2) => {
    if (num === null || num === undefined || isNaN(num)) return '0.00';
    return num.toLocaleString('fr-FR', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
};


export default function RapportSynthesePage() {
    const [loading, setLoading] = useState(true);
    const [mixtureSession, setMixtureSession] = useState<MixtureSession | null>(null);
    const [latestImpact, setLatestImpact] = useState<ImpactAnalysis | null>(null);

    const fetchData = useCallback(async () => {
        try {
            const [sessionData, impactAnalyses] = await Promise.all([
                getLatestMixtureSession(),
                getImpactAnalyses(),
            ]);
            setMixtureSession(sessionData);
            setLatestImpact(impactAnalyses.length > 0 ? impactAnalyses[0] : null);
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
            { label: "PCI", value: formatNumber(indicators.pci, 0), unit: "kcal/kg" },
            { label: "Chlorures", value: formatNumber(indicators.chlorine, 3), unit: "%" },
            { label: "Cendres", value: formatNumber(indicators.ash, 2), unit: "%" },
            { label: "H₂O", value: formatNumber(indicators.humidity, 2), unit: "%" },
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

    const mixtureComposition = useMemo(() => {
        if (!mixtureSession) return [];
        const combinedFuels: Record<string, { buckets: number }> = {};

        // Combine fuels from Hall AF and ATS
        Object.entries(mixtureSession.hallAF?.fuels || {}).forEach(([name, data]) => {
            combinedFuels[name] = { buckets: (combinedFuels[name]?.buckets || 0) + data.buckets };
        });
        Object.entries(mixtureSession.ats?.fuels || {}).forEach(([name, data]) => {
            combinedFuels[name] = { buckets: (combinedFuels[name]?.buckets || 0) + data.buckets };
        });

        return Object.entries(combinedFuels)
            .filter(([, data]) => data.buckets > 0)
            .map(([name, data]) => ({
                name,
                buckets: data.buckets,
            }))
            .sort((a, b) => b.buckets - a.buckets);

    }, [mixtureSession]);


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
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                    <BookOpen className="h-8 w-8" />
                    Rapport de Synthèse
                </h1>
                {mixtureSession?.timestamp && (
                    <p className="text-sm text-muted-foreground">
                        Données de la session du {format(mixtureSession.timestamp.toDate(), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                    </p>
                )}
            </div>
            
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                     <Card>
                        <CardHeader><CardTitle className="flex items-center gap-2"><Beaker /> Composition du Mélange</CardTitle></CardHeader>
                        <CardContent>
                             {mixtureComposition.length > 0 ? (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Combustible</TableHead>
                                            <TableHead className="text-right">Nb. Godets</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {mixtureComposition.map(item => (
                                            <TableRow key={item.name}>
                                                <TableCell className="font-medium">{item.name}</TableCell>
                                                <TableCell className="text-right">{item.buckets}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : (
                                <p className="col-span-full text-center text-muted-foreground p-4">Aucune composition de mélange.</p>
                            )}
                        </CardContent>
                    </Card>
                </div>
                
                <div className="lg:col-span-2 space-y-6">
                     <Card>
                        <CardHeader><CardTitle className="flex items-center gap-2"><Flame /> Indicateurs du Mélange</CardTitle></CardHeader>
                        <CardContent className="grid gap-4 grid-cols-2 md:grid-cols-4">
                             {mixtureIndicators ? mixtureIndicators.map(ind => (
                                <div key={ind.label} className="p-4 rounded-lg bg-brand-muted/70 border border-brand-line/50">
                                    <p className="text-sm text-muted-foreground">{ind.label}</p>
                                    <p className="text-2xl font-bold">{ind.value}<span className="text-sm ml-1">{ind.unit}</span></p>
                                </div>
                            )) : <p className="col-span-full text-center text-muted-foreground p-4">Aucune session de mélange.</p>}
                        </CardContent>
                    </Card>
                    <ImpactCard title="Impact sur le Clinker" data={impactData} lastUpdate={latestImpact?.createdAt.toDate()} />
                </div>
            </section>
        </div>
    );
}


  