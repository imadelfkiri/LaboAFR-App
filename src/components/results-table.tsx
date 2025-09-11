
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
  writeBatch
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  format,
  startOfDay,
  endOfDay,
  isValid,
  parseISO,
  parse,
  subDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subMonths,
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
} from "lucide-react";
import { getSpecifications, SPEC_MAP, getFuelSupplierMap, deleteAllResults, getFuelData, type FuelData, addManyResults } from "@/lib/data";
import { calculerPCI } from "@/lib/pci";
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
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import * as z from "zod";
import { Skeleton } from "./ui/skeleton";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Calendar } from "./ui/calendar";
import { SidebarTrigger } from "./ui/sidebar";

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
  taux_metal?: number | null;
}

type SortableKeys = keyof Result | 'pci' | 'h2o' | 'chlore' | 'cendres';

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
  taux_metal: z.coerce.number().min(0).max(100).optional().nullable(),
});

function ResultsPagePro({
  rows = [],
  fuels = [],
  suppliers = [],
  fuel="__ALL__", setFuel=()=>{},
  supplier="__ALL__", setSupplier=()=>{},
  from="", setFrom=()=>{},
  to="", setTo=()=>{},
  onExport=(type: 'excel' | 'pdf', scope: 'current' | 'daily' | 'weekly' | 'monthly' | 'last_month')=>{}, 
  onImport=()=>{}, 
  onDeleteAll=()=>{}, 
  onDeleteOne=(id:string)=>{},
  sortConfig = { key: 'date_arrivage', direction: 'descending' },
  onSort = (key: SortableKeys) => {},
}) {
  const stats = React.useMemo(() => {
    const total = rows.length
    const conformes = rows.filter((r:any)=> r.alerte.isConform).length
    return { total, conformes, non: total - conformes }
  }, [rows])

  const periodLabel = React.useMemo(() => {
    try {
        if (from && to) return `${format(parseISO(from), "dd/MM/yy")} → ${format(parseISO(to), "dd/MM/yy")}`
        if (from) return `Depuis le ${format(parseISO(from), "dd/MM/yy")}`
        if (to) return `Jusqu'au ${format(parseISO(to), "dd/MM/yy")}`
    } catch (e) {
        return "Période";
    }
    return "Période"
  }, [from, to])


  const Badge = ({tone, children}:{tone:"ok"|"warn"|"muted", children:React.ReactNode}) => {
    const base = "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium"
    const map:any = {
      ok:   "bg-green-100 text-green-700",
      warn: "bg-red-100 text-red-700",
      muted:"bg-muted text-muted-foreground",
    }
    return <span className={`${base} ${map[tone]}`}>{children}</span>
  }
  
  const SortableHeader = ({ label, sortKey }: { label: string; sortKey: SortableKeys }) => {
    const isSorted = sortConfig?.key === sortKey;
    return (
      <th
        onClick={() => onSort(sortKey)}
        className="sticky top-0 z-20 bg-primary text-primary-foreground p-2 text-left font-semibold border-b cursor-pointer hover:bg-primary/90"
      >
        <div className="flex items-center gap-2">
            <span>{label}</span>
            {isSorted && (
                <ArrowUpDown className="h-4 w-4" />
            )}
        </div>
      </th>
    );
  };
  
  const headers: { label: string; key: SortableKeys; }[] = [
    { label: "Date Arrivage", key: "date_arrivage" },
    { label: "Type Combustible", key: "type_combustible" },
    { label: "Fournisseur", key: "fournisseur" },
    { label: "PCI sur Brut", key: "pci" },
    { label: "% H2O", key: "h2o" },
    { label: "% Cl-", key: "chlore" },
    { label: "% Cendres", key: "cendres" },
    { label: "Alertes", key: "id" }, // Not sortable
    { label: "Remarques", key: "remarques" },
  ];

  return (
    <div className="flex flex-col h-full">
        <div className="p-3 md:p-5">
            <Card className="rounded-2xl shadow-sm border">
                <CardContent className="p-2">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-center">
                    <div className="lg:col-span-4 flex items-center gap-2 text-[12px]">
                        <SidebarTrigger className="mr-2" />
                        <Badge tone="muted">Total: {stats.total}</Badge>
                        <Badge tone="ok"><CheckCircle2 className="w-3 h-3 mr-1" /> {stats.conformes} conformes</Badge>
                        <Badge tone="warn"><AlertTriangle className="w-3 h-3 mr-1" /> {stats.non} non conf.</Badge>
                    </div>

                    <div className="lg:col-span-2">
                    <Select value={fuel} onValueChange={setFuel}>
                        <SelectTrigger className="h-9 rounded-xl text-[13px]">
                        <SelectValue placeholder="Type combustible" />
                        </SelectTrigger>
                        <SelectContent>
                        <SelectItem value="__ALL__">Tous les combustibles</SelectItem>
                        {fuels.map((f:string)=><SelectItem key={f} value={f}>{f}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    </div>
                    <div className="lg:col-span-2">
                    <Select value={supplier} onValueChange={setSupplier}>
                        <SelectTrigger className="h-9 rounded-xl text-[13px]">
                        <SelectValue placeholder="Fournisseur" />
                        </SelectTrigger>
                        <SelectContent>
                        <SelectItem value="__ALL__">Tous les fournisseurs</SelectItem>
                        {suppliers.map((s:string)=><SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    </div>

                    <div className="lg:col-span-2">
                    <Popover>
                        <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full h-9 rounded-xl justify-start text-[13px]">
                            <CalendarIcon className="w-4 h-4 mr-2" />
                            {periodLabel}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-auto p-0">
                        <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={from ? parseISO(from) : new Date()}
                            selected={{from: from ? parseISO(from) : undefined, to: to ? parseISO(to) : undefined}}
                            onSelect={(range) => {
                                setFrom(range?.from ? format(range.from, 'yyyy-MM-dd') : '');
                                setTo(range?.to ? format(range.to, 'yyyy-MM-dd') : '');
                            }}
                            numberOfMonths={1}
                            locale={fr}
                            />
                        </PopoverContent>
                    </Popover>
                    </div>
                    <div className="lg:col-span-2 flex items-center justify-end gap-2">
                         <Button variant="outline" className="h-9 rounded-xl" onClick={onImport}>
                            <Upload className="w-4 h-4 mr-1" /> Importer
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="h-9 rounded-xl"><Download className="w-4 h-4 mr-1"/>Exporter</Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => onExport('excel', 'current')}>Exporter la vue (Excel)</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onExport('pdf', 'current')}>Exporter la vue (PDF)</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => onExport('pdf', 'daily')}>Rapport Journalier (PDF)</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onExport('pdf', 'weekly')}>Rapport Hebdomadaire (PDF)</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onExport('pdf', 'monthly')}>Rapport Mensuel (Mois actuel) (PDF)</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onExport('pdf', 'last_month')}>Rapport Mensuel (Mois dernier) (PDF)</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                         <Button variant="destructive" className="h-9 rounded-xl" onClick={onDeleteAll}>
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
                </CardContent>
            </Card>
        </div>
      <div className="flex-grow px-3 md:px-5 pb-3 md:pb-5">
        <Card className="rounded-2xl shadow-md h-full">
          <CardContent className="p-0 h-full">
              <div className="max-h-[70vh] overflow-auto rounded-2xl border-t bg-background h-full">
              <table className="w-full text-[13px] border-separate border-spacing-0">
                <thead className="text-primary-foreground">
                  <tr>
                    {headers.map((h) => <SortableHeader key={h.key} label={h.label} sortKey={h.key} />)}
                    <th className="sticky top-0 z-20 bg-primary text-primary-foreground p-2 text-left font-semibold border-b">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r:any, i:number)=>(
                    <tr key={r.id ?? i} className="border-b last:border-0 even:bg-muted/30 hover:bg-muted/50 transition-colors">
                      <td className="p-2 text-muted-foreground whitespace-nowrap">{r.dateArrivage}</td>
                      <td className="p-2 font-medium">{r.typeCombustible}</td>
                      <td className="p-2">{r.fournisseur}</td>
                      <td className={`p-2 text-right font-semibold tabular-nums ${r.pciAlert ? "text-red-600" : ""}`}>{r.pci}</td>
                      <td className={`p-2 text-right tabular-nums ${r.h2oAlert ? "text-red-600" : ""}`}>{r.h2o}</td>
                      <td className={`p-2 text-right tabular-nums ${r.chloreAlert ? "text-red-600" : ""}`}>{r.cl}</td>
                      <td className={`p-2 text-right tabular-nums ${r.cendresAlert ? "text-red-600" : ""}`}>{r.cendres}</td>
                      <td className="p-2">
                        {r.alerte.isConform ? (
                          <span className="inline-flex items-center gap-1 text-green-600 font-medium">
                            <CheckCircle2 className="w-4 h-4" /> Conforme
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                            <AlertTriangle className="w-4 h-4" /> {r.alerte.text || "Non conforme"}
                          </span>
                        )}
                      </td>
                      <td className="p-2 text-muted-foreground max-w-[150px] truncate" title={r.remarque}>{r.remarque ?? "-"}</td>
                      <td className="p-2 text-center">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDeleteOne(r.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {rows.length===0 && (
                    <tr><td colSpan={11} className="p-6 text-center text-muted-foreground">Aucun résultat.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Le composant conteneur (Logique)
export default function ResultsTable() {
  "use client";
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [fuelTypeFilter, setFuelTypeFilter] = useState('__ALL__');
  const [fournisseurFilter, setFournisseurFilter] = useState('__ALL__');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  
  const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: 'ascending' | 'descending' } | null>({ key: 'date_arrivage', direction: 'descending' });

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

      const q = query(collection(db, "resultats"));
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
    if (fuelTypeFilter !== '__ALL__') {
      const newAvailable = fuelSupplierMap[fuelTypeFilter] || [];
      setAvailableFournisseurs([...new Set(newAvailable)].sort());
      if (!newAvailable.includes(fournisseurFilter)) {
          setFournisseurFilter('__ALL__');
      }
    } else {
      setAvailableFournisseurs(allUniqueFournisseurs);
    }
  }, [fuelTypeFilter, fuelSupplierMap, allUniqueFournisseurs, fournisseurFilter]);

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
    let sortableItems = [...results].filter((result) => {
      if (!result.date_arrivage) return false;
      const dateArrivage = normalizeDate(result.date_arrivage);
      if (!dateArrivage || !isValid(dateArrivage)) return false;

      const typeMatch = fuelTypeFilter === '__ALL__' || result.type_combustible === fuelTypeFilter;
      const fournisseurMatch = fournisseurFilter === '__ALL__' || result.fournisseur === fournisseurFilter;
      
      const dateFrom = dateFromFilter ? startOfDay(parseISO(dateFromFilter)) : null;
      const dateTo = dateToFilter ? endOfDay(parseISO(dateToFilter)) : null;

      const dateMatch = (!dateFrom || dateArrivage >= dateFrom) && (!dateTo || dateArrivage <= dateTo);
      
      return typeMatch && fournisseurMatch && dateMatch;
    });
    
    if (sortConfig !== null) {
        sortableItems.sort((a, b) => {
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
    
    return sortableItems;
    
  }, [results, fuelTypeFilter, fournisseurFilter, dateFromFilter, dateToFilter, sortConfig]);

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
        text: "Conforme",
        isConform: true,
        details: { pci: false, h2o: false, chlore: false, cendres: false },
      };
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
      return { text: "Conforme", isConform: true, details: alertDetails };
    }

    return { text: alerts.join(" / "), isConform: false, details: alertDetails };
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
                    'taux metal': 'taux_metal',
                    'taux du metal': 'taux_metal',
                    'taux du métal (%)': 'taux_metal',
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
                        
                        const validatedData = importSchema.partial().parse({
                            ...mappedRow,
                            date_arrivage: parsedDate,
                        });
                        
                        let finalPci: number | null = null;
                        
                        if (validatedData.pci_brut !== undefined && validatedData.pci_brut !== null) {
                            finalPci = validatedData.pci_brut;
                        } else if (validatedData.pcs && validatedData.type_combustible && validatedData.h2o !== undefined) {
                            const hValue = fuelDataMap.get(validatedData.type_combustible)?.teneur_hydrogene;
                            if (hValue === null || hValue === undefined) {
                                console.warn(`Teneur en hydrogène non définie pour "${validatedData.type_combustible}" (ligne ${rowNum}). Le PCI ne peut être calculé.`);
                            } else {
                                let pcsToUse = validatedData.pcs;
                                if (validatedData.taux_metal) {
                                    const taux = Number(validatedData.taux_metal);
                                    if (taux > 0 && taux < 100) {
                                       pcsToUse = pcsToUse * (1 - taux / 100);
                                    }
                                }
                                finalPci = calculerPCI(pcsToUse, validatedData.h2o, hValue);
                            }
                        }

                        if (!validatedData.type_combustible || !validatedData.fournisseur || validatedData.h2o === undefined) {
                            throw new Error("Les colonnes 'type_combustible', 'fournisseur' et 'h2o' sont obligatoires.")
                        }

                        return { 
                            ...validatedData,
                            pcs: validatedData.pcs ?? null,
                            pci_brut: finalPci,
                            date_creation: Timestamp.now(),
                            date_arrivage: Timestamp.fromDate(validatedData.date_arrivage as Date)
                        };

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
    return sortedAndFilteredResults.map(result => {
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
            pcs: formatNumber(result.pcs, 0),
            pciAlert: alerte.details.pci,
            h2oAlert: alerte.details.h2o,
            chloreAlert: alerte.details.chlore,
            cendresAlert: alerte.details.cendres,
            alerte,
            remarque: result.remarques,
            original: result, // Keep original for sorting
        };
    });
  }, [sortedAndFilteredResults]);
  
  const exportData = (type: 'excel' | 'pdf', scope: 'current' | 'daily' | 'weekly' | 'monthly' | 'last_month') => {
    let dataToExport: Result[] = [];
    let reportTitle = "Rapport des Résultats d'Analyses";
    const now = new Date();

    if (scope === 'current') {
        dataToExport = sortedAndFilteredResults;
        reportTitle = "Export de la vue actuelle";
    } else {
        let startDate: Date;
        let endDate: Date = endOfDay(now);

        switch (scope) {
            case 'daily':
                startDate = startOfDay(now);
                reportTitle = `Rapport Journalier du ${format(now, "dd/MM/yyyy")}`;
                break;
            case 'weekly':
                startDate = startOfWeek(now, { weekStartsOn: 1 });
                endDate = endOfWeek(now, { weekStartsOn: 1 });
                reportTitle = `Rapport Hebdomadaire (Semaine du ${format(startDate, "dd/MM")})`;
                break;
            case 'monthly':
                startDate = startOfMonth(now);
                endDate = endOfMonth(now);
                reportTitle = `Rapport Mensuel (${format(now, "MMMM yyyy", { locale: fr })})`;
                break;
            case 'last_month':
                const lastMonth = subMonths(now, 1);
                startDate = startOfMonth(lastMonth);
                endDate = endOfMonth(lastMonth);
                reportTitle = `Rapport Mensuel (${format(lastMonth, "MMMM yyyy", { locale: fr })})`;
                break;
        }

        dataToExport = results.filter(row => {
            const dateArrivage = normalizeDate(row.date_arrivage);
            if (!dateArrivage) return false;
            return dateArrivage >= startDate && dateArrivage <= endDate;
        }).sort((a, b) => {
          const dateA = normalizeDate(a.date_arrivage)?.getTime() || 0;
          const dateB = normalizeDate(b.date_arrivage)?.getTime() || 0;
          return dateB - dateA;
        });
    }

    if (dataToExport.length === 0) {
        toast({
            variant: "destructive",
            title: "Aucune donnée",
            description: "Il n'y a aucune donnée à exporter pour la période sélectionnée.",
        });
        return;
    }

    if (type === 'excel') {
        const filename = `Export_Resultats_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
        const excelData = dataToExport.map(row => {
             const date = normalizeDate(row.date_arrivage);
             const alerte = generateAlerts(row);
             return {
                "Date Arrivage": date ? format(date, "dd/MM/yyyy") : "Date invalide",
                "Type Combustible": row.type_combustible,
                "Fournisseur": row.fournisseur,
                "PCS (kcal/kg)": row.pcs,
                "PCI sur Brut (kcal/kg)": row.pci_brut,
                "% H2O": row.h2o,
                "% Cl-": row.chlore,
                "% Cendres": row.cendres,
                "Alertes": alerte.isConform ? 'Conforme' : alerte.text,
                "Remarques": row.remarques || ""
            }
        });
        const ws = XLSX.utils.json_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Rapport AFR");
        XLSX.writeFile(wb, filename);
    } else {
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.text(reportTitle, 14, 15);
        const head = [["Date", "Combustible", "Fournisseur", "PCS", "PCI Brut", "H2O", "Cl-", "Cendres", "Alertes", "Remarques"]];
        const body = dataToExport.map(row => {
          const date = normalizeDate(row.date_arrivage);
          const alerte = generateAlerts(row);
          return [
            date ? format(date, "dd/MM/yy") : "Date invalide",
            row.type_combustible,
            row.fournisseur,
            formatNumber(row.pcs, 0),
            formatNumber(row.pci_brut, 0),
            formatNumber(row.h2o, 1),
            formatNumber(row.chlore, 2),
            formatNumber(row.cendres, 1),
            alerte.text,
            row.remarques || "-",
        ]});

        doc.autoTable({
            head: head,
            body: body,
            startY: 20,
            theme: 'grid',
            styles: { fontSize: 7, cellPadding: 1.5 },
            headStyles: { fillColor: [22, 163, 74], textColor: 255, fontStyle: 'bold' }
        });
        doc.save(`Rapport_Resultats_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    }
 };

  if (loading) {
    return (
      <div className="space-y-2 p-4 lg:p-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
      <>
        <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileImport}
            accept=".xlsx, .xls"
        />
        <ResultsPagePro 
            rows={tableRows}
            fuels={uniqueFuelTypes}
            suppliers={availableFournisseurs}
            fuel={fuelTypeFilter}
            setFuel={setFuelTypeFilter}
            supplier={fournisseurFilter}
            setSupplier={setFournisseurFilter}
            from={dateFromFilter}
            setFrom={setDateFromFilter}
            to={dateToFilter}
            setTo={setDateToFilter}
            onImport={() => fileInputRef.current?.click()}
            onExport={exportData}
            onDeleteAll={() => setIsDeleteAllConfirmOpen(true)}
            onDeleteOne={(id) => setResultToDelete(id)}
            sortConfig={sortConfig}
            onSort={requestSort}
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
