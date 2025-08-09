
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, onSnapshot, orderBy, doc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db, firebaseAppPromise } from '@/lib/firebase';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfDay, endOfDay, subDays, isValid, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, XCircle, Trash2, Download, AlertTriangle, CheckCircle2 } from "lucide-react";
import { getSpecifications, SPEC_MAP, getFuelSupplierMap } from "@/lib/data";
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
import { useToast } from '@/hooks/use-toast';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { MultiSelect } from '@/components/ui/multi-select';
import * as XLSX from 'xlsx';

interface Result {
    id: string;
    date_arrivage: { seconds: number; nanoseconds: number } | string;
    type_combustible: string;
    fournisseur: string;
    h2o: number;
    cendres: number;
    chlore: number;
    pci_brut: number;
    remarques: string;
}

export function ResultsTable() {
    const [results, setResults] = useState<Result[]>([]);
    const [loading, setLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState<string[]>([]);
    const [fournisseurFilter, setFournisseurFilter] = useState<string[]>([]);
    const [dateFilter, setDateFilter] = useState<DateRange | undefined>();
    const [resultToDelete, setResultToDelete] = useState<string | null>(null);
    
    const [fuelSupplierMap, setFuelSupplierMap] = useState<Record<string, string[]>>({});
    const [availableFournisseurs, setAvailableFournisseurs] = useState<string[]>([]);

    const { toast } = useToast();

    const fetchInitialData = useCallback(async () => {
        setLoading(true);
        try {
            await firebaseAppPromise;
            const [map] = await Promise.all([
                getFuelSupplierMap(),
                getSpecifications()
            ]);
            setFuelSupplierMap(map);

            const q = query(collection(db, "resultats"), orderBy("date_arrivage", "desc"));
            const unsubscribe = onSnapshot(q, (querySnapshot) => {
                const resultsData: Result[] = [];
                querySnapshot.forEach((doc) => {
                    resultsData.push({ id: doc.id, ...doc.data() } as Result);
                });
                setResults(resultsData);
                setLoading(false);
            }, (error) => {
                console.error("Erreur de lecture des résultats:", error);
                toast({ variant: "destructive", title: "Erreur de lecture", description: "Impossible de charger l'historique des résultats." });
                setLoading(false);
            });
            return unsubscribe; 

        } catch (error) {
            console.error("Erreur lors de la récupération des données de base :", error);
            toast({ variant: "destructive", title: "Erreur de données", description: "Impossible de charger les données de configuration." });
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        let unsubscribe: (() => void) | undefined;
        fetchInitialData().then(unsub => {
            if (unsub) {
                unsubscribe = unsub;
            }
        });
        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, [fetchInitialData]);

    const { uniqueFuelTypes, allUniqueFournisseurs } = useMemo(() => {
        const fuelTypes = [...new Set(results.map(r => r.type_combustible))].sort();
        const fournisseurs = [...new Set(results.map(r => r.fournisseur))].sort();
        return { uniqueFuelTypes: fuelTypes, allUniqueFournisseurs: fournisseurs };
    }, [results]);

    useEffect(() => {
        if (typeFilter.length > 0) {
            const newAvailable = typeFilter.flatMap(type => fuelSupplierMap[type] || []);
            setAvailableFournisseurs([...new Set(newAvailable)].sort());
            // Deselect suppliers that are no longer available
            setFournisseurFilter(current => current.filter(f => newAvailable.includes(f)));
        } else {
            setAvailableFournisseurs(allUniqueFournisseurs);
        }
    }, [typeFilter, fuelSupplierMap, allUniqueFournisseurs]);
    
    const normalizeDate = (date: { seconds: number; nanoseconds: number } | string): Date | null => {
        if (typeof date === 'string') {
            const parsed = parseISO(date);
            return isValid(parsed) ? parsed : null;
        }
        if (date && typeof date.seconds === 'number') {
            return new Timestamp(date.seconds, date.nanoseconds).toDate();
        }
        return null;
    };

    const filteredResults = useMemo(() => {
        return results.filter(result => {
            if (!result.date_arrivage) return false;
            const dateArrivage = normalizeDate(result.date_arrivage);
             if (!dateArrivage || !isValid(dateArrivage)) return false;
            
            const typeMatch = typeFilter.length === 0 || typeFilter.includes(result.type_combustible);
            const fournisseurMatch = fournisseurFilter.length === 0 || fournisseurFilter.includes(result.fournisseur);
            const dateMatch = !dateFilter || (
                (!dateFilter.from || dateArrivage >= startOfDay(dateFilter.from)) &&
                (!dateFilter.to || dateArrivage <= endOfDay(dateFilter.to))
            );

            return typeMatch && fournisseurMatch && dateMatch;
        });
    }, [results, typeFilter, fournisseurFilter, dateFilter]);

    const calculateAverage = (results: Result[], field: keyof Result): number | null => {
        const validValues = results.map(r => r[field]).filter(v => typeof v === 'number') as number[];
        if (!validValues.length) return null;
        const sum = validValues.reduce((acc, val) => acc + val, 0);
        return sum / validValues.length;
    };
    
    function formatDate(date: { seconds: number; nanoseconds: number } | string): string {
        const parsedDate = normalizeDate(date);
        if (!parsedDate || !isValid(parsedDate)) return "Date inconnue";
        return format(parsedDate, "dd/MM/yyyy");
    }

    const resetFilters = () => {
        setTypeFilter([]);
        setFournisseurFilter([]);
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
    
    const formatNumber = (num: number | null | undefined, fractionDigits: number = 0) => {
        if (num === null || num === undefined || isNaN(num)) return 'N/A';
        return num.toLocaleString('fr-FR', {
            minimumFractionDigits: fractionDigits,
            maximumFractionDigits: fractionDigits,
            useGrouping: true,
        });
    };

    const exportToExcel = (data: Result[], reportType: 'Journalier' | 'Hebdomadaire' | 'Mensuel' | 'Filtré') => {
        if (!data || data.length === 0) {
            toast({ variant: "destructive", title: "Aucune donnée", description: "Il n'y a aucune donnée à exporter." });
            return;
        }

        const reportDate = new Date();
        const formattedDate = format(reportDate, 'dd-MM-yyyy');

        const titleText = `Rapport ${reportType} du ${formattedDate} analyses des AF`;
        const subtitleText = "Suivi des combustibles solides non dangereux";
        const filename = `${reportType}_AFR_Report_${format(reportDate, "yyyy-MM-dd")}.xlsx`;

        const headers = ["Date", "Type Combustible", "Fournisseur", "PCI sur Brut", "% H2O", "% Cl-", "% Cendres", "Remarques"];
        
        const border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
        const titleStyle = { font: { bold: true, sz: 14 }, alignment: { horizontal: "center", vertical: "center" }, fill: { fgColor: { rgb: "E6F4EA" } } };
        const subtitleStyle = { font: { bold: true, sz: 12 }, alignment: { horizontal: "center", vertical: "center" }, fill: { fgColor: { rgb: "E6F4EA" } } };
        const headerStyle = { font: { bold: true, color: { rgb: "000000" } }, alignment: { horizontal: "center", vertical: "center" }, fill: { fgColor: { rgb: "CDE9D6" } }, border };
        
        const baseCellStyle = { border, alignment: { vertical: "center" } };
        const centerAlignStyle = { ...baseCellStyle, alignment: { ...baseCellStyle.alignment, horizontal: "center" } };
        const leftAlignStyle = { ...baseCellStyle, alignment: { ...baseCellStyle.alignment, horizontal: "left", wrapText: true } };
        
        const ws_data: (any)[][] = [
            [ { v: titleText, s: titleStyle } ],
            [ { v: subtitleText, s: subtitleStyle } ],
            [], 
            headers.map(h => ({ v: h, s: headerStyle }))
        ];
        
        ws_data[0] = [...ws_data[0], ...Array(headers.length - 1).fill({v: "", s: titleStyle})];
        ws_data[1] = [...ws_data[1], ...Array(headers.length - 1).fill({v: "", s: subtitleStyle})];


        data.forEach(result => {
            const row = [
                { v: formatDate(result.date_arrivage), s: centerAlignStyle },
                { v: result.type_combustible, s: leftAlignStyle },
                { v: result.fournisseur, s: leftAlignStyle },
                { v: result.pci_brut, s: centerAlignStyle },
                { v: result.h2o, s: centerAlignStyle },
                { v: result.chlore, s: centerAlignStyle },
                { v: result.cendres, s: centerAlignStyle },
                { v: result.remarques || '', s: leftAlignStyle },
            ];
            ws_data.push(row);
        });
        
        const ws = XLSX.utils.aoa_to_sheet(ws_data, { cellStyles: true });
    
        if (!ws['!merges']) ws['!merges'] = [];
        const mergeEndColumn = headers.length - 1;
        ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: mergeEndColumn } });
        ws['!merges'].push({ s: { r: 1, c: 0 }, e: { r: 1, c: mergeEndColumn } });
    
        const colWidths = headers.map((header, i) => {
            const maxLength = Math.max(
                header.length,
                ...ws_data.slice(4).map(row => {
                    const cell = row[i];
                    const value = cell && cell.v ? cell.v : '';
                    return value ? value.toString().length : 0;
                })
            );
            return { wch: maxLength + 2 };
        });

        const remarksIndex = headers.indexOf('Remarques');
        if (remarksIndex > -1) colWidths[remarksIndex] = { wch: 40 };

        ws['!cols'] = colWidths;
        
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Rapport AFR");
        XLSX.writeFile(wb, filename);
    };

    const handleReportDownload = (period: 'filtered') => {
        exportToExcel(filteredResults, 'Filtré');
    };

    const getSpecValueColor = (result: Result, field: keyof Result) => {
        const spec = SPEC_MAP.get(`${result.type_combustible}|${result.fournisseur}`);
        if (!spec) return "text-foreground"; // No spec, default color

        const value = result[field];
        if (typeof value !== 'number') return "text-foreground";

        switch (field) {
            case 'pci_brut':
                if (typeof spec.PCI_min === 'number' && value < spec.PCI_min) return "text-red-600";
                return "text-green-600";
            case 'h2o':
                if (typeof spec.H2O_max === 'number' && value > spec.H2O_max) return "text-red-600";
                return "text-green-600";
            case 'chlore':
                if (typeof spec.Cl_max === 'number' && value > spec.Cl_max) return "text-red-600";
                return "text-green-600";
            case 'cendres':
                if (typeof spec.Cendres_max === 'number' && value > spec.Cendres_max) return "text-red-600";
                return "text-green-600";
            default:
                return "text-foreground";
        }
    }


    const generateAlerts = (result: Result) => {
        const spec = SPEC_MAP.get(`${result.type_combustible}|${result.fournisseur}`);
        if (!spec) {
            return { text: "N/A", color: "text-muted-foreground", isConform: true };
        }

        const alerts: string[] = [];

        if (typeof spec.PCI_min === 'number' && result.pci_brut < spec.PCI_min) {
            alerts.push("PCI trop bas");
        }
        if (typeof spec.H2O_max === 'number' && result.h2o > spec.H2O_max) {
            alerts.push("Humidité élevée");
        }
        if (typeof spec.Cl_max === 'number' && result.chlore > spec.Cl_max) {
            alerts.push("Chlore trop élevé");
        }
        if (typeof spec.Cendres_max === 'number' && result.cendres > spec.Cendres_max) {
            alerts.push("Taux de cendres élevé");
        }

        if (alerts.length === 0) {
            return { text: "Conforme", color: "text-green-600", isConform: true };
        }

        return { text: alerts.join(' / '), color: "text-red-600", isConform: false };
    };

    if (loading) {
        return (
             <div className="space-y-2 p-4 lg:p-6">
                <Skeleton className="h-10 w-full" />
                 <Skeleton className="h-96 w-full" />
            </div>
        )
    }

    return (
        <TooltipProvider>
            <AlertDialog onOpenChange={(open) => !open && setResultToDelete(null)}>
                <div className="flex flex-col gap-4 p-4 lg:p-6 h-full">
                    <div className='flex flex-wrap items-center gap-2 bg-green-100 text-green-800 font-semibold rounded-md px-3 py-2'>
                        
                        <MultiSelect
                            options={uniqueFuelTypes.map(f => ({ label: f, value: f }))}
                            selected={typeFilter}
                            onChange={setTypeFilter}
                            placeholder="Filtrer par type..."
                            className="w-full sm:w-auto flex-1 min-w-[160px] bg-white border-green-300 hover:bg-green-50"
                        />
                        <MultiSelect
                            options={availableFournisseurs.map(f => ({ label: f, value: f }))}
                            selected={fournisseurFilter}
                            onChange={setFournisseurFilter}
                            placeholder="Filtrer par fournisseur..."
                            className="w-full sm:w-auto flex-1 min-w-[160px] bg-white border-green-300 hover:bg-green-50"
                        />

                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    id="date"
                                    variant={"outline"}
                                    className={cn(
                                        "w-full sm:w-auto flex-1 min-w-[210px] justify-start text-left font-medium bg-white border-green-300 hover:bg-green-50 text-gray-800",
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
                        <Button onClick={resetFilters} variant="ghost" className="text-green-700 hover:text-green-900 hover:bg-green-100 h-9 px-3">
                            <XCircle className="mr-2 h-4 w-4"/>
                            Réinitialiser
                        </Button>
                        <Button 
                            variant="outline" 
                            className="w-full sm:w-auto bg-white hover:bg-green-50 border-green-300 text-gray-800"
                            onClick={() => handleReportDownload('filtered')}
                        >
                            <Download className="mr-2 h-4 w-4"/>
                            <span>Exporter la vue filtrée</span>
                        </Button>
                    </div>

                    <ScrollArea className="flex-grow rounded-lg border">
                        <Table className="min-w-[1200px]">
                            <TableHeader>
                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                    <TableHead className="w-[120px] px-4 sticky left-0 bg-muted/50">Date Arrivage</TableHead>
                                    <TableHead className="px-4 sticky left-[120px] bg-muted/50">Type Combustible</TableHead>
                                    <TableHead className="px-4">Fournisseur</TableHead>
                                    <TableHead className="text-right text-primary font-bold px-4">PCI sur Brut</TableHead>
                                    <TableHead className="text-right px-4">% H2O</TableHead>
                                    <TableHead className="text-right px-4">% Cl-</TableHead>
                                    <TableHead className="text-right px-4">% Cendres</TableHead>
                                    <TableHead className="px-4 font-bold">Alertes</TableHead>
                                    <TableHead className="px-4">Remarques</TableHead>
                                    <TableHead className="w-[50px] text-right px-4 sticky right-0 bg-muted/50">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredResults.length > 0 ? (
                                    <>
                                        {filteredResults.map((result) => {
                                            const alert = generateAlerts(result);
                                            return (
                                            <TableRow key={result.id}>
                                                <TableCell className="font-medium px-4 sticky left-0 bg-background">{formatDate(result.date_arrivage)}</TableCell>

                                                <TableCell className="px-4 sticky left-[120px] bg-background">
                                                    {result.type_combustible}
                                                </TableCell>
                                                <TableCell className="px-4">{result.fournisseur}</TableCell>
                                                <TableCell className={cn("font-bold text-right px-4", getSpecValueColor(result, 'pci_brut'))}>
                                                    {formatNumber(result.pci_brut, 0)}
                                                </TableCell>
                                                <TableCell className={cn("text-right px-4 font-medium", getSpecValueColor(result, 'h2o'))}>
                                                  {formatNumber(result.h2o, 1)}
                                                </TableCell>
                                                <TableCell className={cn("text-right px-4 font-medium", getSpecValueColor(result, 'chlore'))}>
                                                  {formatNumber(result.chlore, 2)}
                                                </TableCell>
                                                <TableCell className={cn("text-right px-4 font-medium", getSpecValueColor(result, 'cendres'))}>
                                                  {formatNumber(result.cendres, 1)}
                                                </TableCell>
                                                <TableCell className={cn("px-4 font-semibold", alert.color)}>
                                                    <div className="flex items-center gap-2">
                                                        {alert.isConform ? (
                                                            <CheckCircle2 className="h-4 w-4" />
                                                        ) : (
                                                            <AlertTriangle className="h-4 w-4" />
                                                        )}
                                                        <span>{alert.text}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="max-w-[200px] truncate text-muted-foreground px-4">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <span>{result.remarques}</span>
                                                        </TooltipTrigger>
                                                        {result.remarques && <TooltipContent>{result.remarques}</TooltipContent>}
                                                    </Tooltip>
                                                </TableCell>
                                                <TableCell className="text-right px-4 sticky right-0 bg-background">
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" onClick={() => setResultToDelete(result.id)}>
                                                            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive"/>
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                </TableCell>
                                            </TableRow>
                                        )})}
                                        <TableRow className="bg-muted/40 font-semibold">
                                            <TableCell colSpan={3} className="px-4 sticky left-0 bg-muted/40">Moyenne de la sélection</TableCell>
                                            <TableCell className="text-right text-primary px-4">{formatNumber(calculateAverage(filteredResults, 'pci_brut'), 0)}</TableCell>
                                            <TableCell className="text-right px-4">{formatNumber(calculateAverage(filteredResults, 'h2o'), 1)}</TableCell>
                                            <TableCell className="text-right px-4">{formatNumber(calculateAverage(filteredResults, 'chlore'), 2)}</TableCell>
                                            <TableCell className="text-right px-4">{formatNumber(calculateAverage(filteredResults, 'cendres'), 1)}</TableCell>
                                            <TableCell colSpan={3} className='sticky right-0 bg-muted/40'/>
                                        </TableRow>
                                    </>
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                                            Aucun résultat trouvé.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                         <ScrollBar orientation="horizontal" />
                    </ScrollArea>

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
        </TooltipProvider>
    );
}

    