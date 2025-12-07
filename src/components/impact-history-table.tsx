
"use client";

import React, { useState, useEffect } from 'react';
import { getImpactAnalyses, deleteImpactAnalysis, type ImpactAnalysis } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Trash2 } from 'lucide-react';
import { useAuth } from '@/context/auth-provider';

export function ImpactHistoryTable() {
    const { userProfile } = useAuth();
    const isReadOnly = userProfile?.role === 'viewer';
    const [analyses, setAnalyses] = useState<ImpactAnalysis[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const { toast } = useToast();

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const historyData = await getImpactAnalyses();
            setAnalyses(historyData);
        } catch (error) {
            console.error("Failed to fetch impact analysis history:", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger l'historique." });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);
    
    const handleDelete = async () => {
        if (isReadOnly || !deletingId) return;
        try {
            await deleteImpactAnalysis(deletingId);
            toast({ title: "Succès", description: "L'enregistrement a été supprimé." });
            fetchHistory(); // Refresh the list
        } catch (error) {
             toast({ variant: "destructive", title: "Erreur", description: "Impossible de supprimer l'enregistrement." });
        } finally {
            setDeletingId(null);
        }
    };


    const formatNumber = (num: number | null | undefined, digits: number = 2) => {
        if (num === null || num === undefined) return '0,0';
        return num.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
    };

    const formatDelta = (num: number | null | undefined, digits: number = 2) => {
        if (num === null || num === undefined) return '0,0';
        const sign = num > 0 ? '+' : '';
        return `${sign}${formatNumber(num, digits)}`;
    };

    const deltaClass = (num: number | null | undefined) => {
        if (num === null || num === undefined) return '';
        if (num > 0.001) return 'text-green-400';
        if (num < -0.001) return 'text-red-400';
        return '';
    };


    return (
        <>
            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="space-y-2 p-4">
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
                                        {!isReadOnly && <TableHead className="text-center">Actions</TableHead>}
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
                                                        {item.createdAt ? format(item.createdAt.toDate(), "d MMM yyyy 'à' HH:mm", { locale: fr }) : 'Date invalide'}
                                                    </TableCell>
                                                    <TableCell className="text-right">{formatNumber(item.parameters.afFlow, 1)}</TableCell>
                                                    <TableCell className="text-right">{formatNumber(item.parameters.grignonsFlow, 1)}</TableCell>
                                                    <TableCell className="text-right">{formatNumber(petCokeTotal, 1)}</TableCell>
                                                    <TableCell className={`text-right font-medium ${deltaClass(deltaFe2O3)}`}>{formatDelta(deltaFe2O3)}</TableCell>
                                                    <TableCell className={`text-right font-medium ${deltaClass(deltaLSF)}`}>{formatDelta(deltaLSF)}</TableCell>
                                                    <TableCell className={`text-right font-bold ${deltaClass(deltaC3S)}`}>{formatDelta(deltaC3S)}</TableCell>
                                                    {!isReadOnly && (
                                                        <TableCell className="text-center">
                                                            <Button variant="ghost" size="icon" onClick={() => setDeletingId(item.id!)}>
                                                                <Trash2 className="h-4 w-4 text-destructive" />
                                                            </Button>
                                                        </TableCell>
                                                    )}
                                                </TableRow>
                                            );
                                        })
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={8} className="h-24 text-center">
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

            <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Cette action est irréversible et supprimera définitivement cet enregistrement.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Supprimer</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
