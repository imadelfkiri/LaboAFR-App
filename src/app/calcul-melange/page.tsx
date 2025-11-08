
import { MixtureCalculator } from '@/components/mixture-calculator';
import type { Metadata } from 'next';
import { Beaker } from 'lucide-react';

export const metadata: Metadata = {
  title: "Calcul de Mélange | FuelTrack AFR",
  description: "Outil de simulation pour la préparation de mélanges de combustibles alternatifs (AF).",
};

export default function CalculMelangePage() {
  return (
     <div className="flex-1 bg-brand-bg">
        <MixtureCalculator />
    </div>
  );
}
