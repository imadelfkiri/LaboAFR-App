
// components/cards/ImpactCard.tsx
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Activity } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";


export interface ImpactData {
    [key: string]: number;
}

const getColorClass = (key: string, value: number) => {
    switch (key) {
      case "Fe2O3":
        if (value >= 0.7) return "bg-red-900/40 border-red-500 text-red-300";
        if (value >= 0.5) return "bg-yellow-900/40 border-yellow-400 text-yellow-300";
        return "bg-green-900/40 border-green-500 text-green-300";
      case "LSF":
        if (value <= -2.5) return "bg-red-900/40 border-red-500 text-red-300";
        if (value <= -2) return "bg-yellow-900/40 border-yellow-400 text-yellow-300";
        return "bg-green-900/40 border-green-500 text-green-300";
      case "C3S":
        if (value <= -9) return "bg-red-900/40 border-red-500 text-red-300";
        if (value <= -7) return "bg-yellow-900/40 border-yellow-400 text-yellow-300";
        return "bg-green-900/40 border-green-500 text-green-300";
      case "MS":
        if (value <= -0.25) return "bg-red-900/40 border-red-500 text-red-300";
        if (value <= -0.2) return "bg-yellow-900/40 border-yellow-400 text-yellow-300";
        return "bg-green-900/40 border-green-500 text-green-300";
      case "AF":
        if (value <= -0.35) return "bg-red-900/40 border-red-500 text-red-300";
        if (value <= -0.3) return "bg-yellow-900/40 border-yellow-400 text-yellow-300";
        return "bg-green-900/40 border-green-500 text-green-300";
      default:
        return "bg-gray-800/40 border-gray-600 text-gray-300"; // ex: CaO pas de condition
    }
};


export function ImpactCard({ title, data, lastUpdate }: { title: string, data: ImpactData | null, lastUpdate?: Date }) {
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
                      "flex flex-col items-center justify-center rounded-xl border py-3 px-2 font-medium",
                      getColorClass(key, value)
                    )}
                  >
                    <span className="text-xs opacity-80">{key}</span>
                    <span className="text-base font-semibold">
                      {value > 0 ? "+" : ""}
                      {value.toFixed(2)}
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
