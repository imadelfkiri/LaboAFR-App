
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BrainCircuit, Calendar as CalendarIcon, Save, Settings, ChevronDown } from 'lucide-react';
import { DateRange } from "react-day-picker";
import { format, subDays, startOfDay, endOfDay, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { getAverageAnalysisForFuels, saveMixtureSession, getMixtureSessions, MixtureSession, getFuelCosts, FuelCost, getLatestMixtureSession, getStocks } from '@/lib/data';
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
  fuels: Record<string, { buckets: number }>;
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

// Define the custom order for fuels
const fuelOrder = [
    "Pneus",
    "CSR",
    "DMB",
    "Plastiques",
    "CSR DD",
    "Bois",
    "Mélange"
];


function IndicatorCard({ title, value, unit, tooltipText, isAlert }: { title: string; value: string | number; unit?: string; tooltipText?: string, isAlert?: boolean }) {
  const cardContent = (
     <Card className={cn(
        "bg-background text-center transition-colors shadow-sm",
        isAlert && "border-red-500 bg-red-50"
        )}>
      <CardHeader className="p-2 pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-2 pt-0">
        <p className="text-xl font-bold text-foreground">
          {value} <span className="text-base text-gray-500">{unit}</span>
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

  // Global date range for fuel analysis
  const [analysisDateRange, setAnalysisDateRange] = useState<DateRange | undefined>({ from: subDays(new Date(), 7), to: new Date() });


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

 const fetchData = useCallback(async () => {
    if (!analysisDateRange?.from || !analysisDateRange?.to) return;
    setLoading(true);
    try {
        // Fetch all data concurrently
        const [stocks, costs, latestSession] = await Promise.all([
            getStocks(),
            getFuelCosts(),
            getLatestMixtureSession()
        ]);

        // Determine the list of fuels to get analysis for
        const fuelNames = stocks.map(s => s.nom_combustible);

        // Fetch average analysis for these specific fuels
        const fuelsAnalysis = await getAverageAnalysisForFuels(fuelNames, analysisDateRange);

        const initialFuelState = stocks.reduce((acc, stock) => {
            acc[stock.nom_combustible] = { buckets: 0 };
            return acc;
        }, {} as InstallationState['fuels']);

        setAvailableFuels(fuelsAnalysis);
        setFuelCosts(costs);

        if(latestSession){
            setHallAF({
                flowRate: latestSession.hallAF?.flowRate || 0,
                fuels: { ...initialFuelState, ...(latestSession.hallAF?.fuels || {}) }
            });
             setAts({
                flowRate: latestSession.ats?.flowRate || 0,
                fuels: { ...initialFuelState, ...(latestSession.ats?.fuels || {}) }
            });
            toast({title: "Dernière session chargée", description: "La dernière configuration a été chargée."});
        } else {
            setHallAF(prev => ({...prev, fuels: { ...initialFuelState }}));
            setAts(prev => ({...prev, fuels: { ...initialFuelState }}));
        }

    } catch (error) {
        console.error("Error fetching fuel data:", error);
        toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les données des combustibles." });
    } finally {
        setLoading(false);
    }
  }, [analysisDateRange, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);


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
    fetchHistoryData();
  }, [fetchHistoryData]);

  const globalIndicators = useMemo(() => {
    const totalFlow = (hallAF.flowRate || 0) + (ats.flowRate || 0);

    const weightedAvg = (valHall: number, weightHall: number, valAts: number, weightAts: number) => {
      const totalWeight = weightHall + weightAts;
      if (totalWeight === 0) return 0;
      return (valHall * weightHall + valAts * weightAts) / totalWeight;
    }

    const processInstallation = (state: InstallationState) => {
        let totalWeight = 0;
        let tempTotalCost = 0;
        let tempTotalPci = 0;
        let tempTotalHumidity = 0;
        let tempTotalAsh = 0;
        let tempTotalChlorine = 0;
        let tempTotalTireWeight = 0;

        for(const fuelName in state.fuels) {
            const fuelInput = state.fuels[fuelName];
            const fuelData = availableFuels[fuelName];
            
            if (!fuelInput || fuelInput.buckets <= 0) {
                continue;
            }

            // Even if fuelData is missing, we must calculate weight for tire rate.
            // A stock item should have a density, we'll assume a default if not present.
            const density = fuelData?.density > 0 ? fuelData.density : 0.5; // Default density
            const weight = fuelInput.buckets * BUCKET_VOLUME_M3 * density;
            totalWeight += weight;

            if (fuelName.toLowerCase().includes('pneu')) {
                tempTotalTireWeight += weight;
            }

            if (!fuelData || fuelData.count === 0) {
                continue; // Skip fuels with no analysis data for other calculations
            }
            
            const costKey = Object.keys(fuelCosts).find(key => key.startsWith(`${fuelName}|`));
            const fuelCost = costKey ? fuelCosts[costKey]?.cost || 0 : 0;

            tempTotalPci += weight * fuelData.pci_brut;
            tempTotalHumidity += weight * fuelData.h2o;
            tempTotalAsh += weight * fuelData.cendres;
            tempTotalChlorine += weight * fuelData.chlore;
            tempTotalCost += weight * fuelCost;
        }

        return { 
            weight: totalWeight, 
            cost: totalWeight > 0 ? tempTotalCost / totalWeight : 0,
            pci: totalWeight > 0 ? tempTotalPci / totalWeight : 0,
            humidity: totalWeight > 0 ? tempTotalHumidity / totalWeight : 0,
            ash: totalWeight > 0 ? tempTotalAsh / totalWeight : 0,
            chlorine: totalWeight > 0 ? tempTotalChlorine / totalWeight : 0,
            tireRate: totalWeight > 0 ? (tempTotalTireWeight / totalWeight) * 100 : 0
        };
    };

    const { weight: totalWeightHall, cost: costHall, pci: pciHall, humidity: humidityHall, ash: ashHall, chlorine: chlorineHall, tireRate: tireRateHall } = processInstallation(hallAF);
    const { weight: totalWeightAts, cost: costAts, pci: pciAts, humidity: humidityAts, ash: ashAts, chlorine: chlorineAts, tireRate: tireRateAts } = processInstallation(ats);
    
    const totalWeight = totalWeightHall + totalWeightAts;
    
    const pci = weightedAvg(pciHall, totalWeightHall, pciAts, totalWeightAts);
    const chlorine = weightedAvg(chlorineHall, totalWeightHall, chlorineAts, totalWeightAts);
    const humidity = weightedAvg(humidityHall, totalWeightHall, humidityAts, totalWeightAts);
    const ash = weightedAvg(ashHall, totalWeightHall, ashAts, totalWeightAts);
    const cost = weightedAvg(costHall, totalWeightHall, costAts, totalWeightAts);

    // Tire rate needs to be calculated based on total weights directly
    const totalTireWeight = (tireRateHall / 100 * totalWeightHall) + (tireRateAts / 100 * totalWeightAts);
    const tireRate = totalWeight > 0 ? (totalTireWeight / totalWeight) * 100 : 0;

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
      cost,
      alerts,
    };
  }, [hallAF, ats, availableFuels, fuelCosts, thresholds]);

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
        return <Skeleton className="h-48 w-full" />;
    }
     const sortedFuelNames = Object.keys(installationState.fuels)
        .filter(name => name.toLowerCase() !== 'grignons')
        .sort((a, b) => {
            const indexA = fuelOrder.indexOf(a);
            const indexB = fuelOrder.indexOf(b);
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return a.localeCompare(b);
        });

    return (
        <div className="space-y-3">
        {sortedFuelNames.map(fuelName => (
            <div key={fuelName} className="flex items-center gap-2">
            <Label htmlFor={`${installationName}-${fuelName}`} className="flex-1 text-sm">{fuelName}</Label>
            <Input
                id={`${installationName}-${fuelName}`}
                type="number"
                placeholder="0"
                className="w-24 h-9"
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
                <Button variant="outline" size="icon" className="fixed bottom-6 right-6 rounded-full h-14 w-14 shadow-lg bg-primary text-primary-foreground hover:bg-primary/90">
                    <BrainCircuit className="h-6 w-6" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[625px]">
                <DialogHeader>
                    <DialogTitle>Assistant d'Optimisation de Mélange</DialogTitle>
                    <DialogDescription>
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
                    />
                </div>
                <DialogFooter>
                    <Button onClick={handleGenerate} disabled={isGenerating || !objective}>
                        {isGenerating ? "Génération en cours..." : "Générer la suggestion"}
                    </Button>
                </DialogFooter>
                {isGenerating && <Skeleton className="h-32 w-full" />}
                {suggestion && (
                    <Card className="mt-4">
                        <CardHeader>
                            <CardTitle>Suggestion de l'IA</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm space-y-4">
                             <p className="font-semibold">Raisonnement :</p>
                             <p className="text-gray-600 whitespace-pre-wrap">{suggestion.reasoning}</p>
                             <div>
                                <p className="font-semibold mt-4">Recette proposée :</p>
                                <div className="grid grid-cols-2 gap-4 mt-2">
                                    <div>
                                        <p className="font-medium">Hall des AF</p>
                                        <ul className="list-disc pl-5 text-gray-600">
                                            {Object.keys(suggestion.recipe.hallAF).length > 0 ? Object.entries(suggestion.recipe.hallAF).map(([fuel, buckets]) => (
                                                <li key={`hall-${fuel}`}>{fuel}: {buckets} godets</li>
                                            )) : <li>Aucun</li>}
                                        </ul>
                                    </div>
                                    <div>
                                        <p className="font-medium">ATS</p>
                                        <ul className="list-disc pl-5 text-gray-600">
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
                        <h3 className="text-sm font-medium text-gray-500 mb-2">Historique des suggestions</h3>
                        <div className="space-y-2">
                            {suggestionHistory.map((item, index) => (
                                <button key={index} onClick={() => reusePrompt(item.prompt)} className="w-full text-left p-2 bg-muted rounded-md hover:bg-accent">
                                    <p className="text-xs text-muted-foreground truncate">{item.prompt}</p>
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
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                    <Settings className="h-5 w-5" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Définir les seuils d'alerte</DialogTitle>
                    <DialogDescription>
                        Les indicateurs changeront de couleur si ces seuils sont dépassés.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="pci_min">PCI Moyen (min)</Label>
                        <Input id="pci_min" type="number" value={currentThresholds.pci_min} onChange={e => handleChange('pci_min', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="humidity_max">Humidité Moyenne (max %)</Label>
                        <Input id="humidity_max" type="number" value={currentThresholds.humidity_max} onChange={e => handleChange('humidity_max', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="ash_max">Cendres Moyennes (max %)</Label>
                        <Input id="ash_max" type="number" value={currentThresholds.ash_max} onChange={e => handleChange('ash_max', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="chlorine_max">Chlorures Moyens (max %)</Label>
                        <Input id="chlorine_max" type="number" value={currentThresholds.chlorine_max} onChange={e => handleChange('chlorine_max', e.target.value)} />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="tireRate_max">Taux de Pneus (max %)</Label>
                        <Input id="tireRate_max" type="number" value={currentThresholds.tireRate_max} onChange={e => handleChange('tireRate_max', e.target.value)} />
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
            <div className="bg-background/80 backdrop-blur-sm border border-border rounded-lg shadow-lg p-3">
                <p className="font-bold text-foreground">{label}</p>
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
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Indicateurs Globaux</h1>
            <ThresholdSettingsModal />
             <Popover>
                <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant={"outline"}
                        className={cn(
                            "w-[300px] justify-start text-left font-normal",
                            !analysisDateRange && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {analysisDateRange?.from ? (
                        analysisDateRange.to ? (
                            <>
                            {format(analysisDateRange.from, "d MMM y", { locale: fr })} -{" "}
                            {format(analysisDateRange.to, "d MMM y", { locale: fr })}
                            </>
                        ) : (
                            format(analysisDateRange.from, "d MMM y", { locale: fr })
                        )
                        ) : (
                        <span>Sélectionner une période d'analyse</span>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={analysisDateRange?.from}
                        selected={analysisDateRange}
                        onSelect={setAnalysisDateRange}
                        numberOfMonths={2}
                        locale={fr}
                    />
                </PopoverContent>
            </Popover>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleSaveSession} disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Enregistrement..." : "Enregistrer la Session"}
            </Button>
          </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <IndicatorCard title="Débit des AFs" value={globalIndicators.flow.toFixed(2)} unit="t/h" />
        <IndicatorCard title="PCI moy" value={globalIndicators.pci.toFixed(0)} unit="kcal/kg" isAlert={globalIndicators.alerts.pci} />
        <IndicatorCard title="% Humidité moy" value={globalIndicators.humidity.toFixed(2)} unit="%" isAlert={globalIndicators.alerts.humidity} />
        <IndicatorCard title="% Cendres moy" value={globalIndicators.ash.toFixed(2)} unit="%" isAlert={globalIndicators.alerts.ash} />
        <IndicatorCard title="% Chlorures" value={globalIndicators.chlorine.toFixed(3)} unit="%" isAlert={globalIndicators.alerts.chlorine} />
        <IndicatorCard title="Taux de pneus" value={globalIndicators.tireRate.toFixed(2)} unit="%" isAlert={globalIndicators.alerts.tireRate} />
        <IndicatorCard title="Coût du Mélange" value={globalIndicators.cost.toFixed(2)} unit="MAD/t" />
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Hall des AF</CardTitle>
            <div className="flex items-center gap-2">
                <Label htmlFor="flow-hall" className="text-sm">Débit (t/h)</Label>
                <Input id="flow-hall" type="number" className="w-32 h-9" value={hallAF.flowRate || ''} onChange={(e) => handleFlowRateChange(setHallAF, e.target.value)} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <FuelInputList installationState={hallAF} setInstallationState={setHallAF} installationName="hall" />
          </CardContent>
        </Card>
        
        <Card className="shadow-sm rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>ATS</CardTitle>
            <div className="flex items-center gap-2">
                <Label htmlFor="flow-ats" className="text-sm">Débit (t/h)</Label>
                <Input id="flow-ats" type="number" className="w-32 h-9" value={ats.flowRate || ''} onChange={(e) => handleFlowRateChange(setAts, e.target.value)} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <FuelInputList installationState={ats} setInstallationState={setAts} installationName="ats" />
          </CardContent>
        </Card>
      </section>

      <Collapsible defaultOpen={false} className="rounded-xl border bg-card text-card-foreground shadow">
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Historique Global des Indicateurs</CardTitle>
                        <CardDescription>Évolution des indicateurs basée sur les sessions enregistrées.</CardDescription>
                    </div>
                    <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <ChevronDown className="h-5 w-5 transition-transform data-[state=open]:rotate-180" />
                        </Button>
                    </CollapsibleTrigger>
                </div>
                <div className="pt-4">
                     <Popover>
                        <PopoverTrigger asChild>
                        <Button
                            id="date"
                            variant={"outline"}
                            className={cn(
                                "w-[300px] justify-start text-left font-normal",
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
             <CollapsibleContent>
                <CardContent className="pt-0">
                    <ResponsiveContainer width="100%" height={300}>
                        {isHistoryLoading ? (
                            <Skeleton className="h-full w-full" />
                        ) : historyChartData.length > 0 ? (
                            <LineChart data={historyChartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} yAxisId="left" orientation="left" />
                                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} yAxisId="right" orientation="right" />
                                <RechartsTooltip content={<CustomHistoryTooltip />} />
                                <Legend />
                                <Line yAxisId="left" type="monotone" dataKey="PCI moyen" stroke="hsl(var(--primary))" name="PCI" dot={false} strokeWidth={2} />
                                <Line yAxisId="right" type="monotone" dataKey="Humidité moyenne" stroke="#82ca9d" name="Humidité (%)" dot={false} strokeWidth={2} />
                                <Line yAxisId="right" type="monotone" dataKey="Chlorures moyens" stroke="#ffc658" name="Chlorures (%)" dot={false} strokeWidth={2}/>
                            </LineChart>
                        ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                                Aucune donnée historique pour la période sélectionnée.
                            </div>
                        )}
                    </ResponsiveContainer>
                </CardContent>
            </CollapsibleContent>
        </Card>
      </Collapsible>
      <AiAssistant />
    </div>
  );
}

