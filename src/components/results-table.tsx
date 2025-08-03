
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
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
import { CalendarIcon, XCircle, Trash2, Download, ChevronDown, FileOutput, FileText, Plus } from "lucide-react";
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
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { heidelbergLogo, asmentLogo } from '@/lib/assets';


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
    pcs: number;
    pci_brut: number;
    h2o: number;
    cendres: number;
    chlore: number;
    densite: number;
    granulometrie: number;
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
  if (!spec || spec.pci_min === undefined) return "";
  return value < spec.pci_min ? "text-red-600 font-bold" : "text-green-600";
};

const getCustomColor = (
  value: number,
  combustible: string,
  fournisseur: string,
  param: "h2o" | "chlore" | "cendres"
) => {
  const key = `${combustible}|${fournisseur}`;
  const spec = specMap[key];
  if (!spec || spec[param] === undefined) return "";
  const threshold = spec[param];
  if (threshold === undefined) return "";
  return value > threshold ? "text-red-600 font-bold" : "text-green-600";
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
            return roundedNum.toLocaleString('fr-FR');
        }
        return roundedNum.toLocaleString('fr-FR', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits });
    }

    const convertIndividualToCSV = (data: Result[]) => {
        const headers = [
            "Date Arrivage", "Type Combustible", "Fournisseur", 
            "PCS", "PCI sur Brut", "% H2O", "% Cl-", "% Cendres", 
            "Densité", "Granulométrie", "Remarques"
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
            formatNumber(result.granulometrie, 1),
            `"${result.remarques || ''}"`
        ].join(';'));
        return [headers.join(';'), ...rows].join('\n');
    };

    const convertAggregatedToCSV = (data: AggregatedResult[]) => {
        const headers = [
            "Type Combustible", "Analyses", "PCS Moyen", "PCI Moyen", 
            "% H2O Moyen", "% Cl- Moyen", "% Cendres Moyen", "Densité Moyenne", "Granulométrie Moyenne"
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
            formatNumber(result.granulometrie, 1),
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
    
    const exportToPDF = (data: Result[] | AggregatedResult[], title: string, period: string, isAggregated: boolean) => {
      if (data.length === 0) {
        toast({
            variant: "destructive",
            title: "Aucune donnée",
            description: `Il n'y a aucune donnée à exporter en PDF pour la sélection.`,
        });
        return;
      }

      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;

      // Header
      doc.setFillColor(229, 245, 235); // vert très clair (correspond à #E5F5EB)
      doc.rect(0, 0, pageWidth, 30, 'F'); // Fond du bandeau

      if (heidelbergLogo && typeof heidelbergLogo === 'string' && heidelbergLogo.startsWith('data:image/')) {
        doc.addImage(heidelbergLogo, 'PNG', margin, 10, 30, 10);
      }
      if (asmentLogo && typeof asmentLogo === 'string' && asmentLogo.startsWith('data:image/')) {
        doc.addImage(asmentLogo, 'PNG', pageWidth - margin - 25, 10, 25, 10);
      }

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(51, 51, 51); // #333333
      doc.text(title, pageWidth / 2, 14, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text("Suivi des analyses des combustibles solides non dangereux", pageWidth / 2, 22, { align: 'center' });

      doc.setDrawColor(170, 170, 170); // #AAAAAA
      doc.line(margin, 28, pageWidth - margin, 28);
      
      doc.setFontSize(9);
      doc.setTextColor(51, 51, 51);
      doc.text(`Période: ${period}`, margin, 38);

      // Table
      const headStyles = {
          fillColor: [229, 245, 235],
          textColor: [0, 102, 68], // #006644
          fontStyle: 'bold',
          halign: 'center',
      };
      const alternateRowStyles = { fillColor: [250, 250, 250] }; // #FAFAFA
      
      const pdfNumber = (num: any, fractionDigits = 2) => {
        if (num === null || num === undefined || isNaN(num)) return 'N/A';
        
        const options: Intl.NumberFormatOptions = {
            minimumFractionDigits: fractionDigits,
            maximumFractionDigits: fractionDigits,
            useGrouping: true,
        };
        
        // Use a space as a thousands separator for French locale
        return new Intl.NumberFormat('fr-FR', options).format(num);
      };

      let head: any[], body: any[];

      if (isAggregated) {
          head = [["Combustible", "Analyses", "PCI Moyen", "% H₂O Moyen", "% Cl⁻ Moyen", "% Cendres Moyen"]];
          body = (data as AggregatedResult[]).map(r => [
              r.type_combustible,
              r.count,
              pdfNumber(r.pci_brut, 0),
              pdfNumber(r.h2o, 1),
              pdfNumber(r.chlore, 2),
              pdfNumber(r.cendres, 1)
          ]);
      } else {
          head = [["Date", "Combustible", "Fournisseur", "PCI", "% H₂O", "% Cl⁻", "% Cendres"]];
          body = (data as Result[]).map(r => [
              formatDate(r.date_arrivage),
              r.type_combustible,
              r.fournisseur,
              pdfNumber(r.pci_brut, 0),
              pdfNumber(r.h2o, 1),
              pdfNumber(r.chlore, 2),
              pdfNumber(r.cendres, 1)
          ]);
      }

      autoTable(doc, {
          head,
          body,
          startY: 42,
          theme: 'grid',
          headStyles,
          alternateRowStyles,
          styles: { fontSize: 8, cellPadding: 2 },
          columnStyles: {
              0: { halign: 'left' },
              1: { halign: 'left' },
              2: { halign: 'left' },
              3: { halign: 'right' },
              4: { halign: 'right' },
              5: { halign: 'right' },
              6: { halign: 'right' },
          }
      });
      
      // Footer
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(136, 136, 136); // #888888
      doc.text("ER.CTR.22 Version 5 du janvier 2026", margin, pageHeight - 10);
      doc.text("Document généré automatiquement par FuelTrack AFR", pageWidth / 2, pageHeight - 10, { align: 'center' });

      doc.save(`${title.replace(/\s/g, '_')}.pdf`);
    }

    const handleFilteredExport = (exportType: 'csv' | 'pdf') => {
        const fromDate = dateFilter?.from;
        const toDate = dateFilter?.to;
    
        let period = "Période personnalisée";
        if (isValid(fromDate)) {
          period = `Du ${format(fromDate as Date, "dd/MM/yy")} au ${isValid(toDate) ? format(toDate as Date, "dd/MM/yy") : '...'}`;
        } else {
          period = "Toutes les dates"
        }
        
        const filename = `Export_Filtre_${isValid(new Date()) ? format(new Date(), "yyyy-MM-dd") : 'custom'}`;
    
        if (exportType === 'csv') {
          const csvString = convertIndividualToCSV(filteredResults);
          downloadCSV(csvString, filename);
        } else {
          exportToPDF(filteredResults, 'Rapport Vue Filtrée', period, false);
        }
    };
    
    const handleReportDownload = (period: 'daily' | 'weekly' | 'monthly', exportType: 'csv' | 'pdf') => {
        const now = new Date();
        let startDate: Date;
        let endDate: Date = endOfDay(now);
        let filename: string;
        let title: string;
        let periodStr: string;
    
        if (!isValid(now)) {
            toast({ variant: "destructive", title: "Date système invalide", description: "Impossible de générer le rapport." });
            return;
        }
    
        if (period === 'daily') {
            startDate = startOfDay(subDays(now, 1));
            filename = `Rapport_Journalier_${format(now, 'yyyy-MM-dd')}`;
            title = 'Rapport Journalier des Résultats AFR';
            periodStr = isValid(startDate) ? format(startDate, 'dd MMMM yyyy', { locale: fr }) : "Date inconnue";
        } else if (period === 'weekly') {
            startDate = startOfDay(subDays(now, 7));
            filename = `Rapport_Hebdomadaire_${format(now, 'yyyy-MM-dd')}`;
            title = 'Rapport Hebdomadaire des Résultats AFR';
            periodStr = `Du ${isValid(startDate) ? format(startDate, 'dd/MM/yy') : '...'} au ${isValid(endDate) ? format(endDate, 'dd/MM/yy') : '...'}`;
        } else { // monthly
            startDate = startOfDay(subDays(now, 30));
            filename = `Rapport_Mensuel_${format(now, 'yyyy-MM')}`;
            title = 'Rapport Mensuel des Résultats AFR';
            periodStr = `Du ${isValid(startDate) ? format(startDate, 'dd/MM/yy') : '...'} au ${isValid(endDate) ? format(endDate, 'dd/MM/yy') : '...'}`;
        }
    
        const reportData = results.filter(result => {
            const dateArrivage = new Date(result.date_arrivage.seconds * 1000);
            return isValid(dateArrivage) && dateArrivage >= startDate && dateArrivage <= endDate;
        });
    
        if (period === 'daily') {
             if (exportType === 'csv') {
                const csvString = convertIndividualToCSV(reportData);
                downloadCSV(csvString, filename);
            } else {
                exportToPDF(reportData, title, periodStr, false);
            }
        } else {
            const aggregatedData = aggregateResults(reportData);
            if (exportType === 'csv') {
                const csvString = convertAggregatedToCSV(aggregatedData);
                downloadCSV(csvString, filename);
            } else {
                exportToPDF(aggregatedData, title, periodStr, true);
            }
        }
    };
    

    const aggregateResults = (data: Result[]): AggregatedResult[] => {
        const aggregation: Record<string, AggregatedResult> = {};

        data.forEach(result => {
            if (!aggregation[result.type_combustible]) {
                aggregation[result.type_combustible] = {
                    type_combustible: result.type_combustible,
                    pcs: 0, pci_brut: 0, h2o: 0, cendres: 0, chlore: 0, densite: 0, granulometrie: 0, count: 0
                };
            }
            const current = aggregation[result.type_combustible];
            current.pcs += result.pcs;
            current.pci_brut += result.pci_brut;
            current.h2o += result.h2o;
            current.cendres += result.cendres;
            current.chlore += result.chlore;
            current.densite += result.densite;
            current.granulometrie += result.granulometrie;
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
            granulometrie: agg.granulometrie / agg.count,
        }));
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
                                    <span>Rapport</span>
                                    <ChevronDown className="ml-2 h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleReportDownload('daily', 'pdf')}>
                                    <FileText className="mr-2 h-4 w-4"/>
                                    Rapport Journalier (PDF)
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleReportDownload('weekly', 'pdf')}>
                                    <FileText className="mr-2 h-4 w-4"/>
                                    Rapport Hebdomadaire (PDF)
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleReportDownload('monthly', 'pdf')}>
                                    <FileText className="mr-2 h-4 w-4"/>
                                    Rapport Mensuel (PDF)
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleFilteredExport('pdf')}>
                                    <FileText className="mr-2 h-4 w-4"/>
                                    Exporter la vue filtrée (PDF)
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                 <DropdownMenuItem onClick={() => handleReportDownload('daily', 'csv')}>
                                    <FileOutput className="mr-2 h-4 w-4"/>
                                    Rapport Journalier (CSV)
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleReportDownload('weekly', 'csv')}>
                                     <FileOutput className="mr-2 h-4 w-4"/>
                                    Rapport Hebdomadaire (CSV)
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleReportDownload('monthly', 'csv')}>
                                     <FileOutput className="mr-2 h-4 w-4"/>
                                    Rapport Mensuel (CSV)
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleFilteredExport('csv')}>
                                    <FileOutput className="mr-2 h-4 w-4"/>
                                    Exporter la vue filtrée (CSV)
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


    

    

    