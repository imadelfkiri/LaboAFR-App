
// components/cards/FlowRateCard.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Flame } from 'lucide-react';

export interface FlowData {
    label: string;
    value: number;
}

const formatNumber = (num?: number) => {
    if (num === undefined || num === null || isNaN(num)) return '-';
    return num.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function FlowRateCard({ title, flows }: { title: string, flows: FlowData[] | null }) {
  return (
    <Card className="bg-brand-surface border-brand-line">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2 text-white">
          <Flame className="text-orange-500 h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {flows && flows.length > 0 ? (
            flows.map(flow => (
                <div key={flow.label} className="flex justify-between items-baseline text-sm p-2 rounded-md hover:bg-brand-muted">
                    <span className="text-muted-foreground">{flow.label}</span>
                    <span className="font-mono font-medium text-white">{formatNumber(flow.value)} <span className="text-xs text-muted-foreground">t/h</span></span>
                </div>
            ))
        ) : (
            <p className="text-muted-foreground text-center p-4">Aucun débit enregistré.</p>
        )}
      </CardContent>
    </Card>
  );
}
