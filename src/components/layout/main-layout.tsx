"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarInset,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Fuel, LogOut } from 'lucide-react';
import { SidebarNav } from './sidebar-nav';
import { auth } from '@/lib/firebase';
import { getAllowedRoutesForRole } from '@/lib/data';
import { Skeleton } from '../ui/skeleton';
import { useAuth } from '@/context/auth-provider';
import { ThemeToggleButton } from './theme-toggle-button';

export function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, userProfile, loading: authLoading } = useAuth();
  const [allowedRoutes, setAllowedRoutes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const isLoginPage = pathname === '/login';
  const isUnauthorizedPage = pathname === '/unauthorized';

  useEffect(() => {
    const checkAuthAndProfile = async () => {
      setLoading(true);

      if (authLoading) {
          return;
      }

      if (!user) {
        if (!isLoginPage) {
          router.push('/login');
        } else {
           setLoading(false);
        }
        return;
      }

      try {
        const routes = await getAllowedRoutesForRole(userProfile?.role || 'viewer');
        setAllowedRoutes(routes);

        if (!routes.includes(pathname) && !isUnauthorizedPage && !isLoginPage && pathname !== '/') {
            router.push('/unauthorized');
        }
      } catch (error) {
          console.error("Error fetching user roles:", error);
          router.push('/unauthorized');
      } finally {
          setLoading(false);
      }
    };

    checkAuthAndProfile();
  }, [user, userProfile, authLoading, router, pathname, isLoginPage, isUnauthorizedPage]);
  
  if (loading || authLoading) {
    if (isLoginPage || isUnauthorizedPage) {
        return <>{children}</>;
    }
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
  
  if (isLoginPage || isUnauthorizedPage) {
    return <>{children}</>;
  }

  const handleLogout = () => {
    auth.signOut();
    router.push('/login');
  };

  return (
    <SidebarProvider>
      <Sidebar className="shadow-lg">
        <SidebarHeader className="p-4">
          <div className="flex items-center gap-3">
            <div className='flex h-12 w-12 items-center justify-center rounded-lg bg-primary'>
                <Fuel className="h-7 w-7 text-background" />
            </div>
            <div className="flex flex-col">
                <h2 className="text-xl font-bold tracking-tight text-sidebar-primary-foreground">
                    FuelTrack
                </h2>
                <p className="text-xs text-sidebar-foreground/80">AFR Monitoring</p>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
            <SidebarNav allowedRoutes={allowedRoutes} />
        </SidebarContent>
         <SidebarContent className="mt-auto mb-4 text-center text-xs text-muted-foreground">
            © 2025 FuelTrack AFR
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="flex justify-between items-center px-6 py-4 bg-background/80 backdrop-blur-lg sticky top-0 z-20 border-b border-border/60 shadow-sm">
            <div className="flex items-center gap-2">
                <span className="text-green-400 text-2xl">⚡</span>
                <h1 className="text-xl font-bold text-foreground">FuelTrack AFR</h1>
            </div>
            <div className="flex items-center gap-4 text-muted-foreground">
                {user && (
                    <span className="text-sm">{user.email}</span>
                )}
                <ThemeToggleButton />
                <button onClick={handleLogout} className="px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors">
                    Déconnexion
                </button>
            </div>
        </header>
        <main className="p-6 animate-fadeIn">
            {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
