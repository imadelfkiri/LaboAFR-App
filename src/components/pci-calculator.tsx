"use client";

import React, { useState, useEffect } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { format, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon, Circle, Leaf, Droplets, Fuel, Mountain, Recycle, ShoppingBag, Trash2, TreePine, Layers, Building, Beaker } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from "firebase/firestore"; 


import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { calculerPCI } from '@/lib/pci';
import { Separator } from '@/components/ui/separator';
import { FUEL_TYPES, FOURNISSEURS } from '@/lib/data';
import { db } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast";


const formSchema = z.object({
  date_arrivage: z.date({
    required_error: "Une date d'arrivée est requise.",
  }),
  type_combustible: z.string().nonempty({ message: "Veuillez sélectionner un type de combustible." }),
  fournisseur: z.string().nonempty({ message: "Veuillez sélectionner un fournisseur." }),
  pcs: z.coerce.number({invalid_type_error: "Veuillez entrer un nombre."}).positive({ message: "Le PCS doit être un nombre positif." }),
  h2o: z.coerce.number({invalid_type_error: "Veuillez entrer un nombre."}).min(0, { message: "L'humidité ne peut être négative." }).max(100, { message: "L'humidité ne peut dépasser 100%." }),
  chlore: z.coerce.number({invalid_type_error: "Veuillez entrer un nombre."}).min(0, { message: "Le chlore ne peut être négatif." }).optional().or(z.literal('')),
  cendres: z.coerce.number({invalid_type_error: "Veuillez entrer un nombre."}).min(0, { message: "Le % de cendres ne peut être négatif." }).optional().or(z.literal('')),
  densite: z.coerce.number({invalid_type_error: "Veuillez entrer un nombre."}).positive({ message: "La densité doit être un nombre positif." }).optional().or(z.literal('')),
  remarques: z.string().optional(),
});

const fuelIcons: Record<string, React.ElementType> = {
  "Pneus": Circle,
  "Bois": TreePine,
  "CSR": Recycle,
  "Grignons": Leaf,
  "Boues": Droplets,
  "Pet Coke": Fuel,
  "Charbon": Mountain,
  "Caoutchouc": Circle,
  "Textile": Layers,
  "Plastiques": ShoppingBag,
  "DMB": Trash2,
};


export function PciCalculator() {
  const [pciResult, setPciResult] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date_arrivage: subDays(new Date(), 1),
      type_combustible: "",
      fournisseur: "",
      pcs: undefined,
      h2o: undefined,
      chlore: undefined,
      cendres: undefined,
      densite: undefined,
      remarques: "",
    },
  });

  const { watch, reset, getValues } = form;
  const pcsValue = watch("pcs");
  const h2oValue = watch("h2o");
  const chloreValue = watch("chlore");
  const typeCombustibleValue = watch("type_combustible");

  useEffect(() => {
    const values = getValues();
    const { pcs, h2o, type_combustible, chlore } = values;
    
    if (pcs !== undefined && h2o !== undefined && type_combustible) {
      const result = calculerPCI(pcs, h2o, type_combustible, Number(chlore) || 0);
      setPciResult(result);
    } else {
        setPciResult(null);
    }
  }, [pcsValue, h2oValue, chloreValue, typeCombustibleValue, getValues]);


  const resetForm = () => {
    reset({
        date_arrivage: subDays(new Date(), 1),
        type_combustible: "",
        fournisseur: "",
        pcs: '' as any,
        h2o: '' as any,
        chlore: '' as any,
        cendres: '' as any,
        densite: '' as any,
        remarques: "",
    });
    setPciResult(null);
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSaving(true);
    try {
      const pci_brut = calculerPCI(values.pcs, values.h2o, values.type_combustible, Number(values.chlore) || 0);

      if (pci_brut === null) {
          toast({
              variant: "destructive",
              title: "Erreur de calcul",
              description: "Le PCI n'a pas pu être calculé. Vérifiez les valeurs.",
          });
          setIsSaving(false);
          return;
      }
      
      const dataToSave = {
        ...values,
        pci_brut,
        chlore: Number(values.chlore) || 0,
        cendres: Number(values.cendres) || 0,
        densite: Number(values.densite) || 0,
        remarques: values.remarques || "",
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "resultats"), dataToSave);
      
      toast({
          title: "Succès",
          description: "Les résultats ont été enregistrés avec succès.",
      });

      resetForm();

    } catch (error) {
        console.error("Erreur lors de l'enregistrement dans Firestore: ", error);
        toast({
            variant: "destructive",
            title: "Erreur d'enregistrement",
            description: "Impossible d'enregistrer les données. Vérifiez la console pour plus de détails.",
        });
    } finally {
        setIsSaving(false);
    }
  }

  return (
    <Card className="w-full max-w-5xl shadow-none border-0">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Calculateur de PCI Brut</CardTitle>
        <CardDescription>
          Saisissez les résultats d'analyse pour calculer la valeur PCI brute du combustible et enregistrer les données.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <FormField
                  control={form.control}
                  name="date_arrivage"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Date d'arrivage</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP", { locale: fr })
                              ) : (
                                <span>Choisissez une date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date > new Date() || date < new Date("1900-01-01")
                            }
                            initialFocus
                            locale={fr}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                    control={form.control}
                    name="type_combustible"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Type de combustible</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Sélectionnez un type..." />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {FUEL_TYPES.map((fuelType) => {
                                const Icon = fuelIcons[fuelType] || Fuel;
                                return (
                                    <SelectItem key={fuelType} value={fuelType}>
                                        <div className="flex items-center gap-2">
                                            <Icon className="h-4 w-4 text-muted-foreground" />
                                            <span>{fuelType}</span>
                                        </div>
                                    </SelectItem>
                                );
                            })}
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
                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Sélectionnez un fournisseur..." />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {FOURNISSEURS.map((fournisseur) => (
                                    <SelectItem key={fournisseur} value={fournisseur}>
                                        <div className="flex items-center gap-2">
                                            <Building className="h-4 w-4 text-muted-foreground" />
                                            <span>{fournisseur}</span>
                                        </div>
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
                name="pcs"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PCS (kcal/kg)</FormLabel>
                    <FormControl>
                      <Input type="number" step="any" placeholder="ex: 8000" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="h2o"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>% H2O</FormLabel>
                    <FormControl>
                      <Input type="number" step="any" placeholder="ex: 15" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                  control={form.control}
                  name="chlore"
                  render={({ field }) => (
                  <FormItem>
                      <FormLabel>% Cl- (Facultatif)</FormLabel>
                      <FormControl>
                      <Input type="number" step="any" placeholder="ex: 0.5" {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                  </FormItem>
                  )}
              />
               <FormField
                control={form.control}
                name="cendres"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>% Cendres (Facultatif)</FormLabel>
                    <FormControl>
                      <Input type="number" step="any" placeholder="ex: 10" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
                 <FormField
                    control={form.control}
                    name="densite"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Densité (t/m³) (Facultatif)</FormLabel>
                        <FormControl>
                        <Input type="number" step="any" placeholder="ex: 0.8" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="remarques"
                    render={({ field }) => (
                    <FormItem className="sm:col-span-2 lg:col-span-4">
                        <FormLabel>Remarques (Facultatif)</FormLabel>
                        <FormControl>
                            <Textarea
                                placeholder="Ajoutez une remarque..."
                                className="resize-none"
                                {...field}
                                value={field.value ?? ''}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </div>
           
            <div className="flex items-center justify-between pt-4">
                <div>
                {pciResult !== null && (
                    <div className="text-center animate-in fade-in-50 duration-500">
                        <p className="text-base font-medium text-muted-foreground">PCI sur Brut</p>
                        <p className="text-4xl font-bold text-primary tracking-tight">
                            {pciResult.toLocaleString('fr-FR')}
                             <span className="text-lg font-semibold text-muted-foreground ml-2">kcal/kg</span>
                        </p>
                    </div>
                )}
                </div>

                <Button type="submit" disabled={isSaving} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-base py-6 px-8 transition-transform duration-150 ease-in-out active:scale-[0.98]">
                    {isSaving ? "Enregistrement..." : "Enregistrer"}
                </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
