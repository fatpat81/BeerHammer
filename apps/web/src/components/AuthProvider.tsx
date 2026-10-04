// ─────────────────────────────────────────────────────────────────────────────
// ForceOrg-40k — Authentication Provider
// Wraps Supabase Auth in a React context for the entire app
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase';
import type { User, Session, AuthError } from '@supabase/supabase-js';

// ── Types ───────────────────────────────────────────────────────────────────

export interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isGuest: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUpWithEmail: (email: string, password: string, callsign: string) => Promise<{ error: AuthError | null }>;
  signInWithGoogle: () => Promise<{ error: AuthError | null }>;
  signInAsGuest: (callsign?: string) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an <AuthProvider>');
  return ctx;
}

// ── Provider ────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = useMemo(() => createClient(), []);

  // ── Initialize session on mount ─────────────────────────────────────────
  useEffect(() => {
    const initSession = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession?.user) {
          setSession(currentSession);
          setUser(currentSession.user);
          setIsGuest(false);
          setIsLoading(false);
          return;
        }
      } catch {
        // Supabase unavailable or offline
      }

      // Check for persisted local guest session
      try {
        if (typeof window !== 'undefined') {
          const stored = localStorage.getItem('forceorg_local_user');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed && parsed.id) {
              setUser(parsed as User);
              setIsGuest(true);
            }
          }
        }
      } catch {
        // LocalStorage blocked
      }

      setIsLoading(false);
    };

    initSession();

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (newSession) {
          setSession(newSession);
          setUser(newSession.user);
          setIsGuest(false);
          setIsLoading(false);
        }
      },
    );

    return () => subscription.unsubscribe();
  }, [supabase]);

  // ── Auth Methods ────────────────────────────────────────────────────────

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error };
    },
    [supabase],
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string, callsign: string) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { callsign },
        },
      });
      return { error };
    },
    [supabase],
  );

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    return { error };
  }, [supabase]);

  const signInAsGuest = useCallback((callsign?: string) => {
    const cleanCallsign = (callsign || 'Commander').trim() || 'Commander';
    const guestUser: User = {
      id: `guest_${cleanCallsign.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Math.random().toString(36).slice(2, 6)}`,
      app_metadata: { provider: 'guest' },
      user_metadata: { callsign: cleanCallsign },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
      email: `${cleanCallsign.toLowerCase().replace(/[^a-z0-9]/g, '_')}@forceorg.local`,
      role: 'authenticated',
      updated_at: new Date().toISOString(),
    } as unknown as User;

    setUser(guestUser);
    setIsGuest(true);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('forceorg_local_user', JSON.stringify(guestUser));
      } catch {}
    }
  }, []);

  const signOut = useCallback(async () => {
    setUser(null);
    setSession(null);
    setIsGuest(false);
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('forceorg_local_user');
      } catch {}
    }
    try {
      await supabase.auth.signOut();
    } catch {}
  }, [supabase]);

  // ── Context Value ───────────────────────────────────────────────────────

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      isLoading,
      isGuest,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      signInAsGuest,
      signOut,
    }),
    [user, session, isLoading, isGuest, signInWithEmail, signUpWithEmail, signInWithGoogle, signInAsGuest, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
