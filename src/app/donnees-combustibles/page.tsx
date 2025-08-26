import { FuelDataManager } from '@/components/fuel-data-manager';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Données des Combustibles | FuelTrack AFR",
  description: "Gérer les données de référence pour chaque type de combustible.",
};

export default function DonneesCombustiblesPage() {
  return (
     <div className="flex-1 p-4 md:p-6 lg:p-8">
        <FuelDataManager />
    </div>
  );
}
