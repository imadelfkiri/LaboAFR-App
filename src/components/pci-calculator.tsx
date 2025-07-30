"use client";

import React, { useState } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Circle, Leaf, Droplets, Fuel, Mountain, Recycle, ShoppingBag, Trash2, TreePine, Layers } from 'lucide-react';

import { Button } from "@/components/ui/button";
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
import { calculerPCI, FUEL_TYPES } from '@/lib/pci';
import { Separator } from '@/components/ui/separator';

const formSchema = z.object({
  pcs_sec: z.coerce.number({invalid_type_error: "Veuillez entrer un nombre."}).positive({ message: "Le PCS sec doit être un nombre positif." }),
  humidite: z.coerce.number({invalid_type_error: "Veuillez entrer un nombre."}).min(0, { message: "L'humidité ne peut être négative." }).max(100, { message: "L'humidité ne peut dépasser 100%." }),
  type_combustible: z.string().nonempty({ message: "Veuillez sélectionner un type de combustible." }),
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
      pcs_sec: undefined,
      humidite: undefined,
      type_combustible: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    const result = calculerPCI(values.pcs_sec, values.humidite, values.type_combustible);
    setPciResult(result);
  }

  return (
    <Card className="w-full max-w-2xl shadow-2xl border-2 border-primary/10">
      <CardHeader>
        <CardTitle>Calculateur de PCI Brut</CardTitle>
        <CardDescription>
          Entrez les données pour calculer la valeur PCI brute de votre combustible.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="pcs_sec"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PCS sec (kcal/kg)</FormLabel>
                    <FormControl>
                      <Input type="number" step="any" placeholder="ex: 8000" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="humidite"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Humidité (%)</FormLabel>
                    <FormControl>
                      <Input type="number" step="any" placeholder="ex: 15" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
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
            <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-base py-6 transition-transform duration-150 ease-in-out active:scale-[0.98]">
              Calculer le PCI
            </Button>
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
