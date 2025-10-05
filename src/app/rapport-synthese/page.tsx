
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getLatestMixtureSession, type MixtureSession, getImpactAnalyses, type ImpactAnalysis } from '@/lib/data';
import { Skeleton } from "@/components/ui/skeleton";
import { Flame, Activity, BookOpen, Beaker, BarChart2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, Cell, LabelList } from 'recharts';


const formatNumber = (num: number | null | undefined, digits: number = 2) => {
    if (num === null || num === undefined || isNaN(num)) return '0.00';
    return num.toLocaleString('fr-FR', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
};

const DeltaPill = ({ delta }: { delta: number }) => {
  const color =
    delta > 0.001 ? "bg-red-500/20 text-red-300 ring-red-500/30"
    : delta < -0.001 ? "bg-green-500/20 text-green-300 ring-green-500/30"
    : "bg-neutral-700/30 text-neutral-300 ring-neutral-600/30"
  const sign = delta > 0 ? "+" : ""
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold tabular-nums ring-1 ring-inset ${color}`}>
      {sign}{delta.toFixed(2)}
    </span>
  )
}

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

    const mixtureComposition = useMemo(() => {
        if (!mixtureSession) return [];
        const combinedFuels: Record<string, { buckets: number }> = {};

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
            
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2"><Flame /> Indicateurs du Mélange</CardTitle></CardHeader>
                    <CardContent className="grid gap-4 grid-cols-2">
                         {mixtureIndicators ? mixtureIndicators.map(ind => (
                            <div key={ind.label} className="p-4 rounded-lg bg-brand-muted/70 border border-brand-line/50">
                                <p className="text-sm text-muted-foreground">{ind.label}</p>
                                <p className="text-2xl font-bold">{ind.value}<span className="text-sm ml-1">{ind.unit}</span></p>
                            </div>
                        )) : <p className="col-span-full text-center text-muted-foreground p-4">Aucune session de mélange.</p>}
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2"><Activity /> Impact sur le Clinker</CardTitle></CardHeader>
                    <CardContent>
                         {impactChartData.length > 0 ? (
                             <ResponsiveContainer width="100%" height={200}>
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
                                            <Cell key={`cell-${index}`} fill={entry.value > 0 ? 'hsl(var(--danger)/0.7)' : 'hsl(var(--positive)/0.7)'} />
                                        ))}
                                        <LabelList dataKey="value" position="top" formatter={(value: number) => value.toFixed(2)} fontSize={12} fill="hsl(var(--foreground))" />
                                    </Bar>
                                </BarChart>
                             </ResponsiveContainer>
                         ) : <p className="text-center text-muted-foreground p-4">Aucune donnée d'impact.</p>}
                    </CardContent>
                </Card>
            </section>

             <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2"><Beaker /> Composition (Godets)</CardTitle></CardHeader>
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
                 <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2"><BarChart2 /> Répartition du Mélange</CardTitle></CardHeader>
                    <CardContent>
                          {mixtureComposition.length > 0 ? (
                             <ResponsiveContainer width="100%" height={250}>
                                <BarChart data={mixtureComposition} margin={{ top: 5, right: 20, bottom: 0, left: -10}}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                                    <Tooltip
                                        contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
                                        cursor={{ fill: 'hsl(var(--muted))' }}
                                    />
                                    <Bar dataKey="buckets" name="Nb. Godets" fill="hsl(var(--primary)/0.8)" />
                                </BarChart>
                             </ResponsiveContainer>
                         ) : <p className="text-center text-muted-foreground p-4">Aucune donnée pour le graphique.</p>}
                    </CardContent>
                </Card>
            </section>
        </div>
    );
}
