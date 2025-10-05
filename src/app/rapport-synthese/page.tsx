
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getLatestMixtureSession, type MixtureSession, getImpactAnalyses, type ImpactAnalysis, getLatestIndicatorData, getStocks, Stock } from '@/lib/data';
import { Skeleton } from "@/components/ui/skeleton";
import { Droplets, Wind, Percent, BarChart, Thermometer, Flame, TrendingUp, Activity, Archive, BookOpen, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { KeyIndicatorCard } from '@/components/cards/KeyIndicatorCard';
import { FlowRateCard, FlowData } from '@/components/cards/FlowRateCard';
import { ImpactCard, ImpactData } from '@/components/cards/ImpactCard';
import { Bar, BarChart as RechartsBarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Textarea } from '@/components/ui/textarea';

// Hook to read from localStorage without causing hydration issues
function usePersistentValue<T>(key: string, defaultValue: T): T {
    const [state, setState] = useState<T>(defaultValue);

    useEffect(() => {
        try {
            if (typeof window === 'undefined') {
                return;
            }
            const storedValue = localStorage.getItem(key);
            if (storedValue !== null) {
                setState(JSON.parse(storedValue));
            }
        } catch {
            setState(defaultValue);
        }
    }, [key]);
    
    return state;
}

const formatNumber = (num: number | null | undefined, digits: number = 2) => {
    if (num === null || num === undefined || isNaN(num)) return '0.00';
    return num.toLocaleString('fr-FR', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
};


export default function RapportSynthesePage() {
    const [loading, setLoading] = useState(true);
    const [mixtureSession, setMixtureSession] = useState<MixtureSession | null>(null);
    const [latestImpact, setLatestImpact] = useState<ImpactAnalysis | null>(null);
    const [keyIndicators, setKeyIndicators] = useState<{ tsr: number; } | null>(null);
    const [stocks, setStocks] = useState<Stock[]>([]);
    const [comments, setComments] = usePersistentValue<string>('rapportSynthese_comments', '');
    const debitClinker = usePersistentValue<number>('debitClinker', 0);


    const fetchData = useCallback(async () => {
        try {
            const [sessionData, impactAnalyses, indicatorData, stockData] = await Promise.all([
                getLatestMixtureSession(),
                getImpactAnalyses(),
                getLatestIndicatorData(),
                getStocks(),
            ]);
            setMixtureSession(sessionData);
            setLatestImpact(impactAnalyses.length > 0 ? impactAnalyses[0] : null);
            setKeyIndicators(indicatorData);
            setStocks(stockData);
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
            { label: "PCI", value: formatNumber(indicators.pci, 0), unit: "kcal/kg" },
            { label: "Chlorures", value: formatNumber(indicators.chlorine, 3), unit: "%" },
            { label: "Taux Pneus", value: formatNumber(indicators.tireRate, 2), unit: "%" },
            { label: "Cendres", value: formatNumber(indicators.ash, 2), unit: "%" },
            { label: "H₂O", value: formatNumber(indicators.humidity, 2), unit: "%" },
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
        const getPetCokePci = () => getPci('Pet Coke') || getPci('Pet-Coke') || getPci('Pet-Coke Preca') || getPci('Pet-Coke Tuyere');

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

    const stockChartData = useMemo(() => {
        if (!stocks || stocks.length === 0) return [];
        return stocks
            .filter(s => s.stock_actuel_tonnes > 0)
            .map(s => ({
                name: s.nom_combustible,
                tonnage: s.stock_actuel_tonnes
            }))
            .sort((a, b) => b.tonnage - a.tonnage);
    }, [stocks]);


    if (loading) {
        return (
            <div className="p-4 md:p-6 lg:p-8 space-y-6">
                <Skeleton className="h-10 w-1/3" />
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <Skeleton className="h-64" />
                    <Skeleton className="h-64" />
                    <Skeleton className="h-64" />
                </div>
                 <Skeleton className="h-80 w-full" />
            </div>
        );
    }
    
    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                    <BookOpen className="h-8 w-8" />
                    Rapport de Synthèse
                </h1>
                {mixtureSession?.timestamp && (
                    <p className="text-sm text-muted-foreground">
                        Données de la session du {format(mixtureSession.timestamp.toDate(), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                    </p>
                )}
            </div>
            
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-6">
                    <KeyIndicatorCard tsr={keyIndicators?.tsr} consumption={calorificConsumption} />
                    <FlowRateCard title="Débits Actuels" flows={flowData} />
                </div>

                <div className="lg:col-span-2 space-y-6">
                     <Card>
                        <CardHeader><CardTitle className="flex items-center gap-2"><Flame /> Indicateurs du Mélange</CardTitle></CardHeader>
                        <CardContent className="grid gap-4 grid-cols-2 md:grid-cols-3">
                             {mixtureIndicators ? mixtureIndicators.map(ind => (
                                <div key={ind.label} className="p-3 rounded-lg bg-brand-muted/70">
                                    <p className="text-xs text-muted-foreground">{ind.label}</p>
                                    <p className="text-xl font-bold">{ind.value}<span className="text-xs ml-1">{ind.unit}</span></p>
                                </div>
                            )) : <p className="col-span-full text-center text-muted-foreground p-4">Aucune session de mélange.</p>}
                        </CardContent>
                    </Card>
                    <ImpactCard title="Impact sur le Clinker" data={impactData} lastUpdate={latestImpact?.createdAt.toDate()} />
                </div>
            </section>
            
            <section className="grid gap-6 lg:grid-cols-2">
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Archive /> Répartition du Stock</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={350}>
                            {stockChartData.length > 0 ? (
                                <RechartsBarChart data={stockChartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                                    <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} width={100} />
                                    <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} contentStyle={{background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))'}}/>
                                    <Bar dataKey="tonnage" name="Tonnage" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                                </RechartsBarChart>
                            ) : (
                                <div className="flex items-center justify-center h-full text-muted-foreground">Aucune donnée de stock.</div>
                            )}
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><MessageSquare /> Commentaires</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Textarea 
                            placeholder="Écrivez vos commentaires et analyses ici..."
                            className="h-[300px] text-base"
                            value={comments}
                            onChange={(e) => setComments(e.target.value)}
                        />
                    </CardContent>
                 </Card>
            </section>
        </div>
    );
}
