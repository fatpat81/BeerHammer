// BeerHammer — create a callsign. Assigns a unique tag and returns a session.
// Never reveals whether a callsign/passcode combination "already exists".
import {
  adminClient,
  anonClient,
  AUTH_EMAIL_DOMAIN,
  cleanCallsign,
  corsHeaders,
  derivePassword,
  json,
  PASSCODE_RE,
  sessionPayload,
} from '../_shared/common.ts';

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
  const passcode = String(body.passcode ?? '');
  if (!callsign) {
    return json(req, { error: 'Callsign must be 3–24 characters: letters, numbers, spaces, - or _.' }, 400);
  }
  if (!PASSCODE_RE.test(passcode)) {
    return json(req, { error: 'Passcode must be exactly 4 digits.' }, 400);
  }

  const admin = adminClient();
  const email = `${crypto.randomUUID()}@${AUTH_EMAIL_DOMAIN}`;
  const password = derivePassword(callsign, passcode);

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { callsign },
  });
  if (createError || !created.user) {
    console.error('createUser failed', createError?.message);
    return json(req, { error: 'Could not create account. Please try again.' }, 500);
  }
  const userId = created.user.id;

  const cleanup = async () => {
    await admin.auth.admin.deleteUser(userId);
  };

  // Tags are unique per callsign (case-insensitive). Retry on collision.
  let tag = 0;
  let inserted = false;
  for (let attempt = 0; attempt < 25; attempt++) {
    tag = 1000 + Math.floor(Math.random() * 9000);
    const { error } = await admin.from('profiles').insert({ id: userId, callsign, tag });
    if (!error) {
      inserted = true;
      break;
    }
    if (error.code !== '23505') {
      console.error('profile insert failed', error.message);
      break;
    }
  }
  if (!inserted) {
    await cleanup();
    return json(req, { error: 'Could not allocate a tag. Please try again.' }, 500);
  }

  const { error: linkError } = await admin.from('auth_links').insert({ user_id: userId, login_email: email });
  if (linkError) {
    console.error('auth_links insert failed', linkError.message);
    await cleanup();
    return json(req, { error: 'Could not create account. Please try again.' }, 500);
  }

  const { data: signIn, error: signInError } = await anonClient().auth.signInWithPassword({ email, password });
  if (signInError || !signIn.session) {
    console.error('post-signup sign-in failed', signInError?.message);
    return json(req, { error: 'Account created. Please log in.', callsign, tag }, 201);
  }

  return json(req, { session: sessionPayload(signIn.session), profile: { id: userId, callsign, tag } }, 201);
});
