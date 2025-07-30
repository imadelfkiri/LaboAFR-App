import { PciCalculator } from '@/components/pci-calculator';

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm">
      <div className="flex flex-col items-center gap-1 text-center p-4">
         <PciCalculator />
      </div>
    </div>
  );
}
