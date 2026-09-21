import { requireUser } from '@/lib/auth';
import { accessToken, sameOrigin, supabaseRequest, noStore } from '@/lib/supabase-server';
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Origem inválida.' }, { status: 403 });
  try {
    if (!await requireUser(request)) return Response.json({ error: 'Sessão expirada.' }, { status: 401, headers: noStore });
    const body = await request.json();
    if (typeof body.password !== 'string' || body.password.length < 10 || body.password.length > 128) return Response.json({ error: 'Use uma senha de 10 a 128 caracteres.' }, { status: 422 });
    const result = await supabaseRequest('/auth/v1/user', accessToken(request), { method: 'PUT', body: JSON.stringify({ password: body.password }) });
    return Response.json(result.ok ? { ok: true } : { error: 'Não foi possível alterar a senha. Entre novamente e tente outra senha.' }, { status: result.ok ? 200 : 422, headers: noStore });
  } catch { return Response.json({ error: 'Serviço indisponível. Tente novamente.' }, { status: 503, headers: noStore }); }
}
