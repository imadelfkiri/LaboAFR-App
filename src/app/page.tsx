import { PciCalculator } from '@/components/pci-calculator';
import { Fuel, Droplets } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4 sm:p-6 lg:p-8">
      <header className="mb-8 text-center">
        <div className="inline-flex items-center gap-4 mb-4">
           <div className="p-3 bg-primary/10 rounded-full shadow-inner">
            <Fuel className="h-10 w-10 text-primary" />
           </div>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-primary sm:text-5xl lg:text-6xl font-headline">
          FuelTrack AFR
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Calculez la valeur PCI brute de vos combustibles alternatifs rapidement et avec précision.
        </p>
      </header>
      <PciCalculator />
    </div>
  );
}
