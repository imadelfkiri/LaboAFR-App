
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
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  format,
  startOfDay,
  endOfDay,
  isValid,
  parseISO,
  parse,
} from "date-fns";
import { fr } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Calendar as CalendarIcon,
  Trash2,
  Download,
  Upload,
  Plus,
} from "lucide-react";
import { getSpecifications, SPEC_MAP, getFuelSupplierMap, deleteAllResults, getFuelData, type FuelData, addManyResults } from "@/lib/data";
import { calculerPCI } from "@/lib/pci";
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
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { MultiSelect } from "@/components/ui/multi-select";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import * as z from "zod";
import { Skeleton } from "./ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import Link from "next/link";


interface Result {
  id: string;
  date_arrivage: { seconds: number; nanoseconds: number } | string;
  type_combustible: string;
  fournisseur: string;
  pcs: number | null;
  h2o: number;
  cendres: number | null;
  chlore: number | null;
  pci_brut: number | null;
  poids_godet: number | null;
  remarques: string;
}

// Étendre jsPDF pour autoTable
declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

const importSchema = z.object({
  date_arrivage: z.date({ required_error: "Date requise." }),
  type_combustible: z.string().nonempty({message: "Le type de combustible est requis."}),
  fournisseur: z.string().nonempty({message: "Le fournisseur est requis."}),
  pcs: z.coerce.number({invalid_type_error: "PCS doit être un nombre."}).optional().nullable(),
  pci_brut: z.coerce.number({invalid_type_error: "PCI Brut doit être un nombre."}).optional().nullable(),
  h2o: z.coerce.number({invalid_type_error: "H2O doit être un nombre."}).min(0).max(100),
  chlore: z.coerce.number({invalid_type_error: "Chlore doit être un nombre."}).min(0).optional().nullable(),
  cendres: z.coerce.number({invalid_type_error: "Cendres doit être un nombre."}).min(0).optional().nullable(),
  remarques: z.string().optional().nullable(),
  taux_fils_metalliques: z.coerce.number().min(0).max(100).optional().nullable(),
});

function ResultsView({
  rows = [],
  fuels = [],
  suppliers = [],
  fuel="__ALL__", setFuel=()=>{},
  supplier="__ALL__", setSupplier=()=>{},
  from="", setFrom=()=>{},
  to="", setTo=()=>{},
  onExport=()=>{}, onImport=()=>{}, onAdd=()=>{}, onDeleteAll=()=>{},
  onDeleteOne=(id:string)=>{},
}) {
  return (
    <div className="mx-auto w-full max-w-[1400px] p-3 md:p-5 space-y-3">
      {/* Toolbar */}
      <Card className="rounded-2xl shadow-sm border">
        <CardContent className="p-3">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-center">
            {/* Filtres */}
            <div className="lg:col-span-3">
              <Select value={fuel} onValueChange={setFuel}>
                <SelectTrigger className="h-9 rounded-xl">
                  <SelectValue placeholder="Type Combustible" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__ALL__">Tous les combustibles</SelectItem>
                  {fuels.map((f:string)=><SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="lg:col-span-3">
              <Select value={supplier} onValueChange={setSupplier}>
                <SelectTrigger className="h-9 rounded-xl">
                  <SelectValue placeholder="Fournisseur" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__ALL__">Tous les fournisseurs</SelectItem>
                  {suppliers.map((s:string)=><SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Période */}
            <div className="lg:col-span-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full h-9 rounded-xl justify-start">
                    <Calendar className="w-4 h-4 mr-2" />
                    {from && to ? `${from} → ${to}` : "Période"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[280px] p-3 space-y-2">
                  <div className="text-sm font-medium mb-1">Sélectionner une période</div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="date" className="h-9" value={from} onChange={(e)=>setFrom(e.target.value)} />
                    <Input type="date" className="h-9" value={to} onChange={(e)=>setTo(e.target.value)} />
                  </div>
                  <div className="flex justify-between pt-1">
                    <Button variant="ghost" size="sm" onClick={()=>{setFrom("");setTo("");}}>Réinitialiser</Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Actions */}
            <div className="lg:col-span-4 flex items-center justify-end gap-2">
              <Button variant="outline" className="h-9 rounded-xl" onClick={onImport}>
                <Upload className="w-4 h-4 mr-1" /> Importer
              </Button>
              <Button variant="outline" className="h-9 rounded-xl" onClick={onExport}>
                <Download className="w-4 h-4 mr-1" /> Exporter
              </Button>
              <Link href="/calculateur">
                <Button className="h-9 rounded-xl" onClick={onAdd}>
                    <Plus className="w-4 h-4 mr-1" /> Ajouter
                </Button>
              </Link>
              <Button variant="destructive" className="h-9 rounded-xl" onClick={onDeleteAll}>
                <Trash2 className="w-4 h-4 mr-1" /> Supprimer
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tableau */}
      <Card className="rounded-2xl shadow-md">
        <CardContent className="p-0">
          <div className="max-h-[70vh] overflow-auto rounded-2xl border-t bg-background">
            <table className="w-full text-sm border-separate border-spacing-0">
              <thead className="text-[13px] text-muted-foreground">
                <tr>
                  {["Date Arrivage","Type Combustible","Fournisseur","PCI sur Brut","% H2O","% Cl-","% Cendres","Alertes","Remarques","Action"]
                    .map((h) => (
                      <th key={h} className="sticky top-0 z-20 bg-background/95 backdrop-blur p-2 text-left font-semibold border-b">
                        {h}
                      </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r:any, i:number)=>(
                  <tr key={r.id ?? i} className="border-b last:border-0 even:bg-muted/30 hover:bg-muted/50 transition-colors">
                    <td className="p-2 text-muted-foreground whitespace-nowrap">{r.dateArrivage}</td>
                    <td className="p-2 font-medium">{r.typeCombustible}</td>
                    <td className="p-2">{r.fournisseur}</td>
                    <td className={`p-2 text-right font-medium tabular-nums ${r.pciAlert ? "text-red-600" : ""}`}>{r.pci}</td>
                    <td className={`p-2 text-right tabular-nums ${r.h2oAlert ? "text-red-600" : ""}`}>{r.h2o}</td>
                    <td className={`p-2 text-right tabular-nums ${r.chloreAlert ? "text-red-600" : ""}`}>{r.cl}</td>
                    <td className={`p-2 text-right tabular-nums ${r.cendresAlert ? "text-red-600" : ""}`}>{r.cendres}</td>
                    <td className="p-2">
                      {r.alerte.isConform ? (
                        <span className="text-green-600 font-medium flex items-center gap-1">✔ Conforme</span>
                      ) : (
                        <span className="text-red-600 font-medium flex items-center gap-1">⚠ {r.alerte.text}</span>
                      )}
                    </td>
                    <td className="p-2 text-muted-foreground max-w-[200px] truncate">{r.remarque ?? "-"}</td>
                    <td className="p-2 text-center">
                      <button onClick={() => onDeleteOne(r.id)} className="text-muted-foreground hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
                {rows.length===0 && (
                  <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">Aucun résultat.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function ResultsTable() {
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [fournisseurFilter, setFournisseurFilter] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState<DateRange | undefined>();
  const [resultToDelete, setResultToDelete] = useState<string | null>(null);
  const [isDeleteAllConfirmOpen, setIsDeleteAllConfirmOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fuelSupplierMap, setFuelSupplierMap] = useState<Record<string, string[]>>({});
  const [availableFournisseurs, setAvailableFournisseurs] = useState<string[]>([]);
  const [fuelDataMap, setFuelDataMap] = useState<Map<string, FuelData>>(new Map());

  const { toast } = useToast();

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      await getSpecifications(); 
      const [map, fuelData] = await Promise.all([getFuelSupplierMap(), getFuelData()]);
      setFuelSupplierMap(map);
      setFuelDataMap(new Map(fuelData.map(fd => [fd.nom_combustible, fd])));

      const q = query(collection(db, "resultats"), orderBy("date_arrivage", "desc"));
      const unsubscribe = onSnapshot(
        q,
        (querySnapshot) => {
          const resultsData: Result[] = [];
          querySnapshot.forEach((d) => {
            resultsData.push({ id: d.id, ...(d.data() as any) } as Result);
          });
          setResults(resultsData);
          setLoading(false);
        },
        (error) => {
          console.error("Erreur de lecture des résultats:", error);
          toast({
            variant: "destructive",
            title: "Erreur de lecture",
            description: "Impossible de charger l'historique des résultats.",
          });
          setLoading(false);
        }
      );
      return unsubscribe;
    } catch (error) {
      console.error("Erreur lors de la récupération des données de base :", error);
      toast({
        variant: "destructive",
        title: "Erreur de données",
        description: "Impossible de charger les données de configuration.",
      });
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    fetchInitialData().then((unsub) => {
      if (unsub) unsubscribe = unsub;
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [fetchInitialData]);

  const { uniqueFuelTypes, allUniqueFournisseurs } = useMemo(() => {
    const allResults = results; // Use all results to populate filters
    const fuelTypes = [...new Set(allResults.map((r) => r.type_combustible))].sort();
    const fournisseurs = [...new Set(allResults.map((r) => r.fournisseur))].sort();
    return { uniqueFuelTypes: fuelTypes, allUniqueFournisseurs: fournisseurs };
  }, [results]);

  useEffect(() => {
    if (typeFilter.length > 0) {
      const newAvailable = typeFilter.flatMap((type) => fuelSupplierMap[type] || []);
      setAvailableFournisseurs([...new Set(newAvailable)].sort());
      // Keep existing selection if it's still valid
      setFournisseurFilter((current) => current.filter((f) => newAvailable.includes(f)));
    } else {
      setAvailableFournisseurs(allUniqueFournisseurs);
    }
  }, [typeFilter, fuelSupplierMap, allUniqueFournisseurs]);

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
  
  const filteredResults = useMemo(() => {
    let dateFrom: Date | null = null;
    let dateTo: Date | null = null;

    if (dateFilter?.from) {
      dateFrom = startOfDay(dateFilter.from);
    }
    if (dateFilter?.to) {
      dateTo = endOfDay(dateFilter.to);
    }
    
    return results.filter((result) => {
      if (!result.date_arrivage) return false;
      const dateArrivage = normalizeDate(result.date_arrivage);
      if (!dateArrivage || !isValid(dateArrivage)) return false;

      const typeMatch = typeFilter.length === 0 || typeFilter.includes(result.type_combustible);
      const fournisseurMatch =
        fournisseurFilter.length === 0 || fournisseurFilter.includes(result.fournisseur);
      const dateMatch =
        !dateFilter ||
        ((!dateFrom || dateArrivage >= dateFrom) &&
          (!dateTo || dateArrivage <= dateTo));

      return typeMatch && fournisseurMatch && dateMatch;
    });
  }, [results, typeFilter, fournisseurFilter, dateFilter]);

  const handleDelete = async () => {
    if (!resultToDelete) return;
    try {
      await deleteDoc(doc(db, "resultats", resultToDelete));
      toast({ title: "Succès", description: "L'enregistrement a été supprimé." });
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

  const handleDeleteAll = async () => {
    try {
      await deleteAllResults();
      toast({ title: "Succès", description: "Tous les résultats ont été supprimés." });
    } catch (error) {
      console.error("Erreur lors de la suppression de tous les résultats :", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "La suppression de l'historique a échoué.",
      });
    } finally {
      setIsDeleteAllConfirmOpen(false);
    }
  };


  const formatNumber = (num: number | null | undefined, fractionDigits: number = 0) => {
    if (num === null || num === undefined || Number.isNaN(num)) return "-";
    return num
      .toLocaleString("fr-FR", {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      })
  };

  const generateAlerts = (result: Result) => {
    const spec = SPEC_MAP.get(`${result.type_combustible}|${result.fournisseur}`);
    if (!spec) {
      return {
        text: "N/A",
        isConform: true, // No spec, no alert
        details: { pci: true, h2o: true, chlore: true, cendres: true },
      } as const;
    }

    const alerts: string[] = [];
    const alertDetails = { pci: false, h2o: false, chlore: false, cendres: false };

    if (spec.PCI_min != null && result.pci_brut != null && result.pci_brut < spec.PCI_min) {
      alerts.push("PCI bas");
      alertDetails.pci = true;
    }
    if (spec.H2O_max != null && result.h2o != null && result.h2o > spec.H2O_max) {
      alerts.push("H₂O élevé");
      alertDetails.h2o = true;
    }
    if (result.chlore != null && spec.Cl_max != null && result.chlore > spec.Cl_max) {
      alerts.push("Cl- élevé");
      alertDetails.chlore = true;
    }
    if (result.cendres != null && spec.Cendres_max != null && result.cendres > spec.Cendres_max) {
      alerts.push("Cendres élevées");
      alertDetails.cendres = true;
    }

    if (alerts.length === 0) {
      return { text: "Conforme", isConform: true, details: alertDetails } as const;
    }

    return { text: alerts.join(" / "), isConform: false, details: alertDetails } as const;
  };
  
    const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json<any>(worksheet);

                if (!json || json.length === 0) {
                    throw new Error("Le fichier Excel est vide ou mal formaté.");
                }

                const excelDateToJSDate = (serial: number) => {
                    const utc_days = Math.floor(serial - 25569);
                    const utc_value = utc_days * 86400;
                    const date_info = new Date(utc_value * 1000);
                    return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate(), date_info.getHours(), date_info.getMinutes(), date_info.getSeconds());
                };

                const parseDate = (value: any, rowNum: number): Date => {
                    if (!value) throw new Error(`Ligne ${rowNum}: La date est requise.`);
                    if (typeof value === 'number') {
                        const date = excelDateToJSDate(value);
                        if (isValid(date)) return date;
                    }
                    if (typeof value === 'string') {
                        const formats = ['dd/MM/yyyy', 'd/M/yyyy', 'yyyy-MM-dd', 'MM/dd/yyyy'];
                        for (const fmt of formats) {
                            const date = parse(value, fmt, new Date());
                            if (isValid(date)) return date;
                        }
                    }
                    throw new Error(`Ligne ${rowNum}: Format de date non reconnu pour la valeur "${value}".`);
                };

                const headerMapping: { [key: string]: keyof z.infer<typeof importSchema> } = {
                    'date': 'date_arrivage',
                    'date arrivage': 'date_arrivage',
                    'date_arrivage': 'date_arrivage',
                    'combustible': 'type_combustible',
                    'type combustible': 'type_combustible',
                    'type_combustible': 'type_combustible',
                    'fournisseur': 'fournisseur',
                    'pcs': 'pcs',
                    'pcs (kcal/kg)': 'pcs',
                    'pci': 'pci_brut',
                    'pci brut': 'pci_brut',
                    'pci sur brut': 'pci_brut',
                    'pci sur brut (kcal/kg)': 'pci_brut',
                    'pci_brut': 'pci_brut',
                    'h2o': 'h2o',
                    '% h2o': 'h2o',
                    'cl-': 'chlore',
                    'chlore': 'chlore',
                    '% cl-': 'chlore',
                    'cendres': 'cendres',
                    '% cendres': 'cendres',
                    'remarques': 'remarques',
                    'taux fils metalliques': 'taux_fils_metalliques',
                    'taux fils': 'taux_fils_metalliques',
                    'fils metalliques': 'taux_fils_metalliques',
                };

                const parsedResults = json.map((row, index) => {
                    const rowNum = index + 2;
                    const mappedRow: { [key: string]: any } = {};

                    for (const header in row) {
                        const normalizedHeader = header.trim().toLowerCase().replace(/\s+/g, ' ');
                        const targetKey = headerMapping[normalizedHeader];
                        if (targetKey) {
                             let value = row[header];
                            if(typeof value === 'string' && !['date_arrivage', 'type_combustible', 'fournisseur', 'remarques'].includes(targetKey)) {
                                value = value.replace(',', '.');
                            }
                            mappedRow[targetKey] = value;
                        }
                    }

                    try {
                        const parsedDate = parseDate(mappedRow.date_arrivage, rowNum);
                        
                        const validatedData = importSchema.parse({
                            ...mappedRow,
                            date_arrivage: parsedDate,
                        });
                        
                        let finalPci: number | null = validatedData.pci_brut ?? null;

                        if (finalPci === null && validatedData.pcs) {
                             const hValue = fuelDataMap.get(validatedData.type_combustible)?.teneur_hydrogene;
                            if (hValue === null || hValue === undefined) {
                                throw new Error(`Teneur en hydrogène non définie pour "${validatedData.type_combustible}" (nécessaire pour calculer le PCI à partir du PCS).`);
                            }
                            
                            let pcsToUse = validatedData.pcs;
                            if (validatedData.type_combustible.toLowerCase().includes('pneu') && validatedData.taux_fils_metalliques) {
                                const taux = Number(validatedData.taux_fils_metalliques);
                                if (taux > 0 && taux < 100) {
                                   pcsToUse = pcsToUse * (1 - taux / 100);
                                }
                            }
                            finalPci = calculerPCI(pcsToUse, validatedData.h2o, hValue);
                        }

                        if (finalPci === null && mappedRow.pci_brut !== undefined) {
                            finalPci = mappedRow.pci_brut;
                        }

                        if (finalPci === null && !validatedData.pci_brut) {
                            throw new Error(`La colonne PCI ou PCS est requise pour calculer la valeur finale.`);
                        }

                        return { ...validatedData, pci_brut: finalPci, date_creation: Timestamp.now(), date_arrivage: Timestamp.fromDate(validatedData.date_arrivage) };

                    } catch (error) {
                         const errorMessage = error instanceof z.ZodError ? 
                            error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') :
                            error instanceof Error ? error.message : "Erreur inconnue.";
                        throw new Error(`Ligne ${rowNum}: ${errorMessage}`);
                    }
                });

                await addManyResults(parsedResults as any);
                toast({ title: "Succès", description: `${parsedResults.length} résultats ont été importés.` });

            } catch (error) {
                console.error("Error importing file:", error);
                const errorMessage = error instanceof Error ? error.message : "Une erreur inconnue est survenue.";
                toast({ variant: "destructive", title: "Erreur d'importation", description: errorMessage, duration: 9000 });
            } finally {
                 if(fileInputRef.current) {
                    fileInputRef.current.value = "";
                }
            }
        };
        reader.readAsArrayBuffer(file);
    };

  const tableRows = useMemo(() => {
    return filteredResults.map(result => {
        const alerte = generateAlerts(result);
        return {
            id: result.id,
            dateArrivage: normalizeDate(result.date_arrivage) ? format(normalizeDate(result.date_arrivage)!, 'dd/MM/yyyy') : 'Date invalide',
            typeCombustible: result.type_combustible,
            fournisseur: result.fournisseur,
            pci: formatNumber(result.pci_brut, 0),
            h2o: formatNumber(result.h2o, 1),
            cl: formatNumber(result.chlore, 2),
            cendres: formatNumber(result.cendres, 1),
            pciAlert: alerte.details.pci,
            h2oAlert: alerte.details.h2o,
            chloreAlert: alerte.details.chlore,
            cendresAlert: alerte.details.cendres,
            alerte,
            remarque: result.remarques
        };
    });
  }, [filteredResults]);


  if (loading) {
    return (
      <div className="space-y-2 p-4 lg:p-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const exportToExcel = () => {
    // This can be expanded with more logic if needed
     if (!filteredResults || filteredResults.length === 0) {
      toast({
        variant: "destructive",
        title: "Aucune donnée",
        description: "Il n'y a aucune donnée à exporter.",
      });
      return;
    }
     const reportDate = new Date();
    const formattedDate = format(reportDate, "dd/MM/yyyy");

    const titleText = `Rapport Filtré du ${formattedDate} analyses des AF`;
    const filename = `Filtre_AFR_Report_${format(reportDate, "yyyy-MM-dd")}.xlsx`;

    const headers = [
      "Date",
      "Type Combustible",
      "Fournisseur",
      "PCS (kcal/kg)",
      "PCI sur Brut (kcal/kg)",
      "% H2O",
      "% Cl-",
      "% Cendres",
      "Alertes",
      "Remarques",
    ];

    const excelData = filteredResults.map(result => {
        const alert = generateAlerts(result);
        return {
            "Date": formatDate(result.date_arrivage, "dd/MM/yyyy"),
            "Type Combustible": result.type_combustible,
            "Fournisseur": result.fournisseur,
            "PCS (kcal/kg)": result.pcs ?? "N/A",
            "PCI sur Brut (kcal/kg)": result.pci_brut,
            "% H2O": result.h2o,
            "% Cl-": result.chlore ?? "N/A",
            "% Cendres": result.cendres ?? "N/A",
            "Alertes": alert.isConform ? 'Conforme' : alert.text,
            "Remarques": result.remarques || ""
        };
    });

    const ws = XLSX.utils.json_to_sheet(excelData, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rapport AFR");
    XLSX.writeFile(wb, filename);
  };


  return (
      <>
        <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileImport}
            accept=".xlsx, .xls"
        />
        <ResultsView 
            rows={tableRows}
            fuels={uniqueFuelTypes}
            suppliers={availableFournisseurs}
            fuel={typeFilter[0] || "__ALL__"}
            setFuel={(val) => setTypeFilter(val === "__ALL__" ? [] : [val])}
            supplier={fournisseurFilter[0] || "__ALL__"}
            setSupplier={(val) => setFournisseurFilter(val === "__ALL__" ? [] : [val])}
            from={dateFilter?.from ? format(dateFilter.from, 'yyyy-MM-dd') : ''}
            setFrom={(val) => setDateFilter(prev => ({...prev, from: parseISO(val)}))}
            to={dateFilter?.to ? format(dateFilter.to, 'yyyy-MM-dd') : ''}
            setTo={(val) => setDateFilter(prev => ({...prev, to: parseISO(val)}))}
            onAdd={() => {}}
            onImport={() => fileInputRef.current?.click()}
            onExport={exportToExcel}
            onDeleteAll={() => setIsDeleteAllConfirmOpen(true)}
            onDeleteOne={(id) => setResultToDelete(id)}
        />
        
        <AlertDialog onOpenChange={(open) => !open && setResultToDelete(null)} open={!!resultToDelete}>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Êtes-vous absolument sûr ?</AlertDialogTitle>
                <AlertDialogDescription>
                    Cette action est irréversible. Le résultat sera définitivement supprimé de la base de données.
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                    Supprimer
                </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <AlertDialog onOpenChange={setIsDeleteAllConfirmOpen} open={isDeleteAllConfirmOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Êtes-vous absolument sûr ?</AlertDialogTitle>
                <AlertDialogDescription>
                    Cette action est irréversible et supprimera définitivement
                    TOUT l'historique des résultats.
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                    onClick={handleDeleteAll}
                    className="bg-destructive hover:bg-destructive/90"
                >
                    Oui, tout supprimer
                </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </>
  );
}

export default ResultsTable;

    