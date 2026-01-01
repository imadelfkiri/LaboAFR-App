
import { AshAnalysisManager } from '@/components/ash-analysis-manager';
import type { Metadata } from 'next';
import { ClipboardList } from 'lucide-react';

export const metadata: Metadata = {
  title: "Analyses des Cendres des AFs | FuelTrack AFR",
  description: "Suivi des analyses chimiques des cendres des combustibles alternatifs (AF).",
};

export default function AnalysesCendresPage() {
  return (
     <div className="flex flex-col flex-1 bg-brand-bg">
       <div className="mb-8 px-4 md:px-6 lg:px-8 pt-4">
            <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-3">
                <ClipboardList className="h-8 w-8"/>
                Analyses des Cendres
            </h1>
            <p className="text-muted-foreground mt-1">Consultez et gérez l'historique des analyses chimiques des cendres.</p>
        </div>
        <AshAnalysisManager />
    </div>
  );
}
