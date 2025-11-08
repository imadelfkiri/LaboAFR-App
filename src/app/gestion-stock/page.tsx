
import { StockManager } from '@/components/stock-manager';
import type { Metadata } from 'next';
import { Archive } from 'lucide-react';

export const metadata: Metadata = {
  title: "Gestion du Stock | FuelTrack AFR",
  description: "Gérer les stocks de combustibles alternatifs (AF).",
};

export default function GestionStockPage() {
  return (
     <div className="flex-1 p-4 md:p-6 lg:p-8 space-y-6">
       <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-3">
                <Archive className="h-8 w-8"/>
                Gestion des Stocks
            </h1>
            <p className="text-muted-foreground mt-1">Suivez les niveaux de stock et enregistrez les nouveaux arrivages.</p>
        </div>
        <StockManager />
    </div>
  );
}
