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

    const formatDelta = (num: number | null | undefined, digits: number = 2) => {
        if (num === null || num === undefined) return 'N/A';
        const sign = num > 0 ? '+' : '';
        return `${sign}${formatNumber(num, digits)}`;
    };

    const deltaClass = (num: number | null | undefined) => {
        if (num === null || num === undefined) return '';
        return num > 0 ? 'text-green-400' : 'text-red-400';
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
                                    <TableHead className="text-right">Débit AFs (t/h)</TableHead>
                                    <TableHead className="text-right">Débit GO (t/h)</TableHead>
                                    <TableHead className="text-right">Débit Pet Coke (t/h)</TableHead>
                                    <TableHead className="text-right">Δ Fe2O3</TableHead>
                                    <TableHead className="text-right">Δ LSF</TableHead>
                                    <TableHead className="text-right">Δ C3S</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {analyses.length > 0 ? (
                                    analyses.map((item) => {
                                        const petCokeTotal = (item.parameters.petCokePrecaFlow ?? 0) + (item.parameters.petCokeTuyereFlow ?? 0);
                                        const deltaFe2O3 = (item.results.clinkerWithAsh.fe2o3 ?? 0) - (item.results.clinkerWithoutAsh.fe2o3 ?? 0);
                                        const deltaLSF = (item.results.modulesAvec.lsf ?? 0) - (item.results.modulesSans.lsf ?? 0);
                                        const deltaC3S = (item.results.c3sAvec ?? 0) - (item.results.c3sSans ?? 0);

                                        return (
                                            <TableRow key={item.id}>
                                                <TableCell className="font-medium">
                                                    {format(item.createdAt.toDate(), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                                                </TableCell>
                                                <TableCell className="text-right">{formatNumber(item.parameters.afFlow, 1)}</TableCell>
                                                <TableCell className="text-right">{formatNumber(item.parameters.grignonsFlow, 1)}</TableCell>
                                                <TableCell className="text-right">{formatNumber(petCokeTotal, 1)}</TableCell>
                                                <TableCell className={`text-right font-medium ${deltaClass(deltaFe2O3)}`}>{formatDelta(deltaFe2O3)}</TableCell>
                                                <TableCell className={`text-right font-medium ${deltaClass(deltaLSF)}`}>{formatDelta(deltaLSF)}</TableCell>
                                                <TableCell className={`text-right font-bold ${deltaClass(deltaC3S)}`}>{formatDelta(deltaC3S)}</TableCell>
                                            </TableRow>
                                        );
                                    })
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
