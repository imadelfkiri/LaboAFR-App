import { PciCalculator } from '@/components/pci-calculator';

export default function Home() {
  return (
    <div className="flex flex-1 items-start justify-center rounded-lg border border-dashed shadow-sm p-4 md:p-6">
      <PciCalculator />
    </div>
  );
}
