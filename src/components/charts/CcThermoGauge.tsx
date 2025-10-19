"use client";

import { motion } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { KeyIndicatorThresholds } from "@/lib/data";

export default function CcThermoGauge({ value = 0, thresholds }: { value: number, thresholds?: KeyIndicatorThresholds }) {
  
  const getColor = (val: number): string => {
    if (!thresholds) return "#facc15"; // Jaune par défaut
    if (thresholds.conso_cal_rouge_min != null && val < thresholds.conso_cal_rouge_min) return "#ef4444"; // Rouge (trop bas)
    if (thresholds.conso_cal_rouge_max != null && val > thresholds.conso_cal_rouge_max) return "#ef4444"; // Rouge (trop haut)
    if (thresholds.conso_cal_vert_min != null && thresholds.conso_cal_vert_max != null && val >= thresholds.conso_cal_vert_min && val <= thresholds.conso_cal_vert_max) return "#22c55e"; // Vert
    return "#facc15"; // Jaune
  };

  const color = getColor(value);
  // Normalisation de la valeur sur une plage de 700 à 1100 pour la barre de progression
  const percent = Math.min(100, Math.max(0, ((value - 750) / 300) * 100)); 

  return (
    <Card className="bg-brand-surface border-brand-line h-full flex flex-col items-center justify-center">
      <CardHeader className="pb-3 text-center">
        <CardTitle className="text-lg font-semibold text-white">
          🔥 Consommation Calorifique
        </CardTitle>
      </CardHeader>

      <CardContent className="w-full px-6">
        <div className="w-full h-5 bg-gray-700/40 rounded-full overflow-hidden shadow-inner relative">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, #22c55e, #facc15 60%, #ef4444 85%)`,
            }}
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 1.3, ease: "easeOut" }}
          />
        </div>

        <div className="text-center mt-3">
          <span className="text-5xl font-bold" style={{ color }}>
            {value.toFixed(0)}
          </span>
          <span className="text-gray-400 ml-1.5 text-base">kcal/kg</span>
        </div>

        <div className="flex justify-between text-xs text-gray-500 mt-1 px-1">
          <span>Faible</span>
          <span>Élevée</span>
        </div>
      </CardContent>
    </Card>
  );
}
