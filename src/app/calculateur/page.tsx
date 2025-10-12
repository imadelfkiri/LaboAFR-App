
import { PciCalculator } from '@/components/pci-calculator';
import { UserProfile } from '@/lib/data';

export default function CalculatorPage({ userProfile }: { userProfile: UserProfile | null }) {
  return (
    <div className="flex flex-col flex-1 items-center justify-start w-full">
      <PciCalculator userProfile={userProfile} />
    </div>
  );
}
