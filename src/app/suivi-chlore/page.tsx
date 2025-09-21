

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
import { Wind, CalendarIcon, PlusCircle, Trash2, Edit } from 'lucide-react';
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
  
  const [latestMixtureChlorine, setLatestMixtureChlorine] = useState<number>(0);
  const [latestAfFlow, setLatestAfFlow] = useState<number>(0);
  const [latestGoFlow, setLatestGoFlow] = useState<number>(0);

  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: subDays(new Date(), 30), to: new Date() });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchLatestMixtureData = useCallback(async () => {
      try {
          const session = await getLatestMixtureSession();
          if (session) {
              setLatestMixtureChlorine(session.globalIndicators?.chlorine || 0);
              const afFlow = (session.hallAF?.flowRate || 0) + (session.ats?.flowRate || 0);
              const goFlow = (session.directInputs?.['Grignons GO1']?.flowRate || 0) + (session.directInputs?.['Grignons GO2']?.flowRate || 0);
              setLatestAfFlow(afFlow);
              setLatestGoFlow(goFlow);
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
  }, [fetchLatestMixtureData, fetchEntries]);

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
            afFlow: latestAfFlow,
            goFlow: latestGoFlow,
        });
        toast({ title: "Succès", description: "Entrée enregistrée." });
        setHotMealChlorine('');
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

  const chartData = useMemo(() => {
    return entries
        .map(entry => ({
            ...entry,
            date: format(entry.date.toDate(), 'dd/MM/yy'),
        }))
        .sort((a,b) => a.date.localeCompare(b.date)); // Sort chronologically for chart
  }, [entries]);

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
          <form onSubmit={handleSubmit} className="grid md:grid-cols-5 gap-4 items-end">
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
              <label className="text-sm font-medium">% Chlore Farine Chaude</label>
              <Input
                type="number"
                step="0.001"
                value={hotMealChlorine}
                onChange={(e) => setHotMealChlorine(e.target.value)}
                placeholder="Ex: 0.035"
              />
            </div>
            <div className="space-y-2 p-2 border rounded-md bg-muted/50">
              <label className="text-sm font-medium text-muted-foreground">Débit AF (auto)</label>
              <p className="font-bold text-lg">{latestAfFlow.toFixed(2)} t/h</p>
            </div>
             <div className="space-y-2 p-2 border rounded-md bg-muted/50">
              <label className="text-sm font-medium text-muted-foreground">Débit GO (auto)</label>
              <p className="font-bold text-lg">{latestGoFlow.toFixed(2)} t/h</p>
            </div>
            <div className="space-y-2 p-2 border rounded-md bg-muted/50">
              <label className="text-sm font-medium text-muted-foreground">% Chlore Mélange (auto)</label>
              <p className="font-bold text-lg">{latestMixtureChlorine.toFixed(3)} %</p>
            </div>
            <div className="md:col-span-5 flex justify-end">
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
            <CardTitle>Historique et Évolution</CardTitle>
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
            <ResponsiveContainer width="100%" height={400}>
                {loading ? <Skeleton className="h-full w-full" /> : entries.length > 0 ? (
                <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" label={{ value: '% Chlore', angle: -90, position: 'insideLeft' }} />
                    <YAxis yAxisId="right" orientation="right" label={{ value: 'Débit (t/h)', angle: -90, position: 'insideRight' }} />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="calculatedMixtureChlorine" name="% Cl (Mélange)" stroke="#8884d8" strokeWidth={2} />
                    <Line yAxisId="left" type="monotone" dataKey="hotMealChlorine" name="% Cl (Farine)" stroke="#82ca9d" strokeWidth={2} />
                    <Line yAxisId="right" type="monotone" dataKey="afFlow" name="Débit AF" stroke="#ffc658" strokeDasharray="5 5" />
                    <Line yAxisId="right" type="monotone" dataKey="goFlow" name="Débit GO" stroke="#ff8042" strokeDasharray="5 5" />
                </ComposedChart>
                 ) : <div className="flex items-center justify-center h-full text-muted-foreground">Aucune donnée pour la période sélectionnée.</div>}
            </ResponsiveContainer>
            
            <div className="mt-8">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Débit AF (t/h)</TableHead>
                            <TableHead className="text-right">Débit GO (t/h)</TableHead>
                            <TableHead className="text-right">% Cl (Mélange)</TableHead>
                            <TableHead className="text-right">% Cl (Farine)</TableHead>
                            <TableHead className="text-center">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {entries.map(entry => (
                            <TableRow key={entry.id}>
                                <TableCell>{format(entry.date.toDate(), 'd MMM yyyy', { locale: fr })}</TableCell>
                                <TableCell className="text-right">{(entry.afFlow ?? 0).toFixed(2)}</TableCell>
                                <TableCell className="text-right">{(entry.goFlow ?? 0).toFixed(2)}</TableCell>
                                <TableCell className="text-right">{entry.calculatedMixtureChlorine.toFixed(3)}</TableCell>
                                <TableCell className="text-right">{entry.hotMealChlorine.toFixed(3)}</TableCell>
                                <TableCell className="text-center">
                                    <Button variant="ghost" size="icon" onClick={() => setDeletingId(entry.id)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                         {entries.length === 0 && !loading && (
                            <TableRow><TableCell colSpan={6} className="text-center h-24">Aucune donnée.</TableCell></TableRow>
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
