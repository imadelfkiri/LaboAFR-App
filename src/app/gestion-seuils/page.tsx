
"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/auth-provider";
import { useRouter } from "next/navigation";
import { getThresholds, saveThresholds, type Thresholds, type MixtureThresholds, type ImpactThresholds } from "@/lib/data";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { SlidersHorizontal } from "lucide-react";

export default function GestionSeuils() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [thresholds, setThresholds] = useState<Thresholds | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
        const fetchedThresholds = await getThresholds();
        setThresholds(fetchedThresholds);
    } catch (e) {
        console.error(e);
        toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les seuils." });
    } finally {
        setLoading(false);
    }
  }, [toast]);
  
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
        router.push('/login');
        return;
    }
    // We should also check for admin role here if available from useAuth()
    // For now, we assume if user is logged in they can see the page,
    // security is enforced in the save function for now.
    fetchInitialData();
  }, [user, authLoading, router, fetchInitialData]);

  const handleChange = (section: 'melange' | 'impact', key: string, value: string) => {
    setThresholds((prev) => {
        if (!prev) return null;
        return {
            ...prev,
            [section]: {
                ...prev[section],
                [key]: value === '' ? null : Number(value)
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

  const renderSection = (title: string, section: 'melange' | 'impact', icon: React.ReactNode, data?: MixtureThresholds | ImpactThresholds) => {
    if (!data) return null;
    return (
        <section>
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                {icon} {title}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {Object.keys(data).map((key) => (
                    <div key={key} className="bg-brand-surface/70 p-4 rounded-xl border border-brand-line">
                        <Label htmlFor={key} className="block text-sm text-muted-foreground mb-1">
                            {key.replaceAll("_", " ").replace(/\b\w/g, l => l.toUpperCase())}
                        </Label>
                        <Input
                            id={key}
                            type="number"
                            step="any"
                            value={(data as any)[key] ?? ''}
                            onChange={(e) => handleChange(section, key, e.target.value)}
                            className="w-full p-2 rounded-md bg-brand-bg text-white border-brand-line focus:border-primary focus:outline-none"
                        />
                    </div>
                ))}
            </div>
        </section>
    );
  };

  return (
    <motion.div
      className="p-8 bg-brand-bg text-gray-200 rounded-2xl max-w-7xl mx-auto space-y-10"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
        <div>
            <h2 className="text-3xl font-bold text-primary mb-2 flex items-center gap-3">
                <SlidersHorizontal />
                Gestion des Seuils de Qualité
            </h2>
            <p className="text-muted-foreground">
                Configurez les seuils de couleur (vert, jaune, rouge) pour les indicateurs de l'application.
            </p>
        </div>

        {renderSection("🔬 Indicateurs du Mélange", "melange", null, thresholds.melange)}
        {renderSection("🧱 Impact sur le Clinker (Δ)", "impact", null, thresholds.impact)}

      <div className="flex justify-end">
        <Button
          onClick={handleSaveChanges}
          disabled={saving}
          className="mt-6 px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl transition"
        >
          {saving ? "💾 Enregistrement..." : "💾 Sauvegarder les changements"}
        </Button>
      </div>
    </motion.div>
  );
}
