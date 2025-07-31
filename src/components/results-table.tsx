"use client";

import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Result {
    id: string;
    date_arrivage: { seconds: number, nanoseconds: number };
    type_combustible: string;
    fournisseur: string;
    pcs: number;
    h2o: number;
    cendres: number;
    chlore: number;
    densite: number;
    pci_brut: number;
    remarques: string;
}

export function ResultsTable() {
    const [results, setResults] = useState<Result[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, "resultats"), orderBy("date_arrivage", "desc"));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const resultsData: Result[] = [];
            querySnapshot.forEach((doc) => {
                resultsData.push({ id: doc.id, ...doc.data() } as Result);
            });
            setResults(resultsData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const formatDate = (timestamp: { seconds: number, nanoseconds: number }) => {
        if (!timestamp) return 'N/A';
        return format(new Date(timestamp.seconds * 1000), "dd/MM/yyyy", { locale: fr });
    }
    
    const formatNumber = (num: number | null | undefined, fractionDigits: number = 2) => {
        if (num === null || num === undefined) return 'N/A';
        return num.toLocaleString('fr-FR', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits });
    }

    if (loading) {
        return (
             <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
            </div>
        )
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Date Arrivage</TableHead>
                        <TableHead>Type Combustible</TableHead>
                        <TableHead>Fournisseur</TableHead>
                        <TableHead className="text-right">PCS</TableHead>
                        <TableHead className="text-right">PCI sur Brut</TableHead>
                        <TableHead className="text-right">% H2O</TableHead>
                        <TableHead className="text-right">% Cendres</TableHead>
                        <TableHead className="text-right">% Cl-</TableHead>
                        <TableHead className="text-right">Densité</TableHead>
                        <TableHead>Remarques</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {results.length > 0 ? (
                        results.map((result) => (
                            <TableRow key={result.id}>
                                <TableCell>{formatDate(result.date_arrivage)}</TableCell>
                                <TableCell>{result.type_combustible}</TableCell>
                                <TableCell>{result.fournisseur}</TableCell>
                                <TableCell className="text-right">{formatNumber(result.pcs, 0)}</TableCell>
                                <TableCell className="font-semibold text-right">{formatNumber(result.pci_brut, 0)}</TableCell>
                                <TableCell className="text-right">{formatNumber(result.h2o, 1)}</TableCell>
                                <TableCell className="text-right">{formatNumber(result.cendres, 1)}</TableCell>
                                <TableCell className="text-right">{formatNumber(result.chlore, 2)}</TableCell>
                                <TableCell className="text-right">{formatNumber(result.densite, 2)}</TableCell>
                                <TableCell className="max-w-[200px] truncate">{result.remarques}</TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={10} className="h-24 text-center">
                                Aucun résultat trouvé.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
