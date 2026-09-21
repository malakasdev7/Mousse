import { readCookie, sameOrigin, sessionResponse, supabaseRequest, noStore } from '@/lib/supabase-server';
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Origem inválida.' }, { status: 403 });
  const refresh_token = readCookie(request, 'dm_refresh');
  if (!refresh_token) return Response.json({ error: 'Sessão expirada.' }, { status: 401, headers: noStore });
  try {
    const response = await supabaseRequest('/auth/v1/token?grant_type=refresh_token', '', { method: 'POST', body: JSON.stringify({ refresh_token }) });
    if (!response.ok) return Response.json({ error: 'Sessão expirada.' }, { status: 401, headers: noStore });
    return sessionResponse(await response.json());
  } catch { return Response.json({ error: 'Não foi possível renovar a sessão.' }, { status: 503, headers: noStore }); }
}
