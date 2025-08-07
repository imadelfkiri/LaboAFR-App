

"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon, Fuel, PlusCircle, ClipboardList, FlaskConical, MessageSquareText } from 'lucide-react';
// import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
// import { db } from '@/lib/firebase';

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator";
import { calculerPCI } from '@/lib/pci';
import { getFuelTypes, type FuelType, H_MAP, getFournisseurs, addSpecification, getSpecifications } from '@/lib/data';
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from './ui/skeleton';

const formSchema = z.object({
  date_arrivage: z.date({
    required_error: "Une date d'arrivée est requise.",
  }),
  type_combustible: z.string().nonempty({ message: "Veuillez sélectionner un type de combustible." }),
  fournisseur: z.string().nonempty({ message: "Veuillez sélectionner un fournisseur." }),
  pcs: z.coerce.number({required_error: "Veuillez renseigner une valeur valide pour le PCS.", invalid_type_error: "Veuillez entrer un nombre."}).positive({ message: "Le PCS doit être un nombre positif." }),
  h2o: z.coerce.number({required_error: "Le taux d'humidité est requis.", invalid_type_error: "Veuillez entrer un nombre."}).min(0, { message: "L'humidité ne peut être négative." }).max(100, { message: "L'humidité ne peut dépasser 100%." }),
  chlore: z.coerce.number({invalid_type_error: "Veuillez entrer un nombre."}).min(0, { message: "Le chlore ne peut être négatif." }).optional().or(z.literal('')),
  cendres: z.coerce.number({invalid_type_error: "Veuillez entrer un nombre."}).min(0, { message: "Le % de cendres ne peut être négatif." }).optional().or(z.literal('')),
  densite: z.coerce.number({invalid_type_error: "Veuillez entrer un nombre."}).positive({ message: "La densité doit être un nombre positif." }).optional().or(z.literal('')),
  remarques: z.string().optional(),
});

const newFuelTypeSchema = z.object({
    name: z.string().nonempty({ message: "Le nom du combustible est requis."}),
});

const newFournisseurSchema = z.object({
    name: z.string().nonempty({ message: "Le nom du fournisseur est requis."}).regex(/^[a-zA-Z0-9\s-]+$/, "Le nom ne doit contenir que des lettres, chiffres, espaces ou tirets."),
});

// Dummy function to simulate adding data
async function addResult(data: any) {
    console.log("Simulating data save:", data);
    // In a real scenario with a backend, this would be an API call.
    // We can store results in-memory for the session if needed.
    if (typeof window !== 'undefined') {
        let results = JSON.parse(sessionStorage.getItem('results') || '[]');
        results.push({ id: Date.now().toString(), ...data });
        sessionStorage.setItem('results', JSON.stringify(results));
    }
    return Promise.resolve();
}


export function PciCalculator() {
  const [pciResult, setPciResult] = useState<number | null>(null);
  const [hValue, setHValue] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [allFuelTypes, setAllFuelTypes] = useState<FuelType[]>([]);
  const [allFournisseurs, setAllFournisseurs] = useState<string[]>([]);
  const [fuelSupplierMap, setFuelSupplierMap] = useState<Record<string, string[]>>({});
  
  const [filteredFournisseurs, setFilteredFournisseurs] = useState<string[]>([]);
  
  const [isFuelModalOpen, setIsFuelModalOpen] = useState(false);
  const [newFuelTypeName, setNewFuelTypeName] = useState("");

  const [isFournisseurModalOpen, setIsFournisseurModalOpen] = useState(false);
  const [newFournisseurName, setNewFournisseurName] = useState("");

  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date_arrivage: new Date(),
      type_combustible: "",
      fournisseur: "",
      pcs: undefined,
      h2o: undefined,
      chlore: '',
      cendres: '',
      densite: '',
      remarques: "",
    },
  });

  const { watch, reset, getValues, setValue } = form;

  const resetForm = () => {
    reset({
        date_arrivage: new Date(),
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

  const fetchAndSetData = useCallback(async () => {
      setLoading(true);
      try {
        const [fetchedFuelTypes, fetchedFournisseurs, specs] = await Promise.all([
          Promise.resolve(getFuelTypes()),
          Promise.resolve(getFournisseurs()),
          getSpecifications()
        ]);
        
        const map: Record<string, string[]> = {};
        specs.forEach(spec => {
            if (!map[spec.type_combustible]) {
                map[spec.type_combustible] = [];
            }
            if (!map[spec.type_combustible].includes(spec.fournisseur)) {
                map[spec.type_combustible].push(spec.fournisseur);
            }
        });
        
        setAllFuelTypes(fetchedFuelTypes);
        setAllFournisseurs(fetchedFournisseurs);
        setFuelSupplierMap(map);
      } catch (e) {
          console.error(e);
          toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les données de configuration." });
      } finally {
          setLoading(false);
      }
  }, [toast]);

  useEffect(() => {
    fetchAndSetData();
  }, [fetchAndSetData]);


  const pcsValue = watch("pcs");
  const h2oValue = watch("h2o");
  const typeCombustibleValue = watch("type_combustible");

  useEffect(() => {
    if (typeCombustibleValue) {
        const h = H_MAP[typeCombustibleValue];
        setHValue(h ?? null);
    } else {
        setHValue(null);
    }
  }, [typeCombustibleValue]);

  useEffect(() => {
    const values = getValues();
    const { pcs, h2o, type_combustible } = values;

    if (pcs !== undefined && h2o !== undefined && type_combustible) {
      const result = calculerPCI(Number(pcs), Number(h2o), type_combustible);
      setPciResult(result);
    } else {
        setPciResult(null);
    }
  }, [pcsValue, h2oValue, typeCombustibleValue, getValues]);

  useEffect(() => {
    if (typeCombustibleValue) {
        const relatedFournisseurs = fuelSupplierMap[typeCombustibleValue] || allFournisseurs;
        setFilteredFournisseurs(relatedFournisseurs.sort());
        setValue('fournisseur', '');
    } else {
        setFilteredFournisseurs(allFournisseurs.sort());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeCombustibleValue, fuelSupplierMap, allFournisseurs, setValue]);


  const handleAddFuelType = async () => {
      try {
        newFuelTypeSchema.parse({ 
            name: newFuelTypeName, 
        });

        console.warn("Adding fuel types dynamically is not fully supported with current data structure.");
        toast({
            title: "Fonctionnalité limitée",
            description: "L'ajout de nouveaux types de combustible n'est pas encore pris en charge.",
        });

      } catch (error) {
        if (error instanceof z.ZodError) {
             toast({
                variant: "destructive",
                title: "Erreur de validation",
                description: error.errors.map(e => e.message).join('\n'),
            });
        } else {
            console.error("Erreur lors de l'ajout du type:", error);
            toast({
                variant: "destructive",
                title: "Erreur",
                description: "Impossible d'ajouter le nouveau type de combustible.",
            });
        }
    }
  };

  const handleAddFournisseur = async () => {
    const selectedFuelType = getValues("type_combustible");
    if (!selectedFuelType) return;

    try {
        const newFournisseur = newFournisseurSchema.parse({ name: newFournisseurName });
        const name = newFournisseur.name.trim();

        await addSpecification({
            type_combustible: selectedFuelType,
            fournisseur: name
        });
        
        await fetchAndSetData();
        
        setValue("fournisseur", name, { shouldValidate: true });

        toast({
            title: "Succès",
            description: `Le fournisseur "${name}" a été ajouté et associé.`,
        });

        setIsFournisseurModalOpen(false);
        setNewFournisseurName("");

    } catch (error) {
        if (error instanceof z.ZodError) {
            toast({
                variant: "destructive",
                title: "Erreur de validation",
                description: error.errors.map(e => e.message).join('\n'),
            });
        } else {
            console.error("Erreur lors de l'ajout du fournisseur:", error);
            const errorMessage = error instanceof Error ? error.message : "Impossible d'ajouter ou d'associer le nouveau fournisseur.";
            toast({
                variant: "destructive",
                title: "Erreur",
                description: errorMessage
            });
        }
    }
  };


  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSaving(true);
    try {
      const pci_brut = calculerPCI(values.pcs, values.h2o, values.type_combustible);

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
        chlore: values.chlore ? Number(values.chlore) : null,
        cendres: values.cendres ? Number(values.cendres) : null,
        densite: values.densite ? Number(values.densite) : null,
        remarques: values.remarques || "",
        date_creation: new Date().toISOString(), // Using ISO string for local data
      };

      await addResult(dataToSave);
      
      toast({
          title: "Succès",
          description: "Les résultats ont été enregistrés avec succès.",
      });
      
      resetForm();

    } catch (error: any) {
        console.error("Erreur lors de la soumission: ", error);
        toast({
            variant: "destructive",
            title: "Erreur de soumission",
            description: "Impossible d'enregistrer les données. Veuillez vérifier votre connexion ou réessayer.",
        });
    } finally {
        setIsSaving(false);
    }
  }

  const isFournisseurDisabled = !typeCombustibleValue;

  if (loading) {
      return (
          <div className="w-full max-w-4xl space-y-6 pb-24 p-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Skeleton className="h-[480px] w-full" />
                <Skeleton className="h-[480px] w-full" />
              </div>
          </div>
      )
  }

  return (
    <div className="w-full max-w-4xl space-y-4 pb-24">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6 rounded-2xl shadow-md bg-white/70 backdrop-blur-md">
                    <CardHeader>
                       <CardTitle>
                          <div className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <ClipboardList className="h-5 w-5" />
                            <span>Informations Générales</span>
                          </div>
                       </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-6">
                            <FormField
                                control={form.control}
                                name="date_arrivage"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Date d'arrivage</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full justify-start text-left font-normal rounded-xl h-11 px-4 text-sm",
                                                !field.value && "text-muted-foreground"
                                            )}
                                            >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {field.value ? (
                                                format(field.value, "PPP", { locale: fr })
                                            ) : (
                                                <span>Choisir une date</span>
                                            )}
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
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField
                                control={form.control}
                                name="type_combustible"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Combustible</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                            <SelectTrigger className="rounded-xl h-11 px-4 text-sm">
                                                <SelectValue placeholder="Sélectionner..." />
                                            </SelectTrigger>
                                            </FormControl>
                                            <SelectContent side="bottom" avoidCollisions={false} className="z-50">
                                                {allFuelTypes.map((fuel) => (
                                                    <SelectItem key={fuel.name} value={fuel.name}>
                                                        {fuel.name}
                                                    </SelectItem>
                                                ))}
                                                <Separator className="my-1" />
                                                <div
                                                    onSelect={(e) => e.preventDefault()}
                                                    onClick={() => setIsFuelModalOpen(true)}
                                                    className="relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground"
                                                >
                                                    <PlusCircle className="mr-2 h-4 w-4" />
                                                    Ajouter un type
                                                </div>
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
                                        <Select onValueChange={field.onChange} value={field.value} disabled={isFournisseurDisabled}>
                                            <FormControl>
                                            <SelectTrigger className="rounded-xl h-11 px-4 text-sm">
                                                <SelectValue placeholder={isFournisseurDisabled ? "Choisir un combustible" : "Sélectionner..."} />
                                            </SelectTrigger>
                                            </FormControl>
                                            <SelectContent side="bottom" avoidCollisions={false} className="z-50">
                                                {filteredFournisseurs.length === 0 && typeCombustibleValue ? (
                                                    <div className="px-2 py-1.5 text-sm text-muted-foreground text-center">Aucun fournisseur.</div>
                                                ) : (
                                                    filteredFournisseurs.map((fournisseur) => (
                                                        <SelectItem key={fournisseur} value={fournisseur}>
                                                            {fournisseur}
                                                        </SelectItem>
                                                    ))
                                                )}
                                                {typeCombustibleValue && (
                                                    <>
                                                        <Separator className="my-1" />
                                                        <div
                                                            onSelect={(e) => e.preventDefault()}
                                                            onClick={() => setIsFournisseurModalOpen(true)}
                                                            className="relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground"
                                                        >
                                                            <PlusCircle className="mr-2 h-4 w-4" />
                                                            Ajouter un fournisseur
                                                        </div>
                                                    </>
                                                )}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                                />
                            </div>
                            <FormField
                                control={form.control}
                                name="remarques"
                                render={({ field }) => (
                                <FormItem>
                                     <FormLabel>
                                        <div className="flex items-center gap-2 text-gray-800">
                                        <MessageSquareText className="h-4 w-4" />
                                        <span>Remarques</span>
                                        </div>
                                    </FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Ajoutez une remarque..."
                                            className="resize-none rounded-xl min-h-[80px]"
                                            {...field}
                                            value={field.value ?? ''}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card className="p-6 rounded-2xl shadow-md bg-white/70 backdrop-blur-md">
                    <CardHeader>
                        <h2 className="text-xl font-semibold flex items-center gap-2 text-neutral-800">
                            <FlaskConical className="w-5 h-5 mr-2 text-green-600" /> Données Analytiques
                        </h2>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                            <FormField
                                control={form.control}
                                name="pcs"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>PCS (kcal/kg)</FormLabel>
                                    <FormControl>
                                    <Input type="number" step="any" placeholder=" " {...field} value={field.value ?? ''} className="rounded-xl h-11 px-4 text-sm" />
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
                                    <Input type="number" step="any" placeholder=" " {...field} value={field.value ?? ''} className="rounded-xl h-11 px-4 text-sm" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                             <FormItem>
                                <FormLabel>% H</FormLabel>
                                <FormControl>
                                <Input 
                                    type="number" 
                                    readOnly 
                                    disabled 
                                    value={hValue !== null ? hValue.toFixed(2) : ''} 
                                    className="rounded-xl h-11 px-4 text-sm bg-gray-100" 
                                    placeholder="-"
                                />
                                </FormControl>
                            </FormItem>
                            <FormField
                                control={form.control}
                                name="chlore"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>% Cl-</FormLabel>
                                    <FormControl>
                                    <Input type="number" step="any" placeholder=" " {...field} value={field.value ?? ''} className="rounded-xl h-11 px-4 text-sm" />
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
                                    <FormLabel>% Cendres</FormLabel>
                                    <FormControl>
                                    <Input type="number" step="any" placeholder=" " {...field} value={field.value ?? ''} className="rounded-xl h-11 px-4 text-sm" />
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
                                    <FormLabel>Densité (t/m³)</FormLabel>
                                    <FormControl>
                                    <Input type="number" step="any" placeholder=" " {...field} value={field.value ?? ''} className="rounded-xl h-11 px-4 text-sm"/>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-center md:col-span-2">
                                 <p className="text-sm font-medium text-green-700 mb-1">PCI sur Brut (kcal/kg)</p>
                                <p className={cn(
                                    "text-2xl font-bold tracking-tight transition-opacity duration-300",
                                    pciResult !== null ? "text-green-600 opacity-100" : "text-gray-400 opacity-50"
                                )}>
                                    {pciResult !== null ? pciResult.toLocaleString('fr-FR') : '-'}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
            
            <Button 
                type="submit" 
                disabled={isSaving || pciResult === null} 
                className="fixed bottom-6 right-6 bg-green-600 hover:bg-green-700 text-white rounded-full px-6 py-3 shadow-lg"
            >
                {isSaving ? "Enregistrement..." : "Enregistrer"}
            </Button>
        </form>
      </Form>

       <Dialog open={isFuelModalOpen} onOpenChange={setIsFuelModalOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Ajouter un nouveau type de combustible</DialogTitle>
                    <DialogDescription>
                        Entrez les informations pour le nouveau type.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">Nom</Label>
                        <Input id="name" value={newFuelTypeName} onChange={(e) => setNewFuelTypeName(e.target.value)} className="col-span-3" />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="secondary">Annuler</Button>
                    </DialogClose>
                    <Button type="button" onClick={handleAddFuelType}>Ajouter</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <Dialog open={isFournisseurModalOpen} onOpenChange={setIsFournisseurModalOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Ajouter un nouveau fournisseur</DialogTitle>
                    <DialogDescription>
                        Entrez le nom du nouveau fournisseur pour le combustible "{typeCombustibleValue}".
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">Nom</Label>
                        <Input id="name" value={newFournisseurName} onChange={(e) => setNewFournisseurName(e.target.value)} className="col-span-3" />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="secondary">Annuler</Button>
                    </DialogClose>
                    <Button type="button" onClick={handleAddFournisseur}>Ajouter</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
  );
}
