// components/cards/ImpactCard.tsx
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Activity } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ImpactThresholds } from "@/lib/data";

export interface ImpactData {
    [key: string]: number;
}

export interface ImpactCardProps {
  title: string;
  data: ImpactData | null;
  thresholds?: ImpactThresholds;
  lastUpdate?: Date;
  onIndicatorDoubleClick?: (key: string, name: string) => void;
}

export function ImpactCard({ title, data, thresholds, lastUpdate, onIndicatorDoubleClick }: ImpactCardProps) {
  const getColorClass = (key: string, value: number) => {
    if (!thresholds) return "bg-gray-800/40 border-gray-600 text-gray-300";

    switch (key) {
      case "Fe2O3":
        if (thresholds.fe2o3_jaune_max != null && value > thresholds.fe2o3_jaune_max) return "bg-red-900/40 border-red-500 text-red-300";
        if (thresholds.fe2o3_vert_max != null && value > thresholds.fe2o3_vert_max) return "bg-yellow-900/40 border-yellow-400 text-yellow-300";
        return "bg-green-900/40 border-green-500 text-green-300";
      case "LSF":
        if (thresholds.lsf_jaune_min != null && value < thresholds.lsf_jaune_min) return "bg-red-900/40 border-red-500 text-red-300";
        if (thresholds.lsf_vert_min != null && value < thresholds.lsf_vert_min) return "bg-yellow-900/40 border-yellow-400 text-yellow-300";
        return "bg-green-900/40 border-green-500 text-green-300";
      case "C3S":
        if (thresholds.c3s_jaune_min != null && value < thresholds.c3s_jaune_min) return "bg-red-900/40 border-red-500 text-red-300";
        if (thresholds.c3s_vert_min != null && value < thresholds.c3s_vert_min) return "bg-yellow-900/40 border-yellow-400 text-yellow-300";
        return "bg-green-900/40 border-green-500 text-green-300";
      case "MS":
        if (thresholds.ms_jaune_min != null && value < thresholds.ms_jaune_min) return "bg-red-900/40 border-red-500 text-red-300";
        if (thresholds.ms_vert_min != null && value < thresholds.ms_vert_min) return "bg-yellow-900/40 border-yellow-400 text-yellow-300";
        return "bg-green-900/40 border-green-500 text-green-300";
      case "AF":
        if (thresholds.af_jaune_min != null && value < thresholds.af_jaune_min) return "bg-red-900/40 border-red-500 text-red-300";
        if (thresholds.af_vert_min != null && value < thresholds.af_vert_min) return "bg-yellow-900/40 border-yellow-400 text-yellow-300";
        return "bg-green-900/40 border-green-500 text-green-300";
      default:
        return "bg-gray-800/40 border-gray-600 text-gray-300";
    }
  };

  return (
    <Card className="bg-brand-surface border-brand-line h-full">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2 text-white">
          <Activity className="text-cyan-400 h-5 w-5" />
          {title}
        </CardTitle>
        {lastUpdate && <CardDescription>Basé sur l'analyse du {format(lastUpdate, "d MMMM yyyy 'à' HH:mm", { locale: fr })}</CardDescription>}
      </CardHeader>
      <CardContent>
        {data && Object.keys(data).length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-3 gap-3">
                {Object.entries(data).map(([key, value]) => (
                  <motion.div
                    key={key}
                    whileHover={{ scale: 1.08 }}
                    transition={{ type: "spring", stiffness: 300 }}
                    className={cn(
                      "flex flex-col items-center justify-center rounded-xl border py-3 px-2 font-medium cursor-pointer",
                      getColorClass(key, value as number)
                    )}
                    onDoubleClick={() => onIndicatorDoubleClick && onIndicatorDoubleClick(key, `Δ ${key}`)}
                  >
                    <span className="text-xs opacity-80">{key}</span>
                    <span className="text-base font-semibold">
                      {(value as number) > 0 ? "+" : ""}
                      {(value as number).toFixed(2)}
                    </span>
                  </motion.div>
                ))}
            </div>
        ) : (
            <p className="text-muted-foreground text-center p-8">Aucune donnée d'impact disponible.</p>
        )}
      </CardContent>
    </Card>
  );
}