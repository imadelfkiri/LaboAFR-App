"use client";

import React, { useState, useEffect } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon, Circle, Leaf, Droplets, Fuel, Mountain, Recycle, ShoppingBag, Trash2, TreePine, Layers, Building, Beaker } from 'lucide-react';

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
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


const formSchema = z.object({
  date_arrivage: z.date({
    required_error: "Une date d'arrivée est requise.",
  }),
  type_combustible: z.string().nonempty({ message: "Veuillez sélectionner un type de combustible." }),
  fournisseur: z.string().nonempty({ message: "Veuillez sélectionner un fournisseur." }),
  h2o: z.coerce.number({invalid_type_error: "Veuillez entrer un nombre."}).min(0, { message: "L'humidité ne peut être négative." }).max(100, { message: "L'humidité ne peut dépasser 100%." }),
  pcs: z.coerce.number({invalid_type_error: "Veuillez entrer un nombre."}).positive({ message: "Le PCS doit être un nombre positif." }),
  chlore: z.coerce.number({invalid_type_error: "Veuillez entrer un nombre."}).min(0, { message: "Le chlore ne peut être négatif." }),
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

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type_combustible: "",
      fournisseur: "",
      h2o: undefined,
      pcs: undefined,
      chlore: undefined,
    },
  });

  const { watch, setValue } = form;
  const pcs = watch("pcs");
  const h2o = watch("h2o");
  const chlore = watch("chlore");
  const type_combustible = watch("type_combustible");

  useEffect(() => {
    if (pcs !== undefined && h2o !== undefined && chlore !== undefined && type_combustible) {
      const result = calculerPCI(pcs, h2o, type_combustible, chlore);
      setPciResult(result);
    } else {
        setPciResult(null);
    }
  }, [pcs, h2o, chlore, type_combustible]);


  function onSubmit(values: z.infer<typeof formSchema>) {
    // Le calcul se fait en temps réel, donc onSubmit peut être utilisé pour la soumission des données
    console.log(values);
  }

  return (
    <Card className="w-full max-w-4xl shadow-none border-0">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Calculateur de PCI Brut</CardTitle>
        <CardDescription>
          Saisissez les résultats d'analyse pour calculer la valeur PCI brute du combustible.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                    name="chlore"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>% Cl-</FormLabel>
                        <FormControl>
                        <Input type="number" step="any" placeholder="ex: 0.5" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </div>
           
            <div className="flex justify-end pt-4">
                <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-base py-6 px-8 transition-transform duration-150 ease-in-out active:scale-[0.98]">
                    Enregistrer
                </Button>
            </div>
          </form>
        </Form>

        {pciResult !== null && (
          <>
            <Separator className="my-8" />
            <div className="text-center animate-in fade-in-50 duration-500">
                <p className="text-base font-medium text-muted-foreground">Résultat du PCI Brut</p>
                <p className="text-6xl font-bold text-primary tracking-tight">
                    {pciResult.toLocaleString('fr-FR')}
                </p>
                <p className="font-semibold text-muted-foreground">kcal/kg</p>
            </div>
          </>
        )}

      </CardContent>
    </Card>
  );
}
