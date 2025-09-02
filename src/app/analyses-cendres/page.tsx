import { AshAnalysisManager } from '@/components/ash-analysis-manager';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Analyses des Cendres | FuelTrack AFR",
  description: "Suivi des analyses chimiques des cendres des combustibles alternatifs (AF).",
};

export default function AnalysesCendresPage() {
  return (
     <div className="flex-1 p-4 md:p-6 lg:p-8">
        <AshAnalysisManager />
    </div>
  );
}
