
"use client";

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Fuel, PlusCircle, LogOut } from 'lucide-react';
import { SidebarNav } from './sidebar-nav';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';
import { Skeleton } from '../ui/skeleton';

const pageTitles: { [key: string]: string } = {
  '/': 'Tableau de Bord',
  '/rapport-synthese': 'Rapport de Synthèse',
  '/calculateur': 'Calculateur PCI',
  '/resultats': 'Résultats',
  '/statistiques': 'Statistiques',
  '/specifications': 'Spécifications',
  '/analyses-cendres': 'Analyses Cendres',
  '/donnees-combustibles': 'Données Combustibles',
  '/calcul-melange': 'Calcul de Mélange',
  '/simulation-melange': 'Simulation de Mélange',
  '/gestion-couts': 'Gestion des Coûts',
  '/gestion-stock': 'Gestion du Stock',
  '/indicateurs': 'Indicateurs',
  '/calcul-impact': "Calcul d'Impact",
  '/historique-impact': "Historique Impact",
  '/suivi-chlore': 'Suivi Chlore',
};

export function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, loading, error] = useAuthState(auth);
  const title = pageTitles[pathname] || 'FuelTrack AFR';
  
  const isLoginPage = pathname === '/login';

  useEffect(() => {
    if (!loading && !user && !isLoginPage) {
      router.push('/login');
    }
  }, [user, loading, router, isLoginPage, pathname]);

  if (loading && !isLoginPage) {
    return (
        <div className="flex h-screen w-screen items-center justify-center">
            <div className="flex items-center space-x-4">
                <Skeleton className="h-12 w-12 rounded-full bg-primary/20" />
                <div className="space-y-2">
                    <Skeleton className="h-4 w-[250px] bg-primary/10" />
                    <Skeleton className="h-4 w-[200px] bg-primary/10" />
                </div>
            </div>
        </div>
    );
  }

  if (isLoginPage) {
    return <>{children}</>;
  }

  const handleLogout = () => {
    auth.signOut();
    router.push('/login');
  };

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="p-4">
          <div className="flex items-center gap-3">
            <div className='flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-primary'>
                <Fuel className="h-6 w-6 text-sidebar-primary-foreground" />
            </div>
            <div className="flex flex-col">
                <h2 className="text-lg font-bold tracking-tight text-sidebar-primary-foreground">
                    FuelTrack
                </h2>
                <p className="text-xs text-sidebar-foreground/80">AFR Monitoring</p>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
            <SidebarNav />
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-16 items-center justify-between gap-4 border-b bg-background/95 backdrop-blur-sm px-4 lg:px-6 sticky top-0 z-30">
            <div className="flex items-center gap-2">
                <SidebarTrigger className="flex" />
                <h1 className="text-xl font-bold tracking-tight">{title}</h1>
            </div>
            <div className="flex items-center justify-end gap-2" style={{ minWidth: '180px' }}>
                {pathname === '/specifications' && (
                    <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => (window as any).openSpecModal()}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Ajouter une spécification
                    </Button>
                )}
                 <Button variant="ghost" size="sm" onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Déconnexion
                 </Button>
            </div>
        </header>
        {user ? children : null}
      </SidebarInset>
    </SidebarProvider>
  );
}
