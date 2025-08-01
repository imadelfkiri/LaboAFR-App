"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, orderBy, doc, deleteDoc } from 'firebase/firestore';
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
import { format, startOfDay, endOfDay, subDays } from "date-fns";
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
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, XCircle, Trash2, Download, ChevronDown, FileOutput } from "lucide-react";
import { FUEL_TYPES, FOURNISSEURS } from "@/lib/data";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';

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

interface AggregatedResult {
    type_combustible: string;
    pcs: number;
    pci_brut: number;
    h2o: number;
    cendres: number;
    chlore: number;
    densite: number;
    count: number;
}


export function ResultsTable() {
    const [results, setResults] = useState<Result[]>([]);
    const [loading, setLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState<string>("");
    const [fournisseurFilter, setFournisseurFilter] = useState<string>("");
    const [dateFilter, setDateFilter] = useState<DateRange | undefined>();
    const [resultToDelete, setResultToDelete] = useState<string | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        let q = query(collection(db, "resultats"), orderBy("date_arrivage", "desc"));

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const resultsData: Result[] = [];
            querySnapshot.forEach((doc) => {
                resultsData.push({ id: doc.id, ...doc.data() } as Result);
            });
            setResults(resultsData);
            setLoading(false);
        }, (error) => {
            console.error("Erreur de lecture Firestore:", error);
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
                (!dateFilter.from || dateArrivage >= startOfDay(dateFilter.from)) &&
                (!dateFilter.to || dateArrivage <= endOfDay(dateFilter.to))
            );

            return typeMatch && fournisseurMatch && dateMatch;
        });
    }, [results, typeFilter, fournisseurFilter, dateFilter]);

    const resetFilters = () => {
        setTypeFilter("");
        setFournisseurFilter("");
        setDateFilter(undefined);
    };

    const handleDelete = async () => {
        if (!resultToDelete) return;

        try {
            await deleteDoc(doc(db, "resultats", resultToDelete));
            toast({
                title: "Succès",
                description: "L'enregistrement a été supprimé.",
            });
        } catch (error) {
            console.error("Erreur lors de la suppression:", error);
            toast({
                variant: "destructive",
                title: "Erreur",
                description: "La suppression a échoué. Veuillez réessayer.",
            });
        } finally {
            setResultToDelete(null);
        }
    };

    const formatDate = (timestamp: { seconds: number, nanoseconds: number }) => {
        if (!timestamp) return 'N/A';
        return format(new Date(timestamp.seconds * 1000), "dd/MM/yyyy", { locale: fr });
    }
    
    const formatNumber = (num: number | null | undefined, fractionDigits: number = 2) => {
        if (num === null || num === undefined || isNaN(num)) return 'N/A';
        const factor = Math.pow(10, fractionDigits);
        const roundedNum = Math.round(num * factor) / factor;
    
        if (fractionDigits === 0) {
            return roundedNum.toLocaleString('fr-FR');
        }
        return roundedNum.toLocaleString('fr-FR', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits });
    }

    const convertIndividualToCSV = (data: Result[]) => {
        const headers = [
            "Date Arrivage", "Type Combustible", "Fournisseur", 
            "PCS", "PCI sur Brut", "% H2O", "% Cl-", "% Cendres", 
            "Densité", "Remarques"
        ];
        const rows = data.map(result => [
            formatDate(result.date_arrivage),
            result.type_combustible,
            result.fournisseur,
            formatNumber(result.pcs, 0),
            formatNumber(result.pci_brut, 0),
            formatNumber(result.h2o, 1),
            formatNumber(result.chlore, 2),
            formatNumber(result.cendres, 1),
            formatNumber(result.densite, 2),
            `"${result.remarques || ''}"`
        ].join(';'));
        return [headers.join(';'), ...rows].join('\n');
    };

    const convertAggregatedToCSV = (data: AggregatedResult[]) => {
        const headers = [
            "Type Combustible", "Analyses", "PCS Moyen", "PCI Moyen", 
            "% H2O Moyen", "% Cl- Moyen", "% Cendres Moyen", "Densité Moyenne"
        ];
        const rows = data.map(result => [
            result.type_combustible,
            result.count,
            formatNumber(result.pcs, 0),
            formatNumber(result.pci_brut, 0),
            formatNumber(result.h2o, 1),
            formatNumber(result.chlore, 2),
            formatNumber(result.cendres, 1),
            formatNumber(result.densite, 2),
        ].join(';'));
        return [headers.join(';'), ...rows].join('\n');
    };

    const downloadCSV = (csvString: string, filename: string) => {
         if (!csvString || csvString.split('\n').length < 2) {
            toast({
                variant: "destructive",
                title: "Aucune donnée",
                description: `Il n'y a aucune donnée à exporter pour la sélection.`,
            });
            return;
        }
        const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `${filename}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };
    
    const handleFilteredExport = () => {
        const csvString = convertIndividualToCSV(filteredResults);
        const filename = `Export_Filtre_${format(new Date(), 'yyyy-MM-dd')}`;
        downloadCSV(csvString, filename);
    };

    const handleReportDownload = (period: 'daily' | 'weekly' | 'monthly') => {
        const now = new Date();
        let startDate: Date;
        let endDate: Date = endOfDay(now);
        let filename: string;

        if (period === 'daily') {
            startDate = startOfDay(subDays(now, 1));
            endDate = endOfDay(now);
            filename = `Rapport_Journalier_${format(now, 'yyyy-MM-dd')}`;
        } else if (period === 'weekly') {
            startDate = startOfDay(subDays(now, 7));
            filename = `Rapport_Hebdomadaire_${format(now, 'yyyy-MM-dd')}`;
        } else { // monthly
            startDate = startOfDay(subDays(now, 30));
            filename = `Rapport_Mensuel_${format(now, 'yyyy-MM')}`;
        }

        const reportData = results.filter(result => {
            const dateArrivage = new Date(result.date_arrivage.seconds * 1000);
            return dateArrivage >= startDate && dateArrivage <= endDate;
        });

        if (period === 'daily') {
            const csvString = convertIndividualToCSV(reportData);
            downloadCSV(csvString, filename);
        } else {
            const aggregatedData = aggregateResults(reportData);
            const csvString = convertAggregatedToCSV(aggregatedData);
            downloadCSV(csvString, filename);
        }
    };

    const aggregateResults = (data: Result[]): AggregatedResult[] => {
        const aggregation: Record<string, AggregatedResult> = {};

        data.forEach(result => {
            if (!aggregation[result.type_combustible]) {
                aggregation[result.type_combustible] = {
                    type_combustible: result.type_combustible,
                    pcs: 0, pci_brut: 0, h2o: 0, cendres: 0, chlore: 0, densite: 0, count: 0
                };
            }
            const current = aggregation[result.type_combustible];
            current.pcs += result.pcs;
            current.pci_brut += result.pci_brut;
            current.h2o += result.h2o;
            current.cendres += result.cendres;
            current.chlore += result.chlore;
            current.densite += result.densite;
            current.count += 1;
        });

        return Object.values(aggregation).map(agg => ({
            ...agg,
            pcs: agg.pcs / agg.count,
            pci_brut: agg.pci_brut / agg.count,
            h2o: agg.h2o / agg.count,
            cendres: agg.cendres / agg.count,
            chlore: agg.chlore / agg.count,
            densite: agg.densite / agg.count,
        }));
    };


    if (loading) {
        return (
             <div className="space-y-4 pt-4">
                <Skeleton className="h-10 w-full" />
                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2'>
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
                 <Skeleton className="h-40 w-full" />
            </div>
        )
    }

    return (
        <AlertDialog onOpenChange={(open) => !open && setResultToDelete(null)}>
            <div className="flex flex-col gap-4">
                <div className='grid grid-cols-1 md:grid-cols-3 gap-4 items-start'>
                    <div className="md:col-span-2">
                        <label className="text-sm font-medium text-muted-foreground mb-2 block">Filtres</label>
                        <div className="flex flex-wrap items-center gap-2">
                            <Select value={typeFilter} onValueChange={setTypeFilter}>
                                <SelectTrigger className="w-full sm:w-auto flex-1 min-w-[180px]">
                                    <SelectValue placeholder="Filtrer par type..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {FUEL_TYPES.map(fuel => <SelectItem key={fuel} value={fuel}>{fuel}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Select value={fournisseurFilter} onValueChange={setFournisseurFilter}>
                                <SelectTrigger className="w-full sm:w-auto flex-1 min-w-[180px]">
                                    <SelectValue placeholder="Filtrer par fournisseur..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {FOURNISSEURS.map(supplier => <SelectItem key={supplier} value={supplier}>{supplier}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        id="date"
                                        variant={"outline"}
                                        className={cn(
                                            "w-full sm:w-auto flex-1 min-w-[240px] justify-start text-left font-normal",
                                            !dateFilter && "text-muted-foreground"
                                        )}
                                        >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {dateFilter?.from ? (
                                            dateFilter.to ? (
                                            <>
                                                {format(dateFilter.from, "d MMM y", { locale: fr })} -{" "}
                                                {format(dateFilter.to, "d MMM y", { locale: fr })}
                                            </>
                                            ) : (
                                                format(dateFilter.from, "d MMM y", { locale: fr })
                                            )
                                        ) : (
                                            <span>Filtrer par date</span>
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        initialFocus
                                        mode="range"
                                        defaultMonth={dateFilter?.from}
                                        selected={dateFilter}
                                        onSelect={setDateFilter}
                                        numberOfMonths={2}
                                        locale={fr}
                                    />
                                </PopoverContent>
                            </Popover>
                            <Button onClick={resetFilters} variant="ghost" className="text-muted-foreground hover:text-foreground h-10 px-3">
                                <XCircle className="mr-2 h-4 w-4"/>
                                Réinitialiser
                            </Button>
                        </div>
                    </div>
                     <div>
                        <label className="text-sm font-medium text-muted-foreground mb-2 block">Téléchargement</label>
                        <div className='flex flex-wrap gap-2'>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="w-full sm:w-auto">
                                        <Download className="mr-2 h-4 w-4"/>
                                        Télécharger un Rapport
                                        <ChevronDown className="ml-2 h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleReportDownload('daily')}>
                                        Rapport Journalier
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleReportDownload('weekly')}>
                                        Rapport Hebdomadaire
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleReportDownload('monthly')}>
                                        Rapport Mensuel
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={handleFilteredExport}>
                                        <FileOutput className="mr-2 h-4 w-4"/>
                                        Exporter la vue filtrée
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </div>

                <div className="rounded-lg border overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                                <TableHead className="w-[120px]">Date Arrivage</TableHead>
                                <TableHead>Type Combustible</TableHead>
                                <TableHead>Fournisseur</TableHead>
                                <TableHead className="text-right">PCS</TableHead>
                                <TableHead className="text-right text-primary font-bold">PCI sur Brut</TableHead>
                                <TableHead className="text-right">% H2O</TableHead>
                                <TableHead className="text-right">% Cl-</TableHead>
                                <TableHead className="text-right">% Cendres</TableHead>
                                <TableHead className="text-right">Densité</TableHead>
                                <TableHead>Remarques</TableHead>
                                <TableHead className="w-[50px] text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredResults.length > 0 ? (
                                filteredResults.map((result) => (
                                    <TableRow key={result.id}>
                                        <TableCell className="font-medium">{formatDate(result.date_arrivage)}</TableCell>
                                        <TableCell>{result.type_combustible}</TableCell>
                                        <TableCell>{result.fournisseur}</TableCell>
                                        <TableCell className="text-right">{formatNumber(result.pcs, 0)}</TableCell>
                                        <TableCell className="font-bold text-right text-primary">{formatNumber(result.pci_brut, 0)}</TableCell>
                                        <TableCell className="text-right">{formatNumber(result.h2o, 1)}</TableCell>
                                        <TableCell className="text-right">{formatNumber(result.chlore, 2)}</TableCell>
                                        <TableCell className="text-right">{formatNumber(result.cendres, 1)}</TableCell>
                                        <TableCell className="text-right">{formatNumber(result.densite, 2)}</TableCell>
                                        <TableCell className="max-w-[150px] truncate text-muted-foreground">{result.remarques}</TableCell>
                                        <TableCell className="text-right">
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" onClick={() => setResultToDelete(result.id)}>
                                                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive"/>
                                                </Button>
                                            </AlertDialogTrigger>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">
                                        Aucun résultat trouvé pour les filtres sélectionnés.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
                 <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Êtes-vous absolument sûr ?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Cette action est irréversible. Le résultat sera définitivement supprimé
                        de la base de données.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Supprimer</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </div>
        </AlertDialog>
    );
}
