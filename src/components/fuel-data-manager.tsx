"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { 
    getFuelData, 
    addFuelData, 
    updateFuelData, 
    deleteFuelData,
    getUniqueFuelTypesFromResultats,
    type FuelData
} from '@/lib/data';

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
import { Edit, Trash2, Database, PlusCircle } from 'lucide-react';

const fuelDataSchema = z.object({
  nom_combustible: z.string().nonempty({ message: "Le nom du combustible est requis." }),
  poids_godet: z.coerce.number().positive({ message: "Le poids par godet doit être un nombre positif." }),
  teneur_hydrogene: z.coerce.number().min(0, "La teneur en hydrogène doit être positive.").max(100, "La teneur ne peut dépasser 100%"),
});

export function FuelDataManager() {
    const [fuelDataList, setFuelDataList] = useState<FuelData[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [editingFuelData, setEditingFuelData] = useState<FuelData | null>(null);
    const [deletingFuelDataId, setDeletingFuelDataId] = useState<string | null>(null);

    const [availableFuelTypes, setAvailableFuelTypes] = useState<string[]>([]);
    
    const { toast } = useToast();

    const form = useForm<z.infer<typeof fuelDataSchema>>({
        resolver: zodResolver(fuelDataSchema),
        defaultValues: {
            nom_combustible: '',
            poids_godet: undefined,
            teneur_hydrogene: undefined,
        },
    });

    const fetchAllData = useCallback(async () => {
        setLoading(true);
        try {
            const [fetchedFuelData, resultatsFuelTypes] = await Promise.all([
                getFuelData(),
                getUniqueFuelTypesFromResultats(),
            ]);
            
            setFuelDataList(fetchedFuelData.sort((a, b) => a.nom_combustible.localeCompare(b.nom_combustible)));
            setAvailableFuelTypes(resultatsFuelTypes.sort());
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

    const handleModalOpen = (data: FuelData | null = null) => {
        setEditingFuelData(data);
        if (data) {
            form.reset({
                nom_combustible: data.nom_combustible,
                poids_godet: data.poids_godet,
                teneur_hydrogene: data.teneur_hydrogene
            });
        } else {
            form.reset({
                nom_combustible: '',
                poids_godet: undefined,
                teneur_hydrogene: undefined
            });
        }
        setIsModalOpen(true);
    };

    const handleDeleteConfirmation = (id: string) => {
        setDeletingFuelDataId(id);
        setIsDeleteDialogOpen(true);
    };

    const onSubmit = async (values: z.infer<typeof fuelDataSchema>) => {
        try {
            if (editingFuelData) {
                await updateFuelData(editingFuelData.id, values);
                toast({ title: "Succès", description: "Données du combustible mises à jour." });
            } else {
                 // Check if data for this fuel already exists
                const existingFuel = fuelDataList.find(
                    (fuel) => fuel.nom_combustible === values.nom_combustible
                );
                if (existingFuel) {
                    toast({
                        variant: "destructive",
                        title: "Erreur : Doublon",
                        description: `Des données de référence existent déjà pour "${values.nom_combustible}". Veuillez les modifier.`,
                    });
                    return; // Prevent adding a duplicate
                }
                await addFuelData(values);
                toast({ title: "Succès", description: "Données du combustible ajoutées." });
            }
            setIsModalOpen(false);
            fetchAllData();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Une erreur est survenue.";
            toast({ variant: "destructive", title: "Erreur", description: errorMessage });
        }
    };

    const handleDelete = async () => {
        if (!deletingFuelDataId) return;
        try {
            await deleteFuelData(deletingFuelDataId);
            toast({ title: "Succès", description: "Données supprimées." });
            setIsDeleteDialogOpen(false);
            setDeletingFuelDataId(null);
            fetchAllData();
        } catch (error) {
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de supprimer les données." });
        }
    };
    
    const formatNumber = (num: number | null | undefined, digits: number = 2) => {
        if (num === null || num === undefined) return 'N/A';
        return num.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
    };

    const fuelTypesForDropdown = useMemo(() => {
        // Always return all available fuel types from the results.
        // The logic to prevent duplicates is now handled in onSubmit.
        return availableFuelTypes;
    }, [availableFuelTypes]);

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="flex items-center gap-2">
                        <Database className="h-6 w-6 text-primary" />
                        Données de Référence des Combustibles
                    </CardTitle>
                    <CardDescription>
                        Base de données centrale pour les caractéristiques physiques des combustibles.
                    </CardDescription>
                </div>
                <Button onClick={() => handleModalOpen()}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Ajouter des Données
                </Button>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[65vh] rounded-lg border">
                    <Table>
                        <TableHeader className="sticky top-0 bg-muted/50">
                            <TableRow>
                                <TableHead>Nom du Combustible</TableHead>
                                <TableHead className="text-right">Poids par Godet (tonnes)</TableHead>
                                <TableHead className="text-right">Teneur en Hydrogène (%)</TableHead>
                                <TableHead className="text-right w-[120px]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell colSpan={4}>
                                            <Skeleton className="h-8 w-full" />
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : fuelDataList.length > 0 ? (
                                fuelDataList.map((data) => (
                                    <TableRow key={data.id}>
                                        <TableCell className="font-medium">{data.nom_combustible}</TableCell>
                                        <TableCell className="text-right">{formatNumber(data.poids_godet, 2)}</TableCell>
                                        <TableCell className="text-right">{formatNumber(data.teneur_hydrogene, 2)}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => handleModalOpen(data)}>
                                                <Edit className="h-4 w-4 text-muted-foreground" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDeleteConfirmation(data.id)}>
                                                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        Aucune donnée de référence trouvée.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </CardContent>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{editingFuelData ? 'Modifier' : 'Ajouter'} des Données</DialogTitle>
                        <DialogDescription>
                            Remplissez les détails pour le combustible.
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                            <FormField
                                control={form.control}
                                name="nom_combustible"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Combustible</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value} disabled={!!editingFuelData}>
                                            <FormControl>
                                                <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {fuelTypesForDropdown.map(ft => <SelectItem key={ft} value={ft}>{ft}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField control={form.control} name="poids_godet" render={({ field }) => (<FormItem><FormLabel>Poids par Godet (tonnes)</FormLabel><FormControl><Input type="number" step="any" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="teneur_hydrogene" render={({ field }) => (<FormItem><FormLabel>Teneur en Hydrogène (%)</FormLabel><FormControl><Input type="number" step="any" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
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
                            Cette action est irréversible et supprimera définitivement ces données de référence.
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
