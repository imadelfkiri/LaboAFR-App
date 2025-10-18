
"use client";

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { SidebarNav } from './sidebar-nav';
import { auth } from '@/lib/firebase';
import { Skeleton } from '../ui/skeleton';
import { useAuth } from '@/context/auth-provider';
import { ThemeToggleButton } from './theme-toggle-button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, userProfile, loading: authLoading } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const isPublicPage = ['/login', '/unauthorized'].includes(pathname);

  useEffect(() => {
    if (!authLoading && !user && !isPublicPage) {
      router.push('/login');
    }
  }, [user, authLoading, isPublicPage, router]);

  if (authLoading) {
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

  if (isPublicPage) {
    return <>{children}</>;
  }

  const handleLogout = () => {
    auth.signOut();
    router.push('/login');
  };

  return (
    <div className="flex h-screen bg-[#080D16]">
        
        {userProfile && (
            <SidebarNav 
                userRole={userProfile.role}
                isOpen={isSidebarOpen}
                setIsOpen={setIsSidebarOpen}
            />
        )}
        
        <div className={cn(
            "flex-1 flex flex-col overflow-hidden transition-all duration-300",
             isSidebarOpen ? "ml-[250px]" : "ml-[80px]"
        )}>
             <header className="flex-shrink-0 flex justify-between items-center px-6 py-4 bg-background/80 backdrop-blur-lg sticky top-0 z-20 border-b border-border/60 shadow-sm">
                {userProfile ? (
                  <div className="px-4 py-2 rounded-xl bg-brand-surface/50 border border-brand-line/50 text-center">
                     <p className="text-sm font-medium text-white truncate">{user?.email}</p>
                     <p className="text-xs text-emerald-400 capitalize">{userProfile.role}</p>
                  </div>
               ) : <div />}
               <div className="flex items-center gap-2">
                <ThemeToggleButton />
                <button
                    onClick={handleLogout}
                    className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-red-400 bg-red-900/40 hover:bg-red-900/60 transition-colors"
                >
                    <LogOut className="w-4 h-4" />
                </button>
               </div>
            </header>
             <ScrollArea className="flex-grow">
                 <main className="p-6">
                    {children}
                 </main>
            </ScrollArea>
        </div>
    </div>
  );
}
