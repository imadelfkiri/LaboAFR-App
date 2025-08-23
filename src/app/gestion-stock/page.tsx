
import { StockManager } from '@/components/stock-manager';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Gestion du Stock | FuelTrack AFR",
  description: "Gérer les stocks de combustibles alternatifs (AF).",
};

export default function GestionStockPage() {
  return (
     <div className="flex-1 p-4 md:p-6 lg:p-8">
        <StockManager />
    </div>
  );
}
