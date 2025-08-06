
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
import { getFuelTypes, type FuelType, getFournisseurs, getSpecifications, type Specification } from "@/lib/data";
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
    h2o: number;
    cendres: number;
    chlore: number;
    densite: number;
    pci_brut: number;
    remarques: string;
}

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
    if (!isValid(parsedDate)) return "Date inconnue";
    return format(parsedDate, "dd/MM/yyyy");
}

export function ResultsTable() {
    const [results, setResults] = useState<Result[]>([]);
    const [specifications, setSpecifications] = useState<Specification[]>([]);
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

    const specMap = useMemo(() => {
        const map = new Map<string, Specification>();
        specifications.forEach(spec => {
            const key = `${spec.combustible}|${spec.fournisseur}`;
            map.set(key, spec);
        });
        return map;
    }, [specifications]);

    const generateAlerts = (result: Result, spec: Specification | undefined) => {
        if (!spec) return [];

        const alerts: string[] = [];
        
        if (spec.pci != null && result.pci_brut < spec.pci) {
            alerts.push("🔥 PCI trop faible");
        }
        if (spec.h2o != null && result.h2o > spec.h2o) {
            alerts.push("💧 Humidité élevée");
        }
        if (spec.chlorures != null && result.chlore > spec.chlorures) {
            alerts.push("🧪 Chlorures élevés");
        }
        if (spec.cendres != null && result.cendres > spec.cendres) {
            alerts.push("⚱️ Cendres élevées");
        }

        return alerts;
    };

    useEffect(() => {
      if (!isClient) return;
      async function fetchData() {
          const [fetchedFuelTypes, fetchedFournisseurs, fetchedSpecs] = await Promise.all([
              getFuelTypes(),
              getFournisseurs(),
              getSpecifications()
          ]);
          setFuelTypes(fetchedFuelTypes);
          setFournisseurs(fetchedFournisseurs);
          setSpecifications(fetchedSpecs);
          setFuelTypeMap(new Map(fetchedFuelTypes.map(fuel => [fuel.name, fuel.icon])));
      }
      fetchData();

      const q = query(collection(db, "resultats"), orderBy("date_arrivage", "desc"));
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
          const resultsData: Result[] = [];
          querySnapshot.forEach((doc) => {
              const data = doc.data();
               if(data.type_combustible !== 'TEST'){
                resultsData.push({ id: doc.id, ...data } as Result);
              }
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
    
    const formatNumber = (num: number | null | undefined, fractionDigits: number = 0) => {
        if (num === null || num === undefined || isNaN(num)) return 'N/A';
        return num.toLocaleString('fr-FR', {
            minimumFractionDigits: fractionDigits,
            maximumFractionDigits: fractionDigits,
            useGrouping: true,
        });
    }

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

        const headers = ["Date", "Type Combustible", "Fournisseur", "PCI sur Brut", "% H2O", "% Cl-", "% Cendres", "Densité", "Alertes", "Remarques"];
        
        const border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
        const titleStyle = { font: { bold: true, sz: 14 }, alignment: { horizontal: "center", vertical: "center" }, fill: { fgColor: { rgb: "E6F4EA" } } };
        const subtitleStyle = { font: { bold: true, sz: 12 }, alignment: { horizontal: "center", vertical: "center" }, fill: { fgColor: { rgb: "E6F4EA" } } };
        const headerStyle = { font: { bold: true, color: { rgb: "000000" } }, alignment: { horizontal: "center", vertical: "center" }, fill: { fgColor: { rgb: "CDE9D6" } }, border };
        
        const baseCellStyle = { border, alignment: { vertical: "center" } };
        const centerAlignStyle = { ...baseCellStyle, alignment: { ...baseCellStyle.alignment, horizontal: "center" } };
        const leftAlignStyle = { ...baseCellStyle, alignment: { ...baseCellStyle.alignment, horizontal: "left", wrapText: true } };
        
        const alertFont = { color: { rgb: "FF0000" } };
        const alertCellStyle = { ...leftAlignStyle, font: alertFont };

        const ws_data: (any)[][] = [
            [ { v: titleText, s: titleStyle } ],
            [ { v: subtitleText, s: subtitleStyle } ],
            [], 
            headers.map(h => ({ v: h, s: headerStyle }))
        ];
        
        ws_data[0] = [...ws_data[0], ...Array(headers.length - 1).fill({v: "", s: titleStyle})];
        ws_data[1] = [...ws_data[1], ...Array(headers.length - 1).fill({v: "", s: subtitleStyle})];


        data.forEach(result => {
            const spec = specMap.get(`${result.type_combustible}|${result.fournisseur}`);
            const alerts = generateAlerts(result, spec);
            const alertText = alerts.length > 0 ? alerts.join(', ') : '✅ Conforme';

            const row = [
                { v: formatDate(result.date_arrivage), s: centerAlignStyle },
                { v: result.type_combustible, s: leftAlignStyle },
                { v: result.fournisseur, s: leftAlignStyle },
                { v: result.pci_brut, s: centerAlignStyle },
                { v: result.h2o, s: centerAlignStyle },
                { v: result.chlore, s: centerAlignStyle },
                { v: result.cendres, s: centerAlignStyle },
                { v: result.densite, s: centerAlignStyle },
                { v: alertText, s: alerts.length > 0 ? alertCellStyle : leftAlignStyle },
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
        if (remarksIndex > -1) colWidths[remarksIndex] = { wch: 30 };
        const alertsIndex = headers.indexOf('Alertes');
        if (alertsIndex > -1) colWidths[alertsIndex] = { wch: 40 };

        ws['!cols'] = colWidths;
        
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Rapport AFR");
        XLSX.writeFile(wb, filename);
    };


    const handleReportDownload = (period: 'daily' | 'weekly' | 'monthly' | 'filtered') => {
        let reportData: Result[];
        let reportType: 'Journalier' | 'Hebdomadaire' | 'Mensuel' | 'Filtré';

        if (period === 'filtered') {
            reportData = filteredResults;
            reportType = 'Filtré';
        } else {
            const now = new Date();
            let startDate: Date;
            const endDate: Date = endOfDay(now);
        
            if (period === 'daily') {
                startDate = startOfDay(subDays(now, 1));
                reportType = 'Journalier';
            } else if (period === 'weekly') {
                startDate = startOfDay(subDays(now, 7));
                reportType = 'Hebdomadaire';
            } else { // monthly
                startDate = startOfDay(subDays(now, 30));
                reportType = 'Mensuel';
            }
        
            reportData = results.filter(result => {
                const dateArrivage = new Date(result.date_arrivage.seconds * 1000);
                return isValid(dateArrivage) && dateArrivage >= startDate && dateArrivage <= endDate;
            });
        }
        
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
                                <DropdownMenuItem onClick={() => handleReportDownload('filtered')}>
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
                                    <TableHead className="text-right text-primary font-bold px-4">PCI sur Brut</TableHead>
                                    <TableHead className="text-right px-4">% H2O</TableHead>
                                    <TableHead className="text-right px-4">% Cl-</TableHead>
                                    <TableHead className="text-right px-4">% Cendres</TableHead>
                                    <TableHead className="text-right px-4">Densité</TableHead>
                                    <TableHead className="px-4 text-center">Alertes</TableHead>
                                    <TableHead className="px-4">Remarques</TableHead>
                                    <TableHead className="w-[50px] text-right px-4 sticky right-0 bg-muted/50">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredResults.length > 0 ? (
                                    <>
                                        {filteredResults.map((result) => {
                                            const spec = specMap.get(`${result.type_combustible}|${result.fournisseur}`);
                                            const alerts = generateAlerts(result, spec);
                                            return (
                                            <TableRow key={result.id}>
                                                <TableCell className="font-medium px-4 sticky left-0 bg-background">{formatDate(result.date_arrivage)}</TableCell>

                                                <TableCell className="px-4 sticky left-[120px] bg-background">
                                                    <div className="flex items-center gap-2">
                                                        <span>{fuelTypeMap.get(result.type_combustible) ?? '❓'}</span>
                                                        <span>{result.type_combustible}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-4">{result.fournisseur}</TableCell>
                                                <TableCell className={cn("font-bold text-right px-4", spec && spec.pci != null && result.pci_brut < spec.pci ? "text-destructive" : "")}>
                                                    {formatNumber(result.pci_brut, 0)}
                                                </TableCell>
                                                <TableCell className={cn("text-right px-4", spec && spec.h2o != null && result.h2o > spec.h2o ? "text-destructive" : "")}>
                                                  {formatNumber(result.h2o, 1)}
                                                </TableCell>
                                                <TableCell className={cn("text-right px-4", spec && spec.chlorures != null && result.chlore > spec.chlorures ? "text-destructive" : "")}>
                                                  {formatNumber(result.chlore, 2)}
                                                </TableCell>
                                                <TableCell className={cn("text-right px-4", spec && spec.cendres != null && result.cendres > spec.cendres ? "text-destructive" : "")}>
                                                  {formatNumber(result.cendres, 1)}
                                                </TableCell>
                                                <TableCell className="text-right px-4">{formatNumber(result.densite, 2)}</TableCell>
                                                <TableCell className={cn(
                                                    "text-center", 
                                                    alerts.length > 0 ? "text-destructive font-bold" : "text-green-600"
                                                )}>
                                                    {spec ? (alerts.length > 0 ? alerts.join(', ') : '✅ Conforme') : ''}
                                                </TableCell>
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
                                        )})}
                                        <TableRow className="bg-muted/40 font-semibold">
                                            <TableCell colSpan={3} className="px-4 sticky left-0 bg-muted/40">Moyenne de la sélection</TableCell>
                                            <TableCell className="text-right text-primary px-4">{formatNumber(calculateAverage(filteredResults, 'pci_brut'), 0)}</TableCell>
                                            <TableCell className="text-right px-4">{formatNumber(calculateAverage(filteredResults, 'h2o'), 1)}</TableCell>
                                            <TableCell className="text-right px-4">{formatNumber(calculateAverage(filteredResults, 'chlore'), 2)}</TableCell>
                                            <TableCell className="text-right px-4">{formatNumber(calculateAverage(filteredResults, 'cendres'), 1)}</TableCell>
                                            <TableCell className="text-right px-4">{formatNumber(calculateAverage(filteredResults, 'densite'), 2)}</TableCell>
                                            <TableCell colSpan={3} className='sticky right-0 bg-muted/40'/>
                                        </TableRow>
                                    </>
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">
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
