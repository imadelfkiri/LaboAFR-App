

"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { format, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon, Fuel, PlusCircle, ClipboardList, FlaskConical, MessageSquareText, FileText, Flame } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

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
  CardDescription
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
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
import { calculerPCI, calculerPCS } from '@/lib/pci';
import { getFuelTypes, type FuelType, getFuelSupplierMap, addSupplierToFuel, SPEC_MAP, getSpecifications, addFuelType, getFuelData, FuelData, getUniqueFuelTypes } from '@/lib/data';
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from './ui/skeleton';
import { useAuth } from '@/context/auth-provider';

const formSchema = z.object({
  date_arrivage: z.date({
    required_error: "Une date d'arrivée est requise.",
  }),
  type_analyse: z.string().nonempty({ message: "Veuillez sélectionner un type d'analyse." }),
  type_combustible: z.string().nonempty({ message: "Veuillez sélectionner un type de combustible." }),
  fournisseur: z.string().nonempty({ message: "Veuillez sélectionner un fournisseur." }),
  pcs: z.coerce.number({required_error: "Veuillez renseigner une valeur valide pour le PCS.", invalid_type_error: "Veuillez entrer un nombre."}).positive({ message: "Le PCS doit être un nombre positif." }),
  h2o: z.coerce.number({required_error: "Le taux d'humidité est requis.", invalid_type_error: "Veuillez entrer un nombre."}).min(0, { message: "L'humidité ne peut être négative." }).max(100, { message: "L'humidité ne peut dépasser 100%." }),
  chlore: z.coerce.number({invalid_type_error: "Veuillez entrer un nombre."}).min(0, { message: "Le chlore ne peut être négatif." }).optional().nullable(),
  cendres: z.coerce.number({invalid_type_error: "Veuillez entrer un nombre."}).min(0, { message: "Le % de cendres ne peut être négatif." }).optional().nullable(),
  remarques: z.string().optional(),
  taux_metal: z.coerce.number({invalid_type_error: "Veuillez entrer un nombre."}).min(0, "Le taux doit être positif.").max(100, "Le taux ne peut dépasser 100%").optional().nullable(),
});

const newFuelTypeSchema = z.object({
    name: z.string().nonempty({ message: "Le nom du combustible est requis."}),
    hValue: z.coerce.number({required_error: "La valeur H est requise.", invalid_type_error: "Veuillez entrer un nombre."}).min(0, {message: "La valeur H doit être positive."})
});

const newFournisseurSchema = z.object({
    name: z.string().nonempty({ message: "Le nom du fournisseur est requis."}).regex(/^[a-zA-Z0-9\s-]+$/, "Le nom ne doit contenir que des lettres, chiffres, espaces ou tirets."),
});

type ValidationStatus = 'conform' | 'non-conform' | 'neutral';
type FieldValidationStatus = {
    pci: ValidationStatus;
    h2o: ValidationStatus;
    chlore: ValidationStatus;
    cendres: ValidationStatus;
};

const fuelOrder = [
    "Pneus",
    "CSR",
    "CSR DD",
    "DMB",
    "Plastiques",
    "Bois",
    "Mélange"
];

export function PciCalculator() {
  const { userProfile } = useAuth();
  const [pciResult, setPciResult] = useState<number | null>(null);
  const [hValue, setHValue] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [allFuelTypes, setAllFuelTypes] = useState<string[]>([]);
  const [fuelSupplierMap, setFuelSupplierMap] = useState<Record<string, string[]>>({});
  const [fuelDataMap, setFuelDataMap] = useState<Map<string, FuelData>>(new Map());
  
  const [filteredFournisseurs, setFilteredFournisseurs] = useState<string[]>([]);
  
  const [isFuelTypeModalOpen, setIsFuelTypeModalOpen] = useState(false);
  const [isFournisseurModalOpen, setIsFournisseurModalOpen] = useState(false);
  const [newFournisseurName, setNewFournisseurName] = useState("");

  const [validationStatus, setValidationStatus] = useState<FieldValidationStatus>({
    pci: 'neutral',
    h2o: 'neutral',
    chlore: 'neutral',
    cendres: 'neutral',
  });

  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type_analyse: "Arrivage",
      type_combustible: "",
      fournisseur: "",
      pcs: undefined,
      h2o: undefined,
      chlore: undefined,
      cendres: undefined,
      remarques: "",
      taux_metal: undefined,
    },
  });

  const { watch, reset, getValues, setValue } = form;

  const watchedTypeCombustible = watch("type_combustible");

  useEffect(() => {
    // Set the default date only on the client side to avoid hydration errors
    setValue('date_arrivage', subDays(new Date(), 1));
  }, [setValue]);

  const resetForm = () => {
    reset({
        date_arrivage: subDays(new Date(), 1),
        type_analyse: "Arrivage",
        type_combustible: "",
        fournisseur: "",
        pcs: '' as any,
        h2o: '' as any,
        chlore: '' as any,
        cendres: '' as any,
        remarques: "",
        taux_metal: '' as any,
    });
    setPciResult(null);
  };

  const fetchAndSetData = useCallback(async () => {
      setLoading(true);
      try {
        const [fetchedFuelTypes, map, _specs, fuelData] = await Promise.all([
          getUniqueFuelTypes(),
          getFuelSupplierMap(),
          getSpecifications(),
          getFuelData()
        ]);
        
        const sortedFuelTypes = [...fetchedFuelTypes].sort((a, b) => {
            const indexA = fuelOrder.indexOf(a);
            const indexB = fuelOrder.indexOf(b);
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return a.localeCompare(b);
        });

        setAllFuelTypes(sortedFuelTypes);
        setFuelSupplierMap(map);
        setFuelDataMap(new Map(fuelData.map(fd => [fd.nom_combustible, fd])));
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

  const watchedPcs = watch("pcs");
  const watchedH2o = watch("h2o");
  const watchedTauxMetal = watch("taux_metal");
  
  const watchedFournisseur = watch("fournisseur");
  const watchedChlore = watch("chlore");
  const watchedCendres = watch("cendres");

  useEffect(() => {
    if (watchedPcs !== undefined && watchedH2o !== undefined && hValue !== null) {
      let pcsToUse = Number(watchedPcs);
      const metalRate = Number(watchedTauxMetal);
      if (!isNaN(metalRate) && metalRate > 0) {
        pcsToUse = pcsToUse * (1 - metalRate / 100);
      }
      const result = calculerPCI(pcsToUse, Number(watchedH2o), hValue);
      setPciResult(result);
    } else {
      setPciResult(null);
    }
  }, [watchedPcs, watchedH2o, watchedTauxMetal, hValue]);

  useEffect(() => {
    if (watchedTypeCombustible) {
        const fuelData = fuelDataMap.get(watchedTypeCombustible);
        if (fuelData) {
            setHValue(fuelData.teneur_hydrogene);
        } else {
            setHValue(null);
        }
    } else {
        setHValue(null);
    }
  }, [watchedTypeCombustible, fuelDataMap]);


  useEffect(() => {
    if (watchedTypeCombustible && fuelSupplierMap) {
        const relatedFournisseurs = fuelSupplierMap[watchedTypeCombustible] || [];
        setFilteredFournisseurs(relatedFournisseurs.sort());
        setValue('fournisseur', '');
    } else {
        setFilteredFournisseurs([]);
    }
  }, [watchedTypeCombustible, fuelSupplierMap, setValue]);


  useEffect(() => {
    const spec = SPEC_MAP.get(`${watchedTypeCombustible}|${watchedFournisseur}`);
    
    const newStatus: FieldValidationStatus = {
        pci: 'neutral',
        h2o: 'neutral',
        chlore: 'neutral',
        cendres: 'neutral',
    };

    if (spec) {
        // PCI
        if (spec.PCI_min !== null && spec.PCI_min !== undefined && pciResult !== null) {
            newStatus.pci = pciResult < spec.PCI_min ? 'non-conform' : 'conform';
        }
        // H2O
        if (spec.H2O_max !== null && spec.H2O_max !== undefined && watchedH2o !== undefined && watchedH2o !== null) {
            newStatus.h2o = Number(watchedH2o) > spec.H2O_max ? 'non-conform' : 'conform';
        }
        // Chlore
        if (spec.Cl_max !== null && spec.Cl_max !== undefined && watchedChlore !== undefined && watchedChlore !== null) {
            newStatus.chlore = Number(watchedChlore) > spec.Cl_max ? 'non-conform' : 'conform';
        }
        // Cendres
        if (spec.Cendres_max !== null && spec.Cendres_max !== undefined && watchedCendres !== undefined && watchedCendres !== null) {
            newStatus.cendres = Number(watchedCendres) > spec.Cendres_max ? 'non-conform' : 'conform';
        }
    }
    
    setValidationStatus(newStatus);
  }, [pciResult, watchedTypeCombustible, watchedFournisseur, watchedH2o, watchedChlore, watchedCendres]);


  const getInputClass = (status: ValidationStatus) => {
    switch (status) {
      case 'conform': return 'border-emerald-500/50 focus-visible:ring-emerald-500 focus-visible:border-emerald-500';
      case 'non-conform': return 'border-rose-500/50 focus-visible:ring-rose-500 focus-visible:border-rose-500';
      default: return 'border-input';
    }
  };

  const handleAddFournisseur = async () => {
    const selectedFuelType = getValues("type_combustible");
    if (!selectedFuelType) return;

    try {
        const newFournisseur = newFournisseurSchema.parse({ name: newFournisseurName });
        const name = newFournisseur.name.trim();

        await addSupplierToFuel(selectedFuelType, name);
        
        await fetchAndSetData(); // Refetch the map
        
        setValue("fournisseur", name, { shouldValidate: true });

        toast({
            title: "Succès",
            description: `Le fournisseur "${name}" a été ajouté et associé à ${selectedFuelType}.`,
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

  async function handleAddFuelType(values: z.infer<typeof newFuelTypeSchema>) {
    try {
      await addFuelType({ name: values.name, hValue: values.hValue });
      toast({ title: "Succès", description: `Le combustible "${values.name}" a été ajouté.` });
      
      await fetchAndSetData(); // Refetch all data to update UI everywhere
      
      setValue("type_combustible", values.name, { shouldValidate: true });
      
      setIsFuelTypeModalOpen(false);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Une erreur est survenue.";
      toast({ variant: "destructive", title: "Erreur", description: errorMessage });
    }
  }


  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSaving(true);
    try {
      if (hValue === null) {
          toast({ variant: "destructive", title: "Donnée manquante", description: "La teneur en hydrogène pour ce combustible n'est pas définie. Veuillez l'ajouter dans la page 'Données Combustibles'."});
          setIsSaving(false);
          return;
      }
      
      let pcsToUse = values.pcs;
      const metalRate = values.taux_metal;
      if (metalRate !== null && metalRate !== undefined && metalRate > 0) {
        pcsToUse = pcsToUse * (1 - metalRate / 100);
      }
      const pci_brut = calculerPCI(pcsToUse, values.h2o, hValue);

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
        taux_metal: values.taux_metal ? Number(values.taux_metal) : null,
        remarques: values.remarques || "",
        date_creation: serverTimestamp(),
      };
      
      // Remove tonnage from the data to be saved
      const { ...dataWithoutTonnage } = dataToSave;


      await addDoc(collection(db, 'resultats'), dataWithoutTonnage);
      
      toast({
          title: "Succès",
          description: "Les résultats ont été enregistrés avec succès.",
      });
      
      resetForm();
      // No need to refetch here, new results will show on the results page.

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

  const isFournisseurDisabled = !watchedTypeCombustible;
  const isReadOnly = userProfile?.role === 'viewer';


  if (loading) {
      return (
          <div className="w-full max-w-5xl mx-auto space-y-6 pb-24 p-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Skeleton className="h-[480px] w-full" />
                <Skeleton className="h-[480px] w-full" />
              </div>
          </div>
      )
  }

  return (
    <>
    <div className="w-full max-w-5xl space-y-4 mx-auto pb-24">
       <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-3">
                <Flame className="h-8 w-8"/>
                Calculateur de PCI
            </h1>
            <p className="text-muted-foreground mt-1">Saisissez les données d'analyse pour calculer et enregistrer le pouvoir calorifique inférieur.</p>
        </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <Card className="rounded-2xl">
                    <CardHeader className="p-6 pb-6">
                       <CardTitle className="text-lg font-semibold tracking-tight flex items-center gap-2">
                            <ClipboardList className="h-5 w-5 text-emerald-500" />
                            <span>Informations Générales</span>
                       </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 pt-0">
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField
                                    control={form.control}
                                    name="date_arrivage"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Date</FormLabel>
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
                                    name="type_analyse"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Type d'analyse</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                <SelectTrigger className="rounded-xl h-11 px-4 text-sm">
                                                    <SelectValue placeholder="Sélectionner..." />
                                                </SelectTrigger>
                                                </FormControl>
                                                <SelectContent side="bottom" avoidCollisions={false} className="z-50">
                                                    <SelectItem value="Arrivage">Arrivage</SelectItem>
                                                    <SelectItem value="Prospections">Prospections</SelectItem>
                                                    <SelectItem value="Consommation">Consommation</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
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
                                                    <SelectItem key={fuel} value={fuel}>
                                                        {fuel}
                                                    </SelectItem>
                                                ))}
                                                <Separator className="my-1" />
                                                <div
                                                    onSelect={(e) => e.preventDefault()}
                                                    onClick={() => setIsFuelTypeModalOpen(true)}
                                                    className="relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent focus:text-accent-foreground"
                                                >
                                                    <PlusCircle className="mr-2 h-4 w-4" />
                                                    Nouveau combustible...
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
                                                {filteredFournisseurs.length === 0 && watchedTypeCombustible ? (
                                                    <div className="px-2 py-1.5 text-sm text-muted-foreground text-center">Aucun fournisseur.</div>
                                                ) : (
                                                    filteredFournisseurs.map((fournisseur) => (
                                                        <SelectItem key={fournisseur} value={fournisseur}>
                                                            {fournisseur}
                                                        </SelectItem>
                                                    ))
                                                )}
                                                {watchedTypeCombustible && (
                                                    <>
                                                        <Separator className="my-1" />
                                                        <div
                                                            onSelect={(e) => e.preventDefault()}
                                                            onClick={() => setIsFournisseurModalOpen(true)}
                                                            className="relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent focus:text-accent-foreground"
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
                                        <div className="flex items-center gap-2">
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

                <div className="space-y-8">
                    <Card className="rounded-2xl">
                        <CardHeader className="p-6 pb-6">
                            <CardTitle className="text-lg font-semibold tracking-tight flex items-center gap-2">
                                <FlaskConical className="w-5 h-5 text-emerald-500" /> 
                                <span>Données Analytiques</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 pt-0">
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                                    <FormField
                                        control={form.control}
                                        name="pcs"
                                        render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>PCS (kcal/kg)</FormLabel>
                                            <FormControl>
                                            <Input type="number" step="any" placeholder=" " {...field} value={field.value ?? ''} className="h-11 rounded-xl px-4 text-sm" />
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
                                            <Input type="number" step="any" placeholder=" " {...field} value={field.value ?? ''} className={cn("h-11 rounded-xl px-4 text-sm", getInputClass(validationStatus.h2o))} />
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
                                            className="h-11 rounded-xl px-4 text-sm bg-muted text-muted-foreground"
                                            placeholder={watchedTypeCombustible ? (hValue === null ? 'Non défini' : '') : '-'}
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
                                            <Input type="number" step="any" placeholder=" " {...field} value={field.value ?? ''} className={cn("h-11 rounded-xl px-4 text-sm", getInputClass(validationStatus.chlore))} />
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
                                            <Input type="number" step="any" placeholder=" " {...field} value={field.value ?? ''} className={cn("h-11 rounded-xl px-4 text-sm", getInputClass(validationStatus.cendres))} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="taux_metal"
                                        render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Taux d'inertes %</FormLabel>
                                            <FormControl>
                                            <Input type="number" step="any" placeholder=" " {...field} value={field.value ?? ''} className="h-11 rounded-xl px-4 text-sm"/>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                        )}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                     <div className={cn(
                        "rounded-2xl p-5 border text-center transition-colors",
                        validationStatus.pci === "conform" && "bg-emerald-500/10 border-emerald-500/30",
                        validationStatus.pci === "non-conform" && "bg-rose-500/10 border-rose-500/30",
                        validationStatus.pci === "neutral" && "bg-card text-card-foreground border-border"
                    )}>
                        <p className={cn("text-sm", validationStatus.pci === 'neutral' ? 'text-muted-foreground' : 'text-inherit')}>PCI sur Brut (kcal/kg)</p>
                        <p className={cn(
                        "mt-1 text-3xl font-semibold tracking-tight",
                        validationStatus.pci === "conform" && "text-emerald-600",
                        validationStatus.pci === "non-conform" && "text-rose-600",
                        validationStatus.pci === "neutral" && "text-foreground"
                        )}>
                            {pciResult !== null ? pciResult.toLocaleString("fr-FR") : "-"}
                        </p>
                    </div>
                </div>

            </div>
            
            {!isReadOnly && (
                <div className="fixed bottom-6 right-6 z-30">
                    <Button
                        type="submit"
                        disabled={isSaving || pciResult === null}
                        className="rounded-full h-14 px-6 text-base shadow-lg"
                    >
                        {isSaving ? "Enregistrement..." : "Enregistrer"}
                    </Button>
                </div>
            )}
        </form>
      </Form>

        <Dialog open={isFournisseurModalOpen} onOpenChange={setIsFournisseurModalOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Ajouter un nouveau fournisseur</DialogTitle>
                    <DialogDescription>
                        Entrez le nom du nouveau fournisseur pour le combustible "{watchedTypeCombustible}".
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

        <NewFuelTypeDialog 
            isOpen={isFuelTypeModalOpen}
            onOpenChange={setIsFuelTypeModalOpen}
            onSave={handleAddFuelType}
        />
    </div>
    </>
  );
}


const NewFuelTypeDialog = ({ isOpen, onOpenChange, onSave }: { isOpen: boolean; onOpenChange: (open: boolean) => void; onSave: (values: z.infer<typeof newFuelTypeSchema>) => Promise<void> }) => {
    
    const form = useForm<z.infer<typeof newFuelTypeSchema>>({
        resolver: zodResolver(newFuelTypeSchema),
        defaultValues: { name: "", hValue: undefined },
    });
    
    const onSubmit = async (values: z.infer<typeof newFuelTypeSchema>) => {
        await onSave(values);
        form.reset();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Ajouter un nouveau type de combustible</DialogTitle>
                    <DialogDescription>
                        Définissez un nouveau combustible qui sera disponible dans toute l'application.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Nom du Combustible</FormLabel>
                                <FormControl><Input placeholder="Ex: Déchets industriels" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}/>
                        <FormField control={form.control} name="hValue" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Teneur en Hydrogène (%)</FormLabel>
                                <FormControl><Input type="number" step="any" placeholder="Ex: 5.5" {...field} value={field.value ?? ''} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}/>
                        <DialogFooter>
                            <DialogClose asChild><Button type="button" variant="secondary">Annuler</Button></DialogClose>
                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting ? "Sauvegarde..." : "Sauvegarder"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};

    

    