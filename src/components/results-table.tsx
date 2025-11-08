

"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  doc,
  deleteDoc,
  Timestamp,
  where,
  getDocs,
  writeBatch,
  updateDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  format,
  startOfDay,
  endOfDay,
  isValid,
  parseISO,
  parse,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subMonths,
  subDays
} from "date-fns";
import { fr } from "date-fns/locale";
import {
  Calendar as CalendarIcon,
  Trash2,
  Download,
  Upload,
  Plus,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ArrowUpDown,
  Edit,
} from "lucide-react";
import { getSpecifications, SPEC_MAP, deleteAllResults, getFuelData, type FuelData, addManyResults, updateResult } from "@/lib/data";
import { calculerPCI, calculerPCS } from "@/lib/pci";
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
import XLSX from "xlsx";
import * as z from "zod";
import { Skeleton } from "./ui/skeleton";
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuPortal } from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  FormLabel,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

interface Result {
  id: string;
  date_arrivage: { seconds: number; nanoseconds: number } | string;
  type_analyse: string;
  type_combustible: string;
  fournisseur: string;
  tonnage?: number | null;
  pcs: number | null;
  h2o: number;
  cendres: number | null;
  chlore: number | null;
  pci_brut: number | null;
  poids_godet: number | null;
  remarques: string;
  taux_metal?: number | null;
}

type SortableKeys = keyof Result | 'pci' | 'h2o' | 'chlore' | 'cendres';

declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

const formatNumberForPdf = (num: number | null | undefined, fractionDigits: number = 0): string => {
    if (num === null || num === undefined || Number.isNaN(num)) return "-";
    
    const fixed = num.toFixed(fractionDigits);
    const [integerPart, decimalPart] = fixed.split('.');
    
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");

    return decimalPart ? `${formattedInteger},${decimalPart}` : formattedInteger;
};


const editSchema = z.object({
  pcs: z.coerce.number().positive(),
  h2o: z.coerce.number().min(0).max(100),
  tonnage: z.coerce.number().min(0).optional().nullable(),
  chlore: z.coerce.number().min(0).optional().nullable(),
  cendres: z.coerce.number().min(0).optional().nullable(),
  remarques: z.string().optional().nullable(),
  taux_metal: z.coerce.number().min(0).max(100).optional().nullable(),
});

const importSchema = z.object({
  date_arrivage: z.date({ required_error: "Date requise ou invalide." }),
  type_analyse: z.string().optional().nullable(),
  type_combustible: z.string().nonempty({message: "Le type de combustible est requis."}),
  fournisseur: z.string().nonempty({message: "Le fournisseur est requis."}),
  tonnage: z.coerce.number({invalid_type_error: "Tonnage doit être un nombre."}).optional().nullable(),
  pcs: z.coerce.number({invalid_type_error: "PCS doit être un nombre."}).optional().nullable(),
  pci_brut: z.coerce.number({invalid_type_error: "PCI Brut doit être un nombre."}).optional().nullable(),
  h2o: z.coerce.number({invalid_type_error: "H2O doit être un nombre."}).min(0).max(100),
  chlore: z.coerce.number({invalid_type_error: "Chlore doit être un nombre."}).min(0).optional().nullable(),
  cendres: z.coerce.number({invalid_type_error: "Cendres doit être un nombre."}).min(0).optional().nullable(),
  remarques: z.string().optional().nullable(),
  taux_metal: z.coerce.number().min(0).max(100).optional().nullable(),
});

export default function ResultsTable() {
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [fuelTypeFilter, setFuelTypeFilter] = useState('__ALL__');
  const [fournisseurFilter, setFournisseurFilter] = useState('__ALL__');
  const [analysisTypeFilter, setAnalysisTypeFilter] = useState('__ALL__');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  
  const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: 'ascending' | 'descending' }>({ key: 'date_arrivage', direction: 'descending' });

  const [resultToDelete, setResultToDelete] = useState<string | null>(null);
  const [isDeleteAllConfirmOpen, setIsDeleteAllConfirmOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fuelDataMap, setFuelDataMap] = useState<Map<string, FuelData>>(new Map());
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingResult, setEditingResult] = useState<Result | null>(null);

  const { toast } = useToast();

  const form = useForm<z.infer<typeof editSchema>>({
    resolver: zodResolver(editSchema),
  });

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      await getSpecifications(); // This populates SPEC_MAP
      const fuelData = await getFuelData();
      setFuelDataMap(new Map(fuelData.map(fd => [fd.nom_combustible, fd])));
    } catch (error) {
       console.error("Error fetching initial data:", error);
       toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les données de base."});
    }

    const unsubscribe = onSnapshot(query(collection(db, "resultats"), orderBy("date_arrivage", "desc")), (snapshot) => {
      const resultsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Result));
      setResults(resultsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching results with snapshot:", error);
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les résultats en temps réel."});
      setLoading(false);
    });

    return unsubscribe;
  }, [toast]);
  
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    fetchInitialData().then(unsub => unsubscribe = unsub);
    return () => {
        if (unsubscribe) {
            unsubscribe();
        }
    };
  }, [fetchInitialData]);

  const normalizeDate = (date: { seconds: number; nanoseconds: number } | string): Date | null => {
    if (typeof date === "string") {
      const parsed = parseISO(date);
      return isValid(parsed) ? parsed : null;
    }
    if (date && typeof date.seconds === "number") {
      return new Timestamp(date.seconds, date.nanoseconds).toDate();
    }
    return null;
  };

  const getSortableValue = (item: Result, key: SortableKeys) => {
    if (key === 'date_arrivage') {
        const date = normalizeDate(item.date_arrivage);
        return date ? date.getTime() : 0;
    }
    
    const dataKeyMap = {
        pci: 'pci_brut',
        h2o: 'h2o',
        chlore: 'chlore',
        cendres: 'cendres',
    };
    const dataKey = dataKeyMap[key as keyof typeof dataKeyMap] || key;

    const value = item[dataKey as keyof Result];
    return value === null || value === undefined ? -Infinity : (typeof value === 'string' ? value.toLowerCase() : value);
  };
  
  const requestSort = (key: SortableKeys) => {
      let direction: 'ascending' | 'descending' = 'ascending';
      if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
          direction = 'descending';
      }
      setSortConfig({ key, direction });
  };
  
  const sortedAndFilteredResults = useMemo(() => {
    let filtered = [...results];

    if (fuelTypeFilter !== '__ALL__') {
      filtered = filtered.filter(result => result.type_combustible === fuelTypeFilter);
    }
    if (fournisseurFilter !== '__ALL__') {
      filtered = filtered.filter(result => result.fournisseur === fournisseurFilter);
    }
    if (analysisTypeFilter !== '__ALL__') {
      filtered = filtered.filter(result => (result.type_analyse || 'Arrivage') === analysisTypeFilter);
    }
    if (dateRange?.from || dateRange?.to) {
        filtered = filtered.filter(result => {
            const dateArrivage = normalizeDate(result.date_arrivage);
            if (!dateArrivage) return false;
            const fromMatch = !dateRange.from || dateArrivage >= startOfDay(dateRange.from);
            const toMatch = !dateRange.to || dateArrivage <= endOfDay(dateRange.to);
            return fromMatch && toMatch;
        });
    }

    if (sortConfig !== null) {
      filtered.sort((a, b) => {
        const aValue = getSortableValue(a, sortConfig.key);
        const bValue = getSortableValue(b, sortConfig.key);
        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }

    return filtered;
  }, [results, fuelTypeFilter, fournisseurFilter, analysisTypeFilter, dateRange, sortConfig]);

  const { uniqueFuelTypes, uniqueAnalysisTypes, availableSuppliers } = useMemo(() => {
    const allFuels = [...new Set(results.map(r => r.type_combustible))].sort();
    const allAnalysisTypes = [...new Set(results.map(r => r.type_analyse || 'Arrivage'))].sort();
    
    let fuelFilteredResults = results;
    if (fuelTypeFilter !== '__ALL__') {
        fuelFilteredResults = results.filter(r => r.type_combustible === fuelTypeFilter);
    }
    const suppliersInFiltered = [...new Set(fuelFilteredResults.map(r => r.fournisseur))].sort();

    return {
      uniqueFuelTypes: allFuels,
      uniqueAnalysisTypes: allAnalysisTypes,
      availableSuppliers: suppliersInFiltered
    };
  }, [results, fuelTypeFilter]);

  const formatNumber = (num: number | null | undefined, fractionDigits: number = 0): string => {
    if (num === null || num === undefined || Number.isNaN(num)) return "-";
    return num.toLocaleString('fr-FR', {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
    }).replace(/\u00A0/g, ' ');
  };

  useEffect(() => {
      if (fournisseurFilter !== '__ALL__' && !availableSuppliers.includes(fournisseurFilter)) {
          setFournisseurFilter('__ALL__');
      }
  }, [fuelTypeFilter, fournisseurFilter, availableSuppliers]);

  const handleDelete = async () => {
    if (!resultToDelete) return;
    try {
      await deleteDoc(doc(db, "resultats", resultToDelete));
      toast({ title: "Succès", description: "L'enregistrement a été supprimé." });
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
      toast({ variant: "destructive", title: "Erreur", description: "La suppression a échoué." });
    } finally {
      setResultToDelete(null);
    }
  };

  const handleDeleteAll = async () => {
    try {
      await deleteAllResults();
      toast({ title: "Succès", description: "Tous les résultats ont été supprimés." });
    } catch (error) {
      console.error("Erreur lors de la suppression de tous les résultats :", error);
      toast({ variant: "destructive", title: "Erreur", description: "La suppression a échoué." });
    } finally {
      setIsDeleteAllConfirmOpen(false);
    }
  };

  const handleEditOpen = (result: Result) => {
    setEditingResult(result);
    form.reset({
        pcs: result.pcs ?? undefined,
        h2o: result.h2o,
        tonnage: result.tonnage,
        chlore: result.chlore,
        cendres: result.cendres,
        remarques: result.remarques,
        taux_metal: result.taux_metal,
    });
    setIsEditModalOpen(true);
  };

  const onEditSubmit = async (values: z.infer<typeof editSchema>) => {
    if (!editingResult) return;
    try {
        const hValue = fuelDataMap.get(editingResult.type_combustible)?.teneur_hydrogene;
        if (hValue === undefined || hValue === null) {
            throw new Error(`Teneur en hydrogène non définie pour ${editingResult.type_combustible}.`);
        }
        
        let pcsToUse = values.pcs;
        const metalRate = values.taux_metal;
        if (metalRate !== null && metalRate !== undefined && metalRate > 0) {
            pcsToUse = pcsToUse * (1 - metalRate / 100);
        }
        const pci_brut = calculerPCI(pcsToUse, values.h2o, hValue);

        const dataToUpdate: {[key: string]: any} = {
            ...values,
            pci_brut,
        };

        // Convert empty optional number fields to null instead of NaN
        for (const key in dataToUpdate) {
            if (key !== 'remarques' && (dataToUpdate[key] === undefined || isNaN(dataToUpdate[key]))) {
                 dataToUpdate[key] = null;
            }
        }
        dataToUpdate.remarques = dataToUpdate.remarques || "";


        await updateResult(editingResult.id, dataToUpdate);
        toast({ title: "Succès", description: "Résultat mis à jour."});
        setIsEditModalOpen(false);
        setEditingResult(null);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Une erreur inconnue est survenue.";
        toast({ variant: "destructive", title: "Erreur de mise à jour", description: errorMessage });
    }
  };

    const excelDateToJSDate = (serial: number) => {
        const utc_days  = Math.floor(serial - 25569);
        const utc_value = utc_days * 86400;                                        
        const date_info = new Date(utc_value * 1000);
        const fractional_day = serial - Math.floor(serial) + 0.0000001;
        let total_seconds = Math.floor(86400 * fractional_day);
        const seconds = total_seconds % 60;
        total_seconds -= seconds;
        const hours = Math.floor(total_seconds / (60 * 60));
        const minutes = Math.floor(total_seconds / 60) % 60;
        return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate(), hours, minutes, seconds);
    }

    const parseDate = (value: any, rowNum: number): Date => {
        if (value === null || value === undefined) {
            throw new Error(`Date vide non autorisée à la ligne ${rowNum}.`);
        }

        if (value instanceof Date && isValid(value)) {
            return value;
        }

        if (typeof value === 'number') {
            const date = excelDateToJSDate(value);
            if (isValid(date)) return date;
        }
        
        if (typeof value === 'string') {
            const dateFormats = [
                'dd/MM/yyyy', 'd/M/yyyy', 'dd-MM-yyyy', 'd-M-yyyy', 'dd/MM/yy', 'd/M/yy'
            ];
            for (const fmt of dateFormats) {
                const date = parse(value, fmt, new Date());
                if (isValid(date)) return date;
            }
        }
        
        throw new Error(`Format de date non reconnu à la ligne ${rowNum} pour la valeur "${value}".`);
    }

    const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                if (!worksheet) {
                    throw new Error(`Impossible de trouver la première feuille de calcul.`);
                }
                
                const allData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, dateNF:'dd/mm/yyyy' });

                if (allData.length < 4) {
                    throw new Error("Le fichier est vide ou ne contient pas assez de lignes pour les en-têtes et les données.");
                }

                let headerRowIndex = -1;
                for (let i = 0; i < allData.length; i++) {
                    const row = allData[i];
                    if (row && row.some(cell => typeof cell === 'string' && cell.trim().toLowerCase() === 'date arrivage')) {
                        headerRowIndex = i;
                        break;
                    }
                }

                if (headerRowIndex === -1) {
                    throw new Error("Impossible de trouver la ligne d'en-tête (doit contenir 'Date Arrivage').");
                }
                
                const headers: string[] = allData[headerRowIndex].map((h: any) => String(h));
                const dataRows = allData.slice(headerRowIndex + 1);

                const headerMapping: { [key: string]: string } = {
                    'date arrivage': 'date_arrivage',
                    'type combustible': 'type_combustible',
                    'fournisseur': 'fournisseur',
                    'tonnage (t)': 'tonnage',
                    'pcs sur sec (kcal/kg)': 'pcs',
                    'pci sur brut (kcal/kg)': 'pci_brut',
                    '% h2o': 'h2o',
                    '% cl-': 'chlore',
                    '% cendres': 'cendres',
                    'remarques': 'remarques',
                };
                
                const mappedHeaders = headers.map(h => {
                    const normalized = h.trim().toLowerCase();
                    return headerMapping[normalized] || h;
                });
                
                const parsedResults = dataRows.map((row, rowIndex) => {
                    const rowNum = headerRowIndex + rowIndex + 2; 
                    try {
                        const rowData: { [key: string]: any } = {};
                        mappedHeaders.forEach((key, index) => {
                            rowData[key] = row[index];
                        });

                        const validatedData = importSchema.partial().parse({
                            ...rowData,
                            date_arrivage: parseDate(rowData.date_arrivage, rowNum),
                        });

                        if (!validatedData.type_combustible || !validatedData.fournisseur || validatedData.h2o === null || validatedData.h2o === undefined || !validatedData.date_arrivage) {
                            throw new Error("Les colonnes 'Date Arrivage', 'Type Combustible', 'Fournisseur' et '% H2O' sont obligatoires.");
                        }

                        const hValue = fuelDataMap.get(validatedData.type_combustible)?.teneur_hydrogene;
                        if (hValue === undefined || hValue === null) {
                            throw new Error(`Teneur en hydrogène non définie pour "${validatedData.type_combustible}".`);
                        }

                        let finalPci: number | null = null;
                        let finalPcs: number | null = null;

                        if (validatedData.pci_brut !== null && validatedData.pci_brut !== undefined) {
                            finalPci = validatedData.pci_brut;
                            finalPcs = calculerPCS(finalPci, validatedData.h2o, hValue);
                        } else if (validatedData.pcs !== null && validatedData.pcs !== undefined) {
                            finalPcs = validatedData.pcs;
                            finalPci = calculerPCI(finalPcs, validatedData.h2o, hValue);
                        } else {
                            throw new Error(`Ni "PCS" ni "PCI Brut" n'est fourni.`);
                        }

                        if (finalPci === null || finalPcs === null) {
                            throw new Error(`Calcul de PCI/PCS impossible. Vérifiez les valeurs.`);
                        }
                        
                        return {
                            ...validatedData,
                            type_analyse: 'Arrivage',
                            pcs: finalPcs,
                            pci_brut: finalPci,
                            date_creation: Timestamp.now(),
                            date_arrivage: Timestamp.fromDate(validatedData.date_arrivage)
                        };

                    } catch (error) {
                        const errorMessage = error instanceof z.ZodError 
                            ? error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') 
                            : error instanceof Error ? error.message : "Erreur inconnue.";
                        throw new Error(`Ligne ${rowNum}: ${errorMessage}`);
                    }
                }).filter((r): r is NonNullable<typeof r> => !!r);

                await addManyResults(parsedResults as any);
                toast({ title: "Succès", description: `${parsedResults.length} résultats ont été importés.` });

            } catch (error) {
                console.error("Error importing file:", error);
                const errorMessage = error instanceof Error ? error.message : "Une erreur inconnue est survenue.";
                toast({ variant: "destructive", title: "Erreur d'importation", description: errorMessage, duration: 9000 });
            } finally {
                if (fileInputRef.current) fileInputRef.current.value = "";
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const aggregateResults = (data: Result[]) => {
      const grouped = new Map<string, Result[]>();
      data.forEach(result => {
          const key = `${result.type_combustible}|${result.fournisseur}`;
          if (!grouped.has(key)) {
              grouped.set(key, []);
          }
          grouped.get(key)!.push(result);
      });

      const aggregated: any[] = [];
      grouped.forEach((results, key) => {
          const [type_combustible, fournisseur] = key.split('|');
          const avg = (metric: keyof Result) => {
              const values = results.map(r => r[metric]).filter((v): v is number => typeof v === 'number' && isFinite(v));
              return values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : null;
          };
          aggregated.push({
              "Type Combustible": type_combustible,
              "Fournisseur": fournisseur,
              "Analyses": results.length,
              "Tonnage (t)": results.reduce((s, r) => s + (r.tonnage ?? 0), 0),
              "PCS sur sec (kcal/kg)": avg('pcs'),
              "PCI sur Brut (kcal/kg)": avg('pci_brut'),
              "% H2O": avg('h2o'),
              "% Cl-": avg('chlore'),
              "% Cendres": avg('cendres'),
          });
      });
      return aggregated;
  };
  
    const getReportTitle = (): { title: string; filenamePart: string } => {
        const now = new Date();
        if (dateRange?.from && dateRange.to) {
            const from = dateRange.from;
            const to = dateRange.to;
            
            if (format(from, 'yyyy-MM-dd') === format(to, 'yyyy-MM-dd')) {
                return { title: `Rapport Journalier du ${format(from, "d MMMM yyyy", { locale: fr })}`, filenamePart: `Journalier_${format(from, "yyyy-MM-dd")}` };
            }
            if (startOfWeek(from, { locale: fr }).getTime() === from.getTime() && endOfWeek(from, { locale: fr }).getTime() === to.getTime()) {
                return { title: `Rapport Hebdomadaire (semaine du ${format(from, "d MMM", { locale: fr })})`, filenamePart: `Hebdomadaire_${format(from, "yyyy-MM-dd")}` };
            }
            if (startOfMonth(from).getTime() === from.getTime() && endOfMonth(from).getTime() === to.getTime()) {
                return { title: `Rapport Mensuel de ${format(from, "MMMM yyyy", { locale: fr })}`, filenamePart: `Mensuel_${format(from, "yyyy-MM")}` };
            }
            return { title: `Rapport du ${format(from, "dd/MM/yy")} au ${format(to, "dd/MM/yy")}`, filenamePart: `Periode_${format(from, "yyyy-MM-dd")}_a_${format(to, "yyyy-MM-dd")}` };
        }
        if (!dateRange?.from && !dateRange?.to) {
            return { title: "Rapport Global", filenamePart: `Global_${format(now, "yyyy-MM-dd")}` };
        }
        return { title: "Rapport des Résultats d'Analyses", filenamePart: `Filtre_${format(now, "yyyy-MM-dd")}` };
    };

    const exportData = (type: 'excel' | 'pdf', reportType: 'detailed' | 'aggregated', period?: 'today' | 'this_week' | 'this_month' | 'last_month' | 'all' | 'current') => {
        let dateRangeToUse = dateRange;

        if (period && period !== 'current') {
            const now = new Date();
            let from: Date | undefined, to: Date | undefined;
            switch(period) {
                case 'today': from = subDays(startOfDay(now), 1); to = endOfDay(now); break;
                case 'this_week': from = startOfWeek(now, { locale: fr }); to = endOfWeek(now, { locale: fr }); break;
                case 'this_month': from = startOfMonth(now); to = endOfMonth(now); break;
                case 'last_month': const lastMonth = subMonths(now, 1); from = startOfMonth(lastMonth); to = endOfMonth(lastMonth); break;
                case 'all': from = undefined; to = undefined; break;
            }
            dateRangeToUse = { from, to };
        }

        let dataToExport = [...results].filter(r => {
            const fuelTypeMatch = fuelTypeFilter === '__ALL__' || r.type_combustible === fuelTypeFilter;
            const fournisseurMatch = fournisseurFilter === '__ALL__' || r.fournisseur === fournisseurFilter;
            const dateArrivage = normalizeDate(r.date_arrivage);
            if (!dateArrivage) return false;
            const fromMatch = !dateRangeToUse?.from || dateArrivage >= startOfDay(dateRangeToUse.from);
            const toMatch = !dateRangeToUse?.to || dateArrivage <= endOfDay(dateRangeToUse.to);
            return fuelTypeMatch && fournisseurMatch && fromMatch && toMatch;
        });

        if (dataToExport.length === 0) {
            toast({ variant: "destructive", title: "Aucune donnée", description: "Il n'y a aucune donnée à exporter pour la sélection." });
            return;
        }

        const { title: reportTitle, filenamePart } = getReportTitle();
        const reportSubtitle = `${reportType === 'aggregated' ? 'Agrégé' : 'Détaillé'}`;
        const finalFilename = `Rapport_${filenamePart}_${reportSubtitle}`;
    
    const generateAlerts = (result: Result) => {
        const spec = SPEC_MAP.get(`${result.type_combustible}|${result.fournisseur}`);
        if (!spec) return { text: "Conforme", isConform: true, details: { pci: false, h2o: false, chlore: false, cendres: false } };

        const alerts: string[] = [];
        const alertDetails = { pci: false, h2o: false, chlore: false, cendres: false };

        if (spec.PCI_min != null && result.pci_brut != null && result.pci_brut < spec.PCI_min) { alerts.push("PCI bas"); alertDetails.pci = true; }
        if (spec.H2O_max != null && result.h2o != null && result.h2o > spec.H2O_max) { alerts.push("H2O élevé"); alertDetails.h2o = true; }
        if (result.chlore != null && spec.Cl_max != null && result.chlore > spec.Cl_max) { alerts.push("Cl- élevé"); alertDetails.chlore = true; }
        if (result.cendres != null && spec.Cendres_max != null && result.cendres > spec.Cendres_max) { alerts.push("Cendres élevées"); alertDetails.cendres = true; }

        if (alerts.length === 0) return { text: "Conforme", isConform: true, details: alertDetails };
        return { text: alerts.join(", "), isConform: false, details: alertDetails };
    };

    if (type === 'excel') {
        let excelData: any[];

        if (reportType === 'aggregated') {
            excelData = aggregateResults(dataToExport);
        } else {
            excelData = dataToExport.map(row => {
                const date = normalizeDate(row.date_arrivage);
                return {
                    "Date Arrivage": date ? format(date, "dd/MM/yyyy") : "Date invalide",
                    "Type Combustible": row.type_combustible,
                    "Fournisseur": row.fournisseur,
                    "Tonnage (t)": row.tonnage,
                    "PCS sur sec (kcal/kg)": row.pcs,
                    "PCI sur Brut (kcal/kg)": row.pci_brut,
                    "% H2O": row.h2o,
                    "% Cl-": row.chlore,
                    "% Cendres": row.cendres,
                    "Alertes": generateAlerts(row).text.replace("H2O élevé", "H2O élevé"),
                    "Remarques": row.remarques || ""
                }
            });
        }
        const ws = XLSX.utils.json_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Rapport AFR");
        XLSX.writeFile(wb, `${finalFilename}.xlsx`);
    } else {
        import('jspdf').then(jsPDF => {
            import('jspdf-autotable').then(() => {
                const doc = new jsPDF.default({ orientation: 'landscape' });
                
                let head: string[][];
                let body: any[][];
                let columnStyles: any = {};

                if (reportType === 'aggregated') {
                    const aggregatedData = aggregateResults(dataToExport);
                    head = [["Combustible", "Fournisseur", "Analyses", "Tonnage", "Moy. PCS", "Moy. PCI", "Moy. H2O", "Moy. Cl-", "Moy. Cendres"]];
                    body = aggregatedData.map(row => [
                        row["Type Combustible"], row["Fournisseur"], row["Analyses"],
                        formatNumberForPdf(row["Tonnage (t)"], 1), formatNumberForPdf(row["PCS sur sec (kcal/kg)"], 0),
                        formatNumberForPdf(row["PCI sur Brut (kcal/kg)"], 0), formatNumberForPdf(row["% H2O"], 1),
                        formatNumberForPdf(row["% Cl-"], 2), formatNumberForPdf(row["% Cendres"], 1)
                    ]);
                } else {
                    head = [["Date", "Combustible", "Fournisseur", "Tonnage (t)", "PCS", "PCI Brut", "H2O (%)", "Cl- (%)", "Cendres (%)", "Alertes", "Remarques"]];
                    body = dataToExport.map(row => {
                      const date = normalizeDate(row.date_arrivage);
                      return [
                        date ? format(date, "dd/MM/yy") : "Invalide", row.type_combustible, row.fournisseur,
                        formatNumberForPdf(row.tonnage, 1),
                        formatNumberForPdf(row.pcs, 0), formatNumberForPdf(row.pci_brut, 0), formatNumberForPdf(row.h2o, 1), formatNumberForPdf(row.chlore, 2), formatNumberForPdf(row.cendres, 1),
                        generateAlerts(row).text,
                        row.remarques || "-",
                    ]});

                    columnStyles = {
                        5: { cellWidth: 20 }, // PCI
                        6: { cellWidth: 15 }, // H2O
                        7: { cellWidth: 15 }, // Cl-
                        8: { cellWidth: 20 }, // Cendres
                    };
                }
        
                doc.autoTable({ 
                    head, 
                    body, 
                    startY: 30, 
                    theme: 'grid', 
                    styles: { fontSize: 7, cellPadding: 1.5 }, 
                    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
                    columnStyles,
                    didParseCell: (data) => {
                        if (reportType === 'detailed' && data.section === 'body') {
                            const result = dataToExport[data.row.index];
                            if (!result) return;

                            const alertsInfo = generateAlerts(result);
                            
                            if (data.column.index === 9) { // alerts column
                                data.cell.styles.textColor = alertsInfo.isConform ? '#16A34A' : '#8B0000';
                            }
                            
                            const keyMap: {[key: number]: keyof typeof alertsInfo.details} = { 5: 'pci', 6: 'h2o', 7: 'chlore', 8: 'cendres'};
                            const alertKey = keyMap[data.column.index];

                            if (alertKey && alertsInfo.details[alertKey]) {
                                data.cell.styles.textColor = '#EF4444';
                            }
                        }
                    },
                    didDrawPage: (data) => {
                        doc.setFontSize(16);
                        doc.setFont("helvetica", "bold");
                        doc.text(reportTitle, doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });
                        doc.setFontSize(10);
                        doc.setFont("helvetica", "normal");
                        doc.text(reportSubtitle, doc.internal.pageSize.getWidth() / 2, 22, { align: 'center' });
                        const footerText = "*Le taux en hydrogène est une estimation basée sur le tableau 'Données Combustibles'.";
                        const textWidth = doc.getStringUnitWidth(footerText) * 8 / doc.internal.scaleFactor;
                        const textHeight = 5; 
                        const padding = 2;
                        doc.setFillColor(255, 255, 0);
                        doc.rect(data.settings.margin.left - padding, doc.internal.pageSize.getHeight() - 15 - textHeight, textWidth + padding * 2, textHeight + padding, 'F');
                        doc.setFontSize(8);
                        doc.setTextColor(0, 0, 0);
                        doc.text(footerText, data.settings.margin.left, doc.internal.pageSize.getHeight() - 12);
                    },
                    margin: { top: 30, bottom: 20 },
                });
                doc.save(`${finalFilename}.pdf`);
            })
        })
    }
  };


  const stats = useMemo(() => {
    const total = sortedAndFilteredResults.length
    const conformes = sortedAndFilteredResults.filter((r) => {
        const spec = SPEC_MAP.get(`${r.type_combustible}|${r.fournisseur}`);
        if (!spec) return true;
        if (spec.PCI_min != null && r.pci_brut != null && r.pci_brut < spec.PCI_min) return false;
        if (spec.H2O_max != null && r.h2o != null && r.h2o > spec.H2O_max) return false;
        if (r.chlore != null && spec.Cl_max != null && r.chlore > spec.Cl_max) return false;
        if (r.cendres != null && spec.Cendres_max != null && r.cendres > spec.Cendres_max) return false;
        return true;
    }).length
    return { total, conformes, non: total - conformes }
  }, [sortedAndFilteredResults]);
  
  const generateAlerts = (result: Result) => {
    const spec = SPEC_MAP.get(`${result.type_combustible}|${result.fournisseur}`);
    if (!spec) return { text: "Conforme", isConform: true, details: { pci: false, h2o: false, chlore: false, cendres: false }};

    const alerts: string[] = [];
    const alertDetails = { pci: false, h2o: false, chlore: false, cendres: false };

    if (spec.PCI_min != null && result.pci_brut != null && result.pci_brut < spec.PCI_min) { alerts.push("PCI bas"); alertDetails.pci = true; }
    if (spec.H2O_max != null && result.h2o != null && result.h2o > spec.H2O_max) { alerts.push("H2O élevé"); alertDetails.h2o = true; }
    if (result.chlore != null && spec.Cl_max != null && result.chlore > spec.Cl_max) { alerts.push("Cl- élevé"); alertDetails.chlore = true; }
    if (result.cendres != null && spec.Cendres_max != null && result.cendres > spec.Cendres_max) { alerts.push("Cendres élevées"); alertDetails.cendres = true; }

    if (alerts.length === 0) return { text: "Conforme", isConform: true, details: alertDetails };
    return { text: alerts.join(", "), isConform: false, details: alertDetails };
  };

  const headers = [
    { label: "Date Arrivage", key: "date_arrivage" },
    { label: "Type Combustible", key: "type_combustible" },
    { label: "Fournisseur", key: "fournisseur" },
    { label: "Tonnage (t)", key: "tonnage" },
    { label: "PCS sur sec", key: "pcs" },
    { label: "PCI sur Brut", key: "pci" },
    { label: "% H2O", key: "h2o" },
    { label: "% Cl-", key: "chlore" },
    { label: "% Cendres", key: "cendres" },
    { label: "Alertes", key: "id" },
    { label: "Remarques", key: "remarques" },
  ];
  
  const averages = useMemo(() => {
    if (sortedAndFilteredResults.length === 0) {
      return null;
    }

    const sum = (key: keyof Result) => sortedAndFilteredResults.reduce((acc, curr) => {
        const value = curr[key];
        if (typeof value === 'number' && isFinite(value)) {
            return acc + value;
        }
        return acc;
    }, 0);
    
    const count = (key: keyof Result) => sortedAndFilteredResults.filter(r => {
        const value = r[key];
        return typeof value === 'number' && isFinite(value);
    }).length;

    const avg = (key: keyof Result) => {
        const total = sum(key);
        const numItems = count(key);
        return numItems > 0 ? total / numItems : null;
    };

    return {
      tonnage: sum('tonnage'),
      pcs: avg('pcs'),
      pci_brut: avg('pci_brut'),
      h2o: avg('h2o'),
      chlore: avg('chlore'),
      cendres: avg('cendres'),
    };
  }, [sortedAndFilteredResults]);

  if (loading) {
    return ( <div className="space-y-2 p-4 lg:p-6"><Skeleton className="h-10 w-full" /><Skeleton className="h-96 w-full" /></div> );
  }

  return (
      <>
        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileImport} accept=".xlsx, .xls" />
        
        <div className="flex flex-col h-screen bg-muted/20">
          <header className="p-3 md:p-5">
              <Card className="rounded-2xl shadow-sm border border-brand-line/60 bg-brand-surface/60">
                  <CardContent className="p-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 xl:grid-cols-8 gap-2 items-center">
                          <div className="col-span-1 md:col-span-2 lg:col-span-2 xl:col-span-2 flex items-center gap-2 text-[12px]">
                            <span className="font-semibold text-foreground/80">Statistiques:</span>
                            <span className="inline-flex items-center rounded-md px-2 py-0.5 bg-muted text-muted-foreground">Total: {stats.total}</span>
                            <span className="inline-flex items-center rounded-md px-2 py-0.5 bg-green-500/10 text-green-500"><CheckCircle2 className="w-3 h-3 mr-1" /> {stats.conformes}</span>
                            <span className="inline-flex items-center rounded-md px-2 py-0.5 bg-red-500/10 text-red-500"><AlertTriangle className="w-3 h-3 mr-1" /> {stats.non}</span>
                          </div>
                          
                          <div className="col-span-1">
                            <Select value={fuelTypeFilter} onValueChange={setFuelTypeFilter}>
                                <SelectTrigger className="h-9 rounded-xl text-[13px] bg-brand-bg border-brand-line"><SelectValue placeholder="Combustible" /></SelectTrigger>
                                <SelectContent><SelectItem value="__ALL__">Tous les combustibles</SelectItem>{uniqueFuelTypes.map((f:string)=><SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-1">
                            <Select value={fournisseurFilter} onValueChange={setFournisseurFilter}>
                                <SelectTrigger className="h-9 rounded-xl text-[13px] bg-brand-bg border-brand-line"><SelectValue placeholder="Fournisseur" /></SelectTrigger>
                                <SelectContent><SelectItem value="__ALL__">Tous les fournisseurs</SelectItem>{availableSuppliers.map((s:string)=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>

                           <div className="lg:col-span-1">
                               <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full h-9 rounded-xl justify-start text-[13px] bg-brand-bg border-brand-line">
                                        <CalendarIcon className="w-4 h-4 mr-2" />
                                        <span>Période...</span>
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent align="end" className="w-auto p-0">
                                    <Calendar initialFocus mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={1} locale={fr} />
                                </PopoverContent>
                            </Popover>
                            </div>

                          <div className="col-span-1 md:col-span-2 lg:col-span-2 xl:col-span-3 flex items-center justify-end gap-2">
                                <Button variant="outline" className="h-9 rounded-xl" onClick={() => fileInputRef.current?.click()}>
                                    <Upload className="w-4 h-4 mr-1" /> Importer
                                </Button>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button variant="outline" className="h-9 rounded-xl bg-brand-bg border-brand-line"><Download className="w-4 h-4 mr-1"/>Exporter</Button></DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuSub>
                                            <DropdownMenuSubTrigger>Rapport Détaillé</DropdownMenuSubTrigger>
                                            <DropdownMenuPortal>
                                                <DropdownMenuSubContent>
                                                    <DropdownMenuItem onSelect={() => exportData('excel', 'detailed', 'current')}>Sélection actuelle (Excel)</DropdownMenuItem>
                                                    <DropdownMenuItem onSelect={() => exportData('pdf', 'detailed', 'current')}>Sélection actuelle (PDF)</DropdownMenuItem>
                                                    <DropdownMenuSeparator/>
                                                    <DropdownMenuItem onSelect={() => exportData('excel', 'detailed', 'today')}>Veille & Jour J (Excel)</DropdownMenuItem>
                                                     <DropdownMenuItem onSelect={() => exportData('pdf', 'detailed', 'today')}>Veille & Jour J (PDF)</DropdownMenuItem>
                                                    <DropdownMenuItem onSelect={() => exportData('excel', 'detailed', 'this_week')}>Cette semaine (Excel)</DropdownMenuItem>
                                                    <DropdownMenuItem onSelect={() => exportData('pdf', 'detailed', 'this_week')}>Cette semaine (PDF)</DropdownMenuItem>
                                                    <DropdownMenuItem onSelect={() => exportData('excel', 'detailed', 'this_month')}>Ce mois-ci (Excel)</DropdownMenuItem>
                                                    <DropdownMenuItem onSelect={() => exportData('pdf', 'detailed', 'this_month')}>Ce mois-ci (PDF)</DropdownMenuItem>
                                                    <DropdownMenuItem onSelect={() => exportData('excel', 'detailed', 'last_month')}>Mois dernier (Excel)</DropdownMenuItem>
                                                    <DropdownMenuItem onSelect={() => exportData('pdf', 'detailed', 'last_month')}>Mois dernier (PDF)</DropdownMenuItem>
                                                </DropdownMenuSubContent>
                                            </DropdownMenuPortal>
                                        </DropdownMenuSub>
                                        <DropdownMenuSub>
                                            <DropdownMenuSubTrigger>Rapport Agrégé</DropdownMenuSubTrigger>
                                            <DropdownMenuPortal>
                                                 <DropdownMenuSubContent>
                                                    <DropdownMenuItem onSelect={() => exportData('excel', 'aggregated', 'current')}>Sélection actuelle (Excel)</DropdownMenuItem>
                                                    <DropdownMenuItem onSelect={() => exportData('pdf', 'aggregated', 'current')}>Sélection actuelle (PDF)</DropdownMenuItem>
                                                    <DropdownMenuSeparator/>
                                                    <DropdownMenuItem onSelect={() => exportData('excel', 'aggregated', 'today')}>Veille & Jour J (Excel)</DropdownMenuItem>
                                                     <DropdownMenuItem onSelect={() => exportData('pdf', 'aggregated', 'today')}>Veille & Jour J (PDF)</DropdownMenuItem>
                                                    <DropdownMenuItem onSelect={() => exportData('excel', 'aggregated', 'this_week')}>Cette semaine (Excel)</DropdownMenuItem>
                                                    <DropdownMenuItem onSelect={() => exportData('pdf', 'aggregated', 'this_week')}>Cette semaine (PDF)</DropdownMenuItem>
                                                    <DropdownMenuItem onSelect={() => exportData('excel', 'aggregated', 'this_month')}>Ce mois-ci (Excel)</DropdownMenuItem>
                                                    <DropdownMenuItem onSelect={() => exportData('pdf', 'aggregated', 'this_month')}>Ce mois-ci (PDF)</DropdownMenuItem>
                                                    <DropdownMenuItem onSelect={() => exportData('excel', 'aggregated', 'last_month')}>Mois dernier (Excel)</DropdownMenuItem>
                                                    <DropdownMenuItem onSelect={() => exportData('pdf', 'aggregated', 'last_month')}>Mois dernier (PDF)</DropdownMenuItem>
                                                </DropdownMenuSubContent>
                                            </DropdownMenuPortal>
                                        </DropdownMenuSub>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                              <Button variant="destructive" className="h-9 rounded-xl" onClick={() => setIsDeleteAllConfirmOpen(true)}><Trash2 className="w-4 h-4" /></Button>
                          </div>
                      </div>
                  </CardContent>
              </Card>
          </header>

          <main className="flex-grow px-3 md:px-5 pb-3 md:pb-5">
            <Card className="rounded-2xl shadow-md h-full bg-transparent">
              <CardContent className="p-0 h-full">
                  <div className="max-h-[calc(100vh-160px)] overflow-auto rounded-2xl border-t border-brand-line/60 bg-brand-surface h-full">
                  <table className="w-full text-[13px] border-separate border-spacing-0">
                    <thead className="text-neutral-300">
                      <tr>
                        {headers.map(({ label, key }) => {
                          const isSorted = sortConfig?.key === key;
                          return (
                            <th key={label} onClick={() => requestSort(key as SortableKeys)} className="sticky top-0 z-20 bg-brand-surface/95 backdrop-blur p-2 text-left font-semibold border-b border-brand-line/60 cursor-pointer hover:bg-brand-muted/50">
                              <div className="flex items-center gap-2"><span>{label}</span>{isSorted && (<ArrowUpDown className="h-4 w-4" />)}</div>
                            </th>
                          );
                        })}
                        <th className="sticky top-0 z-20 bg-brand-surface/95 backdrop-blur p-2 text-center font-semibold border-b border-brand-line/60">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-line/40">
                      {sortedAndFilteredResults.map((r, i) => {
                        const alerte = generateAlerts(r);
                        return (
                          <tr key={r.id ?? i} className="hover:bg-brand-muted/50 transition-colors">
                            <td className="p-1.5 text-muted-foreground whitespace-nowrap">{normalizeDate(r.date_arrivage) ? format(normalizeDate(r.date_arrivage)!, 'dd/MM/yyyy') : 'Date invalide'}</td>
                            <td className="p-1.5 font-medium">{r.type_combustible}</td>
                            <td className="p-1.5">{r.fournisseur}</td>
                            <td className={`p-1.5 text-right tabular-nums`}>{formatNumber(r.tonnage, 1)}</td>
                            <td className={`p-1.5 text-right tabular-nums`}>{formatNumber(r.pcs, 0)}</td>
                            <td className={`p-1.5 text-right font-semibold tabular-nums ${alerte.details.pci ? "text-red-400" : ""}`}>{formatNumber(r.pci_brut, 0)}</td>
                            <td className={`p-1.5 text-right tabular-nums ${alerte.details.h2o ? "text-red-400" : ""}`}>{formatNumber(r.h2o, 1)}</td>
                            <td className={`p-1.5 text-right tabular-nums ${alerte.details.chlore ? "text-red-400" : ""}`}>{formatNumber(r.chlore, 2)}</td>
                            <td className={`p-1.5 text-right tabular-nums ${alerte.details.cendres ? "text-red-400" : ""}`}>{formatNumber(r.cendres, 1)}</td>
                            <td className="p-1.5">
                              {alerte.isConform ? (
                                <span className="inline-flex items-center gap-1 text-green-400 font-medium"><CheckCircle2 className="w-4 h-4" /> Conforme</span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-red-400 font-medium" title={alerte.text}><AlertTriangle className="w-4 h-4" /> Non Conforme</span>
                              )}
                            </td>
                            <td className="p-1.5 text-muted-foreground max-w-[150px] truncate" title={r.remarques}>{r.remarques ?? "-"}</td>
                            <td className="p-1.5 text-center">
                                <div className="inline-flex gap-1">
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditOpen(r)}><Edit className="w-4 h-4 text-muted-foreground" /></Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setResultToDelete(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                                </div>
                            </td>
                          </tr>
                        );
                      })}
                      {sortedAndFilteredResults.length===0 && ( <tr><td colSpan={12} className="p-6 text-center text-muted-foreground">Aucun résultat.</td></tr> )}
                       {averages && (
                            <tr className="font-semibold border-t-2 border-brand-line/80 bg-blue-900/30">
                                <td className="p-2" colSpan={3}>Moyenne de la sélection</td>
                                <td className="p-2 text-right tabular-nums">{formatNumber(averages.tonnage, 1)}</td>
                                <td className="p-2 text-right tabular-nums">{formatNumber(averages.pcs, 0)}</td>
                                <td className="p-2 text-right tabular-nums">{formatNumber(averages.pci_brut, 0)}</td>
                                <td className="p-2 text-right tabular-nums">{formatNumber(averages.h2o, 1)}</td>
                                <td className="p-2 text-right tabular-nums">{formatNumber(averages.chlore, 2)}</td>
                                <td className="p-2 text-right tabular-nums">{formatNumber(averages.cendres, 1)}</td>
                                <td className="p-2" colSpan={3}></td>
                            </tr>
                        )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </main>
        </div>

        <AlertDialog onOpenChange={(open) => !open && setResultToDelete(null)} open={!!resultToDelete}>
            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Êtes-vous absolument sûr ?</AlertDialogTitle><AlertDialogDescription>Cette action est irréversible. Le résultat sera définitivement supprimé de la base de données.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Supprimer</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
        </AlertDialog>

        <AlertDialog onOpenChange={setIsDeleteAllConfirmOpen} open={isDeleteAllConfirmOpen}>
            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Êtes-vous absolument sûr ?</AlertDialogTitle><AlertDialogDescription>Cette action est irréversible et supprimera définitivement TOUT l'historique des résultats.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={handleDeleteAll} className="bg-destructive hover:bg-destructive/90">Oui, tout supprimer</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
        </AlertDialog>

        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Modifier le Résultat</DialogTitle>
                    <DialogDescription>Combustible: {editingResult?.type_combustible} | Fournisseur: {editingResult?.fournisseur}</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onEditSubmit)} className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="pcs" render={({ field }) => (<FormItem><FormLabel>PCS</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="h2o" render={({ field }) => (<FormItem><FormLabel>% H2O</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="tonnage" render={({ field }) => (<FormItem><FormLabel>Tonnage (t)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="chlore" render={({ field }) => (<FormItem><FormLabel>% Cl-</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="cendres" render={({ field }) => (<FormItem><FormLabel>% Cendres</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="taux_metal" render={({ field }) => (<FormItem><FormLabel>Taux d'inertes (%)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                        <FormField control={form.control} name="remarques" render={({ field }) => (<FormItem><FormLabel>Remarques</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        <DialogFooter><DialogClose asChild><Button type="button" variant="secondary">Annuler</Button></DialogClose><Button type="submit">Enregistrer</Button></DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
      </>
  );
}
