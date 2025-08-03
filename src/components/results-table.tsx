
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfDay, endOfDay, subDays, isValid, parseISO } from "date-fns";
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
import { getFuelTypes, type FuelType, getFournisseurs } from "@/lib/data";
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
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import * as XLSX from 'xlsx';

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
    granulometrie: number;
    pci_brut: number;
    remarques: string;
}

interface AggregatedResult {
    type_combustible: string;
    pci_brut: number;
    h2o: number;
    chlore: number;
    cendres: number;
    count: number;
}

const specMap: Record<string, { pci_min?: number, h2o?: number, chlore?: number, cendres?: number }> = {
  "CSR|Polluclean": { h2o: 16.5, chlore: 1.0, cendres: 15, pci_min: 4000 },
  "CSR|SMBRM": { h2o: 14, chlore: 0.6, cendres: 1, pci_min: 5000 },
  "DMB|MTR": { h2o: 15, chlore: 0.6, cendres: 15, pci_min: 4300 },
  "Grignons|Ain Seddeine": { h2o: 20, chlore: 0.5, cendres: 5, pci_min: 3700 },
  "Plastiques|ValRecete": { h2o: 15, chlore: 1.0, cendres: 15, pci_min: 4300 },
  "Plastiques|Bichara": { h2o: 10, chlore: 1.0, cendres: 15, pci_min: 4200 },
  "Plastiques|Valtradec": { h2o: 10, chlore: 1.0, cendres: 15, pci_min: 6000 },
  "Plastiques|Ssardi": { h2o: 18, chlore: 1.0, cendres: 15, pci_min: 4200 },
  "Pneus|RJL": { h2o: 1.0, chlore: 0.3, cendres: 1, pci_min: 6800 },
  "Pneus|Aliapur": { h2o: 1.0, chlore: 0.3, cendres: 1, pci_min: 6800 },
};

const getPciColorClass = (value: number, combustible: string, fournisseur: string) => {
  const key = `${combustible}|${fournisseur}`;
  const spec = specMap[key];
  if (spec && spec.pci_min !== undefined && value < spec.pci_min) return "text-red-600 font-bold";
  if (value < 4000) return "text-orange-600 font-bold";
  return "text-green-600";
};

const getCustomColor = (
  value: number,
  combustible: string,
  fournisseur: string,
  param: "h2o" | "chlore" | "cendres"
) => {
  const key = `${combustible}|${fournisseur}`;
  const spec = specMap[key];
  if (spec && spec[param] !== undefined && value > (spec[param] ?? Infinity)) return "text-red-600 font-bold";
  
  if (param === 'h2o' && value > 15) return "text-red-600 font-bold";
  if (param === 'chlore' && value > 1.2) return "text-yellow-600 font-bold";
  
  return "text-green-600";
};

const calculateAverage = (results: Result[], field: keyof Result): number | null => {
  const validValues = results.map(r => r[field]).filter(v => typeof v === 'number') as number[];
  if (!validValues.length) return null;
  const sum = validValues.reduce((acc, val) => acc + val, 0);
  return sum / validValues.length;
};

function formatDate(date: { seconds: number; nanoseconds: number } | string | Date): string {
    if (!date) return "Date inconnue";

    let parsedDate: Date;

    if (typeof date === "string") {
        parsedDate = parseISO(date);
    } else if (date && typeof (date as any).seconds === 'number') {
        parsedDate = new Date((date as { seconds: number }).seconds * 1000);
    } else {
        parsedDate = new Date(date);
    }

    if (!isValid(parsedDate)) {
        return "Date inconnue";
    }

    return format(parsedDate, "dd/MM/yyyy");
}


export function ResultsTable() {
    const [results, setResults] = useState<Result[]>([]);
    const [loading, setLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState<string>("");
    const [fournisseurFilter, setFournisseurFilter] = useState<string>("");
    const [dateFilter, setDateFilter] = useState<DateRange | undefined>();
    const [resultToDelete, setResultToDelete] = useState<string | null>(null);
    const [fuelTypes, setFuelTypes] = useState<FuelType[]>([]);
    const [fournisseurs, setFournisseurs] = useState<string[]>([]);
    const [fuelTypeMap, setFuelTypeMap] = useState<Map<string, string>>(new Map());
    const { toast } = useToast();
    const [isClient, setIsClient] = useState(false)

    useEffect(() => {
        setIsClient(true)
    }, [])

    useEffect(() => {
      if (!isClient) return;
      async function fetchData() {
          const [fetchedFuelTypes, fetchedFournisseurs] = await Promise.all([
              getFuelTypes(),
              getFournisseurs()
          ]);
          setFuelTypes(fetchedFuelTypes);
          setFournisseurs(fetchedFournisseurs);
          setFuelTypeMap(new Map(fetchedFuelTypes.map(fuel => [fuel.name, fuel.icon])));
      }
      fetchData();

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
    }, [isClient]);

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
    
    const formatNumber = (num: number | null | undefined, fractionDigits: number = 2) => {
        if (num === null || num === undefined || isNaN(num)) return 'N/A';
        const factor = Math.pow(10, fractionDigits);
        const roundedNum = Math.round(num * factor) / factor;
    
        if (fractionDigits === 0) {
            return roundedNum.toLocaleString('fr-FR', {useGrouping: true});
        }
        return roundedNum.toLocaleString('fr-FR', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits, useGrouping: false });
    }

    const exportToExcel = (data: Result[], reportType: string) => {
        if (!data || data.length === 0) {
            toast({
                variant: "destructive",
                title: "Aucune donnée",
                description: "Il n'y a aucune donnée à exporter pour la sélection.",
            });
            return;
        }

        const title = `Rapport ${reportType} analyses des AF`;
        const subtitle = "Suivi des combustibles solides non dangereux";
        const filename = `${reportType}_AFR_Report_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
        
        const headers = ["Date", "Type Combustible", "Fournisseur", "PCS", "PCI", "% H2O", "% Cl-", "% Cendres", "Densité", "Granulométrie", "Remarques", "Alertes"];

        const ws_data: any[][] = [
            [title],
            [subtitle],
            [],
            headers
        ];

        data.forEach(result => {
            const key = `${result.type_combustible}|${result.fournisseur}`;
            const spec = specMap[key] || {};
            const alerts = [];

            if (spec.pci_min && result.pci_brut < spec.pci_min) alerts.push("⚠️ PCI bas");
            else if (result.pci_brut < 4000) alerts.push("⚠️ PCI bas (Général)");

            if (spec.h2o && result.h2o > spec.h2o) alerts.push("⚠️ H2O élevé");
            if (spec.chlore && result.chlore > spec.chlore) alerts.push("⚠️ Cl- élevé");
            if (spec.cendres && result.cendres > spec.cendres) alerts.push("⚠️ Cendres élevées");

            const row = [
                formatDate(result.date_arrivage),
                result.type_combustible,
                result.fournisseur,
                result.pcs,
                result.pci_brut,
                result.h2o,
                result.chlore,
                result.cendres,
                result.densite,
                result.granulometrie,
                result.remarques,
                alerts.join(', ')
            ];
            ws_data.push(row);
        });

        const ws = XLSX.utils.aoa_to_sheet(ws_data);

        // Merging cells for titles
        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } }
        ];

        // Styling
        const titleStyle = { font: { bold: true, sz: 14 }, alignment: { horizontal: "center" }, fill: { fgColor: { rgb: "E6F4EA" } } };
        const subtitleStyle = { font: { sz: 12 }, alignment: { horizontal: "center" }, fill: { fgColor: { rgb: "E6F4EA" } } };
        const headerStyle = { font: { bold: true }, alignment: { horizontal: "center" }, fill: { fgColor: { rgb: "CDE9D6" } } };
        
        ws['A1'].s = titleStyle;
        ws['A2'].s = subtitleStyle;

        headers.forEach((_, c) => {
            const cellRef = XLSX.utils.encode_cell({r: 3, c});
            ws[cellRef].s = headerStyle;
        });
        
        for(let R = 4; R < ws_data.length; ++R) {
            for(let C = 0; C < headers.length; ++C) {
                const cell_ref = XLSX.utils.encode_cell({r:R, c:C});
                if(!ws[cell_ref]) continue;

                let cellStyle: any = { border: { top: {style:"thin"}, bottom:{style:"thin"}, left:{style:"thin"}, right:{style:"thin"}}};
                
                const result = data[R-4];
                const key = `${result.type_combustible}|${result.fournisseur}`;
                const spec = specMap[key] || {};

                // Conditional Formatting
                if (C === 4) { // PCI
                   if (spec.pci_min && result.pci_brut < spec.pci_min) cellStyle.fill = { fgColor: { rgb: "FFCCCC" } }; // Red
                   else if (result.pci_brut < 4000) cellStyle.fill = { fgColor: { rgb: "FFE6CC" } }; // Orange
                }
                if (C === 5 && spec.h2o && result.h2o > spec.h2o) cellStyle.fill = { fgColor: { rgb: "FFE6CC" } }; // Orange
                if (C === 6 && spec.chlore && result.chlore > spec.chlore) cellStyle.fill = { fgColor: { rgb: "FFFFCC" } }; // Yellow
                if (C === 7 && spec.cendres && result.cendres > spec.cendres) cellStyle.fill = { fgColor: { rgb: "E0E0E0" } }; // Gray
                
                // Alignment
                if ([0, 3, 4, 5, 6, 7, 8, 9].includes(C)) {
                    cellStyle.alignment = { horizontal: "center" };
                }

                // Alerts column styling
                if (C === 11 && ws_data[R][C] && (ws_data[R][C] as string).length > 0) {
                     cellStyle.font = { bold: true, color: { rgb: "FF0000" }};
                }

                ws[cell_ref].s = cellStyle;
            }
        }
        
        // Auto column widths
        const colWidths = headers.map((h, i) => ({
            wch: Math.max(
                h.length,
                ...ws_data.slice(4).map(row => row[i] ? row[i].toString().length : 0)
            ) + 2
        }));
        ws['!cols'] = colWidths;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Rapport AFR");

        XLSX.writeFile(wb, filename);
    };

    const handleReportDownload = (period: 'daily' | 'weekly' | 'monthly') => {
        const now = new Date();
        let startDate: Date;
        let endDate: Date = endOfDay(now);
        let reportType: string;
    
        if (!isValid(now)) {
            toast({ variant: "destructive", title: "Date système invalide", description: "Impossible de générer le rapport." });
            return;
        }
    
        if (period === 'daily') {
            startDate = startOfDay(subDays(now, 1));
            endDate = endOfDay(startDate);
            reportType = `Journalier du ${format(startDate, 'dd-MM-yyyy')}`;
        } else if (period === 'weekly') {
            startDate = startOfDay(subDays(now, 7));
            reportType = `Hebdomadaire`;
        } else { // monthly
            startDate = startOfDay(subDays(now, 30));
            reportType = `Mensuel`;
        }
    
        const reportData = results.filter(result => {
            const dateArrivage = new Date(result.date_arrivage.seconds * 1000);
            return isValid(dateArrivage) && dateArrivage >= startDate && dateArrivage <= endDate;
        });

        exportToExcel(reportData, reportType);
    };

    if (loading || !isClient) {
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
                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="w-full sm:w-auto flex-1 min-w-[160px] bg-white border-green-300 hover:bg-green-50">
                                <SelectValue placeholder="Type..." />
                            </SelectTrigger>
                            <SelectContent>
                                {fuelTypes.map(fuel => <SelectItem key={fuel.name} value={fuel.name}>{fuel.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={fournisseurFilter} onValueChange={setFournisseurFilter}>
                            <SelectTrigger className="w-full sm:w-auto flex-1 min-w-[160px] bg-white border-green-300 hover:bg-green-50">
                                <SelectValue placeholder="Fournisseur..." />
                            </SelectTrigger>
                            <SelectContent>
                                {fournisseurs.map(supplier => <SelectItem key={supplier} value={supplier}>{supplier}</SelectItem>)}
                            </SelectContent>
                        </Select>
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
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="w-full sm:w-auto bg-white hover:bg-green-50 border-green-300 text-gray-800">
                                    <Download className="mr-2 h-4 w-4"/>
                                    <span>Rapport Excel</span>
                                    <ChevronDown className="ml-2 h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                 <DropdownMenuItem onClick={() => handleReportDownload('daily')}>
                                    <FileOutput className="mr-2 h-4 w-4"/>
                                    Rapport Journalier
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleReportDownload('weekly')}>
                                     <FileOutput className="mr-2 h-4 w-4"/>
                                    Rapport Hebdomadaire
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleReportDownload('monthly')}>
                                     <FileOutput className="mr-2 h-4 w-4"/>
                                    Rapport Mensuel
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => exportToExcel(filteredResults, 'Filtre')}>
                                    <FileOutput className="mr-2 h-4 w-4"/>
                                    Exporter la vue filtrée
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    <ScrollArea className="flex-grow rounded-lg border">
                        <Table className="min-w-[1200px]">
                            <TableHeader>
                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                    <TableHead className="w-[120px] px-4 sticky left-0 bg-muted/50">Date Arrivage</TableHead>
                                    <TableHead className="px-4 sticky left-[120px] bg-muted/50">Type Combustible</TableHead>
                                    <TableHead className="px-4">Fournisseur</TableHead>
                                    <TableHead className="text-right px-4">PCS</TableHead>
                                    <TableHead className="text-right text-primary font-bold px-4">PCI sur Brut</TableHead>
                                    <TableHead className="text-right px-4">% H2O</TableHead>
                                    <TableHead className="text-right px-4">% Cl-</TableHead>
                                    <TableHead className="text-right px-4">% Cendres</TableHead>
                                    <TableHead className="text-right px-4">Densité</TableHead>
                                    <TableHead className="text-right px-4">Granulométrie</TableHead>
                                    <TableHead className="px-4">Remarques</TableHead>
                                    <TableHead className="w-[50px] text-right px-4 sticky right-0 bg-muted/50">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredResults.length > 0 ? (
                                    <>
                                        {filteredResults.map((result) => (
                                            <TableRow key={result.id}>
                                                <TableCell className="font-medium px-4 sticky left-0 bg-background">{formatDate(result.date_arrivage)}</TableCell>
                                                <TableCell className="px-4 sticky left-[120px] bg-background">
                                                    <div className="flex items-center gap-2">
                                                        <span>{fuelTypeMap.get(result.type_combustible) ?? '❓'}</span>
                                                        <span>{result.type_combustible}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-4">{result.fournisseur}</TableCell>
                                                <TableCell className="text-right px-4">{formatNumber(result.pcs, 0)}</TableCell>
                                                <TableCell className={cn("font-bold text-right px-4", getPciColorClass(result.pci_brut, result.type_combustible, result.fournisseur))}>{formatNumber(result.pci_brut, 0)}</TableCell>
                                                <TableCell className={cn("text-right px-4", getCustomColor(result.h2o, result.type_combustible, result.fournisseur, "h2o"))}>
                                                  {formatNumber(result.h2o, 1)}
                                                </TableCell>
                                                <TableCell className={cn("text-right px-4", getCustomColor(result.chlore, result.type_combustible, result.fournisseur, "chlore"))}>
                                                  {formatNumber(result.chlore, 2)}
                                                </TableCell>
                                                <TableCell className={cn("text-right px-4", getCustomColor(result.cendres, result.type_combustible, result.fournisseur, "cendres"))}>
                                                  {formatNumber(result.cendres, 1)}
                                                </TableCell>
                                                <TableCell className="text-right px-4">{formatNumber(result.densite, 2)}</TableCell>
                                                <TableCell className="text-right px-4">{formatNumber(result.granulometrie, 1)}</TableCell>
                                                <TableCell className="max-w-[150px] truncate text-muted-foreground px-4">
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
                                        ))}
                                        <TableRow className="bg-muted/40 font-semibold">
                                            <TableCell colSpan={4} className="px-4 sticky left-0 bg-muted/40">Moyenne de la sélection</TableCell>
                                            <TableCell className="text-right text-primary px-4">{formatNumber(calculateAverage(filteredResults, 'pci_brut'), 0)}</TableCell>
                                            <TableCell className="text-right px-4">{formatNumber(calculateAverage(filteredResults, 'h2o'), 1)}</TableCell>
                                            <TableCell className="text-right px-4">{formatNumber(calculateAverage(filteredResults, 'chlore'), 2)}</TableCell>
                                            <TableCell className="text-right px-4">{formatNumber(calculateAverage(filteredResults, 'cendres'), 1)}</TableCell>
                                            <TableCell className="text-right px-4">{formatNumber(calculateAverage(filteredResults, 'densite'), 2)}</TableCell>
                                            <TableCell className="text-right px-4">{formatNumber(calculateAverage(filteredResults, 'granulometrie'), 1)}</TableCell>
                                            <TableCell colSpan={2} className='sticky right-0 bg-muted/40'/>
                                        </TableRow>
                                    </>
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={12} className="h-24 text-center text-muted-foreground">
                                            Aucun résultat trouvé pour les filtres sélectionnés.
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

    