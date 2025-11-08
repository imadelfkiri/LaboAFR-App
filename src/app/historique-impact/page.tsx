
import { ImpactHistoryTable } from '@/components/impact-history-table';
import type { Metadata } from 'next';
import { Book } from 'lucide-react';

export const metadata: Metadata = {
  title: "Historique des Calculs d'Impact | FuelTrack AFR",
  description: "Consulter l'historique des simulations d'impact sur le clinker.",
};

export default function HistoriqueImpactPage() {
  return (
     <div className="flex-1 p-4 md:p-6 lg:p-8 space-y-6">
       <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-3">
                <Book className="h-8 w-8"/>
                Historique des Calculs d'Impact
            </h1>
            <p className="text-muted-foreground mt-1">Consultez, analysez et comparez les simulations d'impact sur le clinker.</p>
        </div>
        <ImpactHistoryTable />
    </div>
  );
}
