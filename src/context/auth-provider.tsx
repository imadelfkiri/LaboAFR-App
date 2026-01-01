
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
      // MOCK USER FOR DEVELOPMENT
      const mockUser = {
        uid: 'dev-user-id',
        email: 'dev@laboafr.com',
        displayName: 'Dev User',
      } as User;

      const mockProfile: UserProfile = {
        id: 'dev-user-id',
        email: 'dev@laboafr.com',
        role: 'admin', // Assume admin to see all features
        name: 'Dev User',
        createdAt: new Date(),
      };

      // Use real user if available, otherwise use mock user
      const activeUser = user || mockUser; // CHANGED for Dev

      if (activeUser) {
        try {
          // Skip actual firestore fetch for dev if no real user
          let profile = null;
          if (user) {
            profile = await getUserProfile(user);
          } else {
            profile = mockProfile;
          }

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
          setUserProfile(mockProfile); // Fallback to mock
          setAllowedRoutes(['/', '/dashboard']); // Allow main routes
        }
      } else {
        setUserProfile(null);
        setAllowedRoutes([]);
      }
      setLoading(false);
    };

    // removed !authLoading check to force load immediately for dev
    fetchProfileAndRoutes();
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
