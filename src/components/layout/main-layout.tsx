
"use client";

import React, { useEffect, useState, useMemo } from 'react';
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
import { getUserProfile, roleAccess, UserProfile, getAllowedRoutesForRole } from '@/lib/data';
import { Skeleton } from '../ui/skeleton';

export function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, authLoading, authError] = useAuthState(auth);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [allowedRoutes, setAllowedRoutes] = useState<string[]>([]);

  const isLoginPage = pathname === '/login';
  const isUnauthorizedPage = pathname === '/unauthorized';

  useEffect(() => {
    const checkAuthAndProfile = async () => {
      setLoading(true);

      // Wait for Firebase Auth to initialize
      if (authLoading) {
          return;
      }

      // If user is not logged in, redirect to login page
      if (!user) {
        if (!isLoginPage) {
          router.push('/login');
        } else {
           setLoading(false);
        }
        return;
      }

      // If user is logged in, fetch their profile
      try {
        const profile = await getUserProfile(user);
        setUserProfile(profile);

        const routes = await getAllowedRoutesForRole(profile?.role || 'viewer');
        setAllowedRoutes(routes);

        // Check for access rights
        if (!routes.includes(pathname) && !isUnauthorizedPage && !isLoginPage && pathname !== '/') {
            router.push('/unauthorized');
        }
      } catch (error) {
          console.error("Error fetching user profile or roles:", error);
          router.push('/unauthorized');
      } finally {
          setLoading(false);
      }
    };

    checkAuthAndProfile();
  }, [user, authLoading, router, pathname, isLoginPage, isUnauthorizedPage]);
  
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
      <Sidebar>
        <SidebarHeader className="p-4">
          <div className="flex items-center gap-3">
            <div className='flex h-10 w-10 items-center justify-center rounded-lg bg-primary'>
                <Fuel className="h-6 w-6 text-primary-foreground" />
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
            <SidebarNav allowedRoutes={allowedRoutes} />
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-[60px] items-center justify-between gap-4 border-b bg-slate-900 px-6 sticky top-0 z-30 text-white">
            <div className="text-lg font-bold">⚡ FuelTrack AFR Monitoring</div>
            <div className="flex items-center gap-4">
                {user && (
                    <span className="text-sm text-slate-300">👋 {user.email}</span>
                )}
                 <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleLogout}
                    className="bg-red-500 hover:bg-red-600 rounded-lg font-bold"
                 >
                    Déconnexion
                 </Button>
            </div>
        </header>
        <div style={{marginTop: '20px'}}>
            {user ? children : null}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
