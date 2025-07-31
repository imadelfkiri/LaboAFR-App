"use client";

import React from 'react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Fuel } from 'lucide-react';
import { SidebarNav } from './sidebar-nav';
import { usePathname } from 'next/navigation';

function HeaderTitle() {
    const pathname = usePathname();
    let title = "Calculateur PCI";
    if (pathname === '/resultats') {
        title = "Historique des Résultats";
    }
    return <h1 className="text-xl font-semibold">{title}</h1>
}


export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-10 w-10 bg-primary/10 hover:bg-primary/20">
                <Fuel className="h-6 w-6 text-primary" />
            </Button>
            <div className="flex flex-col">
                <h2 className="text-lg font-semibold tracking-tight text-primary font-headline">
                    FuelTrack
                </h2>
                <p className="text-xs text-muted-foreground">AFR</p>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
            <SidebarNav />
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center gap-4 border-b bg-background/50 backdrop-blur-sm px-4 lg:h-[60px] lg:px-6 sticky top-0 z-30">
            <SidebarTrigger className="md:hidden" />
            <div className='flex-1'>
                <HeaderTitle />
            </div>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-muted/40">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
