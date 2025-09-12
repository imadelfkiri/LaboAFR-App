import { AshAnalysisManager } from '@/components/ash-analysis-manager';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Analyses des Cendres des AFs | FuelTrack AFR",
  description: "Suivi des analyses chimiques des cendres des combustibles alternatifs (AF).",
};

export default function AnalysesCendresPage() {
  return (
     <div className="flex flex-col flex-1 bg-brand-bg">
        <AshAnalysisManager />
    </div>
  );
}
