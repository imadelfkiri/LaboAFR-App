

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
import { format, startOfDay, endOfDay, subDays, isValid, parseISO, startOfWeek, endOfWeek, startOfMonth, subWeeks, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, XCircle, Trash2, Download, AlertTriangle, CheckCircle2, ChevronDown } from "lucide-react";
import { getSpecifications, SPEC_MAP, getFuelSupplierMap, Specification } from "@/lib/data";
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
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from '@/hooks/use-toast';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { MultiSelect } from '@/components/ui/multi-select';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';


interface Result {
    id: string;
    date_arrivage: { seconds: number; nanoseconds: number } | string;
    type_combustible: string;
    fournisseur: string;
    h2o: number;
    cendres: number | null;
    chlore: number | null;
    pci_brut: number;
    pcs: number;
    densite: number | null;
    remarques: string;
}

interface AggregatedResult {
    type_combustible: string;
    fournisseur: string;
    pci_brut: number | null;
    h2o: number | null;
    chlore: number | null;
    cendres: number | null;
    densite: number | null;
    count: number;
    alerts: {
        text: string;
        isConform: boolean;
        details: {
            pci: boolean;
            h2o: boolean;
            chlore: boolean;
            cendres: boolean;
        }
    };
}


// Extend the jsPDF interface to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
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
    
    function formatDate(date: { seconds: number; nanoseconds: number } | string, formatStr: string = "dd/MM/yyyy"): string {
        const parsedDate = normalizeDate(date);
        if (!parsedDate || !isValid(parsedDate)) return "Date inconnue";
        return format(parsedDate, formatStr, { locale: fr });
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
        if (num === null || num === undefined || isNaN(num)) return '';
        return num.toLocaleString('fr-FR', {
            minimumFractionDigits: fractionDigits,
            maximumFractionDigits: fractionDigits,
            useGrouping: false, 
        }).replace('.', ',');
    };

    const exportToExcel = (data: Result[], reportType: 'Filtré') => {
        if (!data || data.length === 0) {
            toast({ variant: "destructive", title: "Aucune donnée", description: "Il n'y a aucune donnée à exporter." });
            return;
        }
    
        const reportDate = new Date();
        const formattedDate = format(reportDate, 'dd/MM/yyyy');
    
        const titleText = `Rapport ${reportType} du ${formattedDate} analyses des AF`;
        const subtitleText = "Suivi des combustibles solides non dangereux";
        const filename = `Filtré_AFR_Report_${format(reportDate, "yyyy-MM-dd")}.xlsx`;
    
        const headers = ["Date", "Type Combustible", "Fournisseur", "PCS (kcal/kg)", "PCI sur Brut (kcal/kg)", "% H2O", "% Cl-", "% Cendres", "Densité (t/m³)", "Alertes", "Remarques"];
        
        const border = { top: { style: "thin", color: { rgb: "000000" } }, bottom: { style: "thin", color: { rgb: "000000" } }, left: { style: "thin", color: { rgb: "000000" } }, right: { style: "thin", color: { rgb: "000000" } } };
        const titleStyle = { font: { bold: true, sz: 12, color: { rgb: "FFFFFF" } }, alignment: { horizontal: "center", vertical: "center" }, fill: { fgColor: { rgb: "002060" } }, border };
        const headerStyle = { font: { bold: true, color: { rgb: "FFFFFF" } }, alignment: { horizontal: "center", vertical: "center" }, fill: { fgColor: { rgb: "3F51B5" } }, border };
        
        const dataStyleBase = { border, alignment: { vertical: "center" }, fill: { fgColor: { rgb: "F0F8FF" } } };
        const dataStyleCenter = { ...dataStyleBase, alignment: { ...dataStyleBase.alignment, horizontal: "center" } };
        const dataStyleLeft = { ...dataStyleBase, alignment: { ...dataStyleBase.alignment, horizontal: "left", wrapText: true } };
    
        const ws_data: (any)[][] = [];
    
        ws_data.push( Array(headers.length).fill({ v: titleText, s: titleStyle }) );
        ws_data.push( Array(headers.length).fill({ v: subtitleText, s: titleStyle }) );
        ws_data.push( [] ); 
        ws_data.push( headers.map(h => ({ v: h, s: headerStyle })) );
    
        const cleanAlertText = (text: string) => text.endsWith(' / ') ? text.slice(0, -3) : text;
    
        data.forEach(result => {
            const alert = generateAlerts(result);
            const row = [
                { v: formatDate(result.date_arrivage, "dd/MM/yyyy"), s: dataStyleCenter, t: 's' },
                { v: result.type_combustible, s: dataStyleLeft, t: 's' },
                { v: result.fournisseur, s: dataStyleLeft, t: 's' },
                { v: result.pcs, s: dataStyleCenter, t: 'n' },
                { v: result.pci_brut, s: dataStyleCenter, t: 'n' },
                { v: result.h2o, s: dataStyleCenter, t: 'n' },
                { v: result.chlore ?? 'N/A', s: dataStyleCenter, t: result.chlore === null ? 's' : 'n' },
                { v: result.cendres ?? 'N/A', s: dataStyleCenter, t: result.cendres === null ? 's' : 'n' },
                { v: result.densite ?? 'N/A', s: dataStyleCenter, t: result.densite === null ? 's' : 'n' },
                { v: cleanAlertText(alert.text), s: dataStyleLeft, t: 's' },
                { v: result.remarques || '', s: dataStyleLeft, t: 's' },
            ];
            ws_data.push(row);
        });
        
        const ws = XLSX.utils.aoa_to_sheet(ws_data, { cellStyles: true });
    
        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } }
        ];
    
        const colWidths = [
            { wch: 12 }, // Date
            { wch: 20 }, // Type Combustible
            { wch: 20 }, // Fournisseur
            { wch: 15 }, // PCS
            { wch: 22 }, // PCI sur Brut
            { wch: 10 }, // H2O
            { wch: 10 }, // Cl-
            { wch: 10 }, // Cendres
            { wch: 15 }, // Densité
            { wch: 35 }, // Alertes
            { wch: 40 }, // Remarques
        ];
        ws['!cols'] = colWidths;
        
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Rapport AFR");
        XLSX.writeFile(wb, filename, { bookType: 'xlsx', type: 'binary' });
    };

    const getSpecValueColor = (result: Result, field: keyof Result) => {
        const spec = SPEC_MAP.get(`${result.type_combustible}|${result.fournisseur}`);
        if (!spec) return "text-foreground"; 

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

        if (spec.PCI_min !== undefined && spec.PCI_min !== null && result.pci_brut < spec.PCI_min) {
            alerts.push("PCI bas");
        }
        if (spec.H2O_max !== undefined && spec.H2O_max !== null && result.h2o > spec.H2O_max) {
            alerts.push("H2O élevé");
        }
        if (result.chlore !== null && spec.Cl_max !== undefined && spec.Cl_max !== null && result.chlore > spec.Cl_max) {
            alerts.push("Cl- élevé");
        }
        if (result.cendres !== null && spec.Cendres_max !== undefined && spec.Cendres_max !== null && result.cendres > spec.Cendres_max) {
            alerts.push("Cendres élevées");
        }

        if (alerts.length === 0) {
            return { text: "Conforme", color: "text-green-600", isConform: true };
        }

        return { text: alerts.join(' / '), color: "text-red-600", isConform: false };
    };

    const aggregateResults = (data: Result[], checkCendres: boolean = false): AggregatedResult[] => {
        const grouped = new Map<string, { [key in keyof Omit<Result, 'id' | 'date_arrivage' | 'type_combustible' | 'fournisseur' | 'remarques'>]: (number | null)[] } & { count: number }>();
    
        data.forEach(r => {
            const key = `${r.type_combustible}|${r.fournisseur}`;
            if (!grouped.has(key)) {
                grouped.set(key, { pci_brut: [], h2o: [], chlore: [], cendres: [], pcs: [], densite: [], count: 0 });
            }
            const group = grouped.get(key)!;
            group.count++;
            const metrics: (keyof typeof r)[] = ['pci_brut', 'h2o', 'chlore', 'cendres', 'pcs', 'densite'];
            metrics.forEach(metric => {
                const value = r[metric];
                if (metric in group) {
                     (group[metric as keyof typeof group] as (number | null)[]).push(typeof value === 'number' ? value : null);
                }
            });
        });
        
        const aggregated: AggregatedResult[] = [];
        grouped.forEach((value, key) => {
            const [type_combustible, fournisseur] = key.split('|');
            const avg = (arr: (number | null)[]) => {
                 const validNums = arr.filter(n => typeof n === 'number') as number[];
                 return validNums.length > 0 ? validNums.reduce((a, b) => a + b, 0) / validNums.length : null;
            };
            
            const pci_brut = avg(value.pci_brut);
            const h2o = avg(value.h2o);
            const chlore = avg(value.chlore);
            const cendres = avg(value.cendres);
    
            const spec = SPEC_MAP.get(`${type_combustible}|${fournisseur}`);
            const alertMessages: string[] = [];
            const conformity = { pci: true, h2o: true, chlore: true, cendres: true };
    
            if (spec) {
                if (pci_brut !== null && spec.PCI_min !== undefined && spec.PCI_min !== null && pci_brut < spec.PCI_min) {
                    alertMessages.push("PCI bas");
                    conformity.pci = false;
                }
                if (h2o !== null && spec.H2O_max !== undefined && spec.H2O_max !== null && h2o > spec.H2O_max) {
                    alertMessages.push("H2O élevé");
                    conformity.h2o = false;
                }
                if (chlore !== null && spec.Cl_max !== undefined && spec.Cl_max !== null && chlore > spec.Cl_max) {
                    alertMessages.push("Cl- élevé");
                    conformity.chlore = false;
                }
                if (checkCendres && cendres !== null && spec.Cendres_max !== undefined && spec.Cendres_max !== null && cendres > spec.Cendres_max) {
                    alertMessages.push("Cendres élevées");
                    conformity.cendres = false;
                }
            }
            
            const isConform = alertMessages.length === 0;
    
            aggregated.push({
                type_combustible,
                fournisseur,
                pci_brut,
                h2o,
                chlore,
                cendres,
                densite: avg(value.densite),
                count: value.count,
                alerts: {
                    text: isConform ? "Conforme" : alertMessages.join(' / '),
                    isConform,
                    details: conformity
                },
            });
        });
    
        return aggregated.sort((a,b) => a.type_combustible.localeCompare(b.type_combustible) || a.fournisseur.localeCompare(b.fournisseur));
    };
    
    const createStyledCell = (value: number | null, isConform: boolean | null, formatOptions: Intl.NumberFormatOptions = {}) => {
        if (value === null || value === undefined) {
             return { content: '', styles: {} };
        }

        const styles: { textColor?: string } = {};
        if (isConform === false) {
            styles.textColor = '#FF0000'; // Red
        }

        const content = value.toLocaleString('fr-FR', {
            useGrouping: false,
            ...formatOptions,
        }).replace('.', ',');
        
        return { content, styles };
    };

    const createAlertCell = (isConform: boolean, alertText: string) => {
        const styles: { textColor?: string } = {};
        let text = alertText;

        if (isConform) {
            styles.textColor = '#008000'; // Green
            text = `Conforme`;
        } else {
            styles.textColor = '#FF0000'; // Red
        }

        return {
            content: text,
            styles
        };
    };

    const generatePdf = (
        data: any[],
        title: string,
        subtitle: string,
        columns: any[],
        orientation: 'portrait' | 'landscape',
        filename: string
    ) => {
        if (data.length === 0) {
            toast({ variant: 'destructive', title: 'Aucune donnée', description: 'Il n\'y a pas de données à exporter pour cette période.' });
            return;
        }

        const doc = new jsPDF({ orientation });
        const generationDate = format(new Date(), "dd/MM/yyyy HH:mm:ss");

        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(title, doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });

        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(subtitle, doc.internal.pageSize.getWidth() / 2, 22, { align: 'center' });

        doc.autoTable({
            head: [columns.map(c => c.header)],
            body: data,
            startY: 30,
            theme: 'grid',
            headStyles: {
                fillColor: '#CDE9D6',
                textColor: '#000000',
                fontStyle: 'bold'
            },
            alternateRowStyles: {
                fillColor: '#F7FBF9'
            },
            styles: {
                textColor: '#000000',
                halign: 'center'
            },
            columnStyles: {
                0: { halign: 'left' }, // Type Combustible
                1: { halign: 'left' }, // Fournisseur
                5: { halign: 'left' }, // Alertes (daily/weekly)
                6: { halign: 'left' }, // Alertes (monthly)
            },
            didParseCell: (hookData) => {
                if (hookData.section === 'body' && hookData.cell.raw) {
                     const raw = hookData.cell.raw as any;
                     if(raw.styles) {
                         Object.assign(hookData.cell.styles, raw.styles);
                     }
                }
            },
            didDrawPage: (data) => {
                doc.setFontSize(8);
                doc.text(
                    `Généré le: ${generationDate} - Page ${data.pageNumber} sur ${doc.internal.pages.length - 1}`,
                    data.settings.margin.left,
                    doc.internal.pageSize.getHeight() - 10
                );
            },
        });

        doc.save(filename);
    };

    const exportToPdfDaily = () => {
        const today = new Date();
        const yesterday = subDays(today, 1);

        const dailyData = results.filter(r => {
            const d = normalizeDate(r.date_arrivage);
            if (!d || !isValid(d)) return false;
            const dateOnly = startOfDay(d);
            return dateOnly.getTime() === startOfDay(today).getTime() || dateOnly.getTime() === startOfDay(yesterday).getTime();
        }).sort((a,b) => normalizeDate(b.date_arrivage)!.getTime() - normalizeDate(a.date_arrivage)!.getTime());

        const aggregated = aggregateResults(dailyData, false);

        const columns = [
            { header: 'Type Combustible', dataKey: 'type' },
            { header: 'Fournisseur', dataKey: 'fournisseur' },
            { header: 'PCI sur Brut', dataKey: 'pci' },
            { header: '% H2O', dataKey: 'h2o' },
            { header: '% Cl-', dataKey: 'cl' },
            { header: 'Alertes', dataKey: 'alerts' },
        ];
        
        const body = aggregated.map(r => {
            return [
                r.type_combustible,
                r.fournisseur,
                createStyledCell(r.pci_brut, r.alerts.details.pci, {maximumFractionDigits: 0}),
                createStyledCell(r.h2o, r.alerts.details.h2o, {minimumFractionDigits: 1, maximumFractionDigits: 1}),
                createStyledCell(r.chlore, r.alerts.details.chlore, {minimumFractionDigits: 2, maximumFractionDigits: 2}),
                createAlertCell(r.alerts.isConform, r.alerts.text),
            ];
        });

        generatePdf(
            body,
            'Suivi des analyses des combustibles solides non dangereux',
            `Rapport journalier ${format(yesterday, 'dd/MM')} - ${format(today, 'dd/MM/yyyy')}`,
            columns,
            'landscape',
            `Rapport_Journalier_AFR_${format(today, 'yyyy-MM-dd')}.pdf`
        );
    };

    const exportToPdfWeekly = () => {
        const today = new Date();
        const start = startOfWeek(today.getDay() === 1 ? subWeeks(today, 1) : today, { weekStartsOn: 1 });
        const end = endOfWeek(start, { weekStartsOn: 1 });
        
        const weeklyData = results.filter(r => {
                const d = normalizeDate(r.date_arrivage);
                return d && isValid(d) && d >= start && d <= end;
            })
            .sort((a,b) => normalizeDate(b.date_arrivage)!.getTime() - normalizeDate(a.date_arrivage)!.getTime());
        
        const aggregated = aggregateResults(weeklyData, false);

        const columns = [
            { header: 'Type Combustible', dataKey: 'type' },
            { header: 'Fournisseur', dataKey: 'fournisseur' },
            { header: 'PCI sur Brut', dataKey: 'pci' },
            { header: '% H2O', dataKey: 'h2o' },
            { header: '% Cl-', dataKey: 'cl' },
            { header: 'Alertes', dataKey: 'alerts' },
        ];

        const body = aggregated.map(r => {
            return [
                r.type_combustible,
                r.fournisseur,
                createStyledCell(r.pci_brut, r.alerts.details.pci, {maximumFractionDigits: 0}),
                createStyledCell(r.h2o, r.alerts.details.h2o, {minimumFractionDigits: 1, maximumFractionDigits: 1}),
                createStyledCell(r.chlore, r.alerts.details.chlore, {minimumFractionDigits: 2, maximumFractionDigits: 2}),
                createAlertCell(r.alerts.isConform, r.alerts.text),
            ];
        });

        generatePdf(
            body,
            'Suivi des analyses des combustibles solides non dangereux',
            `Rapport hebdomadaire semaine du ${format(start, 'dd MMMM', { locale: fr })}`,
            columns,
            'landscape',
            `Rapport_Hebdo_AFR_Semaine_du_${format(start, 'yyyy-MM-dd')}.pdf`
        );
    };

    const exportToPdfMonthly = () => {
        const today = new Date();
        const start = startOfMonth(today);
        const end = endOfMonth(today);

        const monthlyData = results.filter(r => {
                const d = normalizeDate(r.date_arrivage);
                return d && isValid(d) && d >= start && d <= end;
            })
            .sort((a,b) => normalizeDate(b.date_arrivage)!.getTime() - normalizeDate(a.date_arrivage)!.getTime());
        
        const aggregated = aggregateResults(monthlyData, true);
        
        const columns = [
            { header: 'Type Combustible', dataKey: 'type' },
            { header: 'Fournisseur', dataKey: 'fournisseur' },
            { header: 'PCI sur Brut', dataKey: 'pci' },
            { header: '% H2O', dataKey: 'h2o' },
            { header: '% Cl-', dataKey: 'cl' },
            { header: '% Cendres', dataKey: 'cendres' },
            { header: 'Densité', dataKey: 'densite' },
            { header: 'Alertes', dataKey: 'alerts' },
        ];
        
        const body = aggregated.map(r => {
           return [
                r.type_combustible,
                r.fournisseur,
                createStyledCell(r.pci_brut, r.alerts.details.pci, {maximumFractionDigits: 0}),
                createStyledCell(r.h2o, r.alerts.details.h2o, {minimumFractionDigits: 1, maximumFractionDigits: 1}),
                createStyledCell(r.chlore, r.alerts.details.chlore, {minimumFractionDigits: 2, maximumFractionDigits: 2}),
                createStyledCell(r.cendres, r.alerts.details.cendres, {minimumFractionDigits: 1, maximumFractionDigits: 1}),
                createStyledCell(r.densite, null, {minimumFractionDigits: 3, maximumFractionDigits: 3}),
                createAlertCell(r.alerts.isConform, r.alerts.text),
            ];
        });

        generatePdf(
            body,
            'Suivi des analyses des combustibles solides non dangereux',
            `Rapport mensuel ${format(today, 'MMMM yyyy', { locale: fr })}`,
            columns,
            'landscape',
            `Rapport_Mensuel_AFR_${format(today, 'yyyy-MM')}.pdf`
        );
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
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="w-full sm:w-auto bg-white hover:bg-green-50 border-green-300 text-gray-800">
                                <Download className="mr-2 h-4 w-4" />
                                <span>Exporter</span>
                                <ChevronDown className="ml-2 h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={exportToPdfDaily}>
                                    Rapport Journalier (PDF)
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={exportToPdfWeekly}>
                                    Rapport Hebdomadaire (PDF)
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={exportToPdfMonthly}>
                                    Rapport Mensuel (PDF)
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => exportToExcel(filteredResults, 'Filtré')}>
                                    Exporter la vue filtrée (Excel)
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
                                    <TableHead className="px-4 font-bold">Alertes</TableHead>
                                    <TableHead className="px-4 sticky right-[50px] bg-muted/50">Remarques</TableHead>
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
                                                <TableCell className="max-w-[200px] truncate text-muted-foreground px-4 sticky right-[50px] bg-background">
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
