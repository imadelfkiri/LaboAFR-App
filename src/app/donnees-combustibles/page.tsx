
import { FuelDataManager } from '@/components/fuel-data-manager';
import type { Metadata } from 'next';
import { Cog } from 'lucide-react';

export const metadata: Metadata = {
  title: "Données des Combustibles | FuelTrack AFR",
  description: "Gérer les données de référence pour chaque type de combustible.",
};

export default function DonneesCombustiblesPage() {
  return (
     <div className="space-y-6 p-4 md:p-6 lg:p-8">
        <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-3">
                <Cog className="h-8 w-8"/>
                Données de Référence des Combustibles
            </h1>
            <p className="text-muted-foreground mt-1">Gérez la base de données centrale pour les caractéristiques des combustibles.</p>
        </div>
        <FuelDataManager />
    </div>
  );
}
