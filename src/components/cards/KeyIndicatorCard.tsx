
"use client";

// components/cards/KeyIndicatorCard.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, Activity } from 'lucide-react';
import CountUp from 'react-countup';

export function KeyIndicatorCard({ tsr, consumption }: { tsr?: number, consumption?: number }) {
  return (
    <Card>
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
                <CountUp end={tsr || 0} decimals={0} duration={1.5} />
                <span className="text-4xl text-primary/80">%</span>
            </p>
        </div>
         <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4 text-center">
            <p className="text-sm font-medium text-amber-400">Consommation Calorifique</p>
            <p className="text-5xl font-bold tracking-tighter text-white">
                <CountUp end={consumption || 0} decimals={0} duration={1.5} />
                <span className="text-2xl text-amber-400/80"> kcal/kg</span>
            </p>
        </div>
      </CardContent>
    </Card>
  );
}
