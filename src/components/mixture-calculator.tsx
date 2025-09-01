
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { BrainCircuit, Calendar as CalendarIcon, Save, Settings, ChevronDown, CheckCircle, AlertTriangle, Copy, Mail } from 'lucide-react';
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
import { getAverageAnalysisForFuels, saveMixtureSession, getMixtureSessions, MixtureSession, getFuelCosts, FuelCost, getLatestMixtureSession, getStocks, getFuelData, FuelData, getGlobalMixtureSpecification, saveGlobalMixtureSpecification, Specification } from '@/lib/data';
import type { AverageAnalysis } from '@/lib/data';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { MixtureOptimizerOutput, MixtureOptimizerInput } from '@/ai/flows/mixture-optimizer-flow';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, Legend, Line } from 'recharts';
import { Separator } from './ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { handleGenerateSuggestion } from '@/lib/actions';


interface InstallationState {
  flowRate: number;
  fuels: Record<string, { buckets: number }>;
}

interface MixtureThresholds {
    pci_min: number;
    humidity_max: number;
    ash_max: number;
    chlorine_max: number;
    tireRate_max: number;
}

interface MixtureSummary {
    globalIndicators: ReturnType<typeof useMixtureCalculations>['globalIndicators'];
    composition: { 
        name: string; 
        percentage: number;
        totalBuckets: number;
    }[];
}


const defaultThresholds: MixtureThresholds = {
    pci_min: 0,
    humidity_max: 100,
    ash_max: 100,
    chlorine_max: 100,
    tireRate_max: 100,
};

type IndicatorStatus = 'alert' | 'conform' | 'neutral';

function IndicatorCard({ title, value, unit, tooltipText, status = 'neutral' }: { title: string; value: string | number; unit?: string; tooltipText?: string, status?: IndicatorStatus }) {
  const cardContent = (
     <Card className={cn(
        "text-center transition-colors",
        "bg-white shadow-md rounded-xl",
        status === 'alert' && "border-red-500 bg-red-50 text-red-900",
        status === 'conform' && "border-green-500 bg-green-50 text-green-900",
        )}>
      <CardHeader className="p-2 pb-1">
        <CardTitle className={cn("text-xs font-medium", status === 'neutral' ? 'text-muted-foreground' : 'text-inherit')}>
          <div className="flex items-center justify-center gap-1.5">
            {status === 'alert' && <AlertTriangle className="h-3 w-3" />}
            {status === 'conform' && <CheckCircle className="h-3 w-3" />}
            {title}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 pt-0">
        <p className={cn("text-xl font-bold", status === 'neutral' ? 'text-foreground' : 'text-inherit')}>
          {value} <span className="text-base opacity-70">{unit}</span>
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

function useMixtureCalculations(hallAF: InstallationState, ats: InstallationState, availableFuels: Record<string, AverageAnalysis>, fuelData: Record<string, FuelData>, fuelCosts: Record<string, FuelCost>, thresholds: MixtureThresholds) {
   return useMemo(() => {
    const processInstallation = (state: InstallationState) => {
        let totalWeight = 0;
        let tempTotalCost = 0;
        let tempTotalPci = 0;
        let tempTotalHumidity = 0;
        let tempTotalAsh = 0;
        let tempTotalChlorine = 0;
        let tempTotalTireWeight = 0;
        const fuelWeights: Record<string, number> = {};

        for(const fuelName in state.fuels) {
            const fuelInput = state.fuels[fuelName];
            const baseFuelData = fuelData[fuelName];
            
            if (!fuelInput || fuelInput.buckets <= 0 || !baseFuelData) {
                continue;
            }

            const poidsGodet = baseFuelData.poids_godet > 0 ? baseFuelData.poids_godet : 1.5; // Default 1.5 tonnes if not set
            const weight = fuelInput.buckets * poidsGodet;
            totalWeight += weight;
            fuelWeights[fuelName] = (fuelWeights[fuelName] || 0) + weight;

            if (fuelName.toLowerCase().includes('pneu')) {
                tempTotalTireWeight += weight;
            }
            
            const analysisData = availableFuels[fuelName];
            if (!analysisData || analysisData.count === 0) {
                continue; 
            }
            
            const fuelCost = fuelCosts[fuelName]?.cost || 0;

            tempTotalPci += weight * analysisData.pci_brut;
            tempTotalHumidity += weight * analysisData.h2o;
            tempTotalAsh += weight * analysisData.cendres;
            tempTotalChlorine += weight * analysisData.chlore;
            tempTotalCost += weight * fuelCost;
        }

        return { 
            weight: totalWeight, 
            cost: totalWeight > 0 ? tempTotalCost / totalWeight : 0,
            pci: totalWeight > 0 ? tempTotalPci / totalWeight : 0,
            humidity: totalWeight > 0 ? tempTotalHumidity / totalWeight : 0,
            ash: totalWeight > 0 ? tempTotalAsh / totalWeight : 0,
            chlorine: totalWeight > 0 ? tempTotalChlorine / totalWeight : 0,
            tireRate: totalWeight > 0 ? (tempTotalTireWeight / totalWeight) * 100 : 0,
            fuelWeights
        };
    };

    const hallIndicators = processInstallation(hallAF);
    const atsIndicators = processInstallation(ats);
    
    const flowHall = hallAF.flowRate || 0;
    const flowAts = ats.flowRate || 0;
    const totalFlow = flowHall + flowAts;

    const weightedAvg = (valHall: number, weightHall: number, valAts: number, weightAts: number) => {
      const totalWeight = weightHall + weightAts;
      if (totalWeight === 0) return 0;
      return (valHall * weightHall + valAts * weightAts) / totalWeight;
    }

    const pci = weightedAvg(hallIndicators.pci, flowHall, atsIndicators.pci, flowAts);
    const chlorine = weightedAvg(hallIndicators.chlorine, flowHall, atsIndicators.chlorine, flowAts);
    const humidity = weightedAvg(hallIndicators.humidity, flowHall, atsIndicators.humidity, flowAts);
    const ash = weightedAvg(hallIndicators.ash, flowHall, atsIndicators.ash, flowAts);
    const cost = weightedAvg(hallIndicators.cost, flowHall, atsIndicators.cost, flowAts);
    const tireRate = weightedAvg(hallIndicators.tireRate, flowHall, atsIndicators.tireRate, flowAts);

    const getStatus = (value: number, min: number | undefined, max: number | undefined): IndicatorStatus => {
        if (min === undefined && max === undefined) return 'neutral';
        if (value === 0) return 'neutral';
        if (min !== undefined && value < min) return 'alert';
        if (max !== undefined && value > max) return 'alert';
        return 'conform';
    };

    const status = {
        pci: getStatus(pci, thresholds.pci_min > 0 ? thresholds.pci_min : undefined, undefined),
        humidity: getStatus(humidity, undefined, thresholds.humidity_max < 100 ? thresholds.humidity_max : undefined),
        ash: getStatus(ash, undefined, thresholds.ash_max < 100 ? thresholds.ash_max : undefined),
        chlorine: getStatus(chlorine, undefined, thresholds.chlorine_max < 100 ? thresholds.chlorine_max : undefined),
        tireRate: getStatus(tireRate, undefined, thresholds.tireRate_max < 100 ? thresholds.tireRate_max : undefined),
    };

    const globalFuelWeights: Record<string, number> = {};
    Object.entries(hallIndicators.fuelWeights).forEach(([fuel, weight]) => {
        globalFuelWeights[fuel] = (globalFuelWeights[fuel] || 0) + weight;
    });
     Object.entries(atsIndicators.fuelWeights).forEach(([fuel, weight]) => {
        globalFuelWeights[fuel] = (globalFuelWeights[fuel] || 0) + weight;
    });

    return {
      globalIndicators: {
        flow: totalFlow,
        pci,
        humidity,
        ash,
        chlorine,
        tireRate,
        cost,
        status,
      },
      globalFuelWeights
    };
  }, [hallAF, ats, availableFuels, fuelData, fuelCosts, thresholds]);
}


export function MixtureCalculator() {
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [availableFuels, setAvailableFuels] = useState<Record<string, AverageAnalysis>>({});
  const [fuelData, setFuelData] = useState<Record<string, FuelData>>({});
  
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
  
  // Save confirmation modal state
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [mixtureSummary, setMixtureSummary] = useState<MixtureSummary | null>(null);

  const { toast } = useToast();

  const handleSaveThresholds = async (newThresholds: MixtureThresholds) => {
    try {
        const specToSave: Partial<Specification> = {
            pci_min: newThresholds.pci_min,
            humidity_max: newThresholds.humidity_max,
            ash_max: newThresholds.ash_max,
            chlorine_max: newThresholds.chlorine_max,
            tireRate_max: newThresholds.tireRate_max,
        }
        await saveGlobalMixtureSpecification(specToSave);
        setThresholds(newThresholds);
        toast({ title: "Succès", description: "Les seuils d'alerte ont été enregistrés."});
        setIsThresholdModalOpen(false);
    } catch (error) {
        console.error("Could not save thresholds to Firestore", error);
        toast({ variant: "destructive", title: "Erreur", description: "Impossible d'enregistrer les seuils." });
    }
  }

 const fetchData = useCallback(async () => {
    if (!analysisDateRange?.from || !analysisDateRange?.to) return;
    setLoading(true);
    try {
        // Fetch all data concurrently
        const [allFuelData, costs, latestSession, allStocks, globalSpec] = await Promise.all([
            getFuelData(),
            getFuelCosts(),
            getLatestMixtureSession(),
            getStocks(),
            getGlobalMixtureSpecification(),
        ]);

        if (globalSpec) {
             setThresholds({
                pci_min: globalSpec.pci_min ?? defaultThresholds.pci_min,
                humidity_max: globalSpec.humidity_max ?? defaultThresholds.humidity_max,
                ash_max: globalSpec.ash_max ?? defaultThresholds.ash_max,
                chlorine_max: globalSpec.chlorine_max ?? defaultThresholds.chlorine_max,
                tireRate_max: globalSpec.tireRate_max ?? defaultThresholds.tireRate_max,
            });
        }

        const fuelDataMap = allFuelData.reduce((acc, fd) => {
            acc[fd.nom_combustible] = fd;
            return acc;
        }, {} as Record<string, FuelData>);
        setFuelData(fuelDataMap);
        
        const fuelNames = allStocks.map(s => s.nom_combustible);

        const fuelsAnalysis = await getAverageAnalysisForFuels(fuelNames, analysisDateRange);

        const initialFuelState = allStocks.reduce((acc, stock) => {
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

  const { globalIndicators, globalFuelWeights } = useMixtureCalculations(hallAF, ats, availableFuels, fuelData, fuelCosts, thresholds);

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

  const handlePrepareSave = () => {
    const totalWeight = Object.values(globalFuelWeights).reduce((sum, weight) => sum + weight, 0);

    const composition = Object.entries(globalFuelWeights)
      .filter(([, weight]) => weight > 0)
      .map(([name, weight]) => {
        const totalBuckets = (hallAF.fuels[name]?.buckets || 0) + (ats.fuels[name]?.buckets || 0);
        return {
            name,
            percentage: totalWeight > 0 ? (weight / totalWeight) * 100 : 0,
            totalBuckets,
        }
      })
      .sort((a, b) => b.percentage - a.percentage);

    setMixtureSummary({
      globalIndicators,
      composition,
    });
    setIsSaveModalOpen(true);
  };
  
  const handleConfirmSave = async () => {
    setIsSaving(true);
    setIsSaveModalOpen(false);
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
        setMixtureSummary(null);
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

  const ThresholdSettingsModal = () => {
    const [currentThresholds, setCurrentThresholds] = useState(thresholds);

    useEffect(() => {
        setCurrentThresholds(thresholds);
    }, [isThresholdModalOpen, thresholds]);

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
  
  const SaveConfirmationModal = () => {
    if (!mixtureSummary) return null;

    const { globalIndicators: summaryIndicators, composition } = mixtureSummary;

    const generateSummaryText = () => {
        // Find maximum length for each column to calculate padding
        const headers = ["Combustible", "Nb Godets", "% Poids"];
        const col1Width = Math.max(headers[0].length, ...composition.map(item => item.name.length));
        const col2Width = Math.max(headers[1].length, ...composition.map(item => item.totalBuckets.toString().length));
        
        let textToCopy = "";

        // Introduction
        textToCopy += "Voici le résumé de la nouvelle composition du mélange et de ses indicateurs clés pour la journée :\n\n";

        // Key Indicators
        textToCopy += "Indicateurs Clés\n";
        textToCopy += `- PCI moyen: ${summaryIndicators.pci.toFixed(0)} kcal/kg\n`;
        textToCopy += `- % Chlorures: ${summaryIndicators.chlorine.toFixed(3)} %\n`;
        textToCopy += `- Taux de pneus: ${summaryIndicators.tireRate.toFixed(2)} %\n\n`;

        // Composition
        textToCopy += "Composition du Mélange\n";
        
        // Table Header
        const headerRow = [
            headers[0].padEnd(col1Width),
            headers[1].padEnd(col2Width),
            headers[2]
        ].join('  ');
        textToCopy += headerRow + '\n';
        textToCopy += '-'.repeat(headerRow.length) + '\n';
        
        // Table Rows
        composition.forEach(item => {
            const row = [
                item.name.padEnd(col1Width),
                item.totalBuckets.toString().padEnd(col2Width),
                `${item.percentage.toFixed(2)} %`
            ];
            textToCopy += row.join('  ') + '\n';
        });

        return textToCopy;
    };


    const handleCopySummary = () => {
        const textToCopy = generateSummaryText();
        navigator.clipboard.writeText(textToCopy).then(() => {
            toast({ title: "Copié !", description: "Le résumé a été copié dans le presse-papiers." });
        }).catch(err => {
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de copier le résumé." });
            console.error('Could not copy text: ', err);
        });
    };

    const handleEmailSummary = () => {
        const summaryText = generateSummaryText();
        const subject = `Rapport de Mélange du ${format(new Date(), 'dd/MM/yyyy', { locale: fr })}`;
        const body = encodeURIComponent(summaryText);
        window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${body}`;
    };


    const keyIndicators = [
      { label: 'PCI moyen:', value: summaryIndicators.pci.toFixed(0), unit: 'kcal/kg' },
      { label: '% Chlorures:', value: summaryIndicators.chlorine.toFixed(3), unit: '%' },
      { label: 'Taux de pneus:', value: summaryIndicators.tireRate.toFixed(2), unit: '%' },
    ];

    return (
      <Dialog open={isSaveModalOpen} onOpenChange={setIsSaveModalOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Résumé et Confirmation du Mélange</DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-4 text-sm">
            <p>
              Voici le résumé de la nouvelle composition du mélange et de ses indicateurs clés pour la journée :
            </p>
            
            <div>
                <h3 className="font-semibold text-foreground mb-2">Indicateurs Clés</h3>
                <div className="rounded-lg border p-4 grid grid-cols-1 gap-2">
                    {keyIndicators.map(item => (
                        <div key={item.label} className="flex justify-between items-baseline">
                            <span className="text-muted-foreground">{item.label}</span>
                            <span className="font-medium text-foreground">{item.value} <span className="text-xs text-muted-foreground">{item.unit}</span></span>
                        </div>
                    ))}
                </div>
            </div>
            
            <div>
                 <h3 className="font-semibold text-foreground mb-2">Composition du Mélange</h3>
                {composition.length > 0 ? (
                    <div className="rounded-lg border">
                       <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Combustible</TableHead>
                                    <TableHead className="text-center">Nb Godets</TableHead>
                                    <TableHead className="text-right">% Poids</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {composition.map(item => (
                                    <TableRow key={item.name}>
                                        <TableCell className="font-medium">{item.name}</TableCell>
                                        <TableCell className="text-center">{item.totalBuckets}</TableCell>
                                        <TableCell className="text-right">{item.percentage.toFixed(2)} %</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                ) : (
                    <p className="text-muted-foreground text-center py-4">Le mélange est vide.</p>
                )}
            </div>

          </div>
          <DialogFooter className="gap-2 sm:justify-end flex-wrap">
            <Button type="button" variant="secondary" onClick={() => setIsSaveModalOpen(false)}>Annuler</Button>
            <Button type="button" variant="outline" onClick={handleCopySummary}>
                <Copy className="mr-2 h-4 w-4" />
                Copier le résumé
            </Button>
             <Button type="button" variant="outline" onClick={handleEmailSummary}>
                <Mail className="mr-2 h-4 w-4" />
                Envoyer par Email
            </Button>
            <Button type="button" onClick={handleConfirmSave} disabled={isSaving}>
              {isSaving ? "Enregistrement..." : "Confirmer et Enregistrer"}
            </Button>
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
    <div className="p-4 md:p-6 lg:p-8 space-y-6 bg-gray-50">
      <div className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur-sm py-4 space-y-4">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className='flex items-center gap-2'>
                <h1 className="text-2xl font-bold text-gray-800">Indicateurs Globaux</h1>
                <ThresholdSettingsModal />
              </div>
               <Popover>
                  <PopoverTrigger asChild>
                      <Button
                          id="date"
                          variant={"outline"}
                          className={cn(
                              "w-[300px] justify-start text-left font-normal bg-white",
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
              <Button onClick={handlePrepareSave} disabled={isSaving}>
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? "Enregistrement..." : "Enregistrer la Session"}
              </Button>
            </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <IndicatorCard title="Débit des AFs" value={globalIndicators.flow.toFixed(2)} unit="t/h" />
          <IndicatorCard title="PCI moy" value={globalIndicators.pci.toFixed(0)} unit="kcal/kg" status={globalIndicators.status.pci} />
          <IndicatorCard title="% Humidité moy" value={globalIndicators.humidity.toFixed(2)} unit="%" status={globalIndicators.status.humidity} />
          <IndicatorCard title="% Cendres moy" value={globalIndicators.ash.toFixed(2)} unit="%" status={globalIndicators.status.ash} />
          <IndicatorCard title="% Chlorures" value={globalIndicators.chlorine.toFixed(3)} unit="%" status={globalIndicators.status.chlorine} />
          <IndicatorCard title="Taux de pneus" value={globalIndicators.tireRate.toFixed(2)} unit="%" status={globalIndicators.status.tireRate} />
          <IndicatorCard title="Coût du Mélange" value={globalIndicators.cost.toFixed(2) } unit="MAD/t" />
        </div>
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-md rounded-xl bg-white">
          <CardHeader className="flex flex-row items-center justify-between p-6">
            <CardTitle className='text-gray-800'>Hall des AF</CardTitle>
            <div className="flex items-center gap-2">
                <Label htmlFor="flow-hall" className="text-sm text-gray-600">Débit (t/h)</Label>
                <Input id="flow-hall" type="number" className="w-32 h-9" value={hallAF.flowRate || ''} onChange={(e) => handleFlowRateChange(setHallAF, e.target.value)} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <FuelInputList installationState={hallAF} setInstallationState={setHallAF} installationName="hall" />
          </CardContent>
        </Card>
        
        <Card className="shadow-md rounded-xl bg-white">
          <CardHeader className="flex flex-row items-center justify-between p-6">
            <CardTitle className='text-gray-800'>ATS</CardTitle>
            <div className="flex items-center gap-2">
                <Label htmlFor="flow-ats" className="text-sm text-gray-600">Débit (t/h)</Label>
                <Input id="flow-ats" type="number" className="w-32 h-9" value={ats.flowRate || ''} onChange={(e) => handleFlowRateChange(setAts, e.target.value)} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <FuelInputList installationState={ats} setInstallationState={setAts} installationName="ats" />
          </CardContent>
        </Card>
      </section>

      <Collapsible defaultOpen={false} className="rounded-xl border bg-white text-card-foreground shadow-md">
        <Card>
            <CardHeader className="p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className='text-gray-800'>Historique Global des Indicateurs</CardTitle>
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
                <CardContent className="pt-0 p-6">
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
      
      <SaveConfirmationModal />
    </div>
  );
}
