// ─────────────────────────────────────────────────────────────────────────────
// ForceOrg-40k — Supabase Client (Browser)
// ─────────────────────────────────────────────────────────────────────────────

import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

/**
 * Singleton Supabase browser client for use in client components.
 * Uses @supabase/ssr for cookie-based session management in Next.js.
 */
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
