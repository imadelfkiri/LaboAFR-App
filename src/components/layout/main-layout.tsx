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
import { Fuel } from 'lucide-react';
import { SidebarNav } from './sidebar-nav';

export function MainLayout({ children }: { children: React.ReactNode }) {
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
        <header className="flex h-16 items-center gap-4 border-b bg-background/95 backdrop-blur-sm px-4 lg:px-6 sticky top-0 z-30">
            <SidebarTrigger className="md:hidden" />
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-background">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
