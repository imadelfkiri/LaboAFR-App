
// components/cards/ImpactCard.tsx
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Activity } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export interface ImpactData {
    label: string;
    value: number;
}

const DeltaPill = ({ delta }: { delta: number }) => {
  const color =
    delta > 0.001 ? "bg-red-500/20 text-red-300 ring-red-500/30"
    : delta < -0.001 ? "bg-green-500/20 text-green-300 ring-green-500/30"
    : "bg-neutral-700/30 text-neutral-300 ring-neutral-600/30"
  const sign = delta > 0 ? "+" : ""
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold tabular-nums ring-1 ring-inset ${color}`}>
      {sign}{delta.toFixed(2)}
    </span>
  )
}


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
                {data.map(item => (
                    <div key={item.label} className="flex flex-col items-center justify-center p-4 rounded-lg bg-brand-muted border border-brand-line/50">
                        <dt className="text-sm text-muted-foreground mb-1">{item.label}</dt>
                        <dd><DeltaPill delta={item.value} /></dd>
                    </div>
                ))}
            </div>
        ) : (
            <p className="text-muted-foreground text-center p-8">Aucune donnée d'impact disponible.</p>
        )}
      </CardContent>
    </Card>
  );
}
