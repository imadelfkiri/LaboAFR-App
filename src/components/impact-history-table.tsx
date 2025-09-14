
"use client";

import React, { useState, useEffect } from 'react';
import { getImpactAnalyses, type ImpactAnalysis } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export function ImpactHistoryTable() {
    const [analyses, setAnalyses] = useState<ImpactAnalysis[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            setLoading(true);
            try {
                const historyData = await getImpactAnalyses();
                setAnalyses(historyData);
            } catch (error) {
                console.error("Failed to fetch impact analysis history:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, []);

    const formatNumber = (num: number | null | undefined, digits: number = 2) => {
        if (num === null || num === undefined) return 'N/A';
        return num.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
    };


    return (
        <Card>
            <CardHeader>
                <CardTitle>Historique des Calculs d'Impact</CardTitle>
                <CardDescription>
                    Retrouvez ici toutes les simulations d'impact que vous avez sauvegardées.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="space-y-2">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-64 w-full" />
                    </div>
                ) : (
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead className="text-right">Débit Farine (t/h)</TableHead>
                                    <TableHead className="text-right">Facteur Clinker</TableHead>
                                    <TableHead className="text-right">Chaux Libre</TableHead>
                                    <TableHead className="text-right">Cible SO₃</TableHead>
                                    <TableHead className="text-right">PF Clinker</TableHead>
                                    <TableHead className="text-right">C3S (avec cendres)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {analyses.length > 0 ? (
                                    analyses.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-medium">
                                                {format(item.createdAt.toDate(), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                                            </TableCell>
                                            <TableCell className="text-right">{formatNumber(item.parameters.rawMealFlow, 0)}</TableCell>
                                            <TableCell className="text-right">{formatNumber(item.parameters.clinkerFactor, 2)}</TableCell>
                                            <TableCell className="text-right">{formatNumber(item.parameters.freeLime, 2)}</TableCell>
                                            <TableCell className="text-right">{formatNumber(item.parameters.so3Target, 2)}</TableCell>
                                            <TableCell className="text-right">{formatNumber(item.parameters.pfClinkerTarget, 2)}</TableCell>
                                            <TableCell className="text-right font-semibold">{formatNumber(item.results.c3sAvec, 2)}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center">
                                            Aucun historique trouvé. Enregistrez une analyse pour la voir ici.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
