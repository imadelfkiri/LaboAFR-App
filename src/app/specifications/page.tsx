
"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
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
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PlusCircle, Edit, Trash2 } from "lucide-react";
import { getSpecifications, addSpecification, updateSpecification, deleteSpecification, getFuelTypes, getFournisseurs, Specification, FuelType } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";

const specSchema = z.object({
  combustible: z.string().nonempty({ message: "Le combustible est requis." }),
  fournisseur: z.string().nonempty({ message: "Le fournisseur est requis." }),
  h2o: z.string().nonempty({ message: "H2O est requis." }),
  pci: z.string().nonempty({ message: "PCI est requis." }),
  chlorures: z.string().nonempty({ message: "Chlorures est requis." }),
  cendres: z.string().nonempty({ message: "Cendres est requis." }),
  soufre: z.string().nonempty({ message: "Soufre est requis." }),
});

type SpecFormData = z.infer<typeof specSchema>;

export default function SpecificationsPage() {
  const [data, setData] = useState<Specification[]>([]);
  const [fuelTypes, setFuelTypes] = useState<FuelType[]>([]);
  const [fournisseurs, setFournisseurs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSpec, setEditingSpec] = useState<Specification | null>(null);
  const [deletingSpecId, setDeletingSpecId] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<SpecFormData>({
    resolver: zodResolver(specSchema),
    defaultValues: {
      combustible: "",
      fournisseur: "",
      h2o: "",
      pci: "",
      chlorures: "",
      cendres: "",
      soufre: "",
    },
  });

  const fetchData = async () => {
    setLoading(true);
    const [specs, fetchedFuelTypes, fetchedFournisseurs] = await Promise.all([
        getSpecifications(),
        getFuelTypes(),
        getFournisseurs()
    ]);
    specs.sort((a, b) => a.combustible.localeCompare(b.combustible) || a.fournisseur.localeCompare(b.fournisseur));
    setData(specs);
    setFuelTypes(fetchedFuelTypes.sort((a, b) => a.name.localeCompare(b.name)));
    setFournisseurs(fetchedFournisseurs.sort());
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleModalOpen = (spec: Specification | null = null) => {
    setEditingSpec(spec);
    if (spec) {
      form.reset(spec);
    } else {
      form.reset({
        combustible: "",
        fournisseur: "",
        h2o: "",
        pci: "",
        chlorures: "",
        cendres: "",
        soufre: "",
      });
    }
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingSpec(null);
    form.reset();
  };

  const onSubmit = async (formData: SpecFormData) => {
    try {
      if (editingSpec) {
        await updateSpecification(editingSpec.id, formData);
        toast({ title: "Succès", description: "Spécification mise à jour." });
      } else {
        await addSpecification(formData);
        toast({ title: "Succès", description: "Spécification ajoutée." });
      }
      fetchData();
      handleModalClose();
    } catch (error) {
      console.error("Erreur:", error);
      toast({ variant: "destructive", title: "Erreur", description: "L'opération a échoué." });
    }
  };

  const handleDelete = async () => {
    if (!deletingSpecId) return;
    try {
      await deleteSpecification(deletingSpecId);
      toast({ title: "Succès", description: "Spécification supprimée." });
      fetchData();
    } catch (error) {
      console.error("Erreur de suppression:", error);
      toast({ variant: "destructive", title: "Erreur", description: "La suppression a échoué." });
    } finally {
        setDeletingSpecId(null);
    }
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex justify-between items-center">
            {/* Le titre est géré dans le layout principal */}
            <div></div>
            <Button onClick={() => handleModalOpen()}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Ajouter une spécification
            </Button>
        </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Combustible</TableHead>
                <TableHead>Fournisseur</TableHead>
                <TableHead>H₂O</TableHead>
                <TableHead>PCI (kcal/kg)</TableHead>
                <TableHead>Chlorures</TableHead>
                <TableHead>Cendres</TableHead>
                <TableHead>Soufre</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [...Array(10)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(8)].map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : data.length > 0 ? (
                data.map((spec) => (
                  <TableRow key={spec.id}>
                    <TableCell className="font-medium">{spec.combustible}</TableCell>
                    <TableCell>{spec.fournisseur}</TableCell>
                    <TableCell>{spec.h2o}</TableCell>
                    <TableCell>{spec.pci}</TableCell>
                    <TableCell>{spec.chlorures}</TableCell>
                    <TableCell>{spec.cendres}</TableCell>
                    <TableCell>{spec.soufre}</TableCell>
                    <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleModalOpen(spec)}>
                            <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => setDeletingSpecId(spec.id)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Cette action est irréversible et supprimera définitivement la spécification.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel onClick={() => setDeletingSpecId(null)}>Annuler</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDelete}>Supprimer</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
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
        </CardContent>
      </Card>
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSpec ? "Modifier" : "Ajouter"} une spécification</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="combustible"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Combustible</FormLabel>
                     <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Sélectionner un combustible..." />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        {fuelTypes.map((fuel) => (
                            <SelectItem key={fuel.name} value={fuel.name}>
                            {fuel.icon} {fuel.name}
                            </SelectItem>
                        ))}
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
                     <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Sélectionner un fournisseur..." />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        {fournisseurs.map((fournisseur) => (
                            <SelectItem key={fournisseur} value={fournisseur}>
                            {fournisseur}
                            </SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="h2o"
                render={({ field }) => (
                  <FormItem><FormLabel>H₂O</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="pci"
                render={({ field }) => (
                  <FormItem><FormLabel>PCI (kcal/kg)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="chlorures"
                render={({ field }) => (
                  <FormItem><FormLabel>Chlorures</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cendres"
                render={({ field }) => (
                  <FormItem><FormLabel>Cendres</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="soufre"
                render={({ field }) => (
                  <FormItem><FormLabel>Soufre</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="secondary" onClick={handleModalClose}>Annuler</Button></DialogClose>
                <Button type="submit">Enregistrer</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
