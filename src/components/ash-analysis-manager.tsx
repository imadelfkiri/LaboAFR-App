"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
    getAshAnalyses,
    addAshAnalysis,
    updateAshAnalysis,
    deleteAshAnalysis,
    getUniqueFuelTypesFromResultats,
    getFournisseurs,
    type AshAnalysis
} from '@/lib/data';
import { db } from '@/lib/firebase';
import { Timestamp } from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { ClipboardList, PlusCircle, Trash2, Edit, Save, CalendarIcon, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from './ui/scroll-area';

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
  observations: z.string().optional().nullable(),
});

type FormValues = {
  analyses: z.infer<typeof analysisSchema>[];
};

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

const formatNumber = (num: number | null | undefined, digits: number = 2) => {
    if (num === null || num === undefined) return '';
    if (!isFinite(num)) return "∞";
    return num.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

export function AshAnalysisManager() {
    const [loading, setLoading] = useState(true);
    const [editingRowId, setEditingRowId] = useState<string | null>(null);
    const [deletingRowId, setDeletingRowId] = useState<string | null>(null);
    
    const [fuelTypes, setFuelTypes] = useState<string[]>([]);
    const [fournisseurs, setFournisseurs] = useState<string[]>([]);

    const { toast } = useToast();

    const { control, handleSubmit, reset, watch, formState: { isSubmitting } } = useForm<FormValues>({
        defaultValues: { analyses: [] },
    });

    const { fields, append, remove, update } = useFieldArray({
        control,
        name: "analyses",
    });
    
    const watchedAnalyses = watch("analyses");

    const fetchInitialData = useCallback(async () => {
        setLoading(true);
        try {
            const [analyses, fTypes, founisseursList] = await Promise.all([
                getAshAnalyses(),
                getUniqueFuelTypesFromResultats(),
                getFournisseurs()
            ]);
            
            const formattedAnalyses = analyses.map(a => ({
                ...a,
                date_arrivage: a.date_arrivage.toDate(),
            }));
            
            reset({ analyses: formattedAnalyses });
            setFuelTypes(fTypes);
            setFournisseurs(founisseursList);

        } catch (error) {
            console.error("Error fetching data:", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les analyses." });
        } finally {
            setLoading(false);
        }
    }, [reset, toast]);

    useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);

    const onSave = async (data: z.infer<typeof analysisSchema>, index: number) => {
        const { id, ...dataToSave } = data;
        const dataWithTimestamp = {
            ...dataToSave,
            date_arrivage: Timestamp.fromDate(data.date_arrivage),
        };
        
        try {
            if (id && id.startsWith('new-')) { // It's a new record
                const newId = await addAshAnalysis(dataWithTimestamp);
                update(index, { ...data, id: newId });
                toast({ title: "Succès", description: "Analyse ajoutée." });
            } else if (id) { // It's an existing record
                await updateAshAnalysis(id, dataWithTimestamp);
                toast({ title: "Succès", description: "Analyse mise à jour." });
            }
            setEditingRowId(null);
        } catch (error) {
            console.error("Error saving data:", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible d'enregistrer l'analyse." });
        }
    };

    const handleDelete = async () => {
        if (!deletingRowId) return;
        try {
            const indexToDelete = fields.findIndex(f => f.id === deletingRowId);
            if (indexToDelete > -1) {
                const idToDeleteInDb = fields[indexToDelete].id;
                if(idToDeleteInDb && !idToDeleteInDb.startsWith('new-')) {
                   await deleteAshAnalysis(idToDeleteInDb);
                }
                remove(indexToDelete);
                toast({ title: "Succès", description: "Analyse supprimée." });
            }
        } catch (error) {
            console.error("Error deleting data:", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de supprimer l'analyse." });
        } finally {
            setDeletingRowId(null);
        }
    };

    const handleAddNew = () => {
        const newId = `new-${Date.now()}`;
        append({
            id: newId,
            date_arrivage: new Date(),
            type_combustible: '',
            fournisseur: '',
            pourcentage_cendres: null, paf: null, sio2: null, al2o3: null, fe2o3: null,
            cao: null, mgo: null, so3: null, k2o: null, tio2: null, mno: null, p2o5: null,
            observations: ''
        }, { shouldFocus: true });
        setEditingRowId(newId);
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="flex items-center gap-2">
                        <ClipboardList className="h-6 w-6 text-primary" />
                        Suivi des Analyses de Cendres des AF
                    </CardTitle>
                    <CardDescription>
                        Saisir, consulter et modifier les analyses chimiques des cendres.
                    </CardDescription>
                </div>
                <Button onClick={handleAddNew}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Ajouter une analyse
                </Button>
            </CardHeader>
            <CardContent>
                <ScrollArea className="w-full whitespace-nowrap rounded-lg border">
                    <Table className="min-w-max">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="sticky left-0 bg-muted/50 z-20 w-32">Actions</TableHead>
                                <TableHead>Date Arrivage</TableHead>
                                <TableHead>Type Combustible</TableHead>
                                <TableHead>Fournisseur</TableHead>
                                <TableHead>% Cendres</TableHead>
                                <TableHead>PAF</TableHead>
                                <TableHead>SiO2</TableHead>
                                <TableHead>Al2O3</TableHead>
                                <TableHead>Fe2O3</TableHead>
                                <TableHead>CaO</TableHead>
                                <TableHead>MgO</TableHead>
                                <TableHead>SO3</TableHead>
                                <TableHead>K2O</TableHead>
                                <TableHead>TiO2</TableHead>
                                <TableHead>MnO</TableHead>
                                <TableHead>P2O5</TableHead>
                                <TableHead className="bg-blue-100">MS</TableHead>
                                <TableHead className="bg-blue-100">A/F</TableHead>
                                <TableHead className="bg-blue-100">LSF</TableHead>
                                <TableHead>Observations</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={20}>
                                        <Skeleton className="h-48 w-full" />
                                    </TableCell>
                                </TableRow>
                            ) : fields.length > 0 ? (
                                fields.map((field, index) => {
                                    const isEditing = editingRowId === field.id;
                                    const analysis = watchedAnalyses[index];
                                    const { ms, af, lsf } = calculateModules(analysis.sio2, analysis.al2o3, analysis.fe2o3, analysis.cao);
                                    
                                    return (
                                        <TableRow key={field.id}>
                                            <TableCell className="sticky left-0 bg-background z-10">
                                                <div className="flex items-center gap-1">
                                                    {isEditing ? (
                                                         <Button size="icon" variant="ghost" onClick={handleSubmit(() => onSave(watchedAnalyses[index], index))} disabled={isSubmitting}>
                                                            <Save className="h-4 w-4 text-green-600"/>
                                                        </Button>
                                                    ) : (
                                                        <Button size="icon" variant="ghost" onClick={() => setEditingRowId(field.id)}>
                                                            <Edit className="h-4 w-4 text-muted-foreground" />
                                                        </Button>
                                                    )}
                                                    <Button size="icon" variant="ghost" onClick={() => setDeletingRowId(field.id)}>
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                            
                                            {/* Data Cells */}
                                            {[
                                                { name: "date_arrivage", type: 'date'},
                                                { name: "type_combustible", type: 'select', options: fuelTypes},
                                                { name: "fournisseur", type: 'select', options: fournisseurs },
                                                { name: "pourcentage_cendres", type: 'number'},
                                                { name: "paf", type: 'number'},
                                                { name: "sio2", type: 'number'},
                                                { name: "al2o3", type: 'number'},
                                                { name: "fe2o3", type: 'number'},
                                                { name: "cao", type: 'number'},
                                                { name: "mgo", type: 'number'},
                                                { name: "so3", type: 'number'},
                                                { name: "k2o", type: 'number'},
                                                { name: "tio2", type: 'number'},
                                                { name: "mno", type: 'number'},
                                                { name: "p2o5", type: 'number'},
                                            ].map(col => (
                                                <TableCell key={col.name}>
                                                    <Controller
                                                        name={`analyses.${index}.${col.name as any}`}
                                                        control={control}
                                                        render={({ field: controllerField }) => {
                                                            if (!isEditing) {
                                                                if (col.type === 'date') return format(controllerField.value, 'dd/MM/yyyy');
                                                                return formatNumber(controllerField.value, 2) || 'N/A';
                                                            }
                                                            if (col.type === 'date') return (
                                                                <Popover>
                                                                    <PopoverTrigger asChild>
                                                                        <Button variant="outline" className="w-36 justify-start text-left font-normal">
                                                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                                                            {format(controllerField.value, "dd/MM/yy")}
                                                                        </Button>
                                                                    </PopoverTrigger>
                                                                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={controllerField.value} onSelect={controllerField.onChange} initialFocus /></PopoverContent>
                                                                </Popover>
                                                            );
                                                            if (col.type === 'select') return (
                                                                <Select onValueChange={controllerField.onChange} value={controllerField.value}>
                                                                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                                                                    <SelectContent>{col.options?.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                                                                </Select>
                                                            );
                                                            return <Input type="number" step="any" {...controllerField} value={controllerField.value ?? ''} className="w-24" />;
                                                        }}
                                                    />
                                                </TableCell>
                                            ))}

                                            {/* Calculated and Observation cells */}
                                            <TableCell className="font-bold bg-blue-50">{formatNumber(ms)}</TableCell>
                                            <TableCell className="font-bold bg-blue-50">{formatNumber(af)}</TableCell>
                                            <TableCell className="font-bold bg-blue-50">{formatNumber(lsf)}</TableCell>
                                            <TableCell>
                                                <Controller
                                                    name={`analyses.${index}.observations`}
                                                    control={control}
                                                    render={({ field: controllerField }) => isEditing 
                                                        ? <Input {...controllerField} value={controllerField.value ?? ''} className="w-48" />
                                                        : (controllerField.value || 'N/A')}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={20} className="h-24 text-center">Aucune analyse de cendre trouvée.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                <ScrollBar orientation="horizontal" />
                </ScrollArea>
            </CardContent>

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
        </Card>
    );
}
