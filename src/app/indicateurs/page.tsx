

"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { getLatestMixtureSession, type MixtureSession } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from '@/components/cards/StatCard';
import { Flame, Recycle, Leaf, TrendingUp } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const formatNumber = (num: number | null | undefined, digits: number = 2) => {
    if (num === null || num === undefined || isNaN(num)) return '0,00';
    return num.toLocaleString('fr-FR', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
};

export default function IndicateursPage() {
    const [loading, setLoading] = useState(true);
    const [session, setSession] = useState<MixtureSession | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        const fetchSession = async () => {
            setLoading(true);
            try {
                const sessionData = await getLatestMixtureSession();
                if (!sessionData) {
                    toast({
                        variant: "destructive",
                        title: "Aucune session de mélange trouvée",
                        description: "Veuillez enregistrer une session dans 'Calcul de Mélange' pour voir les indicateurs."
                    });
                }
                setSession(sessionData);
            } catch (error) {
                console.error("Error fetching latest mixture session:", error);
                toast({
                    variant: "destructive",
                    title: "Erreur",
                    description: "Impossible de charger les données de la dernière session."
                });
            } finally {
                setLoading(false);
            }
        };
        fetchSession();
    }, [toast]);

    const substitutionData = useMemo(() => {
        if (!session?.availableFuels) return null;

        const getPci = (fuelName: string) => session.availableFuels[fuelName]?.pci_brut || 0;
        
        const getPetCokePci = () => {
             const pci = getPci('Pet Coke') || getPci('Pet-Coke Preca') || getPci('Pet-Coke Tuyere');
             return pci;
        }

        // --- Énergie des AFs (Hall + ATS) ---
        let afEnergyWeightedSum = 0;
        let afTotalFlow = 0;

        const processInstallation = (installation: any) => {
             if (!installation?.fuels || !installation.flowRate || installation.flowRate === 0) return;
             
             let installationTotalWeight = 0;
             const fuelWeights: Record<string, number> = {};

             // First, calculate total weight in the installation to find proportions
             for (const [fuel, data] of Object.entries(installation.fuels as Record<string, {buckets: number}>)) {
                 const weight = (data.buckets || 0) * (session.availableFuels[fuel]?.poids_godet || 1.5);
                 installationTotalWeight += weight;
                 fuelWeights[fuel] = weight;
             }
             
             if(installationTotalWeight === 0) return;

             afTotalFlow += installation.flowRate;
             
             // Now, calculate the weighted energy contribution
             for (const [fuel, data] of Object.entries(installation.fuels as Record<string, {buckets: number}>)) {
                if (fuel.toLowerCase().includes('grignons') || fuel.toLowerCase().includes('pet coke')) continue;
                
                const pci = getPci(fuel);
                const weight = fuelWeights[fuel] || 0;
                
                const proportion = weight / installationTotalWeight;
                const weightedEnergy = pci * proportion * installation.flowRate;
                
                afEnergyWeightedSum += weightedEnergy;
             }
        }
        
        processInstallation(session.hallAF);
        processInstallation(session.ats);
        
        const energyAFs = afEnergyWeightedSum / 1000; // to Gcal
        const afPci = afTotalFlow > 0 ? (energyAFs * 1000) / afTotalFlow : 0;

        // --- Énergie des Grignons ---
        const grignonsFlow = (session.directInputs?.['Grignons GO1']?.flowRate || 0) + (session.directInputs?.['Grignons GO2']?.flowRate || 0);
        const pciGrignons = getPci('Grignons');
        const energyGrignons = grignonsFlow * pciGrignons / 1000;

        // --- Énergie du Pet Coke ---
        const petCokePrecaFlow = session.directInputs?.['Pet-Coke Preca']?.flowRate || 0;
        const petCokeTuyereFlow = session.directInputs?.['Pet-Coke Tuyere']?.flowRate || 0;
        const petCokeFlow = petCokePrecaFlow + petCokeTuyereFlow;
        const pciPetCoke = getPetCokePci();
        const energyPetCoke = petCokeFlow * pciPetCoke / 1000;

        const energyTotal = energyAFs + energyGrignons + energyPetCoke;
        const energyAlternatives = energyAFs + energyGrignons;

        const substitutionRate = energyTotal > 0 ? (energyAlternatives / energyTotal) * 100 : 0;
        
        return {
            substitutionRate,
            energyAFs,
            energyGrignons,
            energyPetCoke,
            energyTotal,
            afFlow: afTotalFlow,
            grignonsFlow,
            petCokeFlow,
            afPci,
            pciGrignons,
            pciPetCoke,
        };
    }, [session]);

    if (loading) {
        return (
            <div className="container mx-auto p-4 md:p-8 space-y-6">
                 <Skeleton className="h-10 w-1/2" />
                 <Skeleton className="h-40 w-full" />
                 <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    if (!session || !substitutionData) {
         return (
            <div className="container mx-auto p-4 md:p-8">
                <Card className="text-center p-8">
                    <CardTitle>Aucune Donnée Disponible</CardTitle>
                    <CardDescription className="mt-2">
                        Veuillez enregistrer une session de mélange pour calculer le taux de substitution.
                    </CardDescription>
                </Card>
            </div>
        );
    }
  
  return (
    <div className="container mx-auto p-4 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Taux de Substitution Énergétique</h1>
            {session.timestamp && (
                <p className="text-sm text-muted-foreground">
                    Basé sur la session du {format(session.timestamp.toDate(), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                </p>
            )}
        </div>

        <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                 <p className="text-lg font-medium text-primary">Taux de Substitution Actuel</p>
                 <p className="text-7xl font-bold tracking-tighter text-white">
                    {formatNumber(substitutionData.substitutionRate, 2)}<span className="text-5xl text-primary/80">%</span>
                 </p>
            </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard label="Énergie des Combustibles Alternatifs (AFs)" value={`${formatNumber(substitutionData.energyAFs)} Gcal/h`} icon={<Recycle className="text-green-400"/>} hint={`${formatNumber(substitutionData.afFlow)} t/h @ ${formatNumber(substitutionData.afPci, 0)} kcal/kg`}/>
            <StatCard label="Énergie des Grignons" value={`${formatNumber(substitutionData.energyGrignons)} Gcal/h`} icon={<Leaf className="text-yellow-400"/>} hint={`${formatNumber(substitutionData.grignonsFlow)} t/h @ ${formatNumber(substitutionData.pciGrignons, 0)} kcal/kg`} />
            <StatCard label="Énergie du Pet Coke (Fossile)" value={`${formatNumber(substitutionData.energyPetCoke)} Gcal/h`} icon={<Flame className="text-red-400"/>} hint={`${formatNumber(substitutionData.petCokeFlow)} t/h @ ${formatNumber(substitutionData.pciPetCoke, 0)} kcal/kg`} />
        </div>

        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><TrendingUp /> Bilan Énergétique Détaillé</CardTitle>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Source d'Énergie</TableHead>
                            <TableHead className="text-right">Débit (t/h)</TableHead>
                            <TableHead className="text-right">PCI (kcal/kg)</TableHead>
                            <TableHead className="text-right">Apport Énergétique (Gcal/h)</TableHead>
                            <TableHead className="text-right">Contribution (%)</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow className="font-medium">
                            <TableCell>Combustibles Alternatifs (AFs)</TableCell>
                            <TableCell className="text-right">{formatNumber(substitutionData.afFlow)}</TableCell>
                            <TableCell className="text-right">{formatNumber(substitutionData.afPci, 0)}</TableCell>
                            <TableCell className="text-right">{formatNumber(substitutionData.energyAFs)}</TableCell>
                            <TableCell className="text-right">{formatNumber(substitutionData.energyTotal > 0 ? (substitutionData.energyAFs / substitutionData.energyTotal) * 100 : 0)}%</TableCell>
                        </TableRow>
                         <TableRow className="font-medium">
                            <TableCell>Grignons d'Olive</TableCell>
                            <TableCell className="text-right">{formatNumber(substitutionData.grignonsFlow)}</TableCell>
                            <TableCell className="text-right">{formatNumber(substitutionData.pciGrignons, 0)}</TableCell>
                            <TableCell className="text-right">{formatNumber(substitutionData.energyGrignons)}</TableCell>
                             <TableCell className="text-right">{formatNumber(substitutionData.energyTotal > 0 ? (substitutionData.energyGrignons / substitutionData.energyTotal) * 100 : 0)}%</TableCell>
                        </TableRow>
                        <TableRow className="font-medium">
                            <TableCell>Pet Coke (Fossile)</TableCell>
                            <TableCell className="text-right">{formatNumber(substitutionData.petCokeFlow)}</TableCell>
                            <TableCell className="text-right">{formatNumber(substitutionData.pciPetCoke, 0)}</TableCell>
                            <TableCell className="text-right">{formatNumber(substitutionData.energyPetCoke)}</TableCell>
                            <TableCell className="text-right">{formatNumber(substitutionData.energyTotal > 0 ? (substitutionData.energyPetCoke / substitutionData.energyTotal) * 100 : 0)}%</TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    </div>
  );
}
