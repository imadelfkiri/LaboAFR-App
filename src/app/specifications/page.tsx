
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
    getSpecifications,
    addSpecification,
    updateSpecification,
    deleteSpecification,
    getFuelTypes,
    getFournisseurs,
    type Specification,
    type FuelType,
    seedDatabase
} from "@/lib/data";
import { firebaseAppPromise } from '@/lib/firebase';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
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
import { PlusCircle, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

const specSchema = z.object({
    type_combustible: z.string().nonempty({ message: "Le type de combustible est requis." }),
    fournisseur: z.string().nonempty({ message: "Le fournisseur est requis." }),
    PCI_min: z.coerce.number().optional(),
    H2O_max: z.coerce.number().optional(),
    Cl_max: z.coerce.number().optional(),
    Cendres_max: z.coerce.number().optional(),
    Soufre_max: z.coerce.number().optional(),
});

type SpecFormData = z.infer<typeof specSchema>;

export default function SpecificationsPage() {
    const [specifications, setSpecifications] = useState<Specification[]>([]);
    const [fuelTypes, setFuelTypes] = useState<FuelType[]>([]);
    const [fournisseurs, setFournisseurs] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [currentSpec, setCurrentSpec] = useState<Specification | null>(null);
    const [specToDelete, setSpecToDelete] = useState<string | null>(null);
    const { toast } = useToast();

    const form = useForm<SpecFormData>({
        resolver: zodResolver(specSchema),
        defaultValues: {},
    });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            await firebaseAppPromise;
            await seedDatabase();
            
            const [specs, fTypes, founisseursList] = await Promise.all([
                getSpecifications(),
                getFuelTypes(),
                getFournisseurs()
            ]);
            
            setFuelTypes(fTypes);
            setFournisseurs(founisseursList);

            const sortedSpecs = specs.sort((a, b) => {
                const typeComparison = a.type_combustible.localeCompare(b.type_combustible);
                if (typeComparison !== 0) return typeComparison;
                return a.fournisseur.localeCompare(b.fournisseur);
            });
            setSpecifications(sortedSpecs);

        } catch (error) {
            console.error("Failed to fetch data:", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les données." });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleDialogOpen = (spec: Specification | null = null) => {
        setCurrentSpec(spec);
        form.reset(spec ? {
            ...spec,
            PCI_min: spec.PCI_min ?? undefined,
            H2O_max: spec.H2O_max ?? undefined,
            Cl_max: spec.Cl_max ?? undefined,
            Cendres_max: spec.Cendres_max ?? undefined,
            Soufre_max: spec.Soufre_max ?? undefined,
        } : {
            type_combustible: '',
            fournisseur: '',
            PCI_min: undefined,
            H2O_max: undefined,
            Cl_max: undefined,
            Cendres_max: undefined,
            Soufre_max: undefined,
        });
        setIsDialogOpen(true);
    };

    const onSubmit = async (data: SpecFormData) => {
        try {
            const dataToSave = Object.fromEntries(
                Object.entries(data).map(([key, value]) => [key, value === '' ? undefined : value])
            );

            if (currentSpec?.id) {
                await updateSpecification(currentSpec.id, dataToSave as Partial<Specification>);
                toast({ title: "Succès", description: "Spécification mise à jour." });
            } else {
                await addSpecification(dataToSave as Omit<Specification, 'id'>);
                toast({ title: "Succès", description: "Spécification ajoutée." });
            }
            setIsDialogOpen(false);
            fetchData(); 
        } catch (error) {
            console.error("Failed to save specification:", error);
            const errorMessage = error instanceof Error ? error.message : "Impossible d'enregistrer la spécification.";
            toast({ variant: "destructive", title: "Erreur", description: errorMessage });
        }
    };

    const handleDeleteConfirm = async () => {
        if (!specToDelete) return;
        try {
            await deleteSpecification(specToDelete);
            toast({ title: "Succès", description: "Spécification supprimée." });
            setSpecToDelete(null);
            fetchData();
        } catch (error) {
            console.error("Failed to delete specification:", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de supprimer la spécification." });
        }
    };

    const renderCell = (value: number | undefined | null) => {
        return value !== null && value !== undefined ? value.toLocaleString('fr-FR') : <span className="text-muted-foreground">-</span>;
    }

    if (loading) {
        return (
            <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6 h-full">
                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <Skeleton className="h-10 w-1/3" />
                            <Skeleton className="h-10 w-48" />
                        </div>
                    </CardHeader>
                    <CardContent>
                       <div className="space-y-2">
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                       </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6 h-full">
            <AlertDialog onOpenChange={(open) => !open && setSpecToDelete(null)}>
                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle>Spécifications Techniques des AF</CardTitle>
                                <CardDescription>
                                    Définir les seuils contractuels pour chaque combustible et fournisseur.
                                </CardDescription>
                            </div>
                            <Button onClick={() => handleDialogOpen()}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Ajouter une Spécification
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Type Combustible</TableHead>
                                    <TableHead>Fournisseur</TableHead>
                                    <TableHead className="text-right">PCI (min)</TableHead>
                                    <TableHead className="text-right">H₂O (max %)</TableHead>
                                    <TableHead className="text-right">Chlore (max %)</TableHead>
                                    <TableHead className="text-right">Cendres (max %)</TableHead>
                                    <TableHead className="text-right">Soufre (max %)</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {specifications && specifications.map((spec) => (
                                    <TableRow key={spec.id}>
                                        <TableCell className="font-medium">{spec.type_combustible}</TableCell>
                                        <TableCell>{spec.fournisseur}</TableCell>
                                        <TableCell className="text-right">{renderCell(spec.PCI_min)}</TableCell>
                                        <TableCell className="text-right">{renderCell(spec.H2O_max)}</TableCell>
                                        <TableCell className="text-right">{renderCell(spec.Cl_max)}</TableCell>
                                        <TableCell className="text-right">{renderCell(spec.Cendres_max)}</TableCell>
                                        <TableCell className="text-right">{renderCell(spec.Soufre_max)}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button variant="ghost" size="icon" onClick={() => handleDialogOpen(spec)}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" onClick={() => setSpecToDelete(spec.id)}>
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
                
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Êtes-vous absolument sûr ?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Cette action est irréversible. La spécification sera définitivement supprimée.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90">Supprimer</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>


            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{currentSpec ? "Modifier" : "Ajouter"} une spécification</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <Controller
                            name="type_combustible"
                            control={form.control}
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!!currentSpec}>
                                    <SelectTrigger><SelectValue placeholder="Sélectionner un combustible" /></SelectTrigger>
                                    <SelectContent>
                                        {fuelTypes.map(ft => <SelectItem key={ft.name} value={ft.name}>{ft.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                         {form.formState.errors.type_combustible && <p className="text-sm font-medium text-destructive">{form.formState.errors.type_combustible.message}</p>}
                        <Controller
                            name="fournisseur"
                            control={form.control}
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!!currentSpec}>
                                    <SelectTrigger><SelectValue placeholder="Sélectionner un fournisseur" /></SelectTrigger>
                                    <SelectContent>
                                        {fournisseurs.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                        {form.formState.errors.fournisseur && <p className="text-sm font-medium text-destructive">{form.formState.errors.fournisseur.message}</p>}
                        <Input type="number" step="any" placeholder="PCI (min)" {...form.register("PCI_min")} />
                        <Input type="number" step="any" placeholder="H₂O (max %)" {...form.register("H2O_max")} />
                        <Input type="number" step="any" placeholder="Chlore (max %)" {...form.register("Cl_max")} />
                        <Input type="number" step="any" placeholder="Cendres (max %)" {...form.register("Cendres_max")} />
                        <Input type="number" step="any" placeholder="Soufre (max %)" {...form.register("Soufre_max")} />
                        <DialogFooter>
                            <DialogClose asChild><Button type="button" variant="secondary">Annuler</Button></DialogClose>
                            <Button type="submit">Enregistrer</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
