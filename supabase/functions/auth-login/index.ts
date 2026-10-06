// BeerHammer — log in with callsign + tag + 4-digit passcode.
// Enforces lockout server-side and returns one generic error for every failure
// reason except "locked", so callsigns cannot be enumerated.
import {
  adminClient,
  anonClient,
  cleanCallsign,
  corsHeaders,
  derivePassword,
  json,
  LOCK_DURATION,
  MAX_FAILED_ATTEMPTS,
  PASSCODE_RE,
  sessionPayload,
} from '../_shared/common.ts';

const GENERIC_ERROR = 'Invalid callsign, tag or passcode.';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(req, { error: 'Invalid request' }, 400);
  }

  const callsign = cleanCallsign(body.callsign);
  const tag = Number(body.tag);
  const passcode = String(body.passcode ?? '');
  if (!callsign || !Number.isInteger(tag) || tag < 1000 || tag > 9999 || !PASSCODE_RE.test(passcode)) {
    return json(req, { error: 'Enter your callsign, 4-digit tag and 4-digit passcode.' }, 400);
  }

  const admin = adminClient();

  const { data: profile } = await admin
    .from('profiles')
    .select('id, callsign, tag')
    .eq('callsign_key', callsign.toLowerCase())
    .eq('tag', tag)
    .maybeSingle();

  if (!profile) {
    await sleep(300); // keep timing similar to a real failed attempt
    return json(req, { error: GENERIC_ERROR }, 401);
  }

  const { data: link } = await admin
    .from('auth_links')
    .select('login_email, locked_until')
    .eq('user_id', profile.id)
    .maybeSingle();

  if (!link) return json(req, { error: GENERIC_ERROR }, 401);

  if (link.locked_until && new Date(link.locked_until).getTime() > Date.now()) {
    const retryAfter = Math.ceil((new Date(link.locked_until).getTime() - Date.now()) / 1000);
    return json(req, { error: 'Too many attempts. Try again later.', locked: true, retryAfter }, 429);
  }

  const { data: signIn, error: signInError } = await anonClient().auth.signInWithPassword({
    email: link.login_email,
    password: derivePassword(callsign, passcode),
  });

  if (signInError || !signIn.session) {
    const { data: lockedUntil } = await admin.rpc('bh_register_failure', {
      p_user: profile.id,
      p_max: MAX_FAILED_ATTEMPTS,
      p_lock: LOCK_DURATION,
    });
    if (lockedUntil && new Date(lockedUntil).getTime() > Date.now()) {
      const retryAfter = Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 1000);
      return json(req, { error: 'Too many attempts. Try again later.', locked: true, retryAfter }, 429);
    }
    return json(req, { error: GENERIC_ERROR }, 401);
  }

  await admin.rpc('bh_reset_failures', { p_user: profile.id });

  return json(req, {
    session: sessionPayload(signIn.session),
    profile: { id: profile.id, callsign: profile.callsign, tag: profile.tag },
  });
});
