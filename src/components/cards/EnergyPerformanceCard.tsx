"use client";

import { motion } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { KeyIndicatorThresholds } from "@/lib/data";

export default function EnergyPerformanceCard({
  tsr = 0,
  cc = 0,
  thresholds,
}: {
  tsr: number;
  cc: number;
  thresholds?: KeyIndicatorThresholds;
}) {

  const getTsrColor = (val: number) => {
    if (!thresholds || thresholds.tsr_jaune_min === undefined || thresholds.tsr_vert_min === undefined) return "#facc15";
    if (val < thresholds.tsr_jaune_min) return "#ef4444"; // red
    if (val < thresholds.tsr_vert_min) return "#facc15"; // yellow
    return "#22c55e"; // green
  };

  const getCcColor = (val: number) => {
    if (!thresholds) return "#facc15";
    if (thresholds.conso_cal_rouge_min != null && val < thresholds.conso_cal_rouge_min) return "#ef4444";
    if (thresholds.conso_cal_rouge_max != null && val > thresholds.conso_cal_rouge_max) return "#ef4444";
    if (thresholds.conso_cal_vert_min != null && thresholds.conso_cal_vert_max != null && val >= thresholds.conso_cal_vert_min && val <= thresholds.conso_cal_vert_max) return "#22c55e";
    return "#facc15";
  };

  const tsrColor = getTsrColor(tsr);
  const ccColor = getCcColor(cc);

  const normalizedTsr = Math.min(100, Math.max(0, tsr));
  const circumference = 2 * Math.PI * 70; // 2 * PI * r

  const minCc = 750;
  const maxCc = 950;
  const ccPercent = Math.min(1, Math.max(0, (cc - minCc) / (maxCc - minCc)));
  const ccAngle = -90 + ccPercent * 180;

  return (
    <Card className="bg-brand-surface border-brand-line rounded-2xl shadow-lg p-6 col-span-1 md:col-span-2 xl:col-span-2">
      <CardHeader className="pb-4 pt-0">
        <CardTitle className="text-xl font-semibold text-white text-center">
          ⚡ Performance Énergétique
        </CardTitle>
      </CardHeader>

      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center justify-center p-0">
        {/* TSR Gauge */}
        <div className="flex flex-col items-center gap-2">
          <svg width="180" height="180" viewBox="0 0 180 180">
            <circle
              cx="90"
              cy="90"
              r="70"
              stroke="hsl(var(--brand-line))"
              strokeWidth="14"
              fill="none"
            />
            <motion.circle
              cx="90"
              cy="90"
              r="70"
              stroke={tsrColor}
              strokeWidth="14"
              fill="none"
              strokeDasharray={`${circumference}`}
              strokeLinecap="round"
              transform="rotate(-90 90 90)"
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: circumference * (1 - normalizedTsr / 100) }}
              transition={{ duration: 1.4, ease: "easeOut" }}
            />
            <text
              x="50%"
              y="50%"
              dominantBaseline="middle"
              textAnchor="middle"
              className="text-4xl font-bold fill-white"
            >
              {tsr.toFixed(0)}%
            </text>
          </svg>
          <p className="text-gray-300 font-medium text-center">
            Taux de Substitution Énergétique
          </p>
        </div>

        {/* CC Gauge */}
        <div className="flex flex-col items-center gap-2">
           <svg width="220" height="130" viewBox="0 0 220 120">
            <defs>
              <linearGradient id="ccGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#22c55e" />
                <stop offset="50%" stopColor="#facc15" />
                <stop offset="100%" stopColor="#ef4444" />
              </linearGradient>
            </defs>
            <path
              d="M20,110 A90,90 0 0,1 200,110"
              fill="none"
              stroke="hsl(var(--brand-line))"
              strokeWidth="14"
              strokeLinecap="round"
            />
             <path
              d="M20,110 A90,90 0 0,1 200,110"
              fill="none"
              stroke="url(#ccGrad)"
              strokeWidth="14"
              strokeLinecap="round"
            />
            <motion.line
              x1="110"
              y1="110"
              x2="110"
              y2="25"
              stroke={ccColor}
              strokeWidth="4"
              strokeLinecap="round"
              style={{ transformOrigin: "110px 110px" }}
              initial={{ rotate: -90 }}
              animate={{ rotate: ccAngle }}
              transition={{ duration: 1.3, ease: "easeOut" }}
            />
            <circle cx="110" cy="110" r="6" fill="#fff" />
          </svg>
           <div className="text-center">
                <span className="text-3xl font-bold" style={{ color: ccColor }}>
                    {cc.toFixed(0)}
                </span>
                <span className="text-gray-400 ml-1">kcal/kg</span>
            </div>
            <p className="text-gray-300 font-medium text-center">
                Consommation Calorifique
            </p>
        </div>
      </CardContent>
    </Card>
  );
}
