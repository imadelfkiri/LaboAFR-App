
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { KeyIndicatorThresholds } from "@/lib/data";

export default function TsrCircleChart({ value = 0, thresholds }: { value: number, thresholds?: KeyIndicatorThresholds }) {
  
  const getColor = (val: number) => {
    if (!thresholds || thresholds.tsr_jaune_min === undefined || thresholds.tsr_vert_min === undefined) {
      return "#8884d8"; // a neutral default
    }
    if (val < thresholds.tsr_jaune_min) return "#ef4444"; // red
    if (val < thresholds.tsr_vert_min) return "#facc15"; // yellow
    return "#22c55e"; // green
  };

  const color = getColor(value);
  const normalized = Math.min(100, Math.max(0, value));

  return (
    <Card className="bg-brand-surface border-brand-line h-full flex flex-col items-center justify-center">
      <CardHeader className="pb-3 text-center">
        <CardTitle className="text-lg font-semibold text-white">
          ⚡ Taux de Substitution Énergétique
        </CardTitle>
      </CardHeader>

      <CardContent className="relative flex justify-center items-center p-4">
        <svg width="180" height="180" viewBox="0 0 120 120">
          {/* Cercle de fond */}
          <circle
            cx="60"
            cy="60"
            r="54"
            stroke="#1E293B"
            strokeWidth="12"
            fill="none"
          />
          {/* Cercle animé */}
          <motion.circle
            cx="60"
            cy="60"
            r="54"
            transform="rotate(-90 60 60)"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
            fill="none"
            strokeDasharray="339.29" // 2 * PI * 54
            initial={{ strokeDashoffset: 339.29 }}
            animate={{ strokeDashoffset: 339.29 * (1 - normalized / 100) }}
            transition={{ duration: 1.4, ease: "easeOut" }}
          />
        </svg>

        {/* Texte central */}
        <div className="absolute flex flex-col items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.span
              key={value}
              className="text-5xl font-bold"
              style={{ color }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5 }}
            >
              {normalized.toFixed(0)}%
            </motion.span>
          </AnimatePresence>
          <span className="text-gray-400 text-sm mt-1">de substitution</span>
        </div>
      </CardContent>
    </Card>
  );
}
