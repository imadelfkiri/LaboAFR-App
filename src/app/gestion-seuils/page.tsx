"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/auth-provider";
import { useRouter } from "next/navigation";
import { getThresholds, saveThresholds, type Thresholds, type MixtureThresholds, type ImpactThresholds, type KeyIndicatorThresholds } from '@/lib/data';
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { SlidersHorizontal, Zap, TrendingUp, Beaker } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const defaultThresholds: Thresholds = {
    melange: {
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
    },
    impact: {
      fe2o3_vert_max: 0.5,
      fe2o3_jaune_max: 0.7,
      lsf_vert_min: -2,
      lsf_jaune_min: -2.5,
      c3s_vert_min: -7,
      c3s_jaune_min: -9,
      ms_vert_min: -0.2,
      ms_jaune_min: -0.25,
      af_vert_min: -0.3,
      af_jaune_min: -0.35,
    },
    indicateurs: {
        tsr_vert_min: 50,
        tsr_jaune_min: 45,
        conso_cal_rouge_min: 800,
        conso_cal_vert_min: 820,
        conso_cal_vert_max: 860,
        conso_cal_rouge_max: 880,
    }
};


export default function GestionSeuils() {
  const { userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [thresholds, setThresholds] = useState<Thresholds | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
        const fetchedThresholds = await getThresholds();
        setThresholds({
            melange: fetchedThresholds.melange || defaultThresholds.melange,
            impact: fetchedThresholds.impact || defaultThresholds.impact,
            indicateurs: fetchedThresholds.indicateurs || defaultThresholds.indicateurs,
        });
    } catch (e) {
        console.error(e);
        toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les seuils." });
        setThresholds(defaultThresholds);
    } finally {
        setLoading(false);
    }
  }, [toast]);
  
  useEffect(() => {
    if (authLoading) return;
    if (!userProfile) {
        router.push('/login');
        return;
    }
    if (userProfile.role !== 'admin') {
        router.push('/unauthorized');
        return;
    }
    fetchInitialData();
  }, [userProfile, authLoading, router, fetchInitialData]);

  const handleChange = (section: 'melange' | 'impact' | 'indicateurs', key: string, value: string) => {
    setThresholds((prev) => {
        if (!prev) return null;
        const numValue = value === '' ? null : Number(value);
        return {
            ...prev,
            [section]: {
                ...(prev[section] as any),
                [key]: numValue,
            }
        };
    });
  };

  const handleSaveChanges = async () => {
    setSaving(true);
    try {
        if (!thresholds) throw new Error("Les seuils ne sont pas chargés.");
        await saveThresholds(thresholds);
        toast({ title: "✅ Succès", description: "Seuils mis à jour avec succès !" });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Une erreur inconnue est survenue.";
        toast({ variant: "destructive", title: "Erreur", description: errorMessage });
    } finally {
        setSaving(false);
    }
  };

  if (loading || authLoading || !thresholds) {
    return (
        <div className="p-8 max-w-6xl mx-auto space-y-10">
             <Skeleton className="h-10 w-1/3" />
             <Skeleton className="h-64 w-full" />
             <Skeleton className="h-64 w-full" />
        </div>
    );
  }

  const renderSection = (title: string, section: 'melange' | 'impact' | 'indicateurs', icon: React.ReactNode, data?: MixtureThresholds | ImpactThresholds | KeyIndicatorThresholds) => {
    if (!data) return null;
    return (
       <Card className="bg-brand-surface/80 border-brand-line/60">
            <CardHeader>
              <CardTitle className="text-lg text-emerald-400 flex items-center gap-2">{icon}{title}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.keys(data).map((key) => (
                    <div key={key} className="space-y-2">
                        <Label htmlFor={key} className="text-sm text-muted-foreground">
                            {key.replaceAll("_", " ").replace(/\b\w/g, l => l.toUpperCase())}
                        </Label>
                        <Input
                            id={key}
                            type="number"
                            step="any"
                            value={(data as any)[key] ?? ''}
                            onChange={(e) => handleChange(section, key, e.target.value)}
                            className="w-full h-10 bg-brand-bg text-white border-brand-line focus:border-primary focus:outline-none"
                        />
                    </div>
                ))}
            </CardContent>
        </Card>
    );
  };

  return (
    <motion.div
      className="p-8 max-w-7xl mx-auto space-y-10"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
        <div>
            <h1 className="text-3xl font-bold text-primary mb-2 flex items-center gap-3">
                <SlidersHorizontal />
                Gestion des Seuils de Qualité
            </h1>
            <p className="text-muted-foreground">
                Configurez les seuils (vert, jaune, rouge) pour les indicateurs de l'application.
            </p>
        </div>
        
        {renderSection("Indicateurs Clés", "indicateurs", <Zap />, thresholds.indicateurs)}
        {renderSection("Indicateurs du Mélange", "melange", <Beaker />, thresholds.melange)}
        {renderSection("Impact sur le Clinker (Δ)", "impact", <TrendingUp />, thresholds.impact)}

      <div className="flex justify-end mt-8">
        <Button
          onClick={handleSaveChanges}
          disabled={saving}
          className="px-6 py-3 text-base"
        >
          {saving ? "💾 Enregistrement..." : "💾 Sauvegarder les changements"}
        </Button>
      </div>
    </motion.div>
  );
}
