
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BrainCircuit, Calendar as CalendarIcon } from 'lucide-react';
import { DateRange } from "react-day-picker";
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { getAverageAnalysisForFuels } from '@/lib/data';
import type { AverageAnalysis } from '@/lib/data';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { optimizeMixture, MixtureOptimizerOutput, MixtureOptimizerInput } from '@/ai/flows/mixture-optimizer-flow';
import { useToast } from '@/hooks/use-toast';


interface InstallationState {
  flowRate: number;
  fuels: Record<string, { buckets: number, dateRange?: DateRange }>;
}

const initialInstallationState: InstallationState = {
  flowRate: 0,
  fuels: {},
};

const BUCKET_VOLUME_M3 = 3;

function IndicatorCard({ title, value, unit }: { title: string; value: string | number; unit?: string }) {
  return (
    <Card className="bg-gray-800/50 border-gray-700 text-center">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm font-medium text-gray-400">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <p className="text-2xl font-bold text-white">
          {value} <span className="text-lg text-gray-300">{unit}</span>
        </p>
      </CardContent>
    </Card>
  );
}

export function MixtureCalculator() {
  const [loading, setLoading] = useState(true);
  const [availableFuels, setAvailableFuels] = useState<Record<string, AverageAnalysis>>({});
  const [hallAF, setHallAF] = useState<InstallationState>(initialInstallationState);
  const [ats, setAts] = useState<InstallationState>(initialInstallationState);
  const { toast } = useToast();

  const fetchData = useCallback(async (fuelName?: string, dateRange?: DateRange) => {
    try {
      const fuelsToFetch = fuelName ? [fuelName] : Object.keys(availableFuels);
      if (fuelsToFetch.length === 0 && !fuelName) { // Initial load
          const initialFuels = await getAverageAnalysisForFuels(null, { from: subDays(new Date(), 7), to: new Date() });
          setAvailableFuels(initialFuels);
          
          const initialFuelState = Object.keys(initialFuels).reduce((acc, key) => {
              acc[key] = { buckets: 0 };
              return acc;
          }, {} as InstallationState['fuels']);

          setHallAF(prev => ({...prev, fuels: { ...initialFuelState }}));
          setAts(prev => ({...prev, fuels: { ...initialFuelState }}));

      } else if (fuelName && dateRange) {
         const updatedFuelData = await getAverageAnalysisForFuels([fuelName], dateRange);
         setAvailableFuels(prev => ({...prev, ...updatedFuelData}));
      }

    } catch (error) {
      console.error("Error fetching fuel data:", error);
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les données des combustibles." });
    } finally {
      setLoading(false);
    }
  }, [toast, availableFuels]);

  useEffect(() => {
    fetchData();
  }, []); // Eslint-disable-line react-hooks/exhaustive-deps, initial fetch only

  const handleDateRangeChange = (fuelName: string, installation: 'hall' | 'ats', dateRange?: DateRange) => {
    const setter = installation === 'hall' ? setHallAF : setAts;
    setter(prev => {
        const newFuels = { ...prev.fuels };
        newFuels[fuelName] = { ...newFuels[fuelName], dateRange: dateRange };
        return { ...prev, fuels: newFuels };
    });
    if (dateRange?.from && dateRange?.to) {
        fetchData(fuelName, dateRange);
    }
  }

  const calculateMixture = (installationState: InstallationState) => {
    const weights: Record<string, number> = {};
    let totalWeight = 0;
    let totalPci = 0;
    let totalChlorine = 0;
    let totalTireWeight = 0;

    for (const fuelName in installationState.fuels) {
      const fuelInput = installationState.fuels[fuelName];
      const fuelData = availableFuels[fuelName];

      if (fuelInput.buckets > 0 && fuelData && fuelData.density > 0) {
        const weight = fuelInput.buckets * BUCKET_VOLUME_M3 * fuelData.density;
        weights[fuelName] = weight;
        totalWeight += weight;
        if (fuelName.toLowerCase().includes('pneu')) {
            totalTireWeight += weight;
        }
      }
    }
    
    if (totalWeight === 0) return { pci: 0, chlorine: 0, tireRate: 0 };

    for (const fuelName in weights) {
      const weight = weights[fuelName];
      const fuelData = availableFuels[fuelName];
      if (fuelData) {
        totalPci += weight * fuelData.pci_brut;
        totalChlorine += weight * fuelData.chlore;
      }
    }

    return {
      pci: totalPci / totalWeight,
      chlorine: totalChlorine / totalWeight,
      tireRate: (totalTireWeight / totalWeight) * 100,
      totalWeight: totalWeight
    };
  };

  const hallMixture = useMemo(() => calculateMixture(hallAF), [hallAF, availableFuels]);
  const atsMixture = useMemo(() => calculateMixture(ats), [ats, availableFuels]);

  const globalIndicators = useMemo(() => {
    const totalFlow = (hallAF.flowRate || 0) + (ats.flowRate || 0);
    if (totalFlow === 0) return { flow: 0, pci: 0, humidity: 0, ash: 0, chlorine: 0, tireRate: 0 };

    const weightedAvg = (valHall: number, valAts: number) => {
        return (valHall * (hallAF.flowRate || 0) + valAts * (ats.flowRate || 0)) / totalFlow;
    }

    let totalHumidity = 0;
    let totalAsh = 0;
    let totalWeight = 0;

    [hallAF, ats].forEach(installation => {
        for(const fuelName in installation.fuels) {
            const fuelInput = installation.fuels[fuelName];
            const fuelData = availableFuels[fuelName];
            if (fuelInput.buckets > 0 && fuelData && fuelData.density > 0) {
                const weight = fuelInput.buckets * BUCKET_VOLUME_M3 * fuelData.density;
                totalHumidity += weight * fuelData.h2o;
                totalAsh += weight * fuelData.cendres;
                totalWeight += weight;
            }
        }
    });

    return {
      flow: totalFlow,
      pci: weightedAvg(hallMixture.pci, atsMixture.pci),
      humidity: totalWeight > 0 ? totalHumidity / totalWeight : 0,
      ash: totalWeight > 0 ? totalAsh / totalWeight : 0,
      chlorine: weightedAvg(hallMixture.chlorine, atsMixture.chlorine),
      tireRate: weightedAvg(hallMixture.tireRate, atsMixture.tireRate),
    };
  }, [hallAF, ats, hallMixture, atsMixture, availableFuels]);

  const handleInputChange = (setter: React.Dispatch<React.SetStateAction<InstallationState>>, fuelName: string, value: string) => {
    const buckets = parseInt(value, 10);
    setter(prev => {
      const newFuels = { ...prev.fuels };
      newFuels[fuelName] = { ...newFuels[fuelName], buckets: isNaN(buckets) ? 0 : buckets };
      return { ...prev, fuels: newFuels };
    });
  };

  const handleFlowRateChange = (setter: React.Dispatch<React.SetStateAction<InstallationState>>, value: string) => {
    const flowRate = parseFloat(value);
    setter(prev => ({ ...prev, flowRate: isNaN(flowRate) ? 0 : flowRate }));
  };

  const FuelInputList = ({ installationState, setInstallationState, installationName }: { installationState: InstallationState, setInstallationState: React.Dispatch<React.SetStateAction<InstallationState>>, installationName: 'hall' | 'ats' }) => {
    if (loading) {
        return <Skeleton className="h-48 w-full bg-gray-700" />;
    }
    return (
        <div className="space-y-3 pr-2 max-h-60 overflow-y-auto">
        {Object.keys(availableFuels).sort().map(fuelName => (
            <div key={fuelName} className="flex items-center gap-2">
            <Label htmlFor={`${installationName}-${fuelName}`} className="flex-1 text-sm">{fuelName}</Label>
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" size="icon" className="h-8 w-8 bg-gray-700 border-gray-600 hover:bg-gray-600">
                        <CalendarIcon className="h-4 w-4" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                    <Calendar
                        mode="range"
                        selected={installationState.fuels[fuelName]?.dateRange}
                        onSelect={(range) => handleDateRangeChange(fuelName, installationName, range)}
                        locale={fr}
                        numberOfMonths={2}
                    />
                </PopoverContent>
            </Popover>
            <Input
                id={`${installationName}-${fuelName}`}
                type="number"
                placeholder="0"
                className="w-24 bg-gray-700 border-gray-600 text-white"
                value={installationState.fuels[fuelName]?.buckets || ''}
                onChange={(e) => handleInputChange(setInstallationState, fuelName, e.target.value)}
                min="0"
            />
            </div>
        ))}
        </div>
    );
  };
  
  const AiAssistant = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [objective, setObjective] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [suggestion, setSuggestion] = useState<MixtureOptimizerOutput | null>(null);

    const handleGenerate = async () => {
        setIsGenerating(true);
        setSuggestion(null);
        try {
            const input: MixtureOptimizerInput = {
                availableFuels,
                userObjective: objective,
            };
            const result = await optimizeMixture(input);
            setSuggestion(result);
        } catch (error) {
            console.error("Error generating suggestion:", error);
            toast({ variant: "destructive", title: "Erreur IA", description: "La génération de suggestion a échoué." });
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button className="fixed bottom-6 right-6 rounded-full h-16 w-16 shadow-lg bg-primary hover:bg-primary/90">
                    <BrainCircuit className="h-8 w-8" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[625px] bg-gray-800 border-gray-700 text-white">
                <DialogHeader>
                    <DialogTitle>Assistant d'Optimisation de Mélange</DialogTitle>
                    <DialogDescription className="text-gray-400">
                        Décrivez votre objectif et l'IA vous proposera une recette.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <Label htmlFor="objective">Objectif</Label>
                    <Textarea
                        id="objective"
                        value={objective}
                        onChange={(e) => setObjective(e.target.value)}
                        placeholder="Ex: obtenir un PCI de 3500 kcal/kg avec un taux de chlore inférieur à 0.8%"
                        className="bg-gray-700 border-gray-600"
                    />
                </div>
                <DialogFooter>
                    <Button onClick={handleGenerate} disabled={isGenerating || !objective}>
                        {isGenerating ? "Génération en cours..." : "Générer la suggestion"}
                    </Button>
                </DialogFooter>
                {isGenerating && <Skeleton className="h-32 w-full bg-gray-700" />}
                {suggestion && (
                    <Card className="mt-4 bg-gray-900 border-gray-700">
                        <CardHeader>
                            <CardTitle>Suggestion de l'IA</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm space-y-4">
                             <p className="font-semibold">Raisonnement :</p>
                             <p className="text-gray-300 whitespace-pre-wrap">{suggestion.reasoning}</p>
                             <div>
                                <p className="font-semibold mt-4">Recette proposée :</p>
                                <div className="grid grid-cols-2 gap-4 mt-2">
                                    <div>
                                        <p className="font-medium">Hall des AF</p>
                                        <ul className="list-disc pl-5 text-gray-300">
                                            {Object.entries(suggestion.recipe.hallAF).map(([fuel, buckets]) => (
                                                <li key={`hall-${fuel}`}>{fuel}: {buckets} godets</li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div>
                                        <p className="font-medium">ATS</p>
                                        <ul className="list-disc pl-5 text-gray-300">
                                            {Object.entries(suggestion.recipe.ats).map(([fuel, buckets]) => (
                                                <li key={`ats-${fuel}`}>{fuel}: {buckets} godets</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                             </div>
                        </CardContent>
                    </Card>
                )}
            </DialogContent>
        </Dialog>
    );
  };


  return (
    <div className="p-4 md:p-8 space-y-8">
      <section>
        <h1 className="text-3xl font-bold mb-4">Indicateurs du Mélange</h1>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <IndicatorCard title="Débit des AFs" value={globalIndicators.flow.toFixed(2)} unit="t/h" />
          <IndicatorCard title="PCI moy" value={globalIndicators.pci.toFixed(0)} unit="kcal/kg" />
          <IndicatorCard title="% Humidité moy" value={globalIndicators.humidity.toFixed(2)} unit="%" />
          <IndicatorCard title="% Cendres moy" value={globalIndicators.ash.toFixed(2)} unit="%" />
          <IndicatorCard title="% Chlorures moyens" value={globalIndicators.chlorine.toFixed(3)} unit="%" />
          <IndicatorCard title="Taux de pneus" value={globalIndicators.tireRate.toFixed(2)} unit="%" />
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle>Hall des AF</CardTitle>
            <div className="flex items-center gap-2 pt-2">
                <Label htmlFor="flow-hall" className="text-sm">Débit (t/h)</Label>
                <Input id="flow-hall" type="number" className="w-32 bg-gray-700 border-gray-600" value={hallAF.flowRate || ''} onChange={(e) => handleFlowRateChange(setHallAF, e.target.value)} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 rounded-lg bg-gray-900/70 grid grid-cols-3 gap-2 text-center">
              <div><p className="text-xs text-gray-400">PCI Mélange</p><p className="font-bold">{hallMixture.pci.toFixed(0)}</p></div>
              <div><p className="text-xs text-gray-400">Chlorures</p><p className="font-bold">{hallMixture.chlorine.toFixed(3)}</p></div>
              <div><p className="text-xs text-gray-400">Taux Pneus</p><p className="font-bold">{hallMixture.tireRate.toFixed(2)}%</p></div>
            </div>
            <FuelInputList installationState={hallAF} setInstallationState={setHallAF} installationName="hall" />
          </CardContent>
        </Card>
        
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle>ATS</CardTitle>
            <div className="flex items-center gap-2 pt-2">
                <Label htmlFor="flow-ats" className="text-sm">Débit (t/h)</Label>
                <Input id="flow-ats" type="number" className="w-32 bg-gray-700 border-gray-600" value={ats.flowRate || ''} onChange={(e) => handleFlowRateChange(setAts, e.target.value)} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 rounded-lg bg-gray-900/70 grid grid-cols-3 gap-2 text-center">
              <div><p className="text-xs text-gray-400">PCI Mélange</p><p className="font-bold">{atsMixture.pci.toFixed(0)}</p></div>
              <div><p className="text-xs text-gray-400">Chlorures</p><p className="font-bold">{atsMixture.chlorine.toFixed(3)}</p></div>
              <div><p className="text-xs text-gray-400">Taux Pneus</p><p className="font-bold">{atsMixture.tireRate.toFixed(2)}%</p></div>
            </div>
            <FuelInputList installationState={ats} setInstallationState={setAts} installationName="ats" />
          </CardContent>
        </Card>
      </section>

      <AiAssistant />
    </div>
  );
}
