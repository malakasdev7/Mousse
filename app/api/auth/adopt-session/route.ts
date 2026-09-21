import { sameOrigin, sessionResponse, supabaseRequest, noStore } from '@/lib/supabase-server';

// One-time bridge from the former supabase-js localStorage session to HttpOnly cookies.
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Origem inválida.' }, { status: 403, headers: noStore });
  const body = await request.json().catch(() => null);
  const access = typeof body?.access_token === 'string' ? body.access_token : '';
  const refresh = typeof body?.refresh_token === 'string' ? body.refresh_token : '';
  if (access.length > 5000 || refresh.length > 5000 || (!access && !refresh))
    return Response.json({ error: 'Sessão inválida.' }, { status: 401, headers: noStore });
  try {
    if (access) {
      const verified = await supabaseRequest('/auth/v1/user', access);
      if (verified.ok && refresh) return sessionResponse({ access_token: access, refresh_token: refresh, expires_in: 3600 });
    }
    if (refresh) {
      const renewed = await supabaseRequest('/auth/v1/token?grant_type=refresh_token', '', { method: 'POST', body: JSON.stringify({ refresh_token: refresh }) });
      if (renewed.ok) return sessionResponse(await renewed.json());
    }
  } catch {}
  return Response.json({ error: 'Sessão expirada.' }, { status: 401, headers: noStore });
}
