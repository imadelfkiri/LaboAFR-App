

"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Wind, FlaskConical, AlertTriangle, CheckCircle, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/auth-provider';
import { saveBilanClS, getLatestBilanClS, BilanClSData } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

// --- Type Definitions ---

export interface BilanInput {
    debit_farine: number;
    cl_farine_pct: number;
    s_farine_pct: number;
    cl_poussieres_pct: number; // Conserve pour affichage mais n'est plus dans les calculs d'entrée
    s_poussieres_pct: number; // Conserve pour affichage mais n'est plus dans les calculs d'entrée
    cl_afr_pct: number;
    s_afr_pct: number;
    debit_afr: number;
    cl_petcoke_pct: number;
    s_petcoke_pct: number;
    debit_petcoke: number;
    hcl_emission_mg: number;
    so2_emission_mg: number;
    debit_gaz_nm3: number;
    cl_clinker_pct: number;
    s_clinker_pct: number;
}

// --- Initial State ---

const initialInputs: BilanInput = {
    debit_farine: 180,
    cl_farine_pct: 0.006,
    s_farine_pct: 0.15,
    cl_poussieres_pct: 0.04,
    s_poussieres_pct: 0.06,
    cl_afr_pct: 0.25,
    s_afr_pct: 0.7,
    debit_afr: 2,
    cl_petcoke_pct: 0.02,
    s_petcoke_pct: 5.0,
    debit_petcoke: 5,
    hcl_emission_mg: 50,
    so2_emission_mg: 150,
    debit_gaz_nm3: 250000,
    cl_clinker_pct: 0.015,
    s_clinker_pct: 0.8,
};

// --- Calculation Hook ---

const useBilanCalculations = (inputs: BilanInput) => {
    return useMemo(() => {
        const {
            debit_farine, cl_farine_pct, s_farine_pct,
            cl_afr_pct, s_afr_pct, debit_afr, cl_petcoke_pct, s_petcoke_pct, debit_petcoke,
            hcl_emission_mg, so2_emission_mg, debit_gaz_nm3,
            cl_clinker_pct, s_clinker_pct
        } = inputs;

        const debit_clinker = debit_farine * 0.6;
        const prod_clinker_jour = debit_clinker * 24;

        if (debit_clinker <= 0) return { bilan: {}, interpretation: { message: 'Débit clinker invalide.', color: 'bg-yellow-900/40 border-yellow-400 text-yellow-300' } };

        // --- 1. Entrées en g/t clinker
        const cl_farine_g = cl_farine_pct * 10000 * (debit_farine / debit_clinker);
        const s_farine_g = s_farine_pct * 10000 * (debit_farine / debit_clinker);

        const cl_afr_g = cl_afr_pct * 10000 * (debit_afr / debit_clinker);
        const s_afr_g = s_afr_pct * 10000 * (debit_afr / debit_clinker);
        const cl_petcoke_g = cl_petcoke_pct * 10000 * (debit_petcoke / debit_clinker);
        const s_petcoke_g = s_petcoke_pct * 10000 * (debit_petcoke / debit_clinker);
        
        const cl_entree = cl_farine_g + cl_afr_g + cl_petcoke_g;
        const s_entree = s_farine_g + s_afr_g + s_petcoke_g;

        // --- 2. Sorties en g/t clinker
        // Sorties gazeuses
        const hcl_flux_g_h = hcl_emission_mg * debit_gaz_nm3 / 1000;
        const so2_flux_g_h = so2_emission_mg * debit_gaz_nm3 / 1000;
        const cl_flux_g_h = hcl_flux_g_h * (35.5 / 36.5);
        const s_flux_g_h = so2_flux_g_h * (32 / 64);
        const cl_gaz_g = cl_flux_g_h / debit_clinker;
        const s_gaz_g = s_flux_g_h / debit_clinker;
        
        // Sorties clinker
        const cl_clinker_g = cl_clinker_pct * 10000;
        const s_clinker_g = s_clinker_pct * 10000;

        const cl_sortie = cl_gaz_g + cl_clinker_g;
        const s_sortie = s_gaz_g + s_clinker_g;

        // --- 3. Accumulation (Cycle Interne)
        const accum_cl = cl_entree - cl_sortie;
        const accum_s = s_entree - s_sortie;

        // --- 4. Rapport S/Cl
        const rapport_s_cl = cl_entree > 0 ? s_entree / cl_entree : Infinity;

        // --- 5. Valeurs en kg/h
        const cl_entree_kg_h = cl_entree * debit_clinker / 1000;
        const s_entree_kg_h = s_entree * debit_clinker / 1000;
        const accum_cl_kg_h = accum_cl * debit_clinker / 1000;
        const accum_s_kg_h = accum_s * debit_clinker / 1000;

        // --- Interpretation AI
        let message = '';
        let color = '';
        if (rapport_s_cl < 5) {
            message = "⚠️ Rapport S/Cl faible : excès de chlore, risque de dépôts cyclones.";
            color = 'bg-red-900/40 border-red-500 text-red-300';
        } else if (rapport_s_cl < 8) {
            message = "⚠️ Zone de vigilance : tendance à l'instabilité Cl, surveiller AFR riches en PVC.";
            color = 'bg-yellow-900/40 border-yellow-400 text-yellow-300';
        } else if (rapport_s_cl <= 12) {
            message = "✅ Procédé stable : bon équilibre soufre/chlore.";
            color = 'bg-green-900/40 border-green-500 text-green-300';
        } else if (rapport_s_cl <= 15) {
            message = "⚠️ Rapport élevé : excès de soufre, surveiller SO₃ clinker.";
            color = 'bg-yellow-900/40 border-yellow-400 text-yellow-300';
        } else {
            message = "🔴 Déséquilibre marqué : excès de soufre, risque d’enrichissement SO₃ et corrosion.";
            color = 'bg-red-900/40 border-red-500 text-red-300';
        }


        return {
            bilan: { cl_entree, s_entree, accum_cl, accum_s, rapport_s_cl, debit_clinker, prod_clinker_jour, cl_entree_kg_h, s_entree_kg_h, accum_cl_kg_h, accum_s_kg_h },
            interpretation: { message, color },
        };
    }, [inputs]);
};


const BilanResultCard = ({ label, value, unit, valueKgH, status }: { label: string; value: number | string; unit: string; valueKgH?: number | string; status: 'good' | 'warn' | 'bad' | 'neutral' }) => {
    const statusClasses = {
        good: 'bg-green-900/40 border-green-500 text-green-300',
        warn: 'bg-yellow-900/40 border-yellow-400 text-yellow-300',
        bad: 'bg-red-900/40 border-red-500 text-red-300',
        neutral: 'bg-brand-surface/60 border-brand-line/60',
    };

    return (
        <div className={cn("rounded-lg p-3 text-center border", statusClasses[status])}>
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="text-xl font-bold">{value}<span className="text-xs ml-1">{unit}</span></p>
            {valueKgH !== undefined && (
                <p className="text-sm text-muted-foreground">{valueKgH}<span className="text-xs ml-1">kg/h</span></p>
            )}
        </div>
    );
};


export default function BilanClSPage() {
    const { userProfile } = useAuth();
    const isReadOnly = userProfile?.role === 'viewer';
    const [inputs, setInputs] = useState<BilanInput>(initialInputs);
    const { bilan, interpretation } = useBilanCalculations(inputs);
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const fetchLatestData = async () => {
            setLoading(true);
            try {
                const latestBilan = await getLatestBilanClS();
                if (latestBilan) {
                    setInputs(latestBilan.inputs);
                }
            } catch (error) {
                toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger le dernier bilan." });
            } finally {
                setLoading(false);
            }
        };
        fetchLatestData();
    }, [toast]);


    const handleInputChange = (field: keyof BilanInput, value: string) => {
        setInputs(prev => ({ ...prev, [field]: parseFloat(value) || 0 }));
    };

    const handleSave = async () => {
        if (isReadOnly) return;
        setIsSaving(true);
        try {
            await saveBilanClS({ inputs, results: bilan });
            toast({ title: "Succès", description: "Le bilan a été sauvegardé." });
        } catch (error) {
            toast({ variant: "destructive", title: "Erreur de sauvegarde", description: "Impossible d'enregistrer le bilan." });
        } finally {
            setIsSaving(false);
        }
    };

    const getClStatus = (val: number): 'good' | 'warn' | 'bad' => {
        if (val > 600) return 'bad';
        if (val > 300) return 'warn';
        return 'good';
    };
    
    const getRapportStatus = (val: number): 'good' | 'warn' | 'bad' => {
        if (val < 5 || val > 15) return 'bad';
        if (val < 8 || val > 12) return 'warn';
        return 'good';
    };

    if (loading) {
        return (
             <div className="container mx-auto p-4 md:p-8 space-y-6">
                <Skeleton className="h-12 w-1/3" />
                <Skeleton className="h-24 w-full" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
                </div>
                <Skeleton className="h-96 w-full" />
            </div>
        )
    }

    return (
        <div className="container mx-auto p-4 md:p-8 space-y-6">
            <div className="flex justify-between items-start mb-8">
              <div>
                  <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-3">
                      <Wind className="h-8 w-8" />
                      Bilan Chlore & Soufre
                  </h1>
                  <p className="text-muted-foreground mt-2">
                      Évaluez l'équilibre du cycle des volatils pour garantir la stabilité du four.
                  </p>
              </div>
              <Button onClick={handleSave} disabled={isReadOnly || isSaving}>
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? "Sauvegarde..." : "Sauvegarder le Bilan"}
              </Button>
            </div>
            
            {interpretation.message && (
                <div className={cn("p-4 rounded-lg border flex items-center gap-3", interpretation.color)}>
                    {interpretation.message.includes('✅') ? <CheckCircle className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                    <span className="font-medium">{interpretation.message.substring(2)}</span>
                </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <BilanResultCard label="Cl Total Entrée" value={(bilan.cl_entree ?? 0).toFixed(2)} unit="g/t" valueKgH={(bilan.cl_entree_kg_h ?? 0).toFixed(2)} status={getClStatus(bilan.cl_entree ?? 0)} />
                <BilanResultCard label="S Total Entrée" value={(bilan.s_entree ?? 0).toFixed(2)} unit="g/t" valueKgH={(bilan.s_entree_kg_h ?? 0).toFixed(2)} status="neutral" />
                <BilanResultCard label="Accumulation Cl (Cycle Interne)" value={(bilan.accum_cl ?? 0).toFixed(2)} unit="g/t" valueKgH={(bilan.accum_cl_kg_h ?? 0).toFixed(2)} status={(bilan.accum_cl ?? 0) > 300 ? 'warn' : 'neutral'} />
                <BilanResultCard label="Accumulation S (Cycle Interne)" value={(bilan.accum_s ?? 0).toFixed(2)} unit="g/t" valueKgH={(bilan.accum_s_kg_h ?? 0).toFixed(2)} status={(bilan.accum_s ?? 0) < 0 ? 'bad' : (bilan.accum_s ?? 0) > 5000 ? 'warn' : 'neutral'} />
                <BilanResultCard label="Rapport S/Cl" value={isFinite(bilan.rapport_s_cl ?? 0) ? (bilan.rapport_s_cl ?? 0).toFixed(2) : '∞'} unit="" status={getRapportStatus(bilan.rapport_s_cl ?? 0)} />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Données d'Entrée &amp; de Sortie</CardTitle>
                    <CardDescription>Saisissez les valeurs de votre procédé pour calculer le bilan.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Section Entrées */}
                        <div className='space-y-4'>
                            <h3 className="font-semibold text-xl text-primary mb-4">Entrées</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 border rounded-lg">
                                <h3 className="col-span-full font-semibold">Farine</h3>
                                <div className="space-y-2"><Label>Débit (t/h)</Label><Input type="number" value={inputs.debit_farine} onChange={e => handleInputChange('debit_farine', e.target.value)} readOnly={isReadOnly} /></div>
                                <div className="space-y-2"><Label>Cl (%)</Label><Input type="number" value={inputs.cl_farine_pct} onChange={e => handleInputChange('cl_farine_pct', e.target.value)} readOnly={isReadOnly} /></div>
                                <div className="space-y-2"><Label>S (%)</Label><Input type="number" value={inputs.s_farine_pct} onChange={e => handleInputChange('s_farine_pct', e.target.value)} readOnly={isReadOnly} /></div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 border rounded-lg bg-muted/20">
                                <h3 className="col-span-full font-semibold text-muted-foreground">Poussières (Recyclées à 8%) - Pour information</h3>
                                <div className="space-y-2"><Label>Débit (t/h)</Label><Input type="number" value={(inputs.debit_farine * 0.08).toFixed(2)} disabled /></div>
                                <div className="space-y-2"><Label>Cl (%)</Label><Input type="number" value={inputs.cl_poussieres_pct} onChange={e => handleInputChange('cl_poussieres_pct', e.target.value)} readOnly={isReadOnly} /></div>
                                <div className="space-y-2"><Label>S (%)</Label><Input type="number" value={inputs.s_poussieres_pct} onChange={e => handleInputChange('s_poussieres_pct', e.target.value)} readOnly={isReadOnly} /></div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 border rounded-lg">
                                <h3 className="col-span-full font-semibold">Combustibles Alternatifs (AFR)</h3>
                                <div className="space-y-2"><Label>Débit (t/h)</Label><Input type="number" value={inputs.debit_afr} onChange={e => handleInputChange('debit_afr', e.target.value)} readOnly={isReadOnly} /></div>
                                <div className="space-y-2"><Label>Cl (%)</Label><Input type="number" value={inputs.cl_afr_pct} onChange={e => handleInputChange('cl_afr_pct', e.target.value)} readOnly={isReadOnly} /></div>
                                <div className="space-y-2"><Label>S (%)</Label><Input type="number" value={inputs.s_afr_pct} onChange={e => handleInputChange('s_afr_pct', e.target.value)} readOnly={isReadOnly} /></div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 border rounded-lg">
                                <h3 className="col-span-full font-semibold">Petcoke</h3>
                                <div className="space-y-2"><Label>Débit (t/h)</Label><Input type="number" value={inputs.debit_petcoke} onChange={e => handleInputChange('debit_petcoke', e.target.value)} readOnly={isReadOnly} /></div>
                                <div className="space-y-2"><Label>Cl (%)</Label><Input type="number" value={inputs.cl_petcoke_pct} onChange={e => handleInputChange('cl_petcoke_pct', e.target.value)} readOnly={isReadOnly} /></div>
                                <div className="space-y-2"><Label>S (%)</Label><Input type="number" value={inputs.s_petcoke_pct} onChange={e => handleInputChange('s_petcoke_pct', e.target.value)} readOnly={isReadOnly} /></div>
                            </div>
                        </div>

                        {/* Section Sorties */}
                        <div className='space-y-4'>
                             <h3 className="font-semibold text-xl text-primary mb-4">Sorties</h3>
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 border rounded-lg">
                                <h3 className="col-span-full font-semibold">Émissions Gazeuses</h3>
                                <div className="space-y-2"><Label>Débit Gaz (Nm³/h)</Label><Input type="number" value={inputs.debit_gaz_nm3} onChange={e => handleInputChange('debit_gaz_nm3', e.target.value)} readOnly={isReadOnly} /></div>
                                <div className="space-y-2"><Label>HCl (mg/Nm³)</Label><Input type="number" value={inputs.hcl_emission_mg} onChange={e => handleInputChange('hcl_emission_mg', e.target.value)} readOnly={isReadOnly} /></div>
                                <div className="space-y-2"><Label>SO₂ (mg/Nm³)</Label><Input type="number" value={inputs.so2_emission_mg} onChange={e => handleInputChange('so2_emission_mg', e.target.value)} readOnly={isReadOnly} /></div>
                            </div>
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 border rounded-lg">
                                <h3 className="col-span-full font-semibold">Clinker Produit</h3>
                                <div className="space-y-2"><Label>Débit Clinker (t/h)</Label><Input type="number" value={(bilan.debit_clinker ?? 0).toFixed(2)} disabled /></div>
                                <div className="space-y-2"><Label>Cl (%)</Label><Input type="number" value={inputs.cl_clinker_pct} onChange={e => handleInputChange('cl_clinker_pct', e.target.value)} readOnly={isReadOnly} /></div>
                                <div className="space-y-2"><Label>S (%)</Label><Input type="number" value={inputs.s_clinker_pct} onChange={e => handleInputChange('s_clinker_pct', e.target.value)} readOnly={isReadOnly} /></div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

        </div>
    );
}

    