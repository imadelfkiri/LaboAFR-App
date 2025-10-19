"use client";

import { motion } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { KeyIndicatorThresholds } from "@/lib/data";

export default function CcGaugeChart({ value = 0, thresholds }: { value: number, thresholds?: KeyIndicatorThresholds }) {
  
  const getColor = (val: number): string => {
    if (!thresholds) return "#facc15"; // Jaune par défaut
    if (thresholds.conso_cal_rouge_min != null && val < thresholds.conso_cal_rouge_min) return "#ef4444"; // Rouge (trop bas)
    if (thresholds.conso_cal_rouge_max != null && val > thresholds.conso_cal_rouge_max) return "#ef4444"; // Rouge (trop haut)
    if (thresholds.conso_cal_vert_min != null && thresholds.conso_cal_vert_max != null && val >= thresholds.conso_cal_vert_min && val <= thresholds.conso_cal_vert_max) return "#22c55e"; // Vert
    return "#facc15"; // Jaune
  };

  const color = getColor(value);
  const min = 750;
  const max = 950;
  const percent = Math.min(1, Math.max(0, (value - min) / (max - min)));

  // Angle de rotation (-90° à +90°)
  const angle = -90 + percent * 180;

  return (
    <Card className="bg-brand-surface border-brand-line h-full flex flex-col items-center justify-center">
       <CardHeader className="pb-3 text-center">
        <CardTitle className="text-lg font-semibold text-white">
          🔥 Consommation Calorifique
        </CardTitle>
      </CardHeader>
      <CardContent className="relative flex flex-col items-center">
        <svg width="220" height="130" viewBox="0 0 220 120">
          <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22c55e" />
              <stop offset="50%" stopColor="#facc15" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
          </defs>
          <path
            d="M20,110 A90,90 0 0,1 200,110"
            fill="none"
            stroke="#1E293B"
            strokeWidth="14"
            strokeLinecap="round"
          />
          <path
            d="M20,110 A90,90 0 0,1 200,110"
            fill="none"
            stroke="url(#grad)"
            strokeWidth="14"
            strokeLinecap="round"
          />
          <motion.line
            x1="110"
            y1="110"
            x2="110"
            y2="25"
            stroke={color}
            strokeWidth="4"
            strokeLinecap="round"
            style={{
              transformOrigin: "110px 110px",
            }}
            initial={{ rotate: -90 }}
            animate={{ rotate: angle }}
            transition={{ duration: 1.3, ease: "easeOut" }}
          />
          <circle cx="110" cy="110" r="6" fill="#fff" />
        </svg>

        <div className="text-center mt-2">
          <span className="text-4xl font-bold" style={{ color }}>
            {value.toFixed(0)}
          </span>
          <span className="text-gray-400 ml-1">kcal/kg</span>
        </div>
        <div className="flex justify-between w-full text-xs text-gray-500 mt-1 px-4">
          <span>{min}</span>
          <span>{min + (max - min) / 2}</span>
          <span>{max}</span>
        </div>
      </CardContent>
    </Card>
  );
}
