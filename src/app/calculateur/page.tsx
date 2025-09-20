
import { PciCalculator } from '@/components/pci-calculator';

export default function CalculatorPage() {
  return (
    <div className="flex flex-col flex-1 items-center justify-start p-4 sm:p-6 lg:p-8 w-full">
      <PciCalculator />
    </div>
  );
}
