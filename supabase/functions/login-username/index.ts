import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = { 'access-control-allow-origin': Deno.env.get('ALLOWED_ORIGIN') ?? 'https://doce-margem.mjmconstrutoras.chatgpt.site', 'access-control-allow-headers': 'apikey, content-type', 'access-control-allow-methods': 'POST, OPTIONS', 'content-type': 'application/json' };
const fail = (status = 401) => new Response(JSON.stringify({ error: status === 429 ? 'Muitas tentativas. Aguarde e tente novamente.' : 'Usuário ou senha inválidos.' }), { status, headers: cors });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return fail(405);
  const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
  const body = await request.json().catch(() => null) as { username?: string; password?: string } | null;
  const username = body?.username?.trim().toLowerCase() ?? '';
  const password = body?.password ?? '';
  if (!/^[a-z0-9._-]{3,32}$/.test(username) || password.length < 8 || password.length > 128) return fail();

  const url = Deno.env.get('SUPABASE_URL')!;
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const publishable = Deno.env.get('SUPABASE_ANON_KEY')!;
  const admin = createClient(url, secret, { auth: { persistSession: false } });
  const bucket = Math.floor(Date.now() / 300_000);
  const fingerprint = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${ip}:${username}:${bucket}:${Deno.env.get('LOGIN_PEPPER') ?? ''}`));
  const attemptKey = Array.from(new Uint8Array(fingerprint)).map(byte => byte.toString(16).padStart(2, '0')).join('');
  const { data: attempts } = await admin.rpc('register_login_attempt', { attempt_key: attemptKey });
  if (Number(attempts) > 8) return fail(429);
  const { data: profile } = await admin.from('profiles').select('internal_email').eq('username_normalized', username).maybeSingle();
  if (!profile?.internal_email) { await new Promise(resolve => setTimeout(resolve, 250)); return fail(); }
  const client = createClient(url, publishable, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email: profile.internal_email, password });
  if (error || !data.session) return fail();
  return new Response(JSON.stringify({ access_token: data.session.access_token, refresh_token: data.session.refresh_token, expires_in: data.session.expires_in }), { status: 200, headers: cors });
});
