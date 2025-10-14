"use client";

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Fuel, LogOut, Factory } from 'lucide-react';
import { SidebarNav } from './sidebar-nav';
import { auth } from '@/lib/firebase';
import { getAllowedRoutesForRole } from '@/lib/data';
import { Skeleton } from '../ui/skeleton';
import { useAuth } from '@/context/auth-provider';
import { ThemeToggleButton } from './theme-toggle-button';
import { ScrollArea } from '@/components/ui/scroll-area';

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
    <div className="flex h-screen bg-[#080D16]">
        <aside className="w-64 bg-[#0B101A]/95 backdrop-blur-md text-gray-300 flex flex-col border-r border-gray-800 shadow-xl">
            {/* LOGO SECTION */}
            <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-800">
                <div className="bg-emerald-500/10 p-2 rounded-xl">
                <Factory className="text-emerald-400 w-6 h-6" />
                </div>
                <div>
                <h1 className="text-lg font-semibold text-white tracking-wide">FuelTrack</h1>
                <p className="text-xs text-gray-500">AFR Monitoring</p>
                </div>
            </div>

            <SidebarNav userRole={userProfile?.role || 'viewer'} allowedRoutes={allowedRoutes} />
            
            <div className="px-3 py-4 space-y-4">
               {user && (
                  <div className="px-4 py-3 rounded-xl bg-brand-surface/50 border border-brand-line/50 text-center">
                     <p className="text-sm font-medium text-white truncate">{user.email}</p>
                     <p className="text-xs text-emerald-400 capitalize">{userProfile?.role}</p>
                  </div>
               )}
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-red-400 bg-red-900/40 hover:bg-red-900/60 transition-colors"
                >
                    <LogOut className="w-5 h-5" />
                    <span>Déconnexion</span>
                </button>
                 <div className="text-center text-xs text-gray-500 py-2">
                    © {new Date().getFullYear()} FuelTrack AFR
                </div>
            </div>
        </aside>
        
        <main className="flex-1 flex flex-col overflow-hidden">
             <header className="flex-shrink-0 flex justify-end items-center px-6 py-4 bg-background/80 backdrop-blur-lg sticky top-0 z-20 border-b border-border/60 shadow-sm">
                <ThemeToggleButton />
            </header>
             <ScrollArea className="flex-grow">
                 <div className="p-6">
                    {children}
                 </div>
            </ScrollArea>
        </main>
    </div>
  );
}
