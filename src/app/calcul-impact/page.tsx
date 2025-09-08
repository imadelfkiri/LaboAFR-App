import { ClinkerImpactCalculator } from "@/components/clinker-impact-calculator";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Calcul d'Impact Clinker | FuelTrack AFR",
  description: "Calculez l'impact des combustibles alternatifs sur la composition chimique du clinker.",
};

export default function CalculImpactPage() {
  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8">
      <ClinkerImpactCalculator />
    </div>
  );
}
