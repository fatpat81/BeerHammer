// ─────────────────────────────────────────────────────────────────────────────
// ForceOrg-40k — Dedicated Login Route (/login)
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import LoginPage from '@/components/LoginPage';
import { FullPageSkeleton } from '@/components/Skeleton';

export default function LoginRoute() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return <FullPageSkeleton />;
  }

  if (user) {
    return null;
  }

  return <LoginPage />;
}
