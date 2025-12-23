
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getLatestMixtureSession, type MixtureSession, getImpactAnalyses, type ImpactAnalysis, getFuelData, type FuelData } from '@/lib/data';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, BookOpen, Download, Flame, Droplets, Percent, Wind, Edit, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, Cell, LabelList } from 'recharts';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import jsPDF from "jspdf";
import "jspdf-autotable";

declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

const formatNumber = (num: number | null | undefined, digits: number = 2) => {
    if (num === null || num === undefined || isNaN(num)) return '–';
    return num.toLocaleString('fr-FR', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
};

const IndicatorBlock = ({ title, value, unit }: { title: string, value: string | number, unit?: string}) => (
    <div className="bg-brand-surface/80 rounded-xl p-4 text-center border border-brand-line/50">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold text-white">
            {value}
            {unit && <span className="text-base text-muted-foreground ml-1">{unit}</span>}
        </p>
    </div>
);

const InstallationCompositionCard = ({ name, flowRate, composition, pci, chlore, pneus }: { name: string, flowRate: number, composition: { name: string, buckets: number, percentage: number }[], pci: number, chlore: number, pneus: number }) => {
    return (
        <div className="bg-brand-surface rounded-xl border border-brand-line/50 overflow-hidden">
            <div className="p-4 border-b border-brand-line/50">
                <h3 className="font-semibold text-lg text-white">{name}</h3>
                <p className="text-sm text-muted-foreground">Débit estimé: <span className="font-bold text-white">{formatNumber(flowRate, 1)} t/h</span></p>
            </div>
            <div className="p-4 grid grid-cols-3 gap-2 text-center text-xs bg-brand-surface/50">
                <div><span className="font-semibold text-muted-foreground">PCI:</span> <strong className="text-emerald-400">{formatNumber(pci, 0)}</strong></div>
                <div><span className="font-semibold text-muted-foreground">Cl:</span> <strong className="text-orange-400">{formatNumber(chlore, 3)}%</strong></div>
                <div><span className="font-semibold text-muted-foreground">Pneus:</span> <strong className="text-sky-400">{formatNumber(pneus, 1)}%</strong></div>
            </div>
            {composition.length > 0 ? (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="text-white">Combustible</TableHead>
                            <TableHead className="text-right text-white">Godets</TableHead>
                            <TableHead className="text-right text-white">% Poids</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {composition.map(item => (
                            <TableRow key={item.name}>
                                <TableCell className="font-medium">{item.name}</TableCell>
                                <TableCell className="text-right">{item.buckets}</TableCell>
                                <TableCell className="text-right">{formatNumber(item.percentage, 1)}%</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            ) : <p className="text-center text-muted-foreground p-6">Aucune donnée</p>}
        </div>
    );
};


export default function RapportSynthesePage() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [mixtureSession, setMixtureSession] = useState<MixtureSession | null>(null);
    const [latestImpact, setLatestImpact] = useState<ImpactAnalysis | null>(null);
    const [fuelDataMap, setFuelDataMap] = useState<Record<string, FuelData>>({});

    const fetchData = useCallback(async () => {
        try {
            const [sessionData, impactAnalyses, fuelData] = await Promise.all([
                getLatestMixtureSession(),
                getImpactAnalyses(),
                getFuelData(),
            ]);
            setMixtureSession(sessionData);
            setLatestImpact(impactAnalyses.length > 0 ? impactAnalyses[0] : null);
            setFuelDataMap(fuelData.reduce((acc, fd) => {
                acc[fd.nom_combustible] = fd;
                return acc;
            }, {} as Record<string, FuelData>));
        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const { hallData, atsData, afIndicators } = useMemo(() => {
        if (!mixtureSession || !fuelDataMap || !mixtureSession.availableFuels) {
            return { afIndicators: null, hallData: null, atsData: null };
        }

        const hallState = mixtureSession.hallAF;
        const atsState = mixtureSession.ats;

        const processComposition = (fuels: Record<string, { buckets: number }>, flowRate: number) => {
            if (!fuels) return { composition: [], totalWeight: 0, pci: 0, chlore: 0, pneus: 0 };
            
            const fuelDetails = Object.entries(fuels)
                .map(([name, data]) => ({ name, buckets: data.buckets || 0, weight: (data.buckets || 0) * (fuelDataMap[name]?.poids_godet || 1.5) }))
                .filter(item => item.buckets > 0);
            
            const totalWeight = fuelDetails.reduce((sum, item) => sum + item.weight, 0);

            let totalPciWeight = 0;
            let totalChlorineWeight = 0;
            let tireWeight = 0;
            
            fuelDetails.forEach(item => {
                const analysis = mixtureSession.availableFuels[item.name];
                if (analysis) {
                    totalPciWeight += (analysis.pci_brut || 0) * item.weight;
                    totalChlorineWeight += (analysis.chlore || 0) * item.weight;
                    if(item.name.toLowerCase().includes('pneu')) {
                        tireWeight += item.weight;
                    }
                }
            });

            return {
                composition: fuelDetails.map(item => ({...item, percentage: totalWeight > 0 ? (item.weight / totalWeight) * 100 : 0})).sort((a,b) => b.percentage - a.percentage),
                totalWeight,
                flowRate: flowRate,
                pci: totalWeight > 0 ? totalPciWeight / totalWeight : 0,
                chlore: totalWeight > 0 ? totalChlorineWeight / totalWeight : 0,
                pneus: totalWeight > 0 ? (tireWeight / totalWeight) * 100 : 0,
            };
        };

        const hallData = processComposition(hallState?.fuels, hallState?.flowRate || 0);
        const atsData = processComposition(atsState?.fuels, atsState?.flowRate || 0);

        const afIndicators = {
            'PCI': { value: mixtureSession.afIndicators.pci, unit: 'kcal/kg', digits: 0 },
            'Humidité': { value: mixtureSession.afIndicators.humidity, unit: '%', digits: 2 },
            'Cendres': { value: mixtureSession.afIndicators.ash, unit: '%', digits: 2 },
            'Chlore': { value: mixtureSession.afIndicators.chlorine, unit: '%', digits: 3 },
            'Pneus': { value: mixtureSession.afIndicators.tireRate, unit: '%', digits: 1 },
        };
        
        return { 
            afIndicators, 
            hallData,
            atsData,
        };
    }, [mixtureSession, fuelDataMap]);

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
    
    const handleExport = () => {
        if (!mixtureSession) {
            toast({ variant: "destructive", title: "Erreur", description: "Aucune donnée de session à exporter." });
            return;
        }

        setIsExporting(true);
        try {
            const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
            let yPos = 20;

            doc.setFontSize(18);
            doc.setFont("helvetica", "bold");
            doc.text("Rapport de Synthèse du Mélange", 105, yPos, { align: "center" });
            yPos += 8;
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.text(`Basé sur la session du ${format(mixtureSession.timestamp.toDate(), "d MMMM yyyy 'à' HH:mm", { locale: fr })}`, 105, yPos, { align: "center" });
            yPos += 15;

            // Global Indicators
            doc.setFontSize(14); doc.setFont("helvetica", "bold");
            doc.text("Indicateurs du Mélange AFs (sans GO)", 14, yPos);
            yPos += 8;
            doc.setFontSize(10);
            if (afIndicators) {
                Object.entries(afIndicators).forEach(([key, { value, unit, digits }]) => {
                    doc.text(`- ${key}: ${formatNumber(value, digits)} ${unit}`, 20, yPos); yPos += 6;
                });
            }
            yPos += 4;
            
            // Composition Tables
            const drawCompositionTable = (title: string, data: any) => {
                if (!data || data.composition.length === 0) return;
                if (yPos > 240) { doc.addPage(); yPos = 20; }
                doc.setFontSize(12); doc.setFont("helvetica", "bold");
                doc.text(`${title} (Débit: ${formatNumber(data.flowRate, 1)} t/h)`, 14, yPos);
                yPos += 6;
                (doc as any).autoTable({
                    startY: yPos,
                    head: [['Combustible', 'Godets', '% Poids']],
                    body: data.composition.map((c: any) => [c.name, c.buckets, formatNumber(c.percentage, 1) + ' %']),
                    theme: 'grid',
                    headStyles: { fillColor: [22, 163, 74] },
                    styles: { fontSize: 8 },
                });
                yPos = (doc as any).lastAutoTable.finalY + 10;
            };

            drawCompositionTable("Composition Hall des AF", hallData);
            drawCompositionTable("Composition ATS", atsData);

            doc.save(`Rapport_Melange_${format(new Date(), "yyyy-MM-dd")}.pdf`);
            toast({ title: "Succès", description: "Le rapport a été téléchargé." });
        } catch (error) {
            console.error("Client-side export error:", error);
            const errorMessage = error instanceof Error ? error.message : "Une erreur inconnue est survenue.";
            toast({ variant: "destructive", title: "Erreur d'exportation", description: errorMessage });
        } finally {
            setIsExporting(false);
        }
    };


    if (loading) {
        return (
            <div className="max-w-4xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
                <Skeleton className="h-10 w-1/3" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }
    
    return (
        <div className="max-w-5xl mx-auto p-4 md:p-6 lg:p-8 space-y-8">
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold tracking-tight text-primary">Rapport de Synthèse</h1>
                {mixtureSession?.timestamp && (
                    <p className="text-sm text-muted-foreground">
                        Basé sur la session du {format(mixtureSession.timestamp.toDate(), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                    </p>
                )}
                 <Button onClick={handleExport} disabled={isExporting} variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    {isExporting ? "Génération..." : "Exporter en PDF"}
                </Button>
            </div>
            
            <section>
                <h2 className="text-xl font-semibold mb-4">Indicateurs Globaux du Mélange AFs (sans GO)</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {afIndicators ? Object.entries(afIndicators).map(([key, { value, unit, digits }]) => (
                        <IndicatorBlock key={key} title={key} value={formatNumber(value, digits)} unit={unit} />
                    )) : <p className="col-span-full text-center text-muted-foreground py-4">Aucun indicateur de mélange disponible.</p>}
                </div>
            </section>

            <section className="space-y-4">
                <h2 className="text-xl font-semibold mb-4">Composition du Mélange</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {hallData && <InstallationCompositionCard name="Hall des AF" {...hallData} />}
                    {atsData && <InstallationCompositionCard name="ATS" {...atsData} />}
                </div>
            </section>

            <section>
                <h2 className="text-xl font-semibold mb-4">Impact sur le Clinker (Δ Calculé - Sans Cendres)</h2>
                <Card>
                    <CardContent className="pt-6">
                        {impactChartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
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
                                            <Cell key={`cell-${index}`} fill={entry.value >= 0 ? '#22c55e' : '#3b82f6'} />
                                        ))}
                                        <LabelList dataKey="value" position="top" formatter={(value: number) => formatNumber(value, 2)} fontSize={12} fill="hsl(var(--foreground))" />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <p className="text-center text-muted-foreground p-4">Aucune donnée d'impact à afficher.</p>}
                    </CardContent>
                </Card>
            </section>
        </div>
    );
}
