
"use client";

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { RefreshCcw, Save, Download, Edit, Trash2 } from 'lucide-react';

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

import { useToast } from '@/hooks/use-toast';
import { saveMixtureScenario, getMixtureScenarios, deleteMixtureScenario, updateMixtureScenario, type MixtureScenario, getFuelData, type FuelData, getUniqueFuelTypes } from '@/lib/data';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';


const LOCAL_STORAGE_KEY = 'mixtureSimulatorState';

interface FuelAnalysis {
    buckets: number;
    pci: number;
    humidity: number;
    chlorine: number;
    ash: number;
}

interface InstallationState {
  flowRate: number;
  fuels: Record<string, FuelAnalysis>;
}

const createInitialFuelState = (fuelTypes: string[]): Record<string, FuelAnalysis> => {
    return fuelTypes.reduce((acc, fuelType) => {
        acc[fuelType] = { buckets: 0, pci: 0, humidity: 0, chlorine: 0, ash: 0 };
        return acc;
    }, {} as Record<string, FuelAnalysis>);
};

const createInitialInstallationState = (fuelTypes: string[]): InstallationState => ({
    flowRate: 0,
    fuels: createInitialFuelState(fuelTypes),
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

function useMixtureCalculations(hallAF: InstallationState, ats: InstallationState, fuelData: Record<string, FuelData>) {
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
            const baseFuelData = fuelData[fuelName];

            if (!fuelInput || fuelInput.buckets <= 0 || !baseFuelData) {
                continue;
            }
            
            const poidsGodet = baseFuelData.poids_godet > 0 ? baseFuelData.poids_godet : 1.5; // Default 1.5 tonnes if not set
            const weight = fuelInput.buckets * poidsGodet;
            totalWeight += weight;

            if (fuelName.toLowerCase().includes('pneu')) {
                tempTotalTireWeight += weight;
            }
            
            tempTotalPci += weight * (fuelInput.pci || 0);
            tempTotalHumidity += weight * (fuelInput.humidity || 0);
            tempTotalAsh += weight * (fuelInput.ash || 0);
            tempTotalChlorine += weight * (fuelInput.chlorine || 0);
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
    const humidity = weightedAvg(hallIndicators.humidity, flowHall, atsIndicators.humidity, flowAts);
    const ash = weightedAvg(hallIndicators.ash, flowHall, atsIndicators.ash, flowAts);
    const chlorine = weightedAvg(hallIndicators.chlorine, flowHall, atsIndicators.chlorine, flowAts);
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
  }, [hallAF, ats, fuelData]);
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
    
    const fuelTypes = Object.keys(installationState.fuels).sort();

    return (
        <div className="space-y-4">
        {fuelTypes.map(fuelName => {
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
                            <div className="flex items-center gap-2">
                                <Label htmlFor={`${installationName}-${fuelName}-pci`} className="flex-1 text-sm text-muted-foreground">PCI (kcal/kg)</Label>
                                <Input
                                    id={`${installationName}-${fuelName}-pci`}
                                    type="number"
                                    placeholder="0"
                                    className="w-24 h-8"
                                    value={installationState.fuels[fuelName]?.pci || ''}
                                    onChange={(e) => handleInputChange(fuelName, 'pci', e.target.value)}
                                    min="0"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <Label htmlFor={`${installationName}-${fuelName}-humidity`} className="flex-1 text-sm text-muted-foreground">Humidité (%)</Label>
                                <Input
                                    id={`${installationName}-${fuelName}-humidity`}
                                    type="number"
                                    placeholder="0"
                                    className="w-24 h-8"
                                    value={installationState.fuels[fuelName]?.humidity || ''}
                                    onChange={(e) => handleInputChange(fuelName, 'humidity', e.target.value)}
                                    min="0"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <Label htmlFor={`${installationName}-${fuelName}-chlorine`} className="flex-1 text-sm text-muted-foreground">Chlorures (%)</Label>
                                <Input
                                    id={`${installationName}-${fuelName}-chlorine`}
                                    type="number"
                                    placeholder="0"
                                    className="w-24 h-8"
                                    value={installationState.fuels[fuelName]?.chlorine || ''}
                                    onChange={(e) => handleInputChange(fuelName, 'chlorine', e.target.value)}
                                    min="0"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <Label htmlFor={`${installationName}-${fuelName}-ash`} className="flex-1 text-sm text-muted-foreground">Cendres (%)</Label>
                                <Input
                                    id={`${installationName}-${fuelName}-ash`}
                                    type="number"
                                    placeholder="0"
                                    className="w-24 h-8"
                                    value={installationState.fuels[fuelName]?.ash || ''}
                                    onChange={(e) => handleInputChange(fuelName, 'ash', e.target.value)}
                                    min="0"
                                />
                            </div>
                        </div>
                    </CollapsibleContent>
                </Collapsible>
            )
        })}
        </div>
    );
};

export function MixtureSimulator() {
  const [fuelTypes, setFuelTypes] = useState<string[]>([]);
  const [hallAF, setHallAF] = useState<InstallationState>(createInitialInstallationState([]));
  const [ats, setAts] = useState<InstallationState>(createInitialInstallationState([]));
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);
  const [fuelData, setFuelData] = useState<Record<string, FuelData>>({});
  const { toast } = useToast();

  useEffect(() => {
    const fetchMasterData = async () => {
        try {
            const [allFuelTypes, allFuelData] = await Promise.all([
                getUniqueFuelTypes(),
                getFuelData()
            ]);

            setFuelTypes(allFuelTypes);
            
            const fuelDataMap = allFuelData.reduce((acc, fd) => {
                acc[fd.nom_combustible] = fd;
                return acc;
            }, {} as Record<string, FuelData>);
            setFuelData(fuelDataMap);

            const initialHallState = createInitialInstallationState(allFuelTypes);
            const initialAtsState = createInitialInstallationState(allFuelTypes);
            
            setHallAF(initialHallState);
            setAts(initialAtsState);

            // Load from localStorage after setting initial state based on DB
             try {
                const savedStateJSON = localStorage.getItem(LOCAL_STORAGE_KEY);
                if (savedStateJSON) {
                    const savedState = JSON.parse(savedStateJSON);
                    if (savedState.hallAF) {
                        setHallAF(prev => ({ ...prev, ...savedState.hallAF, fuels: { ...prev.fuels, ...savedState.hallAF.fuels } }));
                    }
                    if (savedState.ats) {
                        setAts(prev => ({ ...prev, ...savedState.ats, fuels: { ...prev.fuels, ...savedState.ats.fuels } }));
                    }
                }
            } catch (error) {
                console.error("Could not load simulator state from localStorage", error);
                toast({ variant: "destructive", title: "Erreur", description: "Impossible de restaurer la session de simulation."});
            }

        } catch (error) {
            console.error("Could not load master data", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les données de référence."});
        }
    };
    fetchMasterData();
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


  const { globalIndicators } = useMixtureCalculations(hallAF, ats, fuelData);

  const handleReset = () => {
    setHallAF(createInitialInstallationState(fuelTypes));
    setAts(createInitialInstallationState(fuelTypes));
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
    const fullHallState = createInitialInstallationState(fuelTypes);
    const fullAtsState = createInitialInstallationState(fuelTypes);

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

      const [editingScenario, setEditingScenario] = useState<MixtureScenario | null>(null);
      const [newScenarioName, setNewScenarioName] = useState("");
      
      const [deletingScenario, setDeletingScenario] = useState<MixtureScenario | null>(null);
      
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

      useEffect(() => {
        if (isOpen) {
            fetchScenarios();
        }
      }, [isOpen, fetchScenarios]);

      const handleStartEdit = (scenario: MixtureScenario) => {
        setEditingScenario(scenario);
        setNewScenarioName(scenario.nom_scenario);
      };

      const handleConfirmEdit = async () => {
        if (!editingScenario || !newScenarioName.trim()) return;
        try {
            await updateMixtureScenario(editingScenario.id, { nom_scenario: newScenarioName });
            toast({ title: "Succès", description: "Le scénario a été renommé."});
            setEditingScenario(null);
            fetchScenarios();
        } catch (error) {
            console.error("Error updating scenario:", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de renommer le scénario." });
        }
      };
      
      const handleConfirmDelete = async () => {
        if (!deletingScenario) return;
        try {
            await deleteMixtureScenario(deletingScenario.id);
            toast({ title: "Succès", description: `Le scénario "${deletingScenario.nom_scenario}" a été supprimé.` });
            setDeletingScenario(null);
            fetchScenarios();
        } catch (error) {
            console.error("Error deleting scenario:", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de supprimer le scénario." });
        }
      };

      return (
        <>
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
                                        <div className="flex items-center gap-1">
                                            <Button variant="ghost" size="icon" onClick={() => handleStartEdit(scenario)}>
                                                <Edit className="h-4 w-4 text-muted-foreground" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => setDeletingScenario(scenario)}>
                                                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                                            </Button>
                                            <DialogClose asChild>
                                                <Button size="sm" onClick={() => handleScenarioLoad(scenario)}>
                                                    Charger
                                                </Button>
                                            </DialogClose>
                                        </div>
                                    </div>
                                )) : <p className="text-center text-muted-foreground">Aucun scénario sauvegardé.</p>}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={!!editingScenario} onOpenChange={(open) => !open && setEditingScenario(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Renommer le scénario</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <Label htmlFor="edit-scenario-name">Nouveau nom</Label>
                        <Input id="edit-scenario-name" value={newScenarioName} onChange={(e) => setNewScenarioName(e.target.value)} />
                    </div>
                    <DialogFooter>
                        <Button variant="secondary" onClick={() => setEditingScenario(null)}>Annuler</Button>
                        <Button onClick={handleConfirmEdit}>Enregistrer</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!deletingScenario} onOpenChange={(open) => !open && setDeletingScenario(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Cette action est irréversible et supprimera définitivement le scénario "{deletingScenario?.nom_scenario}".
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive hover:bg-destructive/90">Supprimer</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
      );
  }


  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 bg-gray-50">
      <div className="sticky top-0 z-10 bg-gray-50 py-4">
        <div className="flex items-center justify-between mb-4">
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <IndicatorCard title="Débit des AFs" value={globalIndicators.flow.toFixed(2)} unit="t/h" />
          <IndicatorCard title="PCI moy" value={globalIndicators.pci.toFixed(0)} unit="kcal/kg" />
          <IndicatorCard title="% Humidité moy" value={globalIndicators.humidity.toFixed(2)} unit="%" />
          <IndicatorCard title="% Cendres moy" value={globalIndicators.ash.toFixed(2)} unit="%" />
          <IndicatorCard title="% Chlorures" value={globalIndicators.chlorine.toFixed(3)} unit="%" />
          <IndicatorCard title="Taux de pneus" value={globalIndicators.tireRate.toFixed(2)} unit="%" />
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

