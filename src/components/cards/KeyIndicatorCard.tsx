
// components/cards/KeyIndicatorCard.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, TrendingUp } from 'lucide-react';

const formatNumber = (num?: number, digits = 2) => {
    if (num === undefined || num === null || isNaN(num)) return '-';
    return num.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function KeyIndicatorCard({ tsr, consumption }: { tsr?: number, consumption?: number }) {
  return (
    <Card className="bg-brand-surface border-brand-line">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2 text-white">
          <Zap className="text-primary h-5 w-5" />
          Indicateurs Clés
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-primary/10 border border-primary/20 p-4 text-center">
            <p className="text-sm font-medium text-primary">Taux de Substitution Énergétique</p>
            <p className="text-5xl font-bold tracking-tighter text-white">
                {formatNumber(tsr, 2)}<span className="text-4xl text-primary/80">%</span>
            </p>
        </div>
         <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4 text-center">
            <p className="text-sm font-medium text-amber-400">Consommation Calorifique</p>
            <p className="text-5xl font-bold tracking-tighter text-white">
                {formatNumber(consumption, 0)}<span className="text-2xl text-amber-400/80"> kcal/kg</span>
            </p>
        </div>
      </CardContent>
    </Card>
  );
}
