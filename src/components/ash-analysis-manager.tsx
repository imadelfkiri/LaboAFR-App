
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
import { format, startOfDay, endOfDay, isValid, parse } from 'date-fns';
import { fr } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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
import { ClipboardList, PlusCircle, Trash2, Edit, Save, CalendarIcon, Search, FileUp, Download, ChevronDown } from 'lucide-react';
import { cn } from "@/lib/utils";

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

const formatNumber = (num: number | null | undefined, digits: number = 1) => {
    if (num === null || num === undefined) return '-';
    if (!isFinite(num)) return "∞";
    return num.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

const modulesFormatNumber = (num: number | null | undefined, digits: number = 2) => {
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

export function AshAnalysisManager() {
    const [analyses, setAnalyses] = useState<AshAnalysis[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingRowId, setDeletingRowId] = useState<string | null>(null);
    const [editingAnalysis, setEditingAnalysis] = useState<AshAnalysis | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // Filters
    const [fuelTypeFilter, setFuelTypeFilter] = useState('all');
    const [fournisseurFilter, setFournisseurFilter] = useState('all');
    const [dateRangeFilter, setDateRangeFilter] = useState<DateRange | undefined>();
    const [searchQuery, setSearchQuery] = useState('');

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
            setFuelTypes(fTypes);
            setFournisseurs(founisseursList);

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

    const filteredAnalyses = useMemo(() => {
        return analyses.filter(a => {
            const date = a.date_arrivage.toDate();
            const fuelTypeMatch = fuelTypeFilter === 'all' || a.type_combustible === fuelTypeFilter;
            const fournisseurMatch = fournisseurFilter === 'all' || a.fournisseur === fournisseurFilter;
            const dateMatch = !dateRangeFilter || (
                (!dateRangeFilter.from || date >= startOfDay(dateRangeFilter.from)) &&
                (!dateRangeFilter.to || date <= endOfDay(dateRangeFilter.to))
            );
            const searchMatch = !searchQuery || 
                a.type_combustible.toLowerCase().includes(searchQuery.toLowerCase()) || 
                a.fournisseur.toLowerCase().includes(searchQuery.toLowerCase());
            
            return fuelTypeMatch && fournisseurMatch && dateMatch && searchMatch;
        });
    }, [analyses, fuelTypeFilter, fournisseurFilter, dateRangeFilter, searchQuery]);


    const exportToExcel = () => {
        const dataToExport = filteredAnalyses.map(a => {
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
        
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Analyses Cendres");
        XLSX.writeFile(workbook, `Export_Analyses_Cendres_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    };

    const exportToPdf = () => {
        if (filteredAnalyses.length === 0) {
            toast({ variant: "destructive", title: "Aucune donnée", description: "Il n'y a pas de données à exporter." });
            return;
        }

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

        const body = filteredAnalyses.map(a => {
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


    return (
      <div className="space-y-4 h-full flex flex-col">
        <Card>
            <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <ClipboardList className="h-6 w-6 text-primary" />
                            Suivi des Analyses de Cendres
                        </CardTitle>
                        <CardDescription>
                            Saisir, consulter et modifier les analyses chimiques des cendres.
                        </CardDescription>
                    </div>
                     <div className='flex gap-2 flex-wrap justify-end'>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline">
                                    <Download className="mr-2 h-4 w-4" />
                                    Exporter
                                    <ChevronDown className="ml-2 h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={exportToExcel}>Exporter en Excel</DropdownMenuItem>
                                <DropdownMenuItem onClick={exportToPdf}>Exporter en PDF</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleFileImport}
                            accept=".xlsx, .xls"
                        />
                        <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                            <FileUp className="mr-2 h-4 w-4" />
                            Importer depuis Excel
                        </Button>
                        <Button onClick={() => handleModalOpen()}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Ajouter une analyse
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 border rounded-lg">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Rechercher..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>
                    <Select value={fuelTypeFilter} onValueChange={setFuelTypeFilter}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="all">Tous les combustibles</SelectItem>{fuelTypes.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={fournisseurFilter} onValueChange={setFournisseurFilter}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="all">Tous les fournisseurs</SelectItem>{fournisseurs.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                    </Select>
                    <Popover>
                      <PopoverTrigger asChild>
                          <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !dateRangeFilter && "text-muted-foreground")}>
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {dateRangeFilter?.from ? (dateRangeFilter.to ? `${format(dateRangeFilter.from, "d MMM y", {locale:fr})} - ${format(dateRangeFilter.to, "d MMM y", {locale:fr})}` : format(dateRangeFilter.from, "d MMM y", {locale:fr})) : <span>Filtrer par date</span>}
                          </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start"><Calendar initialFocus mode="range" defaultMonth={dateRangeFilter?.from} selected={dateRangeFilter} onSelect={setDateRangeFilter} numberOfMonths={2} locale={fr}/></PopoverContent>
                    </Popover>
                </div>
            </CardContent>
        </Card>
        
        <Card className="flex-1 flex flex-col rounded-2xl shadow-sm">
            <CardContent className="p-0 flex-1">
                <div className="overflow-auto rounded-2xl h-full">
                    <Table className="min-w-max relative border-collapse">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="sticky top-0 z-30 left-0 bg-background/95 backdrop-blur p-2 text-left whitespace-nowrap">Date Arrivage</TableHead>
                                <TableHead className="sticky top-0 z-30 left-[120px] bg-background/95 backdrop-blur p-2 text-left">Combustible</TableHead>
                                <TableHead className="sticky top-0 z-20 bg-background/95 backdrop-blur p-2 text-left">Fournisseur</TableHead>
                                <TableHead className="sticky top-0 z-20 bg-background/95 backdrop-blur p-2 text-right">% Cendres</TableHead>
                                <TableHead className="sticky top-0 z-20 bg-background/95 backdrop-blur p-2 text-right">PAF</TableHead>
                                <TableHead className="sticky top-0 z-20 bg-background/95 backdrop-blur p-2 text-right">SiO2</TableHead>
                                <TableHead className="sticky top-0 z-20 bg-background/95 backdrop-blur p-2 text-right">Al2O3</TableHead>
                                <TableHead className="sticky top-0 z-20 bg-background/95 backdrop-blur p-2 text-right">Fe2O3</TableHead>
                                <TableHead className="sticky top-0 z-20 bg-background/95 backdrop-blur p-2 text-right">CaO</TableHead>
                                <TableHead className="sticky top-0 z-20 bg-background/95 backdrop-blur p-2 text-right">MgO</TableHead>
                                <TableHead className="sticky top-0 z-20 bg-background/95 backdrop-blur p-2 text-right">SO3</TableHead>
                                <TableHead className="sticky top-0 z-20 bg-background/95 backdrop-blur p-2 text-right">K2O</TableHead>
                                <TableHead className="sticky top-0 z-20 bg-background/95 backdrop-blur p-2 text-right">TiO2</TableHead>
                                <TableHead className="sticky top-0 z-20 bg-background/95 backdrop-blur p-2 text-right">MnO</TableHead>
                                <TableHead className="sticky top-0 z-20 bg-background/95 backdrop-blur p-2 text-right">P2O5</TableHead>
                                <TableHead className="sticky top-0 z-20 bg-background/95 backdrop-blur p-2 text-center">MS</TableHead>
                                <TableHead className="sticky top-0 z-20 bg-background/95 backdrop-blur p-2 text-center">A/F</TableHead>
                                <TableHead className="sticky top-0 z-20 bg-background/95 backdrop-blur p-2 text-center">LSF</TableHead>
                                <TableHead className="sticky top-0 z-30 right-0 bg-background/95 backdrop-blur p-2 text-center">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 10 }).map((_, i) => (
                                    <TableRow key={i}><TableCell colSpan={19} className="py-2"><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                                ))
                            ) : filteredAnalyses.length > 0 ? (
                                filteredAnalyses.map(analysis => {
                                    const { ms, af, lsf } = calculateModules(analysis.sio2, analysis.al2o3, analysis.fe2o3, analysis.cao);
                                    return (
                                        <TableRow key={analysis.id} className="h-auto hover:bg-muted/40">
                                            <TableCell className="sticky left-0 py-1.5 z-10 bg-background hover:bg-muted/40">{format(analysis.date_arrivage.toDate(), "d MMM yyyy", {locale: fr})}</TableCell>
                                            <TableCell className="font-medium sticky left-[120px] py-1.5 z-10 bg-background hover:bg-muted/40">{analysis.type_combustible}</TableCell>
                                            <TableCell className="py-1.5">{analysis.fournisseur}</TableCell>
                                            <TableCell className="text-right py-1.5">{formatNumber(analysis.pourcentage_cendres, 1)}</TableCell>
                                            <TableCell className="text-right py-1.5">{formatNumber(analysis.paf, 1)}</TableCell>
                                            <TableCell className="text-right py-1.5">{formatNumber(analysis.sio2, 1)}</TableCell>
                                            <TableCell className="text-right py-1.5">{formatNumber(analysis.al2o3, 1)}</TableCell>
                                            <TableCell className="text-right py-1.5">{formatNumber(analysis.fe2o3, 1)}</TableCell>
                                            <TableCell className="text-right py-1.5">{formatNumber(analysis.cao, 1)}</TableCell>
                                            <TableCell className="text-right py-1.5">{formatNumber(analysis.mgo, 1)}</TableCell>
                                            <TableCell className="text-right py-1.5">{formatNumber(analysis.so3, 1)}</TableCell>
                                            <TableCell className="text-right py-1.5">{formatNumber(analysis.k2o, 1)}</TableCell>
                                            <TableCell className="text-right py-1.5">{formatNumber(analysis.tio2, 1)}</TableCell>
                                            <TableCell className="text-right py-1.5">{formatNumber(analysis.mno, 1)}</TableCell>
                                            <TableCell className="text-right py-1.5">{formatNumber(analysis.p2o5, 1)}</TableCell>
                                            <TableCell className="text-right font-medium text-blue-600 py-1.5">{modulesFormatNumber(ms)}</TableCell>
                                            <TableCell className="text-right font-medium text-green-600 py-1.5">{modulesFormatNumber(af)}</TableCell>
                                            <TableCell className="text-right font-medium text-orange-600 py-1.5">{modulesFormatNumber(lsf)}</TableCell>
                                            <TableCell className="sticky right-0 py-1.5 text-center z-10 bg-background hover:bg-muted/40">
                                                <div className="flex justify-center items-center">
                                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleModalOpen(analysis)}><Edit className="h-4 w-4" /></Button>
                                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDeletingRowId(analysis.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            ) : (
                                <TableRow><TableCell colSpan={19} className="h-24 text-center">Aucune analyse trouvée.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>


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
      </div>
    );
}

    