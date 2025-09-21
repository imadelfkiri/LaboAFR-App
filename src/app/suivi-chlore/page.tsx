
import { ChlorineTrackingManager } from '@/components/chlorine-tracking-manager';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Suivi du Chlore | FuelTrack AFR",
  description: "Suivi de la corrélation entre le chlore du mélange, le chlore de la farine et le débit des AFs.",
};

export default function SuiviChlorePage() {
  return (
     <div className="flex-1 p-4 md:p-6 lg:p-8">
        <ChlorineTrackingManager />
    </div>
  );
}
