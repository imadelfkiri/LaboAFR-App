import { MixtureSimulator } from '@/components/mixture-simulator';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Simulation de Mélange | FuelTrack AFR",
  description: "Outil de simulation 'bac à sable' pour tester des scénarios de mélange.",
};

export default function SimulationMelangePage() {
  return (
     <div className="flex-1 bg-brand-bg">
        <MixtureSimulator />
    </div>
  );
}
