
import { RawMaterialsManager } from '@/components/raw-materials-manager';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Raw Materials | FuelTrack AFR",
  description: "Gérer les données des matières premières.",
};

export default function RawMaterialsPage() {
  return (
     <div className="flex-1 p-4 md:p-6 lg:p-8">
        <RawMaterialsManager />
    </div>
  );
}

