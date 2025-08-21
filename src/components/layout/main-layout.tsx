"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Fuel, Plus, PlusCircle } from 'lucide-react';
import { SidebarNav } from './sidebar-nav';

const pageTitles: { [key: string]: string } = {
  '/calculateur': 'Calculateur PCI',
  '/resultats': 'Historique des Résultats',
  '/statistiques': 'Tableau de Bord des Statistiques',
  '/specifications': 'Spécifications Techniques',
  '/calcul-melange': 'Calcul de Mélange',
  '/indicateurs': 'Indicateurs',
  '/calcul-impact': "Calcul d'Impact",
};

export function MainLayout({ children }: { children: React.ReactNode }) {
  const [isClient, setIsClient] = React.useState(false);
  const pathname = usePathname();
  const title = pageTitles[pathname] || 'FuelTrack AFR';

  React.useEffect(() => {
    setIsClient(true);
  }, []);

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
            <SidebarTrigger />
          </div>
          <div className="flex-1 text-center">
            {isClient && title && <h1 className="text-xl font-bold tracking-tight">{title}</h1>}
          </div>
           <div className="flex items-center justify-end" style={{ minWidth: '180px' }}>
             {isClient && pathname === '/resultats' && (
                <Button asChild size="sm" className="bg-green-600 hover:bg-green-700 text-white">
                  <Link href="/calculateur">
                    <Plus className="mr-2 h-4 w-4" />
                    Ajouter un Résultat
                  </Link>
                </Button>
            )}
             {isClient && pathname === '/specifications' && (
                <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => (window as any).openSpecModal()}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Ajouter une spécification
                </Button>
            )}
          </div>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
