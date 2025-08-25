
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getStocks,
  updateStock,
  addArrivage,
  calculateAndApplyYesterdayConsumption,
  type Stock,
} from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Archive, PlusCircle, CalendarIcon, Truck, Save, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  FormLabel,
} from "@/components/ui/form";
import { cn } from "@/lib/utils";

const arrivageSchema = z.object({
  type_combustible: z.string().nonempty({ message: "Le type de combustible est requis." }),
  quantite: z.coerce.number().positive({ message: "La quantité doit être un nombre positif." }),
  date_arrivage: z.date({ required_error: "Une date d'arrivée est requise." }),
});


export function StockManager() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof arrivageSchema>>({
    resolver: zodResolver(arrivageSchema),
    defaultValues: {
      type_combustible: '',
      quantite: undefined,
      date_arrivage: new Date(),
    },
  });

  const fetchStocks = useCallback(async () => {
    setLoading(true);
    try {
      const fetchedStocks = await getStocks();
      setStocks(fetchedStocks);
    } catch (error) {
      console.error("Erreur de chargement des stocks :", error);
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les stocks." });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchStocks();
  }, [fetchStocks]);

  const handleStockChange = (id: string, newStockValue: string) => {
    const updatedStocks = stocks.map(stock => {
      if (stock.id === id) {
        return { ...stock, stock_actuel_tonnes: parseFloat(newStockValue) || 0 };
      }
      return stock;
    });
    setStocks(updatedStocks);
  };

  const handleSaveStock = async (stock: Stock) => {
    try {
      await updateStock(stock.id, { stock_actuel_tonnes: stock.stock_actuel_tonnes });
      toast({ title: "Succès", description: `Stock de ${stock.nom_combustible} mis à jour.` });
    } catch (error) {
      console.error("Erreur de sauvegarde du stock :", error);
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de sauvegarder le stock." });
    }
  };
  
  const onArrivageSubmit = async (values: z.infer<typeof arrivageSchema>) => {
    try {
      await addArrivage(values.type_combustible, values.quantite, values.date_arrivage);
      toast({ title: "Succès", description: "Arrivage enregistré."});
      setIsModalOpen(false);
      form.reset({
          type_combustible: '',
          quantite: undefined,
          date_arrivage: new Date(),
      });
      fetchStocks(); // Refresh stocks after adding new arrival
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Une erreur est survenue.";
        toast({ variant: "destructive", title: "Erreur", description: errorMessage });
    }
  };
  
  const handleCalculateConsumption = async () => {
    setIsCalculating(true);
    try {
        const consumed = await calculateAndApplyYesterdayConsumption();
        const consumedFuels = Object.entries(consumed).filter(([, qty]) => qty > 0);

        if (consumedFuels.length === 0) {
             toast({ title: "Calcul terminé", description: "Aucune consommation enregistrée pour la journée d'hier." });
        } else {
            toast({
                title: "Consommation appliquée",
                description: (
                    <div>
                        <p>Le stock a été mis à jour avec la consommation d'hier.</p>
                        <ul className="mt-2 text-xs list-disc pl-4">
                            {consumedFuels.map(([fuel, qty]) => (
                                <li key={fuel}>{fuel}: {qty.toFixed(2)} tonnes</li>
                            ))}
                        </ul>
                    </div>
                ),
            });
        }

        fetchStocks(); // Refresh stock data
    } catch(error) {
        const errorMessage = error instanceof Error ? error.message : "Une erreur inconnue est survenue.";
        toast({ variant: "destructive", title: "Erreur de calcul", description: errorMessage });
    } finally {
        setIsCalculating(false);
    }
  };


  if (loading) {
    return (
        <div className="p-4 md:p-6 lg:p-8">
            <Card>
                <CardHeader>
                <Skeleton className="h-8 w-1/2" />
                <Skeleton className="h-4 w-3/4" />
                </CardHeader>
                <CardContent>
                <Skeleton className="h-64 w-full" />
                </CardContent>
            </Card>
        </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start md:items-center justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Archive className="h-6 w-6 text-primary" />
            Gestion des Stocks
          </CardTitle>
          <CardDescription>
            Suivi et enregistrement des arrivages de combustibles.
          </CardDescription>
        </div>
        <div className="flex flex-col md:flex-row gap-2">
            <Button onClick={handleCalculateConsumption} disabled={isCalculating} variant="outline">
                <Zap className="mr-2 h-4 w-4" />
                {isCalculating ? "Calcul en cours..." : "Calculer la consommation d'hier"}
            </Button>
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogTrigger asChild>
                    <Button>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Enregistrer un Arrivage
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Nouvel Arrivage</DialogTitle>
                        <DialogDescription>
                            Entrez les informations de la nouvelle livraison. Le stock sera mis à jour automatiquement.
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onArrivageSubmit)} className="space-y-4 py-4">
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
                                          {stocks.map(s => <SelectItem key={s.id} value={s.id}>{s.nom_combustible}</SelectItem>)}
                                      </SelectContent>
                                  </Select>
                                  <FormMessage />
                              </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="quantite"
                          render={({ field }) => (
                              <FormItem>
                                  <FormLabel>Quantité (tonnes)</FormLabel>
                                  <FormControl><Input type="number" {...field} value={field.value ?? ''} placeholder="Ex: 50.5" /></FormControl>
                                  <FormMessage />
                              </FormItem>
                          )}
                        />
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
                                          "w-full justify-start text-left font-normal",
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
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom du Combustible</TableHead>
              <TableHead>Dernier Arrivage</TableHead>
              <TableHead>Quantité Arrivage (t)</TableHead>
              <TableHead className="w-[250px]">Stock Actuel (tonnes)</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stocks.map((stock) => (
              <TableRow key={stock.id}>
                <TableCell className="font-medium">{stock.nom_combustible}</TableCell>
                <TableCell>
                  {stock.dernier_arrivage_date 
                    ? format(stock.dernier_arrivage_date.toDate(), 'dd/MM/yyyy') 
                    : 'N/A'}
                </TableCell>
                <TableCell>{stock.dernier_arrivage_quantite?.toLocaleString('fr-FR') ?? 'N/A'}</TableCell>
                <TableCell>
                  <Input 
                    type="number"
                    value={stock.stock_actuel_tonnes}
                    onChange={(e) => handleStockChange(stock.id, e.target.value)}
                    className="max-w-xs"
                  />
                </TableCell>
                <TableCell className="text-right">
                    <Button size="sm" onClick={() => handleSaveStock(stock)}>
                        <Save className="mr-2 h-4 w-4" />
                        Enregistrer
                    </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

    