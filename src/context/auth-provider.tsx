
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';
import { getUserProfile, type UserProfile, getAllowedRoutesForRole } from '@/lib/data';
import type { User } from 'firebase/auth';

interface AuthContextType {
  user: User | null | undefined;
  userProfile: UserProfile | null;
  loading: boolean;
  allowedRoutes: string[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, authLoading, authError] = useAuthState(auth);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [allowedRoutes, setAllowedRoutes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfileAndRoutes = async () => {
      if (user) {
        try {
          const profile = await getUserProfile(user);
          setUserProfile(profile);
          if (profile) {
            const routes = await getAllowedRoutesForRole(profile.role);
            // Ensure the homepage is always accessible for logged-in users
            if (!routes.includes('/')) {
              routes.push('/');
            }
            setAllowedRoutes(routes);
          } else {
            setAllowedRoutes([]);
          }
        } catch (error) {
          console.error("Failed to fetch user profile or routes:", error);
          setUserProfile(null);
          setAllowedRoutes([]);
        }
      } else {
        setUserProfile(null);
        setAllowedRoutes([]);
      }
      setLoading(false);
    };

    if (!authLoading) {
      fetchProfileAndRoutes();
    }
  }, [user, authLoading]);

  const value = {
    user,
    userProfile,
    loading: authLoading || loading,
    allowedRoutes,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
