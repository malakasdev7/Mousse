import { sameOrigin, sessionResponse, supabaseRequest, noStore } from '@/lib/supabase-server';
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Origem inválida.' }, { status: 403 });
  try {
    const body = await request.json().catch(() => null);
    if (typeof body?.username !== 'string' || typeof body?.password !== 'string' || !/^[a-z0-9._-]{3,32}$/i.test(body.username.trim()) || body.password.length < 8 || body.password.length > 128)
      return Response.json({ error: 'Usuário ou senha inválidos.' }, { status: 401, headers: noStore });
    const response = await supabaseRequest('/functions/v1/login-username', '', { method: 'POST', body: JSON.stringify({ username: body.username, password: body.password }) });
    if (!response.ok) return Response.json({ error: response.status === 429 ? 'Muitas tentativas. Aguarde cinco minutos.' : 'Usuário ou senha inválidos.' }, { status: response.status === 429 ? 429 : response.status >= 500 ? 503 : 401, headers: noStore });
    const session = await response.json();
    if (!session.access_token || !session.refresh_token) throw new Error('INVALID_SESSION');
    return sessionResponse(session);
  } catch { return Response.json({ error: 'Login indisponível. Tente novamente.' }, { status: 503, headers: noStore }); }
}
