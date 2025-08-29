
"use client";

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { RefreshCcw, Save, Download } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from 'lucide-react';
import { Separator } from './ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { saveMixtureScenario, getMixtureScenarios, type MixtureScenario } from '@/lib/data';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const BUCKET_VOLUME_M3 = 3;
const FUEL_TYPES = [ "Pneus", "CSR", "DMB", "Plastiques", "CSR DD", "Bois", "Mélange"];
const LOCAL_STORAGE_KEY = 'mixtureSimulatorState';

interface FuelAnalysis {
    buckets: number;
    pci: number;
    humidity: number;
    chlorine: number;
    ash: number;
    density: number;
}

interface InstallationState {
  flowRate: number;
  fuels: Record<string, FuelAnalysis>;
}

const createInitialFuelState = (): Record<string, FuelAnalysis> => {
    return FUEL_TYPES.reduce((acc, fuelType) => {
        acc[fuelType] = { buckets: 0, pci: 0, humidity: 0, chlorine: 0, ash: 0, density: 0 };
        return acc;
    }, {} as Record<string, FuelAnalysis>);
};

const createInitialInstallationState = (): InstallationState => ({
    flowRate: 0,
    fuels: createInitialFuelState(),
});

function IndicatorCard({ title, value, unit, tooltipText }: { title: string; value: string | number; unit?: string; tooltipText?: string }) {
  const cardContent = (
     <Card className="text-center transition-colors bg-white shadow-md rounded-xl">
      <CardHeader className="p-2 pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground">
          <div className="flex items-center justify-center gap-1.5">
            {title}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 pt-0">
        <p className="text-xl font-bold text-foreground">
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

function useMixtureCalculations(hallAF: InstallationState, ats: InstallationState) {
   return useMemo(() => {
    const processInstallation = (state: InstallationState) => {
        let totalWeight = 0;
        let tempTotalPci = 0;
        let tempTotalHumidity = 0;
        let tempTotalAsh = 0;
        let tempTotalChlorine = 0;
        let tempTotalTireWeight = 0;
        
        for(const fuelName in state.fuels) {
            const fuelInput = state.fuels[fuelName];
            
            if (!fuelInput || fuelInput.buckets <= 0 || fuelInput.density <= 0) {
                continue;
            }
            const weight = fuelInput.buckets * BUCKET_VOLUME_M3 * fuelInput.density;
            totalWeight += weight;

            if (fuelName.toLowerCase().includes('pneu')) {
                tempTotalTireWeight += weight;
            }
            
            tempTotalPci += weight * fuelInput.pci;
            tempTotalHumidity += weight * fuelInput.humidity;
            tempTotalAsh += weight * fuelInput.ash;
            tempTotalChlorine += weight * fuelInput.chlorine;
        }

        return { 
            weight: totalWeight, 
            pci: totalWeight > 0 ? tempTotalPci / totalWeight : 0,
            humidity: totalWeight > 0 ? tempTotalHumidity / totalWeight : 0,
            ash: totalWeight > 0 ? tempTotalAsh / totalWeight : 0,
            chlorine: totalWeight > 0 ? tempTotalChlorine / totalWeight : 0,
            tireRate: totalWeight > 0 ? (tempTotalTireWeight / totalWeight) * 100 : 0,
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
    const tireRate = weightedAvg(hallIndicators.tireRate, flowHall, atsIndicators.tireRate, flowAts);

    return {
      globalIndicators: {
        flow: totalFlow,
        pci,
        humidity,
        ash,
        chlorine,
        tireRate,
      }
    };
  }, [hallAF, ats]);
}

const FuelInputSimulator = ({ 
    installationState, 
    setInstallationState, 
    installationName,
    openAccordion,
    setOpenAccordion
}: { 
    installationState: InstallationState, 
    setInstallationState: React.Dispatch<React.SetStateAction<InstallationState>>, 
    installationName: 'hall' | 'ats',
    openAccordion: string | null,
    setOpenAccordion: (value: string | null) => void
}) => {
    
    const handleOpenChange = (accordionId: string) => {
        setOpenAccordion(openAccordion === accordionId ? null : accordionId);
    };

    const handleInputChange = (
        fuelName: string, 
        field: keyof FuelAnalysis,
        value: string
    ) => {
        const numValue = parseFloat(value);
        setInstallationState(prev => {
            const newFuels = { ...prev.fuels };
            newFuels[fuelName] = { ...newFuels[fuelName], [field]: isNaN(numValue) ? 0 : numValue };
            return { ...prev, fuels: newFuels };
        });
    };

    return (
        <div className="space-y-4">
        {FUEL_TYPES.map(fuelName => {
            const accordionId = `${installationName}-${fuelName}`;
            return (
                <Collapsible 
                    key={accordionId} 
                    className="border rounded-lg px-4"
                    open={openAccordion === accordionId}
                    onOpenChange={() => handleOpenChange(accordionId)}
                >
                    <CollapsibleTrigger className="flex items-center justify-between w-full py-3">
                         <Label htmlFor={`${installationName}-${fuelName}-buckets`} className="text-md font-semibold">{fuelName}</Label>
                         <div className='flex items-center gap-2'>
                            <Input
                                id={`${installationName}-${fuelName}-buckets`}
                                type="number"
                                placeholder="Godets"
                                className="w-28 h-9 text-center font-bold"
                                value={installationState.fuels[fuelName]?.buckets || ''}
                                onChange={(e) => handleInputChange(fuelName, 'buckets', e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                min="0"
                            />
                            <ChevronDown className="h-5 w-5 transition-transform data-[state=open]:rotate-180" />
                         </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <Separator className="my-2" />
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3 pb-4">
                            {(Object.keys(installationState.fuels[fuelName]) as Array<keyof FuelAnalysis>)
                                .filter(key => key !== 'buckets')
                                .map(key => {
                                    const labels = {
                                        pci: 'PCI (kcal/kg)',
                                        humidity: 'Humidité (%)',
                                        chlorine: 'Chlorures (%)',
                                        ash: 'Cendres (%)',
                                        density: 'Densité (t/m³)',
                                    };
                                    return (
                                        <div key={key} className="flex items-center gap-2">
                                            <Label htmlFor={`${installationName}-${fuelName}-${key}`} className="flex-1 text-sm text-muted-foreground">{labels[key]}</Label>
                                            <Input
                                                id={`${installationName}-${fuelName}-${key}`}
                                                type="number"
                                                placeholder="0"
                                                className="w-24 h-8"
                                                value={installationState.fuels[fuelName]?.[key] || ''}
                                                onChange={(e) => handleInputChange(fuelName, key, e.target.value)}
                                                min="0"
                                            />
                                        </div>
                                    );
                                })}
                        </div>
                    </CollapsibleContent>
                </Collapsible>
            )
        })}
        </div>
    );
};

export function MixtureSimulator() {
  const [hallAF, setHallAF] = useState<InstallationState>(createInitialInstallationState());
  const [ats, setAts] = useState<InstallationState>(createInitialInstallationState());
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);
  const { toast } = useToast();

  // Load state from localStorage on initial render
  useEffect(() => {
    try {
        const savedStateJSON = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (savedStateJSON) {
            const savedState = JSON.parse(savedStateJSON);
            const initialHallState = createInitialInstallationState();
            const initialAtsState = createInitialInstallationState();
            
            // Deep merge to avoid errors if state shape changes
            if (savedState.hallAF) {
                setHallAF({ ...initialHallState, ...savedState.hallAF, fuels: { ...initialHallState.fuels, ...savedState.hallAF.fuels } });
            }
            if (savedState.ats) {
                 setAts({ ...initialAtsState, ...savedState.ats, fuels: { ...initialAtsState.fuels, ...savedState.ats.fuels } });
            }
        }
    } catch (error) {
        console.error("Could not load simulator state from localStorage", error);
        toast({ variant: "destructive", title: "Erreur", description: "Impossible de restaurer la session de simulation."});
    }
  }, [toast]);

  // Save state to localStorage on every change
  useEffect(() => {
    try {
        const stateToSave = JSON.stringify({ hallAF, ats });
        localStorage.setItem(LOCAL_STORAGE_KEY, stateToSave);
    } catch (error) {
        console.error("Could not save simulator state to localStorage", error);
    }
  }, [hallAF, ats]);


  const { globalIndicators } = useMixtureCalculations(hallAF, ats);

  const handleReset = () => {
    setHallAF(createInitialInstallationState());
    setAts(createInitialInstallationState());
    setOpenAccordion(null);
    try {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        toast({ title: "Réinitialisé", description: "La simulation a été réinitialisée." });
    } catch (error) {
        console.error("Could not remove simulator state from localStorage", error);
    }
  };

  const handleFlowRateChange = (setter: React.Dispatch<React.SetStateAction<InstallationState>>, value: string) => {
    const flowRate = parseFloat(value);
    setter(prev => ({ ...prev, flowRate: isNaN(flowRate) ? 0 : flowRate }));
  };

  const handleScenarioLoad = (scenario: MixtureScenario) => {
    const fullHallState = createInitialInstallationState();
    const fullAtsState = createInitialInstallationState();

    if (scenario.donnees_hall) {
        fullHallState.flowRate = scenario.donnees_hall.flowRate || 0;
        for (const fuel in fullHallState.fuels) {
            if (scenario.donnees_hall.fuels[fuel]) {
                fullHallState.fuels[fuel] = { ...fullHallState.fuels[fuel], ...scenario.donnees_hall.fuels[fuel] };
            }
        }
    }
    
    if (scenario.donnees_ats) {
        fullAtsState.flowRate = scenario.donnees_ats.flowRate || 0;
        for (const fuel in fullAtsState.fuels) {
            if (scenario.donnees_ats.fuels[fuel]) {
                fullAtsState.fuels[fuel] = { ...fullAtsState.fuels[fuel], ...scenario.donnees_ats.fuels[fuel] };
            }
        }
    }
    
    setHallAF(fullHallState);
    setAts(fullAtsState);
    toast({ title: "Succès", description: `Le scénario "${scenario.nom_scenario}" a été chargé.`});
  };
  
  const SaveScenarioDialog = () => {
    const [scenarioName, setScenarioName] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    const handleSave = async () => {
        if (!scenarioName.trim()) {
            toast({ variant: "destructive", title: "Erreur", description: "Veuillez donner un nom à votre scénario."});
            return;
        }
        setIsSaving(true);
        try {
            await saveMixtureScenario({
                nom_scenario: scenarioName,
                donnees_hall: hallAF,
                donnees_ats: ats,
            });
            toast({ title: "Succès", description: "Le scénario a été sauvegardé."});
            setIsOpen(false);
            setScenarioName("");
        } catch (error) {
            console.error("Error saving scenario:", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de sauvegarder le scénario." });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline"><Save className="mr-2 h-4 w-4" /> Sauvegarder le scénario</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Sauvegarder le Scénario de Simulation</DialogTitle>
                    <DialogDescription>
                        Donnez un nom à votre scénario pour le retrouver plus tard.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Label htmlFor="scenario-name">Nom du scénario</Label>
                    <Input id="scenario-name" value={scenarioName} onChange={e => setScenarioName(e.target.value)} placeholder="Ex: Scénario PCI Élevé" />
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="secondary">Annuler</Button></DialogClose>
                    <Button onClick={handleSave} disabled={isSaving}>{isSaving ? "Enregistrement..." : "Enregistrer"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
  };

  const LoadScenarioDialog = () => {
      const [scenarios, setScenarios] = useState<MixtureScenario[]>([]);
      const [isLoading, setIsLoading] = useState(false);
      const [isOpen, setIsOpen] = useState(false);

      const fetchScenarios = useCallback(async () => {
          setIsLoading(true);
          try {
              const fetchedScenarios = await getMixtureScenarios();
              setScenarios(fetchedScenarios);
          } catch(error) {
              console.error("Error fetching scenarios:", error);
              toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les scénarios." });
          } finally {
              setIsLoading(false);
          }
      }, [toast]);

      React.useEffect(() => {
        if (isOpen) {
            fetchScenarios();
        }
      }, [isOpen, fetchScenarios]);
      
      return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline"><Download className="mr-2 h-4 w-4" /> Charger un scénario</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Charger un Scénario</DialogTitle>
                    <DialogDescription>
                        Sélectionnez un scénario sauvegardé pour remplir les champs de simulation.
                    </DialogDescription>
                </DialogHeader>
                 <div className="py-4 max-h-[60vh] overflow-y-auto">
                    {isLoading ? <p>Chargement...</p> : (
                        <div className="space-y-2">
                            {scenarios.length > 0 ? scenarios.map(scenario => (
                                <div key={scenario.id} className="flex justify-between items-center p-3 border rounded-md">
                                    <div>
                                        <p className="font-semibold">{scenario.nom_scenario}</p>
                                        <p className="text-xs text-muted-foreground">
                                            Créé le {format(scenario.date_creation.toDate(), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                                        </p>
                                    </div>
                                    <DialogClose asChild>
                                        <Button size="sm" onClick={() => handleScenarioLoad(scenario)}>
                                            Charger
                                        </Button>
                                    </DialogClose>
                                </div>
                            )) : <p className="text-center text-muted-foreground">Aucun scénario sauvegardé.</p>}
                        </div>
                    )}
                 </div>
            </DialogContent>
        </Dialog>
      );
  }


  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 bg-gray-50">
      <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-800">Indicateurs Globaux (Simulation)</h1>
          </div>
          <div className="flex items-center gap-2">
            <LoadScenarioDialog />
            <SaveScenarioDialog />
            <Button onClick={handleReset} variant="outline">
                <RefreshCcw className="mr-2 h-4 w-4" />
                Réinitialiser
            </Button>
          </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <IndicatorCard title="Débit des AFs" value={globalIndicators.flow.toFixed(2)} unit="t/h" />
        <IndicatorCard title="PCI moy" value={globalIndicators.pci.toFixed(0)} unit="kcal/kg" />
        <IndicatorCard title="% Humidité moy" value={globalIndicators.humidity.toFixed(2)} unit="%" />
        <IndicatorCard title="% Cendres moy" value={globalIndicators.ash.toFixed(2)} unit="%" />
        <IndicatorCard title="% Chlorures" value={globalIndicators.chlorine.toFixed(3)} unit="%" />
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
            <FuelInputSimulator 
                installationState={hallAF} 
                setInstallationState={setHallAF} 
                installationName="hall"
                openAccordion={openAccordion}
                setOpenAccordion={setOpenAccordion}
            />
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
             <FuelInputSimulator 
                installationState={ats} 
                setInstallationState={setAts} 
                installationName="ats"
                openAccordion={openAccordion}
                setOpenAccordion={setOpenAccordion}
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
