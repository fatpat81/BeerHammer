// BeerHammer — shared helpers for the auth Edge Functions.
import { createClient } from 'npm:@supabase/supabase-js@2';

const ALLOWED_ORIGINS = ['https://fatpat81.github.io', 'http://localhost:3000'];

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
}

// Service-role client: bypasses RLS. Server-side only, never sent to the browser.
export function adminClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Anon client: used server-side to perform the actual password sign-in.
export function anonClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const CALLSIGN_RE = /^[A-Za-z0-9 _-]{3,24}$/;
export const PASSCODE_RE = /^\d{4}$/;
export const AUTH_EMAIL_DOMAIN = Deno.env.get('AUTH_EMAIL_DOMAIN') ?? 'example.com';
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_DURATION = '15 minutes';

export function cleanCallsign(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const c = raw.trim().replace(/\s+/g, ' ');
  return CALLSIGN_RE.test(c) ? c : null;
}

// Supabase requires passwords of at least 6 characters, but the player-facing
// secret is a 4-digit passcode. The server expands it here; the browser never does.
export function derivePassword(callsign: string, passcode: string): string {
  return `bh1:${callsign.toLowerCase()}:${passcode}`;
}

export function sessionPayload(session: {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  token_type: string;
}) {
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    token_type: session.token_type,
  };
}
