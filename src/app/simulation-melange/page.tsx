
import { MixtureSimulator } from '@/components/mixture-simulator';
import type { Metadata } from 'next';
import { FlaskConical } from 'lucide-react';

export const metadata: Metadata = {
  title: "Simulation de Mélange | FuelTrack AFR",
  description: "Outil de simulation 'bac à sable' pour tester des scénarios de mélange.",
};

export default function SimulationMelangePage() {
  return (
     <div className="flex-1 bg-brand-bg">
        <div className="p-4 md:p-6 lg:p-8">
             <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-3">
                <FlaskConical className="h-8 w-8"/>
                Simulation de Mélange (Bac à Sable)
            </h1>
            <p className="text-muted-foreground mt-1">Testez librement différentes recettes sans impacter les données réelles.</p>
        </div>
        <MixtureSimulator />
    </div>
  );
}
