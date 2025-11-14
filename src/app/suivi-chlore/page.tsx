

"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getChlorineTrackingEntries,
  addChlorineTrackingEntry,
  updateChlorineTrackingEntry,
  deleteChlorineTrackingEntry,
  getLatestMixtureSession,
  type ChlorineTrackingEntry,
} from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Wind, CalendarIcon, PlusCircle, Trash2, Edit, TrendingUp, MessageSquare } from 'lucide-react';
import { DateRange } from "react-day-picker";
import { Timestamp } from 'firebase/firestore';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line, ComposedChart } from 'recharts';
import { cn } from "@/lib/utils";

function ChlorineTrackingManager() {
  const [entries, setEntries] = useState<ChlorineTrackingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  const [date, setDate] = useState<Date>(new Date());
  const [hotMealChlorine, setHotMealChlorine] = useState<string>('');
  const [remarques, setRemarques] = useState('');
  
  const [latestMixtureChlorine, setLatestMixtureChlorine] = useState<number>(0);
  const [latestClFcEstime, setLatestClFcEstime] = useState<number>(0);
  const [latestTsr, setLatestTsr] = useState<number>(0);

  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: subDays(new Date(), 30), to: new Date() });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchLatestMixtureData = useCallback(async () => {
      try {
          const session = await getLatestMixtureSession();
          if (session) {
              setLatestMixtureChlorine(session.globalIndicators?.chlorine || 0);
              setLatestClFcEstime(session.globalIndicators?.cl_fc || 0);
              setLatestTsr(session.globalIndicators?.tsr || 0);
          }
      } catch (error) {
          toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les données du dernier mélange."});
      }
  }, [toast]);
  
  const fetchEntries = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) return;
    setLoading(true);
    try {
      const fetchedEntries = await getChlorineTrackingEntries({ from: dateRange.from, to: dateRange.to });
      setEntries(fetchedEntries);
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger l'historique." });
    } finally {
      setLoading(false);
    }
  }, [toast, dateRange]);

  useEffect(() => {
    fetchLatestMixtureData();
    fetchEntries();

    // Check for imported chlorine value from localStorage
    if (typeof window !== 'undefined') {
        const importedValue = localStorage.getItem('importedHotMealChlorine');
        if (importedValue) {
            try {
                const parsedValue = JSON.parse(importedValue);
                setHotMealChlorine(String(parsedValue));
                // Optional: remove it after use to prevent re-populating on next visit
                // localStorage.removeItem('importedHotMealChlorine');
                toast({ title: "Donnée importée", description: "Le % de chlore de la farine chaude a été pré-rempli." });
            } catch (e) {
                console.error("Failed to parse imported chlorine value", e);
            }
        }
    }
  }, [fetchLatestMixtureData, fetchEntries, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const chlorineValue = parseFloat(hotMealChlorine);
    if (isNaN(chlorineValue) || chlorineValue < 0) {
        toast({ variant: "destructive", title: "Valeur invalide", description: "Veuillez entrer un pourcentage de chlore valide." });
        return;
    }
    
    setIsSubmitting(true);
    try {
        await addChlorineTrackingEntry({
            date: Timestamp.fromDate(date),
            calculatedMixtureChlorine: latestMixtureChlorine,
            hotMealChlorine: chlorineValue,
            clFcEstime: latestClFcEstime,
            tsr: latestTsr,
            remarques: remarques
        });
        toast({ title: "Succès", description: "Entrée enregistrée." });
        setHotMealChlorine('');
        setRemarques('');
        setDate(new Date());
        fetchEntries(); // Refresh list
    } catch (error) {
        toast({ variant: "destructive", title: "Erreur", description: "Impossible d'enregistrer l'entrée." });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const handleDelete = async () => {
    if (!deletingId) return;
    try {
        await deleteChlorineTrackingEntry(deletingId);
        toast({ title: "Succès", description: "L'enregistrement a été supprimé." });
        fetchEntries();
    } catch (error) {
        toast({ variant: "destructive", title: "Erreur", description: "Impossible de supprimer l'enregistrement." });
    } finally {
        setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wind className="h-6 w-6 text-primary" />
            Suivi du Chlore
          </CardTitle>
          <CardDescription>
            Enregistrez le taux de chlore analysé sur la farine chaude pour le corréler aux données du mélange.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-3 gap-6 items-end">
                {/* --- Inputs --- */}
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Date de l'analyse</label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {date ? format(date, "PPP", { locale: fr }) : <span>Choisir une date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus locale={fr} /></PopoverContent>
                        </Popover>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">% Chlore Farine Chaude (Analysé)</label>
                        <Input type="number" step="0.001" value={hotMealChlorine} onChange={(e) => setHotMealChlorine(e.target.value)} placeholder="Ex: 0.035"/>
                    </div>
                </div>

                {/* --- Auto Values --- */}
                <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="space-y-2 p-3 border rounded-lg bg-muted/30 flex flex-col justify-center">
                        <label className="text-sm font-medium text-muted-foreground">TSR (auto)</label>
                        <p className="font-bold text-lg">{latestTsr.toFixed(2)} %</p>
                    </div>
                    <div className="space-y-2 p-3 border rounded-lg bg-muted/30 flex flex-col justify-center">
                        <label className="text-sm font-medium text-muted-foreground">% Chlore Mélange (auto)</label>
                        <p className="font-bold text-lg">{latestMixtureChlorine.toFixed(3)} %</p>
                    </div>
                     <div className="space-y-2 p-3 border rounded-lg bg-purple-900/40 border-purple-500 text-purple-300 flex flex-col justify-center">
                        <label className="text-sm font-medium">%Cl FC estimé (auto)</label>
                        <p className="font-bold text-lg">{latestClFcEstime.toFixed(3)} %</p>
                    </div>
                </div>
            </div>

            {/* --- Remarques & Submit --- */}
            <div className="space-y-2 pt-4">
                <label className="text-sm font-medium flex items-center gap-2"><MessageSquare className="h-4 w-4" />Remarques</label>
                <Textarea value={remarques} onChange={(e) => setRemarques(e.target.value)} placeholder="Ajoutez un commentaire... (optionnel)" />
            </div>

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={isSubmitting}>
                <PlusCircle className="mr-2 h-4 w-4" />
                {isSubmitting ? "Enregistrement..." : "Enregistrer l'entrée du jour"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
            <CardTitle>Historique des analyses</CardTitle>
            <div className="pt-2">
                 <Popover>
                    <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant={"outline"}
                        className={cn(
                            "w-[300px] justify-start text-left font-normal",
                            !dateRange && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange?.from ? (
                        dateRange.to ? (
                            <>
                            {format(dateRange.from, "d MMM y", { locale: fr })} -{" "}
                            {format(dateRange.to, "d MMM y", { locale: fr })}
                            </>
                        ) : (
                            format(dateRange.from, "d MMM y", { locale: fr })
                        )
                        ) : (
                        <span>Sélectionner une plage de dates</span>
                        )}
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={dateRange?.from}
                        selected={dateRange}
                        onSelect={setDateRange}
                        numberOfMonths={2}
                        locale={fr}
                    />
                    </PopoverContent>
                </Popover>
            </div>
        </CardHeader>
        <CardContent>
            <div className="mt-8">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">TSR (%)</TableHead>
                            <TableHead className="text-right">% Cl (Mélange)</TableHead>
                            <TableHead className="text-right">% Cl FC (Estimé)</TableHead>
                            <TableHead className="text-right">% Cl FC (Analysé)</TableHead>
                            <TableHead className="text-right">Ecart (Est. - Réel)</TableHead>
                            <TableHead>Remarques</TableHead>
                            <TableHead className="text-center">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                          [...Array(5)].map((_, i) => (
                            <TableRow key={i}>
                                <TableCell colSpan={8}><Skeleton className="h-6 w-full" /></TableCell>
                            </TableRow>
                          ))
                        ) : entries.map(entry => {
                            const ecart = (entry.clFcEstime ?? 0) - entry.hotMealChlorine;
                            return (
                            <TableRow key={entry.id}>
                                <TableCell>{format(entry.date.toDate(), 'd MMM yyyy', { locale: fr })}</TableCell>
                                <TableCell className="text-right">{(entry.tsr ?? 0).toFixed(2)}%</TableCell>
                                <TableCell className="text-right">{entry.calculatedMixtureChlorine.toFixed(3)}</TableCell>
                                <TableCell className="text-right font-medium text-purple-400">{(entry.clFcEstime ?? 0).toFixed(3)}</TableCell>
                                <TableCell className="text-right font-bold text-emerald-400">{entry.hotMealChlorine.toFixed(3)}</TableCell>
                                <TableCell className={cn("text-right font-medium", ecart > 0.01 ? 'text-red-400' : ecart < -0.01 ? 'text-yellow-400' : 'text-gray-400')}>{ecart.toFixed(3)}</TableCell>
                                <TableCell className="max-w-[200px] truncate" title={entry.remarques}>{entry.remarques}</TableCell>
                                <TableCell className="text-center">
                                    <Button variant="ghost" size="icon" onClick={() => setDeletingId(entry.id)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        )})}
                         {entries.length === 0 && !loading && (
                            <TableRow><TableCell colSpan={8} className="text-center h-24">Aucune donnée pour la période sélectionnée.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </CardContent>
      </Card>
      
       <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Cette action est irréversible et supprimera définitivement cet enregistrement.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Supprimer</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}

export default function SuiviChlorePage() {
    return (
        <div className="flex-1 p-4 md:p-6 lg:p-8">
            <ChlorineTrackingManager />
        </div>
    )
}
