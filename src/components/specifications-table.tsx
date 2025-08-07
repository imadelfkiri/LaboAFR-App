
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { db, firebaseAppPromise } from '@/lib/firebase';
import { 
    getSpecifications, 
    addSpecification, 
    updateSpecification, 
    deleteSpecification,
    getFuelTypes,
    getFournisseurs,
    seedDatabase, // Import the seeding function
    type Specification,
    type FuelType
} from '@/lib/data';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  FormLabel,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlusCircle, Trash2, Edit } from 'lucide-react';

const specSchema = z.object({
  type_combustible: z.string().nonempty({ message: "Le type de combustible est requis." }),
  fournisseur: z.string().nonempty({ message: "Le fournisseur est requis." }),
  PCI_min: z.coerce.number().optional().nullable(),
  H2O_max: z.coerce.number().optional().nullable(),
  Cl_max: z.coerce.number().optional().nullable(),
  Cendres_max: z.coerce.number().optional().nullable(),
  Soufre_max: z.coerce.number().optional().nullable(),
});

export function SpecificationsTable() {
    const [specs, setSpecs] = useState<Specification[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [editingSpec, setEditingSpec] = useState<Specification | null>(null);
    const [deletingSpecId, setDeletingSpecId] = useState<string | null>(null);

    const [fuelTypes, setFuelTypes] = useState<FuelType[]>([]);
    const [fournisseurs, setFournisseurs] = useState<string[]>([]);
    
    const { toast } = useToast();

    const form = useForm<z.infer<typeof specSchema>>({
        resolver: zodResolver(specSchema),
        defaultValues: {
            type_combustible: '',
            fournisseur: '',
            PCI_min: undefined,
            H2O_max: undefined,
            Cl_max: undefined,
            Cendres_max: undefined,
            Soufre_max: undefined,
        },
    });

    const fetchAllData = useCallback(async () => {
        setLoading(true);
        try {
            await firebaseAppPromise;
            await seedDatabase(); // Ensure the database is seeded
            const [fetchedSpecs, fetchedFuelTypes, fetchedFournisseurs] = await Promise.all([
                getSpecifications(),
                getFuelTypes(),
                getFournisseurs()
            ]);
            setSpecs(fetchedSpecs.sort((a, b) => a.type_combustible.localeCompare(b.type_combustible)));
            setFuelTypes(fetchedFuelTypes.sort((a,b) => a.name.localeCompare(b.name)));
            setFournisseurs(fetchedFournisseurs.sort());
        } catch (error) {
            console.error("Erreur de chargement des données :", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les données." });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    const handleModalOpen = (spec: Specification | null = null) => {
        setEditingSpec(spec);
        if (spec) {
            form.reset({
                type_combustible: spec.type_combustible,
                fournisseur: spec.fournisseur,
                PCI_min: spec.PCI_min,
                H2O_max: spec.H2O_max,
                Cl_max: spec.Cl_max,
                Cendres_max: spec.Cendres_max,
                Soufre_max: spec.Soufre_max,
            });
        } else {
            form.reset({
                type_combustible: '',
                fournisseur: '',
                PCI_min: null, H2O_max: null, Cl_max: null, Cendres_max: null, Soufre_max: null,
            });
        }
        setIsModalOpen(true);
    };

    const handleDeleteConfirmation = (id: string) => {
        setDeletingSpecId(id);
        setIsDeleteDialogOpen(true);
    };

    const onSubmit = async (values: z.infer<typeof specSchema>) => {
        try {
            if (editingSpec) {
                await updateSpecification(editingSpec.id, values);
                toast({ title: "Succès", description: "Spécification mise à jour." });
            } else {
                await addSpecification(values);
                toast({ title: "Succès", description: "Spécification ajoutée." });
            }
            setIsModalOpen(false);
            fetchAllData();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Une erreur est survenue.";
            toast({ variant: "destructive", title: "Erreur", description: errorMessage });
        }
    };

    const handleDelete = async () => {
        if (!deletingSpecId) return;
        try {
            await deleteSpecification(deletingSpecId);
            toast({ title: "Succès", description: "Spécification supprimée." });
            setIsDeleteDialogOpen(false);
            setDeletingSpecId(null);
            fetchAllData();
        } catch (error) {
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de supprimer la spécification." });
        }
    };
    
    const formatNumber = (num: number | null | undefined) => {
        if (num === null || num === undefined) return 'N/A';
        return num.toLocaleString('fr-FR');
    };

    if (loading) {
        return (
            <div className="space-y-4 p-4 lg:p-6">
                <div className="flex justify-end">
                     <Skeleton className="h-10 w-48" />
                </div>
                <Skeleton className="h-96 w-full" />
            </div>
        );
    }
    
    return (
        <div className="flex flex-col gap-4 p-4 lg:p-6 h-full">
            <div className="flex justify-end">
                <Button onClick={() => handleModalOpen()} className="bg-primary hover:bg-primary/90">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Ajouter une spécification
                </Button>
            </div>
            <ScrollArea className="flex-grow rounded-lg border">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                            <TableHead>Type Combustible</TableHead>
                            <TableHead>Fournisseur</TableHead>
                            <TableHead className="text-right">PCI Min (kcal/kg)</TableHead>
                            <TableHead className="text-right">H2O Max (%)</TableHead>
                            <TableHead className="text-right">Cl- Max (%)</TableHead>
                            <TableHead className="text-right">Cendres Max (%)</TableHead>
                            <TableHead className="text-right">Soufre Max (%)</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {specs.length > 0 ? (
                            specs.map((spec) => (
                                <TableRow key={spec.id}>
                                    <TableCell className="font-medium">{spec.type_combustible}</TableCell>
                                    <TableCell>{spec.fournisseur}</TableCell>
                                    <TableCell className="text-right">{formatNumber(spec.PCI_min)}</TableCell>
                                    <TableCell className="text-right">{formatNumber(spec.H2O_max)}</TableCell>
                                    <TableCell className="text-right">{formatNumber(spec.Cl_max)}</TableCell>
                                    <TableCell className="text-right">{formatNumber(spec.Cendres_max)}</TableCell>
                                    <TableCell className="text-right">{formatNumber(spec.Soufre_max)}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => handleModalOpen(spec)}>
                                            <Edit className="h-4 w-4 text-muted-foreground" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDeleteConfirmation(spec.id)}>
                                            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={8} className="h-24 text-center">
                                    Aucune spécification trouvée.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </ScrollArea>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>{editingSpec ? 'Modifier' : 'Ajouter'} une spécification</DialogTitle>
                        <DialogDescription>
                            Remplissez les détails de la spécification.
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="type_combustible"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Combustible</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {fuelTypes.map(ft => <SelectItem key={ft.name} value={ft.name}>{ft.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="fournisseur"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Fournisseur</FormLabel>
                                             <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {fournisseurs.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="PCI_min" render={({ field }) => (<FormItem><FormLabel>PCI Min</FormLabel><FormControl><Input type="number" step="any" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="H2O_max" render={({ field }) => (<FormItem><FormLabel>H2O Max</FormLabel><FormControl><Input type="number" step="any" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="Cl_max" render={({ field }) => (<FormItem><FormLabel>Cl- Max</FormLabel><FormControl><Input type="number" step="any" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="Cendres_max" render={({ field }) => (<FormItem><FormLabel>Cendres Max</FormLabel><FormControl><Input type="number" step="any" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="Soufre_max" render={({ field }) => (<FormItem><FormLabel>Soufre Max</FormLabel><FormControl><Input type="number" step="any" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                            </div>
                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button type="button" variant="secondary">Annuler</Button>
                                </DialogClose>
                                <Button type="submit">Enregistrer</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Cette action est irréversible et supprimera définitivement la spécification.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDeletingSpecId(null)}>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Supprimer</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
