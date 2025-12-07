"use client"
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function UnauthorizedPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-unauthorized-bg text-white text-center">
      <h1 className="text-4xl font-bold mb-4">🚫 Accès Refusé</h1>
      <p className="text-lg mb-8">Vous n’avez pas les autorisations nécessaires pour accéder à cette page.</p>
      <Button
        onClick={() => router.push('/')}
        className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 px-6 rounded-lg text-base"
      >
        Retour au Tableau de Bord
      </Button>
    </div>
  );
}
