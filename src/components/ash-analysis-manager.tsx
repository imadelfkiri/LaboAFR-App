
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
    getAshAnalyses,
    addAshAnalysis,
    updateAshAnalysis,
    deleteAshAnalysis,
    getUniqueFuelTypesFromResultats,
    getFournisseurs,
    type AshAnalysis,
    addManyAshAnalyses,
} from '@/lib/data';
import * as XLSX from 'xlsx';
import jsPDF from "jspdf";
import "jspdf-autotable";
import { Timestamp } from 'firebase/firestore';
import { DateRange } from "react-day-picker";
import { format, startOfDay, endOfDay, isValid, parse, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  FormLabel,
} from "@/components/ui/form";
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { ClipboardList, PlusCircle, Trash2, Edit, Save, CalendarIcon, Search, FileUp, Download, ChevronDown, ArrowUpDown, Filter, Plus, Upload } from 'lucide-react';
import { cn } from "@/lib/utils";
import ToolbarAnalysesCendres from './toolbar-analyses-cendres';

// Extend jsPDF for autoTable
declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

const analysisSchema = z.object({
  id: z.string().optional(),
  date_arrivage: z.date({ required_error: "Date requise." }),
  type_combustible: z.string().nonempty({ message: "Requis." }),
  fournisseur: z.string().nonempty({ message: "Requis." }),
  pourcentage_cendres: z.coerce.number().optional().nullable(),
  paf: z.coerce.number().optional().nullable(),
  sio2: z.coerce.number().optional().nullable(),
  al2o3: z.coerce.number().optional().nullable(),
  fe2o3: z.coerce.number().optional().nullable(),
  cao: z.coerce.number().optional().nullable(),
  mgo: z.coerce.number().optional().nullable(),
  so3: z.coerce.number().optional().nullable(),
  k2o: z.coerce.number().optional().nullable(),
  tio2: z.coerce.number().optional().nullable(),
  mno: z.coerce.number().optional().nullable(),
  p2o5: z.coerce.number().optional().nullable(),
});

type FormValues = z.infer<typeof analysisSchema>;
type SortableKeys = keyof AshAnalysis | 'ms' | 'af' | 'lsf';


const calculateModules = (sio2?: number | null, al2o3?: number | null, fe2o3?: number | null, cao?: number | null) => {
    const s = sio2 || 0;
    const a = al2o3 || 0;
    const f = fe2o3 || 0;
    const c = cao || 0;

    const ms_denom = a + f;
    const af_denom = f;
    const lsf_denom = (2.8 * s) + (1.18 * a) + (0.65 * f);

    const ms = ms_denom > 0 ? s / ms_denom : Infinity;
    const af = af_denom > 0 ? a / af_denom : Infinity;
    const lsf = lsf_denom > 0 ? (100 * c) / lsf_denom : Infinity;

    return { ms, af, lsf };
};

const formatNumberForTable = (num: number | null | undefined, digits: number = 1) => {
    if (num === null || num === undefined) return '-';
    if (!isFinite(num)) return "∞";
    return num.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

const AnalysisForm = ({
  form,
  onSubmit,
  fuelTypes,
  fournisseurs,
  isSubmitting,
}: {
  form: any;
  onSubmit: (values: FormValues) => void;
  fuelTypes: string[];
  fournisseurs: string[];
  isSubmitting: boolean;
}) => (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField control={form.control} name="date_arrivage" render={({ field }) => (
            <FormItem>
              <FormLabel>Date Arrivage</FormLabel>
              <Popover>
                  <PopoverTrigger asChild>
                  <FormControl>
                      <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal",!field.value && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {field.value ? (format(field.value, "PPP", { locale: fr })) : (<span>Choisir une date</span>)}
                      </Button>
                  </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={fr} /></PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}/>
          <FormField control={form.control} name="type_combustible" render={({ field }) => (
            <FormItem><FormLabel>Type Combustible</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger></FormControl><SelectContent>{fuelTypes.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
          )}/>
          <FormField control={form.control} name="fournisseur" render={({ field }) => (
            <FormItem><FormLabel>Fournisseur</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger></FormControl><SelectContent>{fournisseurs.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
          )}/>
        </div>
        <Card><CardContent className="pt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <FormField control={form.control} name="pourcentage_cendres" render={({ field }) => (<FormItem><FormLabel>% Cendres</FormLabel><FormControl><Input type="number" step="any" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)}/>
            <FormField control={form.control} name="paf" render={({ field }) => (<FormItem><FormLabel>PAF</FormLabel><FormControl><Input type="number" step="any" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)}/>
            <FormField control={form.control} name="sio2" render={({ field }) => (<FormItem><FormLabel>SiO2</FormLabel><FormControl><Input type="number" step="any" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)}/>
            <FormField control={form.control} name="al2o3" render={({ field }) => (<FormItem><FormLabel>Al2O3</FormLabel><FormControl><Input type="number" step="any" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)}/>
            <FormField control={form.control} name="fe2o3" render={({ field }) => (<FormItem><FormLabel>Fe2O3</FormLabel><FormControl><Input type="number" step="any" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)}/>
            <FormField control={form.control} name="cao" render={({ field }) => (<FormItem><FormLabel>CaO</FormLabel><FormControl><Input type="number" step="any" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)}/>
            <FormField control={form.control} name="mgo" render={({ field }) => (<FormItem><FormLabel>MgO</FormLabel><FormControl><Input type="number" step="any" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)}/>
            <FormField control={form.control} name="so3" render={({ field }) => (<FormItem><FormLabel>SO3</FormLabel><FormControl><Input type="number" step="any" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)}/>
            <FormField control={form.control} name="k2o" render={({ field }) => (<FormItem><FormLabel>K2O</FormLabel><FormControl><Input type="number" step="any" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)}/>
            <FormField control={form.control} name="tio2" render={({ field }) => (<FormItem><FormLabel>TiO2</FormLabel><FormControl><Input type="number" step="any" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)}/>
            <FormField control={form.control} name="mno" render={({ field }) => (<FormItem><FormLabel>MnO</FormLabel><FormControl><Input type="number" step="any" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)}/>
            <FormField control={form.control} name="p2o5" render={({ field }) => (<FormItem><FormLabel>P2O5</FormLabel><FormControl><Input type="number" step="any" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)}/>
        </CardContent></Card>
        <DialogFooter>
            <DialogClose asChild><Button type="button" variant="secondary">Annuler</Button></DialogClose>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Enregistrement..." : "Enregistrer"}</Button>
        </DialogFooter>
      </form>
    </Form>
);

function AnalysesCendresView({
  rows = [],
  fuels = [],
  suppliers = [],
  onAdd = () => {},
  onEdit = () => {},
  onDelete = () => {},
  onExport = () => {},
  onImport = () => {},
  onSort,
  sortConfig,
  q = "",
  setQ = () => {},
  fuel = "__ALL__",
  setFuel = () => {},
  supplier = "__ALL__",
  setSupplier = () => {},
  from = "",
  setFrom = () => {},
  to = "",
  setTo = () => {},
}) {
  const chip = (v: number | undefined, t: "MS"|"AF"|"LSF") => {
    const n = typeof v === "number" && isFinite(v) ? v : undefined
    const base = "inline-flex items-center justify-center rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums"
    if (n === undefined) return <span className={`${base} bg-muted text-muted-foreground`}>-</span>
    if (t === "MS") return <span className={`${base} ${n<1.5?"bg-red-100 text-red-700":n<2.0?"bg-yellow-100 text-yellow-800":"bg-green-100 text-green-800"}`}>{n.toFixed(2)}</span>
    if (t === "AF") return <span className={`${base} ${n<0.5?"bg-red-100 text-red-700":n<1.5?"bg-yellow-100 text-yellow-800":"bg-green-100 text-green-800"}`}>{n.toFixed(2)}</span>
    return <span className={`${base} ${n<0.80?"bg-red-100 text-red-700":n<=1.00?"bg-yellow-100 text-yellow-800":"bg-green-100 text-green-800"}`}>{n.toFixed(2)}</span>
  }

  const SortableHeader = ({ label, sortKey }: { label: string; sortKey: SortableKeys }) => {
    const isSorted = sortConfig?.key === sortKey;
    return (
      <th
        onClick={() => onSort(sortKey)}
        className="sticky top-0 z-20 bg-background/95 backdrop-blur p-2 text-left font-semibold border-b cursor-pointer hover:bg-muted/50"
      >
        <div className="flex items-center gap-2">
            <span>{label}</span>
            {isSorted && (
                <ArrowUpDown className="h-4 w-4 text-foreground" />
            )}
        </div>
      </th>
    );
  };
  
  const headers: { label: string; key: SortableKeys; align?: 'right'|'center' }[] = [
    { label: "Date Arrivage", key: "date_arrivage" },
    { label: "Combustible", key: "type_combustible" },
    { label: "Fournisseur", key: "fournisseur" },
    { label: "% Cendres", key: "pourcentage_cendres", align: "right" },
    { label: "PAF", key: "paf", align: "right" },
    { label: "SiO2", key: "sio2", align: "right" },
    { label: "Al2O3", key: "al2o3", align: "right" },
    { label: "Fe2O3", key: "fe2o3", align: "right" },
    { label: "CaO", key: "cao", align: "right" },
    { label: "MgO", key: "mgo", align: "right" },
    { label: "SO3", key: "so3", align: "right" },
    { label: "K2O", key: "k2o", align: "right" },
    { label: "TiO2", key: "tio2", align: "right" },
    { label: "MnO", key: "mno", align: "right" },
    { label: "P2O5", key: "p2o5", align: "right" },
    { label: "MS", key: "ms", align: "center" },
    { label: "A/F", key: "af", align: "center" },
    { label: "LSF", key: "lsf", align: "center" },
  ];

  return (
    <div className="flex flex-col h-full">
      <ToolbarAnalysesCendres
        q={q} setQ={setQ}
        fuel={fuel} setFuel={setFuel}
        supplier={supplier} setSupplier={setSupplier}
        from={from} setFrom={setFrom}
        to={to} setTo={setTo}
        fuels={fuels} suppliers={suppliers}
        onAdd={onAdd} onExport={onExport} onImport={onImport}
      />

      <div className="flex-grow px-3 md:px-5 pb-3 md:pb-5">
        <Card className="rounded-2xl shadow-md h-full">
          <CardContent className="p-0 h-full">
            <div className="max-h-[70vh] overflow-auto rounded-2xl border-t bg-background h-full">
              <table className="w-full text-[13px] border-separate border-spacing-0">
                <thead className="text-muted-foreground">
                  <tr>
                    {headers.map(h => <SortableHeader key={h.key} label={h.label} sortKey={h.key} />)}
                    <th className="sticky top-0 z-20 bg-background/95 backdrop-blur p-2 text-center font-semibold border-b">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(rows ?? []).map((r: any, i: number) => (
                    <tr key={r.id ?? i} className="border-b last:border-0 even:bg-muted/30 hover:bg-muted/50 transition-colors">
                      <td className="p-2 text-muted-foreground whitespace-nowrap">{r.dateArrivage}</td>
                      <td className="p-2 font-medium">{r.combustible}</td>
                      <td className="p-2">{r.fournisseur}</td>
                      <td className="p-2 text-right tabular-nums">{r.oxides?.['%Cendres']}</td>
                      <td className="p-2 text-right tabular-nums">{r.oxides?.PAF}</td>
                      <td className="p-2 text-right tabular-nums">{r.oxides?.SiO2}</td>
                      <td className="p-2 text-right tabular-nums">{r.oxides?.Al2O3}</td>
                      <td className="p-2 text-right tabular-nums">{r.oxides?.Fe2O3}</td>
                      <td className="p-2 text-right tabular-nums">{r.oxides?.CaO}</td>
                      <td className="p-2 text-right tabular-nums">{r.oxides?.MgO}</td>
                      <td className="p-2 text-right tabular-nums">{r.oxides?.SO3}</td>
                      <td className="p-2 text-right tabular-nums">{r.oxides?.K2O}</td>
                      <td className="p-2 text-right tabular-nums">{r.oxides?.TiO2}</td>
                      <td className="p-2 text-right tabular-nums">{r.oxides?.MnO}</td>
                      <td className="p-2 text-right tabular-nums">{r.oxides?.P2O5}</td>
                      <td className="p-2 text-center">{chip(r.modules?.MS, "MS")}</td>
                      <td className="p-2 text-center">{chip(r.modules?.AF, "AF")}</td>
                      <td className="p-2 text-center">{chip(r.modules?.LSF, "LSF")}</td>
                      <td className="p-2 text-center">
                        <div className="inline-flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(r.original)} title="Éditer">
                              <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(r.id)} title="Supprimer">
                              <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(!rows || rows.length === 0) && (
                    <tr><td colSpan={19} className="p-6 text-center text-muted-foreground">Aucune donnée.</td></tr>
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

export function AshAnalysisManager() {
    const [analyses, setAnalyses] = useState<AshAnalysis[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingRowId, setDeletingRowId] = useState<string | null>(null);
    const [editingAnalysis, setEditingAnalysis] = useState<AshAnalysis | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // Filters
    const [fuelTypeFilter, setFuelTypeFilter] = useState('__ALL__');
    const [fournisseurFilter, setFournisseurFilter] = useState('__ALL__');
    const [dateFromFilter, setDateFromFilter] = useState('');
    const [dateToFilter, setDateToFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Sorting
    const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: 'ascending' | 'descending' } | null>({ key: 'date_arrivage', direction: 'descending' });

    const [fuelTypes, setFuelTypes] = useState<string[]>([]);
    const [fournisseurs, setFournisseurs] = useState<string[]>([]);

    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const form = useForm<FormValues>({
        resolver: zodResolver(analysisSchema),
    });
    const { reset, handleSubmit, formState: { isSubmitting } } = form;

    const fetchInitialData = useCallback(async () => {
        setLoading(true);
        try {
            const [analysesData, fTypes, founisseursList] = await Promise.all([
                getAshAnalyses(),
                getUniqueFuelTypesFromResultats(),
                getFournisseurs()
            ]);
            
            setAnalyses(analysesData);
            setFuelTypes(fTypes.sort());
            setFournisseurs(founisseursList.sort());

        } catch (error) {
            console.error("Error fetching data:", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les analyses." });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);

    const handleModalOpen = (analysis: AshAnalysis | null = null) => {
        setEditingAnalysis(analysis);
        if (analysis) {
            reset({ ...analysis, date_arrivage: analysis.date_arrivage.toDate() });
        } else {
            reset({
                date_arrivage: new Date(),
                type_combustible: '',
                fournisseur: '',
                pourcentage_cendres: null, paf: null, sio2: null, al2o3: null, fe2o3: null,
                cao: null, mgo: null, so3: null, k2o: null, tio2: null, mno: null, p2o5: null,
            });
        }
        setIsModalOpen(true);
    };

    const onSubmit = async (data: FormValues) => {
        const dataWithTimestamp = {
            ...data,
            date_arrivage: Timestamp.fromDate(data.date_arrivage),
        };

        try {
            if (editingAnalysis) {
                await updateAshAnalysis(editingAnalysis.id, dataWithTimestamp);
                toast({ title: "Succès", description: "Analyse mise à jour." });
            } else {
                await addAshAnalysis(dataWithTimestamp);
                toast({ title: "Succès", description: "Analyse ajoutée." });
            }
            setIsModalOpen(false);
            fetchInitialData(); // Refresh data
        } catch (error) {
            console.error("Error saving data:", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible d'enregistrer l'analyse." });
        }
    };

    const handleDelete = async () => {
        if (!deletingRowId) return;
        try {
            await deleteAshAnalysis(deletingRowId);
            toast({ title: "Succès", description: "Analyse supprimée." });
            fetchInitialData(); // Refresh data
        } catch (error) {
            console.error("Error deleting data:", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de supprimer l'analyse." });
        } finally {
            setDeletingRowId(null);
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

        if (typeof value === 'number') {
            const date = excelDateToJSDate(value);
            if (isValid(date)) return date;
        }
        
        if (typeof value === 'string') {
            const dateFormats = [
                'dd/MM/yyyy', 'd/M/yyyy', 'dd-MM-yyyy', 'd-M-yyyy',
                'yyyy/MM/dd', 'yyyy-MM-dd', 'MM/dd/yyyy'
            ];
            for (const fmt of dateFormats) {
                const date = parse(value, fmt, new Date());
                if (isValid(date)) return date;
            }
        }
        
        throw new Error(`Format de date non reconnu à la ligne ${rowNum} pour la valeur "${value}".`);
    }

    const headerMapping: { [key: string]: keyof FormValues } = {
        'date arrivage': 'date_arrivage',
        'combustible': 'type_combustible',
        'fournisseur': 'fournisseur',
        '% cendres': 'pourcentage_cendres',
        'cendres': 'pourcentage_cendres',
        '% cendre': 'pourcentage_cendres',
        'cendre': 'pourcentage_cendres',
        'paf': 'paf',
        'sio2': 'sio2',
        'al2o3': 'al2o3',
        'fe2o3': 'fe2o3',
        'cao': 'cao',
        'mgo': 'mgo',
        'so3': 'so3',
        'k2o': 'k2o',
        'tio2': 'tio2',
        'mno': 'mno',
        'p2o5': 'p2o5',
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
                
                const parsedAnalyses = json.map((row, index) => {
                    const rowNum = index + 2; // Excel rows are 1-based, and we skip the header
                    const mappedRow: { [key: string]: any } = {};

                    for(const header in row) {
                        const normalizedHeader = header.trim().toLowerCase().replace(/\s+/g, ' ');
                        const targetKey = headerMapping[normalizedHeader];
                        if (targetKey) {
                            let value = row[header];
                            // Replace comma with dot for decimal values
                            if(typeof value === 'string' && targetKey !== 'date_arrivage' && targetKey !== 'type_combustible' && targetKey !== 'fournisseur') {
                                value = value.replace(',', '.');
                            }
                            mappedRow[targetKey] = value;
                        }
                    }

                    if (!mappedRow.date_arrivage) {
                        throw new Error(`Colonne "Date Arrivage" manquante ou non reconnue à la ligne ${rowNum}.`);
                    }

                    const parsedDate = parseDate(mappedRow.date_arrivage, rowNum);
                    
                    const validatedData = analysisSchema.omit({id: true}).parse({
                        ...mappedRow,
                        date_arrivage: parsedDate,
                    });
                    
                    return { ...validatedData, date_arrivage: Timestamp.fromDate(validatedData.date_arrivage) };
                });

                await addManyAshAnalyses(parsedAnalyses);
                toast({ title: "Succès", description: `${parsedAnalyses.length} analyses ont été importées.` });
                fetchInitialData(); // Refresh data
            } catch (error) {
                 console.error("Error importing file:", error);
                const errorMessage = error instanceof z.ZodError ? 
                    `Erreur de validation: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}` :
                    error instanceof Error ? error.message : "Une erreur inconnue est survenue.";
                toast({ variant: "destructive", title: "Erreur d'importation", description: errorMessage, duration: 9000 });
            } finally {
                if(fileInputRef.current) {
                    fileInputRef.current.value = "";
                }
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const getSortableValue = (item: AshAnalysis, key: SortableKeys) => {
        if (key === 'ms' || key === 'af' || key === 'lsf') {
            const modules = calculateModules(item.sio2, item.al2o3, item.fe2o3, item.cao);
            return modules[key];
        }
        if (key === 'date_arrivage') {
            return item.date_arrivage.toMillis();
        }
        const value = item[key as keyof AshAnalysis];
        // For sorting, treat null/undefined as a very low number to group them
        return value === null || value === undefined ? -Infinity : (typeof value === 'string' ? value.toLowerCase() : value);
    };

    const requestSort = (key: SortableKeys) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const sortedAndFilteredAnalyses = useMemo(() => {
        let sortableItems = [...analyses].filter(a => {
            const date = a.date_arrivage.toDate();
            const fuelTypeMatch = fuelTypeFilter === '__ALL__' || a.type_combustible === fuelTypeFilter;
            const fournisseurMatch = fournisseurFilter === '__ALL__' || a.fournisseur === fournisseurFilter;
            
            const dateFrom = dateFromFilter ? startOfDay(parseISO(dateFromFilter)) : null;
            const dateTo = dateToFilter ? endOfDay(parseISO(dateToFilter)) : null;
            
            const dateMatch = (!dateFrom || date >= dateFrom) && (!dateTo || date <= dateTo);
            
            const searchMatch = !searchQuery || 
                a.type_combustible.toLowerCase().includes(searchQuery.toLowerCase()) || 
                a.fournisseur.toLowerCase().includes(searchQuery.toLowerCase());
            
            return fuelTypeMatch && fournisseurMatch && dateMatch && searchMatch;
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

    }, [analyses, fuelTypeFilter, fournisseurFilter, dateFromFilter, dateToFilter, searchQuery, sortConfig]);

    const exportData = (type: 'excel' | 'pdf') => {
        const dataToExport = sortedAndFilteredAnalyses;
        if (dataToExport.length === 0) {
            toast({ variant: "destructive", title: "Aucune donnée", description: "Il n'y a pas de données à exporter." });
            return;
        }

        if (type === 'excel') {
            exportToExcel(dataToExport);
        } else {
            exportToPdf(dataToExport);
        }
    }

    const exportToExcel = (data: AshAnalysis[]) => {
        const excelData = data.map(a => {
            const { ms, af, lsf } = calculateModules(a.sio2, a.al2o3, a.fe2o3, a.cao);
            return {
                "Date Arrivage": format(a.date_arrivage.toDate(), "dd/MM/yyyy"),
                "Combustible": a.type_combustible,
                "Fournisseur": a.fournisseur,
                "% Cendres": a.pourcentage_cendres,
                "PAF": a.paf,
                "SiO2": a.sio2,
                "Al2O3": a.al2o3,
                "Fe2O3": a.fe2o3,
                "CaO": a.cao,
                "MgO": a.mgo,
                "SO3": a.so3,
                "K2O": a.k2o,
                "TiO2": a.tio2,
                "MnO": a.mno,
                "P2O5": a.p2o5,
                "MS": isFinite(ms) ? ms : null,
                "A/F": isFinite(af) ? af : null,
                "LSF": isFinite(lsf) ? lsf : null,
            }
        });
        
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Analyses Cendres");
        XLSX.writeFile(workbook, `Export_Analyses_Cendres_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    };

    const exportToPdf = (data: AshAnalysis[]) => {
        const doc = new jsPDF({ orientation: 'landscape' });
        const title = "Rapport des Analyses de Cendres";
        const generationDate = format(new Date(), "dd/MM/yyyy HH:mm:ss");

        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text(title, doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Généré le: ${generationDate}`, doc.internal.pageSize.getWidth() / 2, 22, { align: 'center' });

        const head = [[
            "Date", "Combustible", "Fourn.", "% Cendres", "PAF",
            "SiO2", "Al2O3", "Fe2O3", "CaO", "MgO", "SO3", "K2O", "TiO2", "MnO", "P2O5",
            "MS", "A/F", "LSF"
        ]];

        const body = data.map(a => {
            const { ms, af, lsf } = calculateModules(a.sio2, a.al2o3, a.fe2o3, a.cao);
            return [
                format(a.date_arrivage.toDate(), "dd/MM/yy"),
                a.type_combustible,
                a.fournisseur,
                a.pourcentage_cendres?.toFixed(1) ?? '-',
                a.paf?.toFixed(1) ?? '-',
                a.sio2?.toFixed(1) ?? '-',
                a.al2o3?.toFixed(1) ?? '-',
                a.fe2o3?.toFixed(1) ?? '-',
                a.cao?.toFixed(1) ?? '-',
                a.mgo?.toFixed(1) ?? '-',
                a.so3?.toFixed(1) ?? '-',
                a.k2o?.toFixed(1) ?? '-',
                a.tio2?.toFixed(1) ?? '-',
                a.mno?.toFixed(1) ?? '-',
                a.p2o5?.toFixed(1) ?? '-',
                isFinite(ms) ? ms.toFixed(2) : '∞',
                isFinite(af) ? af.toFixed(2) : '∞',
                isFinite(lsf) ? lsf.toFixed(2) : '∞',
            ];
        });

        doc.autoTable({
            head,
            body,
            startY: 30,
            theme: 'grid',
            styles: { fontSize: 6, cellPadding: 1.5 },
            headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
        });

        doc.save(`Rapport_Analyses_Cendres_${format(new Date(), "yyyy-MM-dd")}.pdf`);
    };
    
    const tableRows = useMemo(() => {
        return sortedAndFilteredAnalyses.map(analysis => {
            const { ms, af, lsf } = calculateModules(analysis.sio2, analysis.al2o3, analysis.fe2o3, analysis.cao);
            return {
                id: analysis.id,
                dateArrivage: format(analysis.date_arrivage.toDate(), "d MMM yyyy", { locale: fr }),
                combustible: analysis.type_combustible,
                fournisseur: analysis.fournisseur,
                oxides: {
                    '%Cendres': formatNumberForTable(analysis.pourcentage_cendres, 1),
                    PAF: formatNumberForTable(analysis.paf, 1),
                    SiO2: formatNumberForTable(analysis.sio2, 1),
                    Al2O3: formatNumberForTable(analysis.al2o3, 1),
                    Fe2O3: formatNumberForTable(analysis.fe2o3, 1),
                    CaO: formatNumberForTable(analysis.cao, 1),
                    MgO: formatNumberForTable(analysis.mgo, 1),
                    SO3: formatNumberForTable(analysis.so3, 1),
                    K2O: formatNumberForTable(analysis.k2o, 1),
                    TiO2: formatNumberForTable(analysis.tio2, 1),
                    MnO: formatNumberForTable(analysis.mno, 1),
                    P2O5: formatNumberForTable(analysis.p2o5, 1),
                },
                modules: {
                    MS: ms,
                    AF: af,
                    LSF: lsf,
                },
                original: analysis,
            };
        });
    }, [sortedAndFilteredAnalyses]);

    if (loading) {
        return <div className="p-6"><Skeleton className="h-96 w-full" /></div>
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
        <AnalysesCendresView
          rows={tableRows}
          fuels={fuelTypes}
          suppliers={fournisseurs}
          onAdd={() => handleModalOpen(null)}
          onEdit={(analysis) => handleModalOpen(analysis)}
          onDelete={(id) => setDeletingRowId(id)}
          onExport={() => exportData('excel')}
          onImport={() => fileInputRef.current?.click()}
          onSort={requestSort}
          sortConfig={sortConfig}
          q={searchQuery}
          setQ={setSearchQuery}
          fuel={fuelTypeFilter}
          setFuel={setFuelTypeFilter}
          supplier={fournisseurFilter}
          setSupplier={setFournisseurFilter}
          from={dateFromFilter}
          setFrom={setDateFromFilter}
          to={dateToFilter}
          setTo={setDateToFilter}
        />

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>{editingAnalysis ? "Modifier" : "Ajouter"} une Analyse de Cendres</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                  <AnalysisForm 
                    form={form} 
                    onSubmit={onSubmit} 
                    fuelTypes={fuelTypes} 
                    fournisseurs={fournisseurs}
                    isSubmitting={isSubmitting}
                  />
                </div>
            </DialogContent>
        </Dialog>

        <AlertDialog open={!!deletingRowId} onOpenChange={(open) => !open && setDeletingRowId(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Cette action est irréversible et supprimera définitivement cette analyse.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Supprimer</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </>
    );
}
