
"use client";

import React, { useState, useEffect } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon, Fuel, PlusCircle, ClipboardList, FlaskConical, MessageSquareText } from 'lucide-react';
import { collection, addDoc, Timestamp, doc, setDoc, getDoc, updateDoc, arrayUnion, serverTimestamp } from "firebase/firestore";

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
import { getFuelTypes, type FuelType, H_MAP, getFournisseurs, getFuelSupplierMap, fixFuelTypesMissingCreatedAt } from '@/lib/data';
import { db } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast";

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
    icon: z.string().nonempty({ message: "L'icône est requise." }),
    hValue: z.coerce.number({ required_error: "La valeur H est requise."}).min(0, { message: "La valeur H doit être positive." }),
});

const newFournisseurSchema = z.object({
    name: z.string().nonempty({ message: "Le nom du fournisseur est requis."}).regex(/^[a-zA-Z0-9\s-]+$/, "Le nom ne doit contenir que des lettres, chiffres, espaces ou tirets."),
});

export function PciCalculator() {
  const [pciResult, setPciResult] = useState<number | null>(null);
  const [hValue, setHValue] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [allFuelTypes, setAllFuelTypes] = useState<FuelType[]>([]);
  const [allFournisseurs, setAllFournisseurs] = useState<string[]>([]);
  const [fuelSupplierMap, setFuelSupplierMap] = useState<Record<string, string[]>>({});
  
  const [filteredFournisseurs, setFilteredFournisseurs] = useState<string[]>([]);
  
  const [isFuelModalOpen, setIsFuelModalOpen] = useState(false);
  const [newFuelTypeName, setNewFuelTypeName] = useState("");
  const [newFuelTypeIcon, setNewFuelTypeIcon] = useState("");
  const [newFuelTypeHValue, setNewFuelTypeHValue] = useState<number | string>("");

  const [isFournisseurModalOpen, setIsFournisseurModalOpen] = useState(false);
  const [newFournisseurName, setNewFournisseurName] = useState("");

  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date_arrivage: undefined,
      type_combustible: "Plastiques",
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
        date_arrivage: undefined,
        type_combustible: "Plastiques",
        fournisseur: "",
        pcs: '' as any,
        h2o: '' as any,
        chlore: '' as any,
        cendres: '' as any,
        densite: '' as any,
        remarques: "",
    });
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    setValue("date_arrivage", yesterday);
    setPciResult(null);
  };

  const fetchAndSetData = async () => {
      let fetchedFuelTypes = await getFuelTypes();
      
      // Tri alphabétique
      fetchedFuelTypes.sort((a, b) => a.name.localeCompare(b.name));
      
      const [fetchedFournisseurs, fetchedMap] = await Promise.all([
          getFournisseurs(),
          getFuelSupplierMap()
      ]);
      
      setAllFuelTypes(fetchedFuelTypes);
      setAllFournisseurs(fetchedFournisseurs);
      setFuelSupplierMap(fetchedMap);
  };

  useEffect(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    setValue("date_arrivage", yesterday);
    
    fetchAndSetData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


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
    if (typeCombustibleValue && Object.keys(fuelSupplierMap).length > 0) {
        const relatedFournisseurs = fuelSupplierMap[typeCombustibleValue] || [];
        setFilteredFournisseurs(relatedFournisseurs.sort());
        setValue('fournisseur', '');
    } else {
        setFilteredFournisseurs([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeCombustibleValue, fuelSupplierMap, setValue]);


  const handleAddFuelType = async () => {
      try {
        const newFuel = newFuelTypeSchema.parse({ 
            name: newFuelTypeName, 
            icon: newFuelTypeIcon, 
            hValue: newFuelTypeHValue,
        });

        const docRef = doc(db, "fuel_types", newFuel.name);
        const dataToSave = { 
            name: newFuel.name, 
            icon: newFuel.icon, 
            hValue: newFuel.hValue,
            createdAt: serverTimestamp(),
        };

        await setDoc(docRef, dataToSave);

        H_MAP[newFuel.name] = dataToSave.hValue;
        
        await fetchAndSetData();
        
        setValue("type_combustible", newFuel.name, { shouldValidate: true });

        toast({
            title: "Succès",
            description: `Le type "${newFuel.name}" a été ajouté.`,
        });

        setIsFuelModalOpen(false);
        setNewFuelTypeName("");
        setNewFuelTypeIcon("");
        setNewFuelTypeHValue("");

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

        const fournisseurDocRef = doc(db, "fournisseurs", name);
        const docSnap = await getDoc(fournisseurDocRef);
        if (!docSnap.exists()) {
            await setDoc(fournisseurDocRef, { name });
            setAllFournisseurs(prev => [...prev, name].sort());
        }

        const mapDocRef = doc(db, "fuel_supplier_map", selectedFuelType);
        
        const mapDocSnap = await getDoc(mapDocRef);
        if (mapDocSnap.exists()) {
            await updateDoc(mapDocRef, {
                suppliers: arrayUnion(name)
            });
        } else {
            await setDoc(mapDocRef, {
                suppliers: [name]
            });
        }

        const updatedMap = { ...fuelSupplierMap };
        if (!updatedMap[selectedFuelType]) {
            updatedMap[selectedFuelType] = [];
        }
        if (!updatedMap[selectedFuelType].includes(name)) {
            updatedMap[selectedFuelType].push(name);
        }
        setFuelSupplierMap(updatedMap);
        
        setFilteredFournisseurs(updatedMap[selectedFuelType].sort()); 

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
            toast({
                variant: "destructive",
                title: "Erreur",
                description: "Impossible d'ajouter ou d'associer le nouveau fournisseur.",
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
        date_arrivage: Timestamp.fromDate(values.date_arrivage),
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

    } catch (error: any) {
        console.error("Erreur lors de l'enregistrement dans Firestore: ", error);
        let description = "Impossible d'enregistrer les données. Vérifiez la console pour plus de détails.";
        if (error.code === 'permission-denied') {
            description = "Permission refusée. Veuillez vérifier les règles de sécurité de votre base de données Firestore."
        }
        toast({
            variant: "destructive",
            title: "Erreur d'enregistrement",
            description,
        });
    } finally {
        setIsSaving(false);
    }
  }

  const isFournisseurDisabled = !typeCombustibleValue;

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
                                                        {fuel.icon} {fuel.name}
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
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="icon" className="text-right">Icône (emoji)</Label>
                        <Input id="icon" value={newFuelTypeIcon} onChange={(e) => setNewFuelTypeIcon(e.target.value)} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="hValue" className="text-right">Valeur H</Label>
                        <Input id="hValue" type="number" value={newFuelTypeHValue} onChange={(e) => setNewFuelTypeHValue(e.target.value)} className="col-span-3" />
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

    