import { ImpactHistoryTable } from '@/components/impact-history-table';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Historique des Calculs d'Impact | FuelTrack AFR",
  description: "Consulter l'historique des simulations d'impact sur le clinker.",
};

export default function HistoriqueImpactPage() {
  return (
     <div className="flex-1 p-4 md:p-6 lg:p-8">
        <ImpactHistoryTable />
    </div>
  );
}
