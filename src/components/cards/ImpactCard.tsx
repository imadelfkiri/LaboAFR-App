
// components/cards/ImpactCard.tsx
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Activity, AlertTriangle, CheckCircle, MinusCircle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { DeltaPill } from "../badges/DeltaPill";

export interface ImpactData {
    label: string;
    value: number;
}

type DeltaPillProps = {
  color: "positive" | "danger" | "warning" | "neutral";
  icon: React.ElementType;
};

const getDeltaPillProps = (key: string, value: number): DeltaPillProps => {
    switch (key) {
        case "Fe2O3":
            if (value >= 0.7) return { color: "danger", icon: AlertTriangle };
            if (value >= 0.5) return { color: "warning", icon: AlertTriangle };
            return { color: "positive", icon: CheckCircle };
        case "LSF":
            if (value <= -2.5) return { color: "danger", icon: AlertTriangle };
            if (value <= -2) return { color: "warning", icon: AlertTriangle };
            return { color: "positive", icon: CheckCircle };
        case "C3S":
            if (value <= -9) return { color: "danger", icon: AlertTriangle };
            if (value <= -7) return { color: "warning", icon: AlertTriangle };
            return { color: "positive", icon: CheckCircle };
        case "MS":
            if (value <= -0.25) return { color: "danger", icon: AlertTriangle };
            if (value <= -0.2) return { color: "warning", icon: AlertTriangle };
            return { color: "positive", icon: CheckCircle };
        case "AF":
            if (value <= -0.35) return { color: "danger", icon: AlertTriangle };
            if (value <= -0.3) return { color: "warning", icon: AlertTriangle };
            return { color: "positive", icon: CheckCircle };
        default:
            return { color: "neutral", icon: MinusCircle };
    }
};


export function ImpactCard({ title, data, lastUpdate }: { title: string, data: ImpactData[] | null, lastUpdate?: Date }) {
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
        {data && data.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {data.map(item => {
                    const { color, icon } = getDeltaPillProps(item.label, item.value);
                    return (
                        <div key={item.label} className="flex flex-col items-center justify-center p-4 rounded-lg bg-brand-muted border border-brand-line/50">
                            <dt className="text-sm text-muted-foreground mb-1">{item.label}</dt>
                            <dd><DeltaPill delta={item.value} color={color} icon={icon} /></dd>
                        </div>
                    )
                })}
            </div>
        ) : (
            <p className="text-muted-foreground text-center p-8">Aucune donnée d'impact disponible.</p>
        )}
      </CardContent>
    </Card>
  );
}
