import { PciCalculator } from '@/components/pci-calculator';

export default function CalculatorPage() {
  return (
    <div className="flex flex-1 items-start justify-center bg-background p-4 sm:p-6 lg:p-8">
      <PciCalculator />
    </div>
  );
}
