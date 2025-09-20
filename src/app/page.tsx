import { MainDashboard } from '@/components/main-dashboard';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Tableau de Bord | FuelTrack AFR",
  description: "Vue d'ensemble des indicateurs clés, stocks et analyses.",
};

export default function Home() {
  return <MainDashboard />;
}
