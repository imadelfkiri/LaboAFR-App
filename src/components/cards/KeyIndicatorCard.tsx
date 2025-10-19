
"use client";

// components/cards/KeyIndicatorCard.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap } from 'lucide-react';
import CountUp from 'react-countup';
import { cn } from "@/lib/utils";
import type { KeyIndicatorThresholds } from "@/lib/data";

type IndicatorStatus = 'alert' | 'warning' | 'conform' | 'neutral';

export function KeyIndicatorCard({ 
    tsr, 
    consumption,
    thresholds,
    onIndicatorDoubleClick,
}: { 
    tsr?: number, 
    consumption?: number,
    thresholds?: KeyIndicatorThresholds,
    onIndicatorDoubleClick?: (key: 'tsr' | 'consumption', name: string) => void,
}) {

  const getTsrStatus = (value?: number): IndicatorStatus => {
    if (value === undefined || value === null || !thresholds) return 'neutral';
    if (thresholds.tsr_vert_min != null && value >= thresholds.tsr_vert_min) return 'conform';
    if (thresholds.tsr_jaune_min != null && value >= thresholds.tsr_jaune_min) return 'warning';
    return 'alert';
  };

  const getConsumptionStatus = (value?: number): IndicatorStatus => {
    if (value === undefined || value === null || !thresholds) return 'neutral';
    if (thresholds.conso_cal_rouge_min != null && value < thresholds.conso_cal_rouge_min) return 'alert';
    if (thresholds.conso_cal_rouge_max != null && value > thresholds.conso_cal_rouge_max) return 'alert';
    if ((thresholds.conso_cal_vert_min != null && value >= thresholds.conso_cal_vert_min) && (thresholds.conso_cal_vert_max != null && value <= thresholds.conso_cal_vert_max)) return 'conform';
    return 'warning';
  };
  
  const statusClasses: Record<IndicatorStatus, string> = {
    alert: "bg-red-900/40 border-red-500 text-red-300",
    warning: "bg-yellow-900/40 border-yellow-400 text-yellow-300",
    conform: "bg-green-900/40 border-green-500 text-green-300",
    neutral: "bg-primary/10 border-primary/20",
  };

  const tsrStatus = getTsrStatus(tsr);
  const consumptionStatus = getConsumptionStatus(consumption);

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2 text-white">
          <Zap className="text-primary h-5 w-5" />
          Indicateurs Clés
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col flex-grow justify-around space-y-4">
        <div 
            className={cn(
                "rounded-lg p-4 text-center flex-1 flex flex-col justify-center cursor-pointer hover:brightness-110 transition-all border",
                statusClasses[tsrStatus]
            )}
            onDoubleClick={() => onIndicatorDoubleClick && onIndicatorDoubleClick('tsr', 'Taux de Substitution')}
        >
            <p className="text-sm font-medium opacity-80">Taux de Substitution Énergétique</p>
            <p className="text-5xl font-bold tracking-tighter">
                <CountUp end={tsr || 0} decimals={0} duration={1.5} />
                <span className="text-4xl opacity-80">%</span>
            </p>
        </div>
         <div 
            className={cn(
                "rounded-lg p-4 text-center flex-1 flex flex-col justify-center cursor-pointer hover:brightness-110 transition-all border",
                statusClasses[consumptionStatus]
            )}
            onDoubleClick={() => onIndicatorDoubleClick && onIndicatorDoubleClick('consumption', 'Consommation Calorifique')}
        >
            <p className="text-sm font-medium opacity-80">Consommation Calorifique</p>
            <p className="text-5xl font-bold tracking-tighter">
                <CountUp end={consumption || 0} decimals={0} duration={1.5} />
                <span className="text-2xl opacity-80"> kcal/kg</span>
            </p>
        </div>
      </CardContent>
    </Card>
  );
}
