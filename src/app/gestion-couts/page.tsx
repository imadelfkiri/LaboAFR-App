
import { CostManager } from '@/components/cost-manager';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Gestion des Coûts | FuelTrack AFR",
  description: "Gérer les coûts des combustibles pour le calcul de mélange.",
};

export default function GestionCoutsPage() {
  return (
     <div className="flex-1">
        <CostManager />
    </div>
  );
}
