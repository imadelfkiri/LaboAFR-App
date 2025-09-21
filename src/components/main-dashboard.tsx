

"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getLatestMixtureSession, type MixtureSession, getImpactAnalyses, type ImpactAnalysis, getLatestIndicatorData } from '@/lib/data';
import { Skeleton } from "@/components/ui/skeleton";
import { Droplets, Wind, Percent, BarChart, Thermometer } from 'lucide-react';
import { Card } from "@/components/ui/card";
import { KeyIndicatorCard } from './cards/KeyIndicatorCard';
import { FlowRateCard, FlowData } from './cards/FlowRateCard';
import { ImpactCard, ImpactData } from './cards/ImpactCard';

// Hook to read from localStorage without causing hydration issues
function usePersistentValue<T>(key: string, defaultValue: T): T {
    const [state, setState] = useState<T>(defaultValue);

    useEffect(() => {
        try {
            // Only run on client
            if (typeof window === 'undefined') {
                return;
            }
            const storedValue = localStorage.getItem(key);
            if (storedValue !== null) {
                setState(JSON.parse(storedValue));
            }
        } catch {
            // If parsing fails, stick with the default value
            setState(defaultValue);
        }
    }, [key]);
    
    return state;
}

// Simplified StatCard for local use
function StatCard({ label, value, icon: Icon, unit }: { label: string; value: string; icon: React.ElementType, unit?: string }) {
  return (
    <div className="rounded-2xl bg-brand-surface/60 border border-brand-line/60 p-4 shadow-soft">
      <div className="flex items-start justify-between">
        <span className="text-sm text-neutral-300">{label}</span>
        {Icon ? <div className="opacity-70"><Icon className="h-5 w-5"/></div> : null}
      </div>
      <div className="mt-2 text-3xl font-bold text-white">{value}<span className="text-lg text-muted-foreground ml-1">{unit}</span></div>
    </div>
  );
}

const formatNumber = (num: number | null | undefined, digits: number = 2) => {
    if (num === null || num === undefined || isNaN(num)) return '0.00';
    return num.toLocaleString('fr-FR', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
};

export function MainDashboard() {
    const [loading, setLoading] = useState(true);
    const [mixtureSession, setMixtureSession] = useState<MixtureSession | null>(null);
    const [latestImpact, setLatestImpact] = useState<ImpactAnalysis | null>(null);
    const [keyIndicators, setKeyIndicators] = useState<{ tsr: number; } | null>(null);
    const debitClinker = usePersistentValue<number>('debitClinker', 0);


    const fetchData = useCallback(async () => {
        try {
            const [sessionData, impactAnalyses, indicatorData] = await Promise.all([
                getLatestMixtureSession(),
                getImpactAnalyses(),
                getLatestIndicatorData()
            ]);
            setMixtureSession(sessionData);
            setLatestImpact(impactAnalyses.length > 0 ? impactAnalyses[0] : null);
            setKeyIndicators(indicatorData);
        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const mixtureIndicators = useMemo(() => {
        if (!mixtureSession?.globalIndicators) return null;
        const indicators = mixtureSession.globalIndicators;
        return [
            { label: "PCI", value: formatNumber(indicators.pci, 0), unit: "kcal/kg", icon: Thermometer },
            { label: "Chlorures", value: formatNumber(indicators.chlorine, 3), unit: "%", icon: Wind },
            { label: "Taux Pneus", value: formatNumber(indicators.tireRate, 2), unit: "%", icon: BarChart },
            { label: "Cendres", value: formatNumber(indicators.ash, 2), unit: "%", icon: Percent },
            { label: "H₂O", value: formatNumber(indicators.humidity, 2), unit: "%", icon: Droplets },
        ];
    }, [mixtureSession]);
    
    const flowData: FlowData[] | null = useMemo(() => {
        if (!mixtureSession) return null;
        return [
          { label: 'AF', value: (mixtureSession.hallAF?.flowRate || 0) + (mixtureSession.ats?.flowRate || 0) },
          { label: 'GO1', value: mixtureSession.directInputs?.['Grignons GO1']?.flowRate || 0 },
          { label: 'GO2', value: mixtureSession.directInputs?.['Grignons GO2']?.flowRate || 0 },
          { label: 'Pet-Coke Preca', value: mixtureSession.directInputs?.['Pet-Coke Preca']?.flowRate || 0 },
          { label: 'Pet-Coke Tuyère', value: mixtureSession.directInputs?.['Pet-Coke Tuyere']?.flowRate || 0 },
        ];
    }, [mixtureSession]);

    const impactData: ImpactData[] | null = useMemo(() => {
        if (!latestImpact) return null;
        const { results } = latestImpact;
        const delta = (a?: number | null, b?: number | null) => (a ?? 0) - (b ?? 0);
        return [
            { label: "% Fe2O3", value: delta(results.clinkerWithAsh.fe2o3, results.clinkerWithoutAsh.fe2o3) },
            { label: "LSF", value: delta(results.modulesAvec.lsf, results.modulesSans.lsf) },
            { label: "C3S", value: delta(results.c3sAvec, results.c3sSans) },
            { label: "MS", value: delta(results.modulesAvec.ms, results.modulesSans.ms) },
            { label: "AF", value: delta(results.modulesAvec.af, results.modulesSans.af) },
        ];
    }, [latestImpact]);

    const calorificConsumption = useMemo(() => {
        if (!mixtureSession || !debitClinker || debitClinker === 0 || !mixtureSession.availableFuels) return 0;
        
        const getPci = (fuelName: string) => mixtureSession.availableFuels[fuelName]?.pci_brut || 0;
        
        const getPetCokePci = () => {
             const pci = getPci('Pet Coke') || getPci('Pet-Coke') || getPci('Pet-Coke Preca') || getPci('Pet-Coke Tuyere');
             return pci;
        }

        let afEnergyWeightedSum = 0;

        const processInstallation = (installation: any) => {
             if (!installation?.fuels || !installation.flowRate || installation.flowRate === 0) return;
             
             let installationTotalWeight = 0;
             const fuelWeights: Record<string, number> = {};

             for (const [fuel, data] of Object.entries(installation.fuels as Record<string, {buckets: number}>)) {
                 const weight = (data.buckets || 0) * (mixtureSession.availableFuels[fuel]?.poids_godet || 1.5);
                 installationTotalWeight += weight;
                 fuelWeights[fuel] = weight;
             }
             
             if(installationTotalWeight === 0) return;

             for (const [fuel, data] of Object.entries(installation.fuels as Record<string, {buckets: number}>)) {
                if (fuel.toLowerCase().includes('grignons') || fuel.toLowerCase().includes('pet coke')) continue;
                
                const pci = getPci(fuel);
                const weight = fuelWeights[fuel] || 0;
                
                const proportion = weight / installationTotalWeight;
                const weightedEnergy = pci * proportion * installation.flowRate;
                
                afEnergyWeightedSum += weightedEnergy;
             }
        }
        
        processInstallation(mixtureSession.hallAF);
        processInstallation(mixtureSession.ats);
        
        const energyAFs = afEnergyWeightedSum / 1000;

        const grignonsFlow = (mixtureSession.directInputs?.['Grignons GO1']?.flowRate || 0) + (mixtureSession.directInputs?.['Grignons GO2']?.flowRate || 0);
        const energyGrignons = grignonsFlow * getPci('Grignons') / 1000;

        const petCokeFlow = (mixtureSession.directInputs?.['Pet-Coke Preca']?.flowRate || 0) + (mixtureSession.directInputs?.['Pet-Coke Tuyere']?.flowRate || 0);
        const energyPetCoke = petCokeFlow * getPetCokePci() / 1000;

        const energyTotalGcal = energyAFs + energyGrignons + energyPetCoke;

        return debitClinker > 0 
            ? (energyTotalGcal * 1000000) / (debitClinker * 1000)
            : 0;
    }, [mixtureSession, debitClinker]);


    if (loading) {
        return (
            <div className="p-4 md:p-6 space-y-6">
                <Skeleton className="h-32 w-full" />
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <Skeleton className="h-64" />
                    <Skeleton className="h-64" />
                    <Skeleton className="h-64" />
                </div>
            </div>
        );
    }
    
    return (
        <div className="p-4 md:p-6 space-y-6">
             <section>
                <h2 className="text-xl font-semibold text-white mb-3">Indicateurs du Mélange Actuel</h2>
                {mixtureIndicators ? (
                    <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                       {mixtureIndicators.map(ind => <StatCard key={ind.label} {...ind} />)}
                    </div>
                ) : (
                    <Card className="flex items-center justify-center h-24 bg-brand-surface border-brand-line">
                        <p className="text-muted-foreground">Aucune session de mélange enregistrée.</p>
                    </Card>
                )}
            </section>
            
            <section className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-1 space-y-6">
                    <KeyIndicatorCard tsr={keyIndicators?.tsr} consumption={calorificConsumption} />
                    <FlowRateCard title="Débits Actuels" flows={flowData} />
                </div>

                <div className="lg:col-span-2">
                    <ImpactCard title="Impact sur le Clinker" data={impactData} lastUpdate={latestImpact?.createdAt.toDate()} />
                </div>
            </section>
        </div>
    );
}
