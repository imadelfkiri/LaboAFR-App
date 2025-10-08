"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getLatestMixtureSession, type MixtureSession, getImpactAnalyses, type ImpactAnalysis, getFuelData, type FuelData } from '@/lib/data';
import { Skeleton } from "@/components/ui/skeleton";
import { Flame, Activity, BookOpen, Beaker, BarChart2, Download, FileText, FileJson, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, Cell, LabelList } from 'recharts';
import jsPDF from "jspdf";
import "jspdf-autotable";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table as DocxTable, TableRow as DocxTableRow, TableCell as DocxTableCell, WidthType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';


// Extend jsPDF for autoTable
declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

const formatNumber = (num: number | null | undefined, digits: number = 2) => {
    if (num === null || num === undefined || isNaN(num)) return '0.00';
    return num.toLocaleString('fr-FR', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
};

const formatNumberForPdf = (num: number | null | undefined, digits: number = 2): string => {
    if (num === null || num === undefined || isNaN(num)) return '0,00';
    const fixed = num.toFixed(digits);
    // Remplacer le point par une virgule pour le format français
    const [integerPart, decimalPart] = fixed.split('.');
    
    // Utilise un espace comme séparateur de milliers
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");

    return decimalPart ? `${formattedInteger},${decimalPart}` : formattedInteger;
};

export default function RapportSynthesePage() {
    const [loading, setLoading] = useState(true);
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
        if (!mixtureSession || !fuelDataMap || Object.keys(fuelDataMap).length === 0) return [];

        const allFuelNames = new Set([
            ...Object.keys(mixtureSession.hallAF?.fuels || {}),
            ...Object.keys(mixtureSession.ats?.fuels || {})
        ]);

        const combinedFuelsData = Array.from(allFuelNames).map(name => {
            const hallBuckets = mixtureSession.hallAF?.fuels[name]?.buckets || 0;
            const atsBuckets = mixtureSession.ats?.fuels[name]?.buckets || 0;
            const totalBuckets = hallBuckets + atsBuckets;
            
            const poidsGodet = fuelDataMap[name]?.poids_godet || 1.5;
            const weight = totalBuckets * poidsGodet;

            return { name, buckets: totalBuckets, weight };
        });

        const totalWeight = combinedFuelsData.reduce((sum, data) => sum + data.weight, 0);

        return combinedFuelsData
            .filter(data => data.buckets > 0)
            .map(data => ({
                name: data.name,
                buckets: data.buckets,
                percentage: totalWeight > 0 ? Math.round((data.weight / totalWeight) * 100) : 0,
            }))
            .sort((a, b) => b.buckets - a.buckets);

    }, [mixtureSession, fuelDataMap]);

    const handleExportPDF = () => {
        const doc = new jsPDF();
        const date = format(new Date(), "dd/MM/yyyy");
        let yPos = 20;

        doc.setFontSize(18);
        doc.text("Composition de mélange et son impact", 105, yPos, { align: "center" });
        yPos += 8;
        doc.setFontSize(10);
        doc.text(date, 105, yPos, { align: "center" });
        yPos += 15;

        // Section 1: Indicateurs du Mélange
        if (mixtureIndicators && mixtureSession?.globalIndicators) {
            doc.setFontSize(14);
            doc.text("Indicateurs du Mélange", 14, yPos);
            yPos += 6;
            doc.autoTable({
                startY: yPos,
                head: [['Indicateur', 'Valeur', 'Unité']],
                body: mixtureIndicators.map(ind => {
                    const label = ind.label;
                    let digits = 2;
                    switch (label) {
                        case 'PCI':
                            digits = 0;
                            break;
                        case 'H₂O':
                        case 'Cendres':
                            digits = 1;
                            break;
                        case 'Chlorures':
                            digits = 2;
                            break;
                    }
                    
                    const value = formatNumberForPdf(
                        mixtureSession?.globalIndicators[
                            label.toLowerCase().replace('chlorures', 'chlorine').replace('cendres', 'ash').replace('h₂o', 'humidity') as keyof typeof mixtureSession.globalIndicators
                        ], 
                        digits
                    );
                    return [label === 'H₂O' ? 'H2O' : label, value, ind.unit];
                }),
                theme: 'striped',
                headStyles: { fillColor: [44, 62, 80] },
            });
            yPos = (doc as any).lastAutoTable.finalY + 15;
        }

        // Section 2: Composition du Mélange
        if (mixtureComposition.length > 0) {
            doc.setFontSize(14);
            doc.text("Composition du Mélange", 14, yPos);
            yPos += 6;
            doc.autoTable({
                startY: yPos,
                head: [['Combustible', 'Nombre de Godets', '% Poids']],
                body: mixtureComposition.map(item => [
                    item.name,
                    item.buckets,
                    `${item.percentage}%`
                ]),
                theme: 'striped',
                headStyles: { fillColor: [44, 62, 80] },
            });
            yPos = (doc as any).lastAutoTable.finalY + 15;
        }

        // Section 3: Impact sur le Clinker
        if (impactChartData.length > 0) {
            doc.setFontSize(14);
            doc.text("Impact sur le Clinker", 14, yPos);
            yPos += 6;
            doc.autoTable({
                startY: yPos,
                head: [['Indicateur', 'Variation (Calculé - Sans Cendres)']],
                body: impactChartData.map(item => [
                    item.name,
                    item.value.toFixed(2),
                ]),
                theme: 'striped',
                headStyles: { fillColor: [44, 62, 80] },
            });
        }
        
        const filename = `Rapport_Synthese_${format(new Date(), "yyyy-MM-dd")}.pdf`;
        doc.save(filename);
    };

    const handleExportWord = () => {
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({ text: "Composition de mélange et son impact", heading: HeadingLevel.TITLE, alignment: 'center' }),
                    new Paragraph({ text: format(new Date(), "dd/MM/yyyy"), alignment: 'center', spacing: { after: 400 } }),
                    
                    // Indicateurs
                    ...(mixtureIndicators && mixtureSession?.globalIndicators ? [
                        new Paragraph({ text: "Indicateurs du Mélange", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
                        new DocxTable({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            rows: [
                                new DocxTableRow({
                                    children: [
                                        new DocxTableCell({ children: [new Paragraph({ text: "Indicateur", children: [new TextRun({ bold: true })]})] }),
                                        new DocxTableCell({ children: [new Paragraph({ text: "Valeur", children: [new TextRun({ bold: true })]})] }),
                                        new DocxTableCell({ children: [new Paragraph({ text: "Unité", children: [new TextRun({ bold: true })]})] }),
                                    ],
                                }),
                                ...mixtureIndicators.map(ind => new DocxTableRow({
                                    children: [
                                        new DocxTableCell({ children: [new Paragraph(ind.label)] }),
                                        new DocxTableCell({ children: [new Paragraph(ind.value)] }),
                                        new DocxTableCell({ children: [new Paragraph(ind.unit)] }),
                                    ]
                                }))
                            ]
                        })
                    ] : []),
    
                    // Composition
                    ...(mixtureComposition.length > 0 ? [
                        new Paragraph({ text: "Composition du Mélange", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
                         new DocxTable({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            rows: [
                                new DocxTableRow({
                                    children: [
                                        new DocxTableCell({ children: [new Paragraph({ text: "Combustible", children: [new TextRun({ bold: true })]})] }),
                                        new DocxTableCell({ children: [new Paragraph({ text: "Nombre de Godets", children: [new TextRun({ bold: true })]})] }),
                                        new DocxTableCell({ children: [new Paragraph({ text: "% Poids", children: [new TextRun({ bold: true })]})] }),
                                    ],
                                }),
                                ...mixtureComposition.map(item => new DocxTableRow({
                                    children: [
                                        new DocxTableCell({ children: [new Paragraph(item.name)] }),
                                        new DocxTableCell({ children: [new Paragraph(String(item.buckets))] }),
                                        new DocxTableCell({ children: [new Paragraph(`${item.percentage}%`)] }),
                                    ]
                                }))
                            ]
                        })
                    ] : []),
    
                     // Impact
                    ...(impactChartData.length > 0 ? [
                        new Paragraph({ text: "Impact sur le Clinker", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
                         new DocxTable({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            rows: [
                                new DocxTableRow({
                                    children: [
                                        new DocxTableCell({ children: [new Paragraph({ text: "Indicateur", children: [new TextRun({ bold: true })]})] }),
                                        new DocxTableCell({ children: [new Paragraph({ text: "Variation (Calculé - Sans Cendres)", children: [new TextRun({ bold: true })]})] }),
                                    ],
                                }),
                                ...impactChartData.map(item => new DocxTableRow({
                                    children: [
                                        new DocxTableCell({ children: [new Paragraph(item.name)] }),
                                        new DocxTableCell({ children: [new Paragraph(item.value.toFixed(2))] }),
                                    ]
                                }))
                            ]
                        })
                    ] : []),
                ],
            }],
        });
    
        Packer.toBlob(doc).then(blob => {
            saveAs(blob, `Rapport_Synthese_${format(new Date(), "yyyy-MM-dd")}.docx`);
        });
    };


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
                <div className='flex items-center gap-4'>
                    {mixtureSession?.timestamp && (
                        <p className="text-sm text-muted-foreground">
                            Données de la session du {format(mixtureSession.timestamp.toDate(), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                        </p>
                    )}
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline">
                                <Download className="mr-2 h-4 w-4" />
                                Exporter
                                <ChevronDown className="ml-2 h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onClick={handleExportPDF}>
                                <FileText className="mr-2 h-4 w-4" />
                                Exporter en PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleExportWord}>
                                <FileJson className="mr-2 h-4 w-4" />
                                Exporter en Word
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
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
                    <CardHeader><CardTitle className="flex items-center gap-2"><BarChart2 /> Répartition du Mélange (% Poids)</CardTitle></CardHeader>
                    <CardContent>
                          {mixtureComposition.length > 0 ? (
                             <ResponsiveContainer width="100%" height={250}>
                                <BarChart data={mixtureComposition} margin={{ top: 20, right: 20, bottom: 0, left: -10}}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} unit="%" />
                                    <Tooltip
                                        formatter={(value) => `${value}%`}
                                        contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
                                        cursor={{ fill: 'hsl(var(--muted))' }}
                                    />
                                    <Bar dataKey="percentage" name="% Poids" fill="hsl(var(--primary)/0.8)">
                                       <LabelList dataKey="percentage" position="top" formatter={(value: number) => `${value}%`} fontSize={12} fill="hsl(var(--foreground))" />
                                    </Bar>
                                </BarChart>
                             </ResponsiveContainer>
                         ) : <p className="text-center text-muted-foreground p-4">Aucune donnée pour le graphique.</p>}
                    </CardContent>
                </Card>
            </section>
        </div>
    );
}
