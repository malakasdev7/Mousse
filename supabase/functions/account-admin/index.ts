import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const origin = Deno.env.get('ALLOWED_ORIGIN') ?? 'https://doce-margem.mjmconstrutoras.chatgpt.site';
const headers = { 'access-control-allow-origin': origin, 'access-control-allow-headers': 'apikey, authorization, content-type', 'access-control-allow-methods': 'POST, OPTIONS', 'content-type': 'application/json' };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const validUsername = (value: string) => /^[a-z0-9._-]{3,32}$/.test(value);

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return reply({ error: 'Método inválido.' }, 405);
  const url = Deno.env.get('SUPABASE_URL')!;
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, secret, { auth: { persistSession: false } });
  const body = await request.json().catch(() => null) as { action?: string; username?: string; password?: string; displayName?: string; role?: 'admin' | 'employee' | 'viewer'; storeName?: string; legacyOwnerId?: string } | null;
  const username = body?.username?.trim().toLowerCase() ?? '';
  const password = body?.password ?? '';
  const displayName = body?.displayName?.trim() ?? '';
  if (!validUsername(username) || password.length < 10 || password.length > 128 || !displayName || displayName.length > 100) return reply({ error: 'Dados da conta inválidos.' }, 422);

  let storeId: string;
  let role: 'admin' | 'employee' | 'viewer' = body?.role ?? 'viewer';
  if (body?.action === 'bootstrap') {
    const { count } = await admin.from('stores').select('id', { count: 'exact', head: true });
    if (count && count > 0) return reply({ error: 'A conta inicial já foi criada.' }, 409);
    role = 'admin';
    storeId = '';
  } else {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
    const { data: authData } = await admin.auth.getUser(token);
    if (!authData.user) return reply({ error: 'Sessão inválida.' }, 401);
    const { data: membership } = await admin.from('store_members').select('store_id,role').eq('user_id', authData.user.id).eq('role', 'admin').maybeSingle();
    if (!membership) return reply({ error: 'Acesso negado.' }, 403);
    storeId = membership.store_id;
  }

  const internalEmail = `${username}.${crypto.randomUUID()}@users.doce-margem.invalid`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({ email: internalEmail, password, email_confirm: true, user_metadata: { display_name: displayName } });
  if (createError || !created.user) return reply({ error: createError?.message?.includes('already') ? 'Usuário já cadastrado.' : 'Não foi possível criar a conta.' }, 400);
  try {
    await admin.from('profiles').insert({ user_id: created.user.id, username, internal_email: internalEmail, display_name: displayName }).throwOnError();
    if (body?.action === 'bootstrap') {
      const { data: store } = await admin.from('stores').insert({ name: body.storeName?.trim() || 'Doce Margem', created_by: created.user.id, legacy_owner_id: body.legacyOwnerId || null }).select('id').single().throwOnError();
      storeId = store.id;
    }
    await admin.from('store_members').insert({ store_id: storeId, user_id: created.user.id, role, created_by: created.user.id }).throwOnError();
    return reply({ ok: true, username, role }, 201);
  } catch {
    await admin.auth.admin.deleteUser(created.user.id);
    return reply({ error: 'Não foi possível concluir a conta.' }, 500);
  }
});
