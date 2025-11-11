

"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { BrainCircuit, Calendar as CalendarIcon, Save, Settings, ChevronDown, CheckCircle, AlertTriangle, Copy, Mail, Flame, X, LineChart as LineChartIcon, Beaker, TrendingUp } from 'lucide-react';
import { DateRange } from "react-day-picker";
import { format, subDays, startOfDay, endOfDay, parseISO, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Timestamp } from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { getAverageAnalysisForFuels, saveMixtureSession, getMixtureSessions, MixtureSession, getFuelCosts, FuelCost, getLatestMixtureSession, getStocks, getFuelData, FuelData, getThresholds, saveThresholds, Specification, MixtureThresholds, getAverageAnalysisForFuels as getAverageAnalysisForFuelsNew } from '@/lib/data';
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
import { ScrollArea } from './ui/scroll-area';
import { useAuth } from '@/context/auth-provider';
import { motion } from 'framer-motion';


interface FuelState {
  buckets: number;
}

interface InstallationState {
  flowRate: number;
  fuels: Record<string, FuelState>;
}


interface DirectInputState {
    flowRate: number;
}

interface MixtureSummary {
    globalIndicators: ReturnType<typeof useMixtureCalculations>['afIndicators'];
    composition: { 
        name: string; 
        percentage: number;
        totalBuckets: number;
    }[];
    flows: {
        afFlow: number;
        goFlow: number;
    }
}

const defaultThresholds: MixtureThresholds = {
    pci_min: 5000,
    pci_max: 6500,
    pci_vert_min: 5500,
    pci_vert_max: 6000,
    chlorure_vert_max: 0.5,
    chlorure_jaune_max: 0.8,
    cendre_vert_max: 15,
    cendre_jaune_max: 20,
    h2o_vert_max: 5,
    h2o_jaune_max: 8,
    pneus_vert_max: 50,
    pneus_jaune_max: 60
};

type IndicatorStatus = 'alert' | 'warning' | 'conform' | 'neutral';
export type IndicatorKey = 'pci' | 'humidity' | 'ash' | 'chlorine' | 'tireRate' | 'cost' | 'flow' | 'tsr' | 'cl_fc';

const ThresholdSettingsModal = ({
  isOpen,
  onOpenChange,
  thresholds,
  onSave,
  isReadOnly,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  thresholds: MixtureThresholds;
  onSave: (newThresholds: MixtureThresholds) => void;
  isReadOnly: boolean;
}) => {
    const [currentThresholds, setCurrentThresholds] = useState(thresholds);

    useEffect(() => {
        setCurrentThresholds(thresholds);
    }, [isOpen, thresholds]);

    const handleChange = (key: keyof MixtureThresholds, value: string) => {
        const numValue = parseFloat(value);
        setCurrentThresholds(prev => ({
            ...prev,
            [key]: isNaN(numValue) ? null : numValue
        }));
    };

    const handleSave = () => {
        onSave(currentThresholds);
    };
    
    const thresholdFields: {key: keyof MixtureThresholds; label: string}[] = [
        { key: 'pci_min', label: 'PCI - Alerte (Min)' },
        { key: 'pci_max', label: 'PCI - Alerte (Max)' },
        { key: 'pci_vert_min', label: 'PCI - Vert (Min)' },
        { key: 'pci_vert_max', label: 'PCI - Vert (Max)' },
        { key: 'chlorure_vert_max', label: 'Chlorures - Vert (Max)' },
        { key: 'chlorure_jaune_max', label: 'Chlorures - Jaune (Max)' },
        { key: 'cendre_vert_max', label: 'Cendres - Vert (Max)' },
        { key: 'cendre_jaune_max', label: 'Cendres - Jaune (Max)' },
        { key: 'h2o_vert_max', label: 'H2O - Vert (Max)' },
        { key: 'h2o_jaune_max', label: 'H2O - Jaune (Max)' },
        { key: 'pneus_vert_max', label: 'Pneus - Vert (Max)' },
        { key: 'pneus_jaune_max', label: 'Pneus - Jaune (Max)' },
    ];

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" disabled={isReadOnly}>
                    <Settings className="h-5 w-5" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Définir les seuils d'alerte</DialogTitle>
                    <DialogDescription>
                        Les indicateurs changeront de couleur si ces seuils sont dépassés.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 py-4 max-h-[60vh] overflow-y-auto">
                    {thresholdFields.map(({key, label}) => (
                         <div key={key} className="space-y-2">
                            <Label htmlFor={key}>{label}</Label>
                            <Input id={key} type="number" value={currentThresholds[key] ?? ''} onChange={e => handleChange(key, e.target.value)} readOnly={isReadOnly}/>
                        </div>
                    ))}
                </div>
                <DialogFooter>
                    <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Annuler</Button>
                    {!isReadOnly && <Button type="button" onClick={handleSave}>Enregistrer les seuils</Button>}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export function IndicatorCard({ 
    data, 
    thresholds,
    onIndicatorDoubleClick,
}: { 
    data: Record<string, number | undefined>, 
    thresholds?: MixtureThresholds,
    onIndicatorDoubleClick?: (key: IndicatorKey, name: string) => void,
}) {
  const getColorClass = (key: string, value: number): IndicatorStatus => {
    if(key === '%Cl- FC estimé') return 'neutral'; // Always neutral color
    if(!thresholds) return 'neutral';

    switch (key) {
      case "PCI":
        if ((thresholds.pci_min != null && value < thresholds.pci_min) || (thresholds.pci_max != null && value > thresholds.pci_max)) return 'alert';
        if ((thresholds.pci_vert_min != null && value >= thresholds.pci_vert_min) && (thresholds.pci_vert_max != null && value <= thresholds.pci_vert_max)) return 'conform';
        return 'warning';
      case "Chlorures":
        if (thresholds.chlorure_jaune_max != null && value > thresholds.chlorure_jaune_max) return 'alert';
        if (thresholds.chlorure_vert_max != null && value > thresholds.chlorure_vert_max) return 'warning';
        return 'conform';
      case "Cendres":
        if (thresholds.cendre_jaune_max != null && value > thresholds.cendre_jaune_max) return 'alert';
        if (thresholds.cendre_vert_max != null && value > thresholds.cendre_vert_max) return 'warning';
        return 'conform';
      case "Humidité":
        if (thresholds.h2o_jaune_max != null && value > thresholds.h2o_jaune_max) return 'alert';
        if (thresholds.h2o_vert_max != null && value > thresholds.h2o_vert_max) return 'warning';
        return 'conform';
      case "TauxPneus":
         if (thresholds.pneus_jaune_max != null && value > thresholds.pneus_jaune_max) return 'alert';
        if (thresholds.pneus_vert_max != null && value > thresholds.pneus_vert_max) return 'warning';
        return 'conform';
      default:
        return 'neutral';
    }
  };

  const keyMap: Record<string, { key: IndicatorKey, name: string }> = {
    'PCI': { key: 'pci', name: 'PCI' },
    'Chlorures': { key: 'chlorine', name: 'Chlorures' },
    'Cendres': { key: 'ash', name: 'Cendres' },
    'Humidité': { key: 'humidity', name: 'Humidité' },
    'TauxPneus': { key: 'tireRate', name: 'Taux Pneus' },
    'TSR': { key: 'tsr', name: 'TSR'},
    '%Cl- FC estimé': { key: 'cl_fc', name: '%Cl FC estimé'},
  };
  
    const statusClasses: Record<IndicatorStatus, string> = {
        alert: "bg-red-900/40 border-red-500 text-red-300",
        warning: "bg-yellow-900/40 border-yellow-400 text-yellow-300",
        conform: "bg-green-900/40 border-green-500 text-green-300",
        neutral: "border-brand-line/60 bg-brand-surface/60",
    }

    const specialColorClass = "bg-purple-900/40 border-purple-500 text-purple-300";

  return (
    <Card className="bg-brand-surface border-brand-line h-full">
        <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-white">
                <span>⚗️</span> Indicateurs du Mélange
            </CardTitle>
            <CardDescription>
                Basé sur le dernier calcul ou la dernière analyse
            </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 gap-3">
                {Object.entries(data).map(([key, value]) => (
                <motion.div
                    key={key}
                    whileHover={{ scale: 1.07 }}
                    transition={{ type: "spring", stiffness: 250 }}
                    className={cn(
                        "flex flex-col items-center justify-center rounded-xl border py-3 px-2 font-medium cursor-pointer",
                        key === '%Cl- FC estimé' ? specialColorClass : statusClasses[getColorClass(key, value as number)]
                    )}
                    onDoubleClick={() => onIndicatorDoubleClick && keyMap[key] && onIndicatorDoubleClick(keyMap[key].key, keyMap[key].name)}
                >
                    <span className="text-xs opacity-80">{key === 'TauxPneus' ? 'Taux Pneus' : key}</span>
                    <span className="text-base font-semibold">
                    {typeof value !== 'number' || isNaN(value)
                      ? '-'
                      : key === "PCI"
                        ? `${(value as number).toFixed(0)}`
                        : `${(value as number).toFixed(key === 'Chlorures' || key === '%Cl- FC estimé' ? 3 : 2)}%`}
                    </span>
                </motion.div>
                ))}
            </div>
        </CardContent>
    </Card>
  );
}


function useMixtureCalculations(
    hallAF: InstallationState, 
    ats: InstallationState, 
    directInputs: Record<string, DirectInputState>,
    availableFuels: Record<string, AverageAnalysis>, 
    fuelData: Record<string, FuelData>, 
    fuelCosts: Record<string, FuelCost>,
    thresholds?: MixtureThresholds
) {
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

            let correctedPciBrut = analysisData.pci_brut;
            
            const fuelCost = fuelCosts[fuelName]?.cost || 0;

            tempTotalPci += weight * correctedPciBrut;
            tempTotalHumidity += weight * analysisData.h2o;
            tempTotalAsh += weight * analysisData.cendres;
            tempTotalChlorine += weight * analysisData.chlore;
            tempTotalCost += weight * fuelCost;
        }

        return { 
            weight: totalWeight, 
            tireWeight: tempTotalTireWeight,
            cost: totalWeight > 0 ? tempTotalCost / totalWeight : 0,
            pci: totalWeight > 0 ? tempTotalPci / totalWeight : 0,
            humidity: totalWeight > 0 ? tempTotalHumidity / totalWeight : 0,
            ash: totalWeight > 0 ? tempTotalAsh / totalWeight : 0,
            chlorine: totalWeight > 0 ? tempTotalChlorine / totalWeight : 0,
            fuelWeights
        };
    };

    const hallIndicators = processInstallation(hallAF);
    const atsIndicators = processInstallation(ats);

    // --- AFs Indicators (sans GO) ---
    const afFlows = [
      { flow: hallAF.flowRate || 0, indicators: hallIndicators },
      { flow: ats.flowRate || 0, indicators: atsIndicators },
    ];
    const totalAfFlow = afFlows.reduce((sum, item) => sum + item.flow, 0);

    const weightedAfAvg = (valueKey: 'pci' | 'humidity' | 'ash' | 'chlorine' | 'cost') => {
        if (totalAfFlow === 0) return 0;
        const totalValue = afFlows.reduce((sum, item) => sum + item.flow * (item.indicators[valueKey] || 0), 0);
        return totalValue / totalAfFlow;
    };
    
    let tireRateAf = 0;
    const totalAfWeightFromFlows = afFlows.reduce((sum, item) => sum + item.flow * (item.indicators.weight > 0 ? 1 : 0), 0);
    if (totalAfWeightFromFlows > 0) {
        const totalTireWeightContribution = afFlows.reduce((sum, item) => {
            if (item.indicators.weight > 0) {
                return sum + item.flow * (item.indicators.tireWeight / item.indicators.weight);
            }
            return sum;
        }, 0);
        tireRateAf = (totalTireWeightContribution / totalAfWeightFromFlows) * 100;
    }


    const afIndicators = {
        flow: totalAfFlow,
        pci: weightedAfAvg('pci'),
        humidity: weightedAfAvg('humidity'),
        ash: weightedAfAvg('ash'),
        chlorine: weightedAfAvg('chlorine'),
        tireRate: tireRateAf,
        cost: weightedAfAvg('cost'),
    };
    
    // --- Total Indicators (avec GO) ---
    const grignonsFlow = (directInputs['Grignons GO1']?.flowRate || 0) + (directInputs['Grignons GO2']?.flowRate || 0);
    const totalAlternativeFlow = totalAfFlow + grignonsFlow;
    
    const grignonsAnalysis = availableFuels['Grignons'];
    const pciGrignons = grignonsAnalysis?.pci_brut || 0;
    const humidityGrignons = grignonsAnalysis?.h2o || 0;
    const ashGrignons = grignonsAnalysis?.cendres || 0;
    const chlorineGrignons = grignonsAnalysis?.chlore || 0;
    const costGrignons = fuelCosts['Grignons']?.cost || 0;
    
    const weightedTotalAvg = (afValue: number, grignonsValue: number) => {
        if (totalAlternativeFlow === 0) return 0;
        return (afValue * totalAfFlow + grignonsValue * grignonsFlow) / totalAlternativeFlow;
    };

    const totalPci = weightedTotalAvg(afIndicators.pci, pciGrignons);
    const totalHumidity = weightedTotalAvg(afIndicators.humidity, humidityGrignons);
    const totalAsh = weightedTotalAvg(afIndicators.ash, ashGrignons);
    const totalChlorine = weightedTotalAvg(afIndicators.chlorine, chlorineGrignons);
    
    // TSR Calculation
    const getPci = (fuelName: string) => availableFuels[fuelName]?.pci_brut || 0;
    const afEnergy = totalAfFlow * afIndicators.pci;
    const grignonsEnergy = grignonsFlow * pciGrignons;
    const petcokeFlow = (directInputs['Pet-Coke Preca']?.flowRate || 0) + (directInputs['Pet-Coke Tuyere']?.flowRate || 0);
    const pciPetcoke = getPci('Pet-Coke') || getPci('Pet-Coke Preca') || getPci('Pet-Coke Tuyere');
    const petcokeEnergy = petcokeFlow * pciPetcoke;
    const totalAlternativeEnergy = afEnergy + grignonsEnergy;
    const totalEnergy = totalAlternativeEnergy + petcokeEnergy;
    const tsr = totalEnergy > 0 ? (totalAlternativeEnergy / totalEnergy) * 100 : 0;
    
    const cl_fc = 0.15 + (totalChlorine) * (0.23 + 4.85 * (tsr / 100));

    const totalIndicators = {
        flow: totalAlternativeFlow,
        pci: totalPci,
        humidity: totalHumidity,
        ash: totalAsh,
        chlorine: totalChlorine,
        tireRate: afIndicators.tireRate, // tireRate is only for AFs
        cost: weightedTotalAvg(afIndicators.cost, costGrignons),
        tsr,
        cl_fc
    };

    const getStatus = (value: number, key: IndicatorKey): IndicatorStatus => {
       if(!thresholds) return 'neutral';
       switch (key) {
        case 'pci':
            if ((thresholds.pci_min != null && value < thresholds.pci_min) || (thresholds.pci_max != null && value > thresholds.pci_max)) return 'alert';
            if ((thresholds.pci_vert_min != null && value >= thresholds.pci_vert_min) && (thresholds.pci_vert_max != null && value <= thresholds.pci_vert_max)) return 'conform';
            return 'warning';
        case 'chlorine':
            if (thresholds.chlorure_jaune_max != null && value > thresholds.chlorure_jaune_max) return 'alert';
            if (thresholds.chlorure_vert_max != null && value > thresholds.chlorure_vert_max) return 'warning';
            return 'conform';
        case 'ash':
            if (thresholds.cendre_jaune_max != null && value > thresholds.cendre_jaune_max) return 'alert';
            if (thresholds.cendre_vert_max != null && value > thresholds.cendre_vert_max) return 'warning';
            return 'conform';
        case 'humidity':
            if (thresholds.h2o_jaune_max != null && value > thresholds.h2o_jaune_max) return 'alert';
            if (thresholds.h2o_vert_max != null && value > thresholds.h2o_vert_max) return 'warning';
            return 'conform';
        case 'tireRate':
            if (thresholds.pneus_jaune_max != null && value > thresholds.pneus_jaune_max) return 'alert';
            if (thresholds.pneus_vert_max != null && value > thresholds.pneus_vert_max) return 'warning';
            return 'conform';
        default:
            return 'neutral';
       }
    };

    return {
      afIndicators: { ...afIndicators, tsr, status: {
        pci: getStatus(afIndicators.pci, 'pci'),
        humidity: getStatus(afIndicators.humidity, 'humidity'),
        ash: getStatus(afIndicators.ash, 'ash'),
        chlorine: getStatus(afIndicators.chlorine, 'chlorine'),
        tireRate: getStatus(afIndicators.tireRate, 'tireRate'),
        tsr: 'neutral' as IndicatorStatus,
        cost: 'neutral' as IndicatorStatus,
        flow: 'neutral' as IndicatorStatus,
      } },
      totalIndicators: { ...totalIndicators, status: {
        pci: getStatus(totalIndicators.pci, 'pci'),
        humidity: getStatus(totalIndicators.humidity, 'humidity'),
        ash: getStatus(totalIndicators.ash, 'ash'),
        chlorine: getStatus(totalIndicators.chlorine, 'chlorine'),
        tireRate: getStatus(totalIndicators.tireRate, 'tireRate'),
        tsr: 'neutral' as IndicatorStatus,
        cl_fc: 'neutral' as IndicatorStatus,
        cost: 'neutral' as IndicatorStatus,
        flow: 'neutral' as IndicatorStatus,
      } },
    };
  }, [hallAF, ats, directInputs, availableFuels, fuelData, fuelCosts, thresholds]);
}


const fuelOrder = [
    "Pneus",
    "CSR",
    "CSR DD",
    "DMB",
    "Plastiques",
    "Bois",
    "Mélange"
];




export function MixtureCalculator() {
  const { userProfile } = useAuth();
  const isReadOnly = userProfile?.role === 'viewer';
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [availableFuels, setAvailableFuels] = useState<Record<string, AverageAnalysis>>({});
  const [fuelData, setFuelData] = useState<Record<string, FuelData>>({});
  
  const [hallAF, setHallAF] = useState<InstallationState>({ flowRate: 0, fuels: {} });
  const [ats, setAts] = useState<InstallationState>({ flowRate: 0, fuels: {} });
  const [directInputs, setDirectInputs] = useState<Record<string, DirectInputState>>({
    'Grignons GO1': { flowRate: 0 },
    'Grignons GO2': { flowRate: 0 },
    'Pet-Coke Preca': { flowRate: 0 },
    'Pet-Coke Tuyere': { flowRate: 0 },
  });
  
  // History state
  const [historySessions, setHistorySessions] = useState<MixtureSession[]>([]);
  const [historyDateRange, setHistoryDateRange] = useState<DateRange | undefined>({ from: subDays(new Date(), 30), to: new Date() });
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyChartIndicator, setHistoryChartIndicator] = useState<{key: IndicatorKey; name: string} | null>(null);

  // Global and individual date ranges
  const [globalDateRange, setGlobalDateRange] = useState<DateRange | undefined>(undefined);
  const [fuelDateRanges, setFuelDateRanges] = useState<Record<string, DateRange | undefined>>({});

  // Cost state
  const [fuelCosts, setFuelCosts] = useState<Record<string, FuelCost>>({});
  
  // Thresholds state
  const [thresholds, setThresholds] = useState<MixtureThresholds | undefined>(undefined);
  const [isThresholdModalOpen, setIsThresholdModalOpen] = useState(false);
  
  // Save confirmation modal state
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [mixtureSummary, setMixtureSummary] = useState<MixtureSummary | null>(null);

  const { toast } = useToast();

  const handleSaveThresholds = async (newThresholds: MixtureThresholds) => {
    if (isReadOnly) return;
    try {
        await saveThresholds({ melange: newThresholds });
        setThresholds(newThresholds);
        toast({ title: "Succès", description: "Les seuils d'alerte ont été enregistrés."});
        setIsThresholdModalOpen(false);
    } catch (error) {
        console.error("Could not save thresholds to Firestore", error);
        toast({ variant: "destructive", title: "Erreur", description: "Impossible d'enregistrer les seuils." });
    }
  }

 const fetchData = useCallback(async () => {
    setLoading(true);
    try {
        const [allFuelData, costs, allStocks, thresholdsData] = await Promise.all([
            getFuelData(),
            getFuelCosts(),
            getStocks(),
            getThresholds(),
        ]);
        
        const allPossibleFuelNames = new Set(allStocks.map(s => s.nom_combustible));
        const fuelNames = Array.from(allPossibleFuelNames);

        const analysesResults = await getAverageAnalysisForFuelsNew(fuelNames, globalDateRange, fuelDateRanges);

        const extendedAnalyses = {...analysesResults};
        if (analysesResults['Grignons']) {
            extendedAnalyses['Grignons GO1'] = analysesResults['Grignons'];
            extendedAnalyses['Grignons GO2'] = analysesResults['Grignons'];
        }
        const petcokeAnalysis = analysesResults['Pet-Coke'] || analysesResults['Pet Coke'] || analysesResults['Pet-Coke Preca'] || analysesResults['Pet-Coke Tuyere'];
        if(petcokeAnalysis) {
             extendedAnalyses['Pet-Coke Preca'] = petcokeAnalysis;
             extendedAnalyses['Pet-Coke Tuyere'] = petcokeAnalysis;
        }

        setAvailableFuels(extendedAnalyses);
        
        if (thresholdsData.melange) {
             setThresholds(thresholdsData.melange);
        } else {
            setThresholds(defaultThresholds);
        }
        const fuelDataMap = allFuelData.reduce((acc, fd) => { acc[fd.nom_combustible] = fd; return acc; }, {} as Record<string, FuelData>);
        setFuelData(fuelDataMap);
        setFuelCosts(costs);

    } catch (error) {
        console.error("Error fetching fuel data:", error);
        const errorMessage = error instanceof Error ? error.message : "Une erreur inconnue est survenue.";
        toast({ variant: "destructive", title: "Erreur", description: `Impossible de charger les données des combustibles: ${errorMessage}` });
    } finally {
        setLoading(false);
    }
  }, [toast, globalDateRange, fuelDateRanges]);
  

  // Initial data load effect
  useEffect(() => {
    const loadInitialData = async () => {
        setLoading(true);
        try {
            const latestSession = await getLatestMixtureSession();
            
            const [allStocks] = await Promise.all([getStocks()]);
            const allPossibleFuelNames = new Set(allStocks.map(s => s.nom_combustible));
             if (latestSession) {
                Object.keys(latestSession.hallAF?.fuels || {}).forEach(name => allPossibleFuelNames.add(name));
                Object.keys(latestSession.ats?.fuels || {}).forEach(name => allPossibleFuelNames.add(name));
            }
            const fuelNamesArray = Array.from(allPossibleFuelNames);
            const directInputBaseNames = ['Grignons', 'Pet-Coke'];
            const initialFuelState = fuelNamesArray
            .filter(name => !directInputBaseNames.includes(name))
            .reduce((acc, name) => {
                acc[name] = { buckets: 0 };
                return acc;
            }, {} as InstallationState['fuels']);
        
            let initialHallState: InstallationState = { flowRate: 0, fuels: { ...initialFuelState } };
            let initialAtsState: InstallationState = { flowRate: 0, fuels: { ...initialFuelState } };
            let initialDirectInputs = { ...directInputs };

            if (latestSession) {
                initialHallState = {
                    flowRate: latestSession.hallAF?.flowRate || 0,
                    fuels: { ...initialHallState.fuels, ...(latestSession.hallAF?.fuels || {}) }
                };
                initialAtsState = {
                    flowRate: latestSession.ats?.flowRate || 0,
                    fuels: { ...initialAtsState.fuels, ...(latestSession.ats?.fuels || {}) }
                };
                if (latestSession.directInputs) {
                  initialDirectInputs = { ...initialDirectInputs, ...latestSession.directInputs };
                }
                setGlobalDateRange(latestSession.analysisDateRange ? {
                    from: latestSession.analysisDateRange.from.toDate(),
                    to: latestSession.analysisDateRange.to.toDate(),
                }: undefined);
                setTimeout(() => {
                    toast({ title: "Dernière session chargée", description: "La dernière configuration a été chargée." });
                }, 100);
            }
            
            setHallAF(initialHallState);
            setAts(initialAtsState);
            setDirectInputs(initialDirectInputs);
            
        } catch (error) {
             console.error("Error on initial load:", error);
        } finally {
            setLoading(false);
        }
    };

    loadInitialData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once


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

  const { afIndicators, totalIndicators } = useMixtureCalculations(hallAF, ats, directInputs, availableFuels, fuelData, fuelCosts, thresholds);

  const historyChartData = useMemo(() => {
    if (!historySessions || historySessions.length === 0 || !historyChartIndicator) return [];
    
    return historySessions
        .map(session => ({
            date: session.timestamp.toDate(),
            value: (session.globalIndicators as any)[historyChartIndicator.key]
        }))
        .filter(item => typeof item.value === 'number')
        .sort((a, b) => a.date.valueOf() - b.date.valueOf())
        .map(item => ({
            date: format(item.date, 'dd/MM HH:mm'),
            value: item.value
        }));
}, [historySessions, historyChartIndicator]);


  const handleInputChange = (setter: React.Dispatch<React.SetStateAction<InstallationState>>, fuelName: string, value: string) => {
    const buckets = parseInt(value, 10);
    setter(prev => {
      const newFuels = { ...prev.fuels };
      newFuels[fuelName] = { ...newFuels[fuelName], buckets: isNaN(buckets) ? 0 : buckets };
      return { ...prev, fuels: newFuels };
    });
  };
  
  const handleFlowRateChange = (setter: React.Dispatch<React.SetStateAction<any>>, value: string) => {
    const flowRate = parseFloat(value);
    setter(prev => ({ ...prev, flowRate: isNaN(flowRate) ? 0 : flowRate }));
  };

  const handleDirectInputChange = (fuelName: string, value: string) => {
      const flowRate = parseFloat(value);
      setDirectInputs(prev => ({
          ...prev,
          [fuelName]: { flowRate: isNaN(flowRate) ? 0 : flowRate }
      }));
  }

  const handlePrepareSave = () => {
    if (isReadOnly) return;
    const directInputBaseNames = ['grignons', 'pet-coke'];

    const mixtureFuelWeights: Record<string, number> = {};

    const afFlow = (hallAF.flowRate || 0) + (ats.flowRate || 0);
    const goFlow = (directInputs['Grignons GO1']?.flowRate || 0) + (directInputs['Grignons GO2']?.flowRate || 0);

    setMixtureSummary({
      globalIndicators: afIndicators,
      composition: [], // This part seems not used in modal, can be simplified
      flows: { afFlow, goFlow }
    });
    setIsSaveModalOpen(true);
  };
  
  const handleConfirmSave = async () => {
    if (isReadOnly) return;
    setIsSaving(true);
    setIsSaveModalOpen(false);
    try {
        const usedFuelNames = new Set<string>();
        Object.entries(hallAF.fuels).forEach(([name, data]) => { if (data.buckets > 0) usedFuelNames.add(name) });
        Object.entries(ats.fuels).forEach(([name, data]) => { if (data.buckets > 0) usedFuelNames.add(name) });
        Object.entries(directInputs).forEach(([name, data]) => { 
            if (data.flowRate > 0) {
              if (name.toLowerCase().includes('grignons')) usedFuelNames.add('Grignons');
              else if (name.toLowerCase().includes('pet-coke')) usedFuelNames.add('Pet-Coke');
              else usedFuelNames.add(name);
            }
        });

        const availableFuelsToSave: Record<string, AverageAnalysis> = {};
        usedFuelNames.forEach(name => {
          if (availableFuels[name]) {
            availableFuelsToSave[name] = availableFuels[name];
          }
        });


        const sessionData: Omit<MixtureSession, 'id' | 'timestamp'> = {
            hallAF,
            ats,
            directInputs,
            globalIndicators: totalIndicators, // Save the total indicators
            availableFuels: availableFuelsToSave,
            analysisDateRange: globalDateRange?.from && globalDateRange.to ? {
                from: Timestamp.fromDate(globalDateRange.from),
                to: Timestamp.fromDate(globalDateRange.to),
            } : undefined,
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
        {sortedFuelNames.map(fuelName => {
            const fuelState = installationState.fuels[fuelName];
            const analysis = availableFuels[fuelName];
            
            return (
            <div key={fuelName} className="flex items-center gap-2">
                <Label htmlFor={`${installationName}-${fuelName}`} className="flex-1 text-sm">{fuelName}</Label>
                <Popover>
                    <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                        <CalendarIcon className="h-4 w-4" />
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            mode="range"
                            selected={fuelDateRanges[fuelName]}
                            onSelect={(range) => setFuelDateRanges(prev => ({ ...prev, [fuelName]: range }))}
                            locale={fr}
                            numberOfMonths={1}
                        />
                    </PopoverContent>
                </Popover>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className={cn(
                                "h-8 w-8 rounded-md flex items-center justify-center text-xs font-mono",
                                analysis?.count > 0 ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                            )}>
                                {analysis?.count ?? 0}
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{analysis?.count ?? 0} analyse(s) trouvée(s) pour la période sélectionnée.</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                <Input
                    id={`${installationName}-${fuelName}`}
                    type="number"
                    placeholder="0"
                    className="w-24 h-9"
                    value={fuelState?.buckets || ''}
                    onChange={(e) => handleInputChange(setInstallationState, fuelName, e.target.value)}
                    min="0"
                    readOnly={isReadOnly}
                />
            </div>
        )})}
        </div>
    );
  };
  
  const SaveConfirmationModal = () => {
    if (!mixtureSummary) return null;

    const { globalIndicators: summaryIndicators, flows } = mixtureSummary;

    const generateSummaryText = () => {
        let textToCopy = "Voici le résumé de la nouvelle composition du mélange et de ses indicateurs clés :\n\n";
        textToCopy += `Basé sur la session du ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: fr })}\n\n`;

        textToCopy += "Indicateurs du Mélange Total (AFs + GO)\n";
        textToCopy += `- Débit: ${totalIndicators.flow.toFixed(2)} t/h\n`;
        textToCopy += `- PCI moyen: ${totalIndicators.pci.toFixed(0)} kcal/kg\n`;
        textToCopy += `- % Humidité: ${totalIndicators.humidity.toFixed(2)} %\n`;
        textToCopy += `- % Cendres: ${totalIndicators.ash.toFixed(2)} %\n`;
        textToCopy += `- % Chlorures: ${totalIndicators.chlorine.toFixed(3)} %\n\n`;
        textToCopy += `- TSR: ${totalIndicators.tsr.toFixed(2)} %\n\n`;

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


    return (
      <Dialog open={isSaveModalOpen} onOpenChange={setIsSaveModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmer l'Enregistrement</DialogTitle>
          </DialogHeader>
           <DialogDescription>
              Voulez-vous enregistrer la session avec les indicateurs du mélange total (AFs + GO) ?
          </DialogDescription>
          <div className="py-4 space-y-2">
            <div className="flex justify-between font-medium"><span>TSR Global:</span><span>{totalIndicators.tsr.toFixed(2)} %</span></div>
            <div className="flex justify-between font-medium"><span>PCI Total:</span><span>{totalIndicators.pci.toFixed(0)} kcal/kg</span></div>
          </div>
          <DialogFooter className="gap-2 sm:justify-between flex-wrap">
            <div>
              <Button type="button" variant="outline" onClick={handleCopySummary}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copier
              </Button>
               <Button type="button" variant="outline" onClick={handleEmailSummary} className="ml-2">
                  <Mail className="mr-2 h-4 w-4" />
                  Email
              </Button>
            </div>
            <div>
              <Button type="button" variant="secondary" onClick={() => setIsSaveModalOpen(false)}>Annuler</Button>
              <Button type="button" onClick={handleConfirmSave} disabled={isSaving} className="ml-2">
                {isSaving ? "Enregistrement..." : "Confirmer et Enregistrer"}
              </Button>
            </div>
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

  const handleIndicatorDoubleClick = (key: IndicatorKey, name: string) => {
    setHistoryChartIndicator({key, name});
  };

  const IndicatorDisplay = ({ title, value, unit, status, indicatorKey, name }: { title: string; value: string | number; unit?: string; status: IndicatorStatus, indicatorKey: IndicatorKey, name: string }) => {
    
    const statusClasses: Record<IndicatorStatus, string> = {
        alert: "bg-red-900/40 border-red-500 text-red-300",
        warning: "bg-yellow-900/40 border-yellow-400 text-yellow-300",
        conform: "bg-green-900/40 border-green-500 text-green-300",
        neutral: "border-brand-line/60 bg-brand-surface/60",
    }

    const specialColorClass = "bg-purple-900/40 border-purple-500 text-purple-300";
    
    return (
        <Card 
            onDoubleClick={() => handleIndicatorDoubleClick(indicatorKey, name)}
            className={cn(
                "text-center transition-colors rounded-xl cursor-pointer hover:bg-brand-muted/50",
                title === '%Cl- FC estimé' ? specialColorClass : statusClasses[status]
            )}>
            <CardHeader className="p-2 pb-1">
                <CardTitle className={cn("text-xs font-medium", status === 'neutral' && title !== '%Cl- FC estimé' ? 'text-muted-foreground' : 'text-inherit')}>
                <div className="flex items-center justify-center gap-1.5">
                    {status === 'alert' && <AlertTriangle className="h-3 w-3" />}
                    {status === 'conform' && <CheckCircle className="h-3 w-3" />}
                    {title}
                </div>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-2 pt-0">
                <p className={cn("text-xl font-bold", status === 'neutral' && title !== '%Cl- FC estimé' ? 'text-white' : 'text-inherit')}>
                {value} <span className="text-base opacity-70">{unit}</span>
                </p>
            </CardContent>
        </Card>
    );
  };


  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
       <div className="flex items-center justify-between">
            <div>
                 <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-3">
                    <Beaker className="h-8 w-8"/>
                    Calcul de Mélange
                </h1>
                <p className="text-muted-foreground mt-1">Outil de simulation pour la préparation de mélanges de combustibles alternatifs (AF).</p>
            </div>
        </div>

      <div className="sticky top-0 z-10 bg-brand-bg/95 backdrop-blur-sm py-4 space-y-6 -mx-4 -mt-4 px-4 pt-4">
        {/* Section Indicateurs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Indicateurs AFs (sans GO) */}
            <div>
                 <div className="flex items-center gap-4 mb-3">
                    <h2 className="text-xl font-bold text-white">Indicateurs Mélange AFs (sans GO)</h2>
                     {thresholds && (
                        <ThresholdSettingsModal 
                            isOpen={isThresholdModalOpen}
                            onOpenChange={setIsThresholdModalOpen}
                            thresholds={thresholds}
                            onSave={handleSaveThresholds}
                            isReadOnly={isReadOnly}
                        />
                    )}
                 </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    <IndicatorDisplay title="Débit AFs" value={afIndicators.flow.toFixed(2)} unit="t/h" status='neutral' indicatorKey="flow" name="Débit"/>
                    <IndicatorDisplay title="PCI moy" value={afIndicators.pci.toFixed(0)} unit="kcal/kg" status={afIndicators.status.pci} indicatorKey="pci" name="PCI Moyen"/>
                    <IndicatorDisplay title="% Humidité moy" value={afIndicators.humidity.toFixed(2)} unit="%" status={afIndicators.status.humidity} indicatorKey="humidity" name="Humidité Moyenne"/>
                    <IndicatorDisplay title="% Cendres moy" value={afIndicators.ash.toFixed(2)} unit="%" status={afIndicators.status.ash} indicatorKey="ash" name="Cendres Moyennes"/>
                    <IndicatorDisplay title="% Chlorures" value={afIndicators.chlorine.toFixed(3)} unit="%" status={afIndicators.status.chlorine} indicatorKey="chlorine" name="Chlorures Moyens"/>
                    <IndicatorDisplay title="Taux de pneus" value={afIndicators.tireRate.toFixed(2)} unit="%" status={afIndicators.status.tireRate} indicatorKey="tireRate" name="Taux de Pneus"/>
                     <IndicatorDisplay title="TSR" value={afIndicators.tsr.toFixed(2)} unit="%" status='neutral' indicatorKey="tsr" name="TSR"/>
                    <IndicatorDisplay title="Coût du Mélange" value={afIndicators.cost.toFixed(2) } unit="MAD/t" status='neutral' indicatorKey="cost" name="Coût du Mélange"/>
                </div>
            </div>
            {/* Indicateurs Mélange Total (avec GO) */}
            <div>
                <h3 className="text-lg font-semibold text-white mb-3">Indicateurs Mélange Total (avec GO)</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    <IndicatorDisplay title="Débit Total" value={totalIndicators.flow.toFixed(2)} unit="t/h" status='neutral' indicatorKey="flow" name="Débit"/>
                    <IndicatorDisplay title="PCI moy" value={totalIndicators.pci.toFixed(0)} unit="kcal/kg" status={totalIndicators.status.pci} indicatorKey="pci" name="PCI Moyen"/>
                    <IndicatorDisplay title="% Humidité moy" value={totalIndicators.humidity.toFixed(2)} unit="%" status={totalIndicators.status.humidity} indicatorKey="humidity" name="Humidité Moyenne"/>
                    <IndicatorDisplay title="% Cendres moy" value={totalIndicators.ash.toFixed(2)} unit="%" status={totalIndicators.status.ash} indicatorKey="ash" name="Cendres Moyennes"/>
                    <IndicatorDisplay title="% Chlorures" value={totalIndicators.chlorine.toFixed(3)} unit="%" status={totalIndicators.status.chlorine} indicatorKey="chlorine" name="Chlorures Moyens"/>
                    <IndicatorDisplay title="Taux de pneus" value={totalIndicators.tireRate.toFixed(2)} unit="%" status={totalIndicators.status.tireRate} indicatorKey="tireRate" name="Taux de Pneus"/>
                     <IndicatorDisplay title="TSR" value={totalIndicators.tsr.toFixed(2)} unit="%" status='neutral' indicatorKey="tsr" name="TSR"/>
                    <IndicatorDisplay title="Coût du Mélange" value={totalIndicators.cost.toFixed(2) } unit="MAD/t" status='neutral' indicatorKey="cost" name="Coût du Mélange"/>
                    <IndicatorDisplay title="%Cl- FC estimé" value={totalIndicators.cl_fc.toFixed(3)} unit="%" status='neutral' indicatorKey="cl_fc" name="%Cl- FC estimé" />
                </div>
            </div>
        </div>

        <div className="flex justify-end gap-2">
            <Popover>
                <PopoverTrigger asChild>
                <Button
                    id="date"
                    variant={"outline"}
                    className={cn(
                        "w-[300px] justify-start text-left font-normal",
                        !globalDateRange && "text-muted-foreground"
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {globalDateRange?.from ? (
                    globalDateRange.to ? (
                        <>
                        {format(globalDateRange.from, "d MMM y", { locale: fr })} -{" "}
                        {format(globalDateRange.to, "d MMM y", { locale: fr })}
                        </>
                    ) : (
                        format(globalDateRange.from, "d MMM y", { locale: fr })
                    )
                    ) : (
                    <span>Période d'analyse globale</span>
                    )}
                </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={globalDateRange?.from}
                    selected={globalDateRange}
                    onSelect={setGlobalDateRange}
                    numberOfMonths={2}
                    locale={fr}
                />
                </PopoverContent>
            </Popover>
            <Button disabled={isSaving || isReadOnly} onClick={handlePrepareSave}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Enregistrement..." : "Enregistrer la Session"}
            </Button>
            <SaveConfirmationModal />
        </div>
      </div>

      <Dialog open={!!historyChartIndicator} onOpenChange={(open) => !open && setHistoryChartIndicator(null)}>
        <DialogContent className="max-w-4xl">
            <DialogHeader>
                <DialogTitle>Historique de l'Indicateur : {historyChartIndicator?.name}</DialogTitle>
            </DialogHeader>
            <div className="py-4">
                 <ResponsiveContainer width="100%" height={400}>
                        {isHistoryLoading ? (
                            <Skeleton className="h-full w-full" />
                        ) : historyChartData.length > 0 ? (
                            <LineChart data={historyChartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} domain={['dataMin', 'auto']} />
                                <RechartsTooltip content={<CustomHistoryTooltip />} />
                                <Line type="monotone" dataKey="value" name={historyChartIndicator?.name} stroke="hsl(var(--primary))" dot={false} strokeWidth={2} />
                            </LineChart>
                        ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                                Aucune donnée historique pour cet indicateur dans la période sélectionnée.
                            </div>
                        )}
                    </ResponsiveContainer>
            </div>
        </DialogContent>
      </Dialog>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="shadow-md rounded-xl lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between p-6">
            <CardTitle>Hall des AF</CardTitle>
            <div className="flex items-center gap-2">
                <Label htmlFor="flow-hall" className="text-sm text-gray-600">Débit (t/h)</Label>
                <Input id="flow-hall" type="number" className="w-32 h-9" value={hallAF.flowRate || ''} onChange={(e) => handleFlowRateChange(setHallAF, e.target.value)} readOnly={isReadOnly}/>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <FuelInputList installationState={hallAF} setInstallationState={setHallAF} installationName="hall" />
          </CardContent>
        </Card>
        
        <Card className="shadow-md rounded-xl lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between p-6">
            <CardTitle>ATS</CardTitle>
            <div className="flex items-center gap-2">
                <Label htmlFor="flow-ats" className="text-sm text-gray-600">Débit (t/h)</Label>
                <Input id="flow-ats" type="number" className="w-32 h-9" value={ats.flowRate || ''} onChange={(e) => handleFlowRateChange(setAts, e.target.value)} readOnly={isReadOnly}/>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <FuelInputList installationState={ats} setInstallationState={setAts} installationName="ats" />
          </CardContent>
        </Card>
        
        <Card className="shadow-md rounded-xl lg:col-span-1">
          <CardHeader className="p-6">
            <CardTitle className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-orange-500" />
                Autres Combustibles
            </CardTitle>
            <CardDescription>Entrées directes pour les combustibles non-mélangés.</CardDescription>
          </CardHeader>
           <CardContent className="space-y-4 p-6">
             {Object.keys(directInputs).map(fuelName => (
                <div key={fuelName} className="flex items-center gap-4 justify-between">
                    <Label htmlFor={`flow-${fuelName}`} className="text-sm font-medium">{fuelName}</Label>
                    <div className="flex items-center gap-2">
                        <Input 
                            id={`flow-${fuelName}`} 
                            type="number" 
                            className="w-32 h-9" 
                            value={directInputs[fuelName].flowRate || ''} 
                            onChange={(e) => handleDirectInputChange(fuelName, e.target.value)}
                            readOnly={isReadOnly}
                        />
                        <span className="text-sm text-muted-foreground w-8">t/h</span>
                    </div>
                </div>
             ))}
          </CardContent>
        </Card>
      </section>

      <Collapsible defaultOpen={false} className="rounded-xl border bg-card text-card-foreground shadow-md">
        <Card>
            <CardHeader className="p-6">
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
                                <Line yAxisId="left" type="monotone" dataKey="PCI" stroke="hsl(var(--primary))" name="PCI" dot={false} strokeWidth={2} />
                                <Line yAxisId="right" type="monotone" dataKey="Chlorures" stroke="#ffc658" name="Chlorures (%)" dot={false} strokeWidth={2}/>
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
    </div>
  );
}

    



