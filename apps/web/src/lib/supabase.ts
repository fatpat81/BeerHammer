// ─────────────────────────────────────────────────────────────────────────────
// ForceOrg-40k — Legacy Auth Client (in-browser local persistence)
// Retrieves a session token for the API when available; the app degrades to
// guest/local-persistence mode when no session exists.
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
