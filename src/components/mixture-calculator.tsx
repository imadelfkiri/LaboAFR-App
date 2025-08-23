
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BrainCircuit, Calendar as CalendarIcon, Save, AlertCircle, DollarSign, Settings, Info } from 'lucide-react';
import { DateRange } from "react-day-picker";
import { format, subDays, startOfDay, endOfDay, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { getAverageAnalysisForFuels, saveMixtureSession, getMixtureSessions, MixtureSession, getFuelCosts, FuelCost } from '@/lib/data';
import type { AverageAnalysis } from '@/lib/data';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { optimizeMixture, MixtureOptimizerOutput, MixtureOptimizerInput } from '@/ai/flows/mixture-optimizer-flow';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, Legend, Line } from 'recharts';

interface InstallationState {
  flowRate: number;
  fuels: Record<string, { buckets: number, dateRange?: DateRange }>;
}

interface AISuggestion {
    prompt: string;
    output: MixtureOptimizerOutput;
}

interface MixtureThresholds {
    pci_min: number;
    humidity_max: number;
    ash_max: number;
    chlorine_max: number;
    tireRate_max: number;
}

const defaultThresholds: MixtureThresholds = {
    pci_min: 0,
    humidity_max: 100,
    ash_max: 100,
    chlorine_max: 100,
    tireRate_max: 100,
};


const BUCKET_VOLUME_M3 = 3;

function IndicatorCard({ title, value, unit, tooltipText, isAlert }: { title: string; value: string | number; unit?: string; tooltipText?: string, isAlert?: boolean }) {
  const cardContent = (
     <Card className={cn(
        "bg-gray-800/50 border-gray-700 text-center transition-colors",
        isAlert && "border-red-500/80 bg-red-900/30"
        )}>
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

  if (!tooltipText) return cardContent;

  return (
    <TooltipProvider>
        <Tooltip>
            <TooltipTrigger asChild>{cardContent}</TooltipTrigger>
            <TooltipContent><p>{tooltipText}</p></TooltipContent>
        </Tooltip>
    </TooltipProvider>
  )
}

export function MixtureCalculator() {
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [availableFuels, setAvailableFuels] = useState<Record<string, AverageAnalysis>>({});
  
  const [hallAF, setHallAF] = useState<InstallationState>({ flowRate: 0, fuels: {} });
  const [ats, setAts] = useState<InstallationState>({ flowRate: 0, fuels: {} });
  
  // History state
  const [historySessions, setHistorySessions] = useState<MixtureSession[]>([]);
  const [historyDateRange, setHistoryDateRange] = useState<DateRange | undefined>({ from: subDays(new Date(), 30), to: new Date() });
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  // Cost state
  const [fuelCosts, setFuelCosts] = useState<Record<string, FuelCost>>({});
  
  // Thresholds state
  const [thresholds, setThresholds] = useState<MixtureThresholds>(defaultThresholds);
  const [isThresholdModalOpen, setIsThresholdModalOpen] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    try {
        const savedThresholds = localStorage.getItem('mixtureThresholds');
        if (savedThresholds) {
            setThresholds(JSON.parse(savedThresholds));
        }
    } catch (error) {
        console.error("Could not load thresholds from localStorage", error);
    }
  }, []);

  const handleSaveThresholds = (newThresholds: MixtureThresholds) => {
    setThresholds(newThresholds);
    localStorage.setItem('mixtureThresholds', JSON.stringify(newThresholds));
    toast({ title: "Succès", description: "Les seuils d'alerte ont été enregistrés."});
    setIsThresholdModalOpen(false);
  }

  const fetchData = useCallback(async (fuelName?: string, dateRange?: DateRange) => {
    try {
      if (fuelName && dateRange) { // Fetch specific fuel for custom range
         const updatedFuelData = await getAverageAnalysisForFuels([fuelName], dateRange);
         setAvailableFuels(prev => ({...prev, ...updatedFuelData}));
      } else { // Initial load
          setLoading(true);
          const [initialFuels, costs] = await Promise.all([
            getAverageAnalysisForFuels(null, { from: subDays(new Date(), 7), to: new Date() }),
            getFuelCosts()
          ]);
          setAvailableFuels(initialFuels);
          setFuelCosts(costs);
          
          const initialFuelState = Object.keys(initialFuels).reduce((acc, key) => {
              acc[key] = { buckets: 0 };
              return acc;
          }, {} as InstallationState['fuels']);

          setHallAF(prev => ({...prev, fuels: { ...initialFuelState }}));
          setAts(prev => ({...prev, fuels: { ...initialFuelState }}));
      }
    } catch (error) {
      console.error("Error fetching fuel data:", error);
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les données des combustibles." });
    } finally {
      setLoading(false);
    }
  }, [toast]);


  const fetchHistoryData = useCallback(async () => {
    if (!historyDateRange?.from || !historyDateRange?.to) return;
    setIsHistoryLoading(true);
    try {
        const sessions = await getMixtureSessions(historyDateRange.from, historyDateRange.to);
        setHistorySessions(sessions);
    } catch(error) {
        console.error("Error fetching history sessions:", error);
        toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger l'historique des sessions." });
    } finally {
        setIsHistoryLoading(false);
    }
  }, [historyDateRange, toast]);

  useEffect(() => {
    fetchData();
  }, []); // Eslint-disable-line react-hooks/exhaustive-deps, initial fetch only

  useEffect(() => {
    fetchHistoryData();
  }, [fetchHistoryData]);

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

  const calculateMixture = useCallback((installationState: InstallationState) => {
    let totalWeight = 0;
    let totalPci = 0;
    let totalChlorine = 0;
    let totalTireWeight = 0;
    let totalAnalysisCount = 0;

    const weights: Record<string, number> = {};

    for (const fuelName in installationState.fuels) {
      const fuelInput = installationState.fuels[fuelName];
      const fuelData = availableFuels[fuelName];

      if (fuelInput.buckets > 0 && fuelData && fuelData.density > 0) {
        const weight = fuelInput.buckets * BUCKET_VOLUME_M3 * fuelData.density;
        weights[fuelName] = weight;
        totalWeight += weight;
        totalAnalysisCount += fuelData.count;
        if (fuelName.toLowerCase().includes('pneu')) {
            totalTireWeight += weight;
        }
      }
    }
    
    if (totalWeight === 0) return { pci: 0, chlorine: 0, tireRate: 0, analysisCount: 0, totalWeight: 0 };

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
      totalWeight: totalWeight,
      analysisCount: totalAnalysisCount
    };
  }, [availableFuels]);

  const hallMixture = useMemo(() => calculateMixture(hallAF), [hallAF, calculateMixture]);
  const atsMixture = useMemo(() => calculateMixture(ats), [ats, calculateMixture]);

  const globalIndicators = useMemo(() => {
    const totalFlow = (hallAF.flowRate || 0) + (ats.flowRate || 0);

    const weightedAvg = (valHall: number, valAts: number) => {
      if (totalFlow === 0) return 0;
        return (valHall * (hallAF.flowRate || 0) + valAts * (ats.flowRate || 0)) / totalFlow;
    }

    let totalHumidity = 0;
    let totalAsh = 0;
    
    const processInstallation = (state: InstallationState) => {
        let totalWeight = 0;
        let tempTotalCost = 0;
        for(const fuelName in state.fuels) {
            const fuelInput = state.fuels[fuelName];
            const fuelData = availableFuels[fuelName];
            
            const costKey = Object.keys(fuelCosts).find(key => key.startsWith(`${fuelName}|`));
            const fuelCost = costKey ? fuelCosts[costKey]?.cost || 0 : 0;

            if (fuelInput.buckets > 0 && fuelData && fuelData.density > 0) {
                const weight = fuelInput.buckets * BUCKET_VOLUME_M3 * fuelData.density;
                totalHumidity += weight * fuelData.h2o;
                totalAsh += weight * fuelData.cendres;
                tempTotalCost += weight * fuelCost;
                totalWeight += weight;
            }
        }
        return { weight: totalWeight, cost: tempTotalCost };
    };

    const { weight: totalWeightHall, cost: totalCostHall } = processInstallation(hallAF);
    const { weight: totalWeightAts, cost: totalCostAts } = processInstallation(ats);
    const totalWeight = totalWeightHall + totalWeightAts;
    const totalCost = totalCostHall + totalCostAts;

    const pci = weightedAvg(hallMixture.pci, atsMixture.pci);
    const chlorine = weightedAvg(hallMixture.chlorine, atsMixture.chlorine);
    const tireRate = weightedAvg(hallMixture.tireRate, atsMixture.tireRate);
    const humidity = totalWeight > 0 ? totalHumidity / totalWeight : 0;
    const ash = totalWeight > 0 ? totalAsh / totalWeight : 0;

    const alerts = {
        pci: pci > 0 && thresholds.pci_min > 0 && pci < thresholds.pci_min,
        humidity: humidity > thresholds.humidity_max,
        ash: ash > thresholds.ash_max,
        chlorine: chlorine > thresholds.chlorine_max,
        tireRate: tireRate > thresholds.tireRate_max,
    };

    return {
      flow: totalFlow,
      pci,
      humidity,
      ash,
      chlorine,
      tireRate,
      cost: totalWeight > 0 ? totalCost / totalWeight : 0,
      alerts,
    };
  }, [hallAF, ats, hallMixture, atsMixture, availableFuels, fuelCosts, thresholds]);

  const historyChartData = useMemo(() => {
    if (!historySessions || historySessions.length === 0) return [];
    return historySessions.map(session => ({
        date: session.timestamp.toDate(), 
        'PCI moyen': session.globalIndicators.pci,
        'Humidité moyenne': session.globalIndicators.humidity,
        'Chlorures moyens': session.globalIndicators.chlorine,
    })).sort((a,b) => a.date.valueOf() - b.date.valueOf()) 
     .map(session => ({ 
         ...session,
         date: format(session.date, 'dd/MM HH:mm'),
     }));
  }, [historySessions]);

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

  const handleSaveSession = async () => {
    setIsSaving(true);
    try {
        const sessionData: Omit<MixtureSession, 'id' | 'timestamp'> = {
            hallAF,
            ats,
            globalIndicators,
            availableFuels,
        };
        await saveMixtureSession(sessionData);
        toast({ title: "Succès", description: "La session de mélange a été enregistrée." });
        fetchHistoryData(); // Refresh history
    } catch(error) {
        console.error("Error saving session:", error);
        toast({ variant: "destructive", title: "Erreur", description: "Impossible d'enregistrer la session." });
    } finally {
        setIsSaving(false);
    }
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
                    <Button 
                        variant="outline" 
                        size="icon" 
                        className={cn("h-8 w-8 bg-gray-700 border-gray-600 hover:bg-gray-600",
                            installationState.fuels[fuelName]?.dateRange && "bg-blue-600 hover:bg-blue-500 text-white"
                        )}
                    >
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
    const [suggestionHistory, setSuggestionHistory] = useState<AISuggestion[]>([]);

    useEffect(() => {
        if (isOpen) {
            try {
                const storedHistory = localStorage.getItem('aiSuggestionHistory');
                if (storedHistory) {
                    setSuggestionHistory(JSON.parse(storedHistory));
                }
            } catch (error) {
                console.error("Could not load AI suggestion history", error);
            }
        }
    }, [isOpen]);

    const saveSuggestionToHistory = (prompt: string, output: MixtureOptimizerOutput) => {
        const newSuggestion = { prompt, output };
        const updatedHistory = [newSuggestion, ...suggestionHistory].slice(0, 3); // Keep last 3
        setSuggestionHistory(updatedHistory);
        localStorage.setItem('aiSuggestionHistory', JSON.stringify(updatedHistory));
    }

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
            saveSuggestionToHistory(objective, result);
        } catch (error) {
            console.error("Error generating suggestion:", error);
            toast({ variant: "destructive", title: "Erreur IA", description: "La génération de suggestion a échoué." });
        } finally {
            setIsGenerating(false);
        }
    };
    
    const reusePrompt = (prompt: string) => {
        setObjective(prompt);
        setSuggestion(null);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button className="fixed bottom-6 right-6 rounded-full h-16 w-16 shadow-lg bg-primary hover:bg-primary/90 z-40">
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
                                            {Object.keys(suggestion.recipe.hallAF).length > 0 ? Object.entries(suggestion.recipe.hallAF).map(([fuel, buckets]) => (
                                                <li key={`hall-${fuel}`}>{fuel}: {buckets} godets</li>
                                            )) : <li>Aucun</li>}
                                        </ul>
                                    </div>
                                    <div>
                                        <p className="font-medium">ATS</p>
                                        <ul className="list-disc pl-5 text-gray-300">
                                            {Object.keys(suggestion.recipe.ats).length > 0 ? Object.entries(suggestion.recipe.ats).map(([fuel, buckets]) => (
                                                <li key={`ats-${fuel}`}>{fuel}: {buckets} godets</li>
                                            )) : <li>Aucun</li>}
                                        </ul>
                                    </div>
                                </div>
                             </div>
                        </CardContent>
                    </Card>
                )}
                {suggestionHistory.length > 0 && (
                    <div className="mt-6">
                        <h3 className="text-sm font-medium text-gray-400 mb-2">Historique des suggestions</h3>
                        <div className="space-y-2">
                            {suggestionHistory.map((item, index) => (
                                <button key={index} onClick={() => reusePrompt(item.prompt)} className="w-full text-left p-2 bg-gray-700/50 rounded-md hover:bg-gray-700">
                                    <p className="text-xs text-gray-300 truncate">{item.prompt}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
  };

  const ThresholdSettingsModal = () => {
    const [currentThresholds, setCurrentThresholds] = useState(thresholds);

    useEffect(() => {
        setCurrentThresholds(thresholds);
    }, [isThresholdModalOpen]);

    const handleChange = (key: keyof MixtureThresholds, value: string) => {
        const numValue = parseFloat(value);
        setCurrentThresholds(prev => ({
            ...prev,
            [key]: isNaN(numValue) ? defaultThresholds[key] : numValue
        }));
    };

    const handleSave = () => {
        handleSaveThresholds(currentThresholds);
    };

    return (
        <Dialog open={isThresholdModalOpen} onOpenChange={setIsThresholdModalOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                    <Settings className="h-5 w-5" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-gray-800 border-gray-700 text-white">
                <DialogHeader>
                    <DialogTitle>Définir les seuils d'alerte</DialogTitle>
                    <DialogDescription>
                        Les indicateurs changeront de couleur si ces seuils sont dépassés.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="pci_min">PCI Moyen (min)</Label>
                        <Input id="pci_min" type="number" value={currentThresholds.pci_min} onChange={e => handleChange('pci_min', e.target.value)} className="bg-gray-700 border-gray-600" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="humidity_max">Humidité Moyenne (max %)</Label>
                        <Input id="humidity_max" type="number" value={currentThresholds.humidity_max} onChange={e => handleChange('humidity_max', e.target.value)} className="bg-gray-700 border-gray-600" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="ash_max">Cendres Moyennes (max %)</Label>
                        <Input id="ash_max" type="number" value={currentThresholds.ash_max} onChange={e => handleChange('ash_max', e.target.value)} className="bg-gray-700 border-gray-600" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="chlorine_max">Chlorures Moyens (max %)</Label>
                        <Input id="chlorine_max" type="number" value={currentThresholds.chlorine_max} onChange={e => handleChange('chlorine_max', e.target.value)} className="bg-gray-700 border-gray-600" />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="tireRate_max">Taux de Pneus (max %)</Label>
                        <Input id="tireRate_max" type="number" value={currentThresholds.tireRate_max} onChange={e => handleChange('tireRate_max', e.target.value)} className="bg-gray-700 border-gray-600" />
                    </div>
                </div>
                <DialogFooter>
                    <Button type="button" variant="secondary" onClick={() => setIsThresholdModalOpen(false)}>Annuler</Button>
                    <Button type="button" onClick={handleSave}>Enregistrer les seuils</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
  };

  const CustomHistoryTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-3 text-white">
                <p className="font-bold">{label}</p>
                {payload.map((pld: any) => (
                    <div key={pld.dataKey} style={{ color: pld.color }}>
                        {`${pld.name}: ${pld.value.toFixed(2)}`}
                    </div>
                ))}
            </div>
        );
    }
    return null;
  };


  return (
    <div className="p-4 md:p-8 space-y-8">
      <section>
        <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold">Indicateurs du Mélange</h1>
            <ThresholdSettingsModal />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
          <IndicatorCard title="Débit des AFs" value={globalIndicators.flow.toFixed(2)} unit="t/h" />
          <IndicatorCard title="PCI moy" value={globalIndicators.pci.toFixed(0)} unit="kcal/kg" isAlert={globalIndicators.alerts.pci} />
          <IndicatorCard title="% Humidité moy" value={globalIndicators.humidity.toFixed(2)} unit="%" isAlert={globalIndicators.alerts.humidity} />
          <IndicatorCard title="% Cendres moy" value={globalIndicators.ash.toFixed(2)} unit="%" isAlert={globalIndicators.alerts.ash} />
          <IndicatorCard title="% Chlorures moyens" value={globalIndicators.chlorine.toFixed(3)} unit="%" isAlert={globalIndicators.alerts.chlorine} />
          <IndicatorCard title="Taux de pneus" value={globalIndicators.tireRate.toFixed(2)} unit="%" isAlert={globalIndicators.alerts.tireRate} />
          <IndicatorCard title="Coût du Mélange" value={globalIndicators.cost.toFixed(2)} unit="MAD/t" />
        </div>
      </section>

      <section>
        <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
                <CardTitle>Historique Global des Indicateurs</CardTitle>
                <div className="pt-2">
                     <Popover>
                        <PopoverTrigger asChild>
                        <Button
                            id="date"
                            variant={"outline"}
                            className={cn(
                                "w-[300px] justify-start text-left font-normal bg-gray-700 border-gray-600 hover:bg-gray-600",
                                !historyDateRange && "text-muted-foreground"
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {historyDateRange?.from ? (
                            historyDateRange.to ? (
                                <>
                                {format(historyDateRange.from, "d MMM y", { locale: fr })} -{" "}
                                {format(historyDateRange.to, "d MMM y", { locale: fr })}
                                </>
                            ) : (
                                format(historyDateRange.from, "d MMM y", { locale: fr })
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
                            defaultMonth={historyDateRange?.from}
                            selected={historyDateRange}
                            onSelect={setHistoryDateRange}
                            numberOfMonths={2}
                            locale={fr}
                        />
                        </PopoverContent>
                    </Popover>
                </div>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                    {isHistoryLoading ? (
                        <Skeleton className="h-full w-full bg-gray-700" />
                    ) : historyChartData.length > 0 ? (
                        <LineChart data={historyChartData}>
                            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} stroke="hsl(var(--muted-foreground))" />
                            <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} yAxisId="left" orientation="left" />
                            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} yAxisId="right" orientation="right" />
                            <RechartsTooltip content={<CustomHistoryTooltip />} />
                            <Legend wrapperStyle={{ color: "white" }}/>
                            <Line yAxisId="left" type="monotone" dataKey="PCI moyen" stroke="#8884d8" name="PCI" dot={false} />
                            <Line yAxisId="right" type="monotone" dataKey="Humidité moyenne" stroke="#82ca9d" name="Humidité (%)" dot={false} />
                            <Line yAxisId="right" type="monotone" dataKey="Chlorures moyens" stroke="#ffc658" name="Chlorures (%)" dot={false} />
                        </LineChart>
                    ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                            Aucune donnée historique pour la période sélectionnée.
                        </div>
                    )}
                </ResponsiveContainer>
            </CardContent>
        </Card>
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
              <IndicatorCard title="PCI Mélange" value={hallMixture.pci.toFixed(0)} tooltipText={`Basé sur ${hallMixture.analysisCount} analyses`} />
              <IndicatorCard title="Chlorures" value={hallMixture.chlorine.toFixed(3)} tooltipText={`Basé sur ${hallMixture.analysisCount} analyses`} />
              <IndicatorCard title="Taux Pneus" value={hallMixture.tireRate.toFixed(2)} unit="%" tooltipText={`Basé sur ${hallMixture.analysisCount} analyses`} />
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
              <IndicatorCard title="PCI Mélange" value={atsMixture.pci.toFixed(0)} tooltipText={`Basé sur ${atsMixture.analysisCount} analyses`} />
              <IndicatorCard title="Chlorures" value={atsMixture.chlorine.toFixed(3)} tooltipText={`Basé sur ${atsMixture.analysisCount} analyses`} />
              <IndicatorCard title="Taux Pneus" value={atsMixture.tireRate.toFixed(2)} unit="%" tooltipText={`Basé sur ${atsMixture.analysisCount} analyses`} />
            </div>
            <FuelInputList installationState={ats} setInstallationState={setAts} installationName="ats" />
          </CardContent>
        </Card>
      </section>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
        <Button onClick={handleSaveSession} disabled={isSaving} size="lg">
            <Save className="mr-2 h-5 w-5" />
            {isSaving ? "Enregistrement..." : "Enregistrer la Session"}
        </Button>
      </div>

      <AiAssistant />
    </div>
  );
}
