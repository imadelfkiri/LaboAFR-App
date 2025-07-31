"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, orderBy, where, Timestamp } from 'firebase/firestore';
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, XCircle } from "lucide-react";
import { FUEL_TYPES, FOURNISSEURS } from "@/lib/data";
import { cn } from "@/lib/utils";

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
    const [typeFilter, setTypeFilter] = useState<string>("");
    const [fournisseurFilter, setFournisseurFilter] = useState<string>("");
    const [dateFilter, setDateFilter] = useState<Date | undefined>();

    useEffect(() => {
        let q = query(collection(db, "resultats"), orderBy("date_arrivage", "desc"));

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

    const filteredResults = useMemo(() => {
        return results.filter(result => {
            const dateArrivage = new Date(result.date_arrivage.seconds * 1000);
            
            const typeMatch = !typeFilter || result.type_combustible === typeFilter;
            const fournisseurMatch = !fournisseurFilter || result.fournisseur === fournisseurFilter;
            const dateMatch = !dateFilter || (
                dateArrivage.getDate() === dateFilter.getDate() &&
                dateArrivage.getMonth() === dateFilter.getMonth() &&
                dateArrivage.getFullYear() === dateFilter.getFullYear()
            );

            return typeMatch && fournisseurMatch && dateMatch;
        });
    }, [results, typeFilter, fournisseurFilter, dateFilter]);

    const resetFilters = () => {
        setTypeFilter("");
        setFournisseurFilter("");
        setDateFilter(undefined);
    };

    const formatDate = (timestamp: { seconds: number, nanoseconds: number }) => {
        if (!timestamp) return 'N/A';
        return format(new Date(timestamp.seconds * 1000), "dd/MM/yyyy", { locale: fr });
    }
    
    const formatNumber = (num: number | null | undefined, fractionDigits: number = 2) => {
        if (num === null || num === undefined) return 'N/A';
        if (fractionDigits === 0) {
            return Math.round(num).toLocaleString('fr-FR');
        }
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
        <div>
            <div className="flex flex-col sm:flex-row gap-4 mb-6 p-4 border rounded-lg bg-card">
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-full sm:w-[200px]">
                        <SelectValue placeholder="Filtrer par type..." />
                    </SelectTrigger>
                    <SelectContent>
                        {FUEL_TYPES.map(fuel => <SelectItem key={fuel} value={fuel}>{fuel}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={fournisseurFilter} onValueChange={setFournisseurFilter}>
                    <SelectTrigger className="w-full sm:w-[200px]">
                        <SelectValue placeholder="Filtrer par fournisseur..." />
                    </SelectTrigger>
                    <SelectContent>
                        {FOURNISSEURS.map(supplier => <SelectItem key={supplier} value={supplier}>{supplier}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className={cn(
                            "w-full sm:w-[240px] justify-start text-left font-normal",
                            !dateFilter && "text-muted-foreground"
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dateFilter ? format(dateFilter, "PPP", { locale: fr }) : <span>Filtrer par date...</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            mode="single"
                            selected={dateFilter}
                            onSelect={setDateFilter}
                            initialFocus
                            locale={fr}
                        />
                    </PopoverContent>
                </Popover>
                 <Button onClick={resetFilters} variant="ghost" className="text-muted-foreground hover:text-foreground">
                    <XCircle className="mr-2 h-4 w-4"/>
                    Réinitialiser
                </Button>
            </div>
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
                        {filteredResults.length > 0 ? (
                            filteredResults.map((result) => (
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
                                    Aucun résultat trouvé pour les filtres sélectionnés.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
