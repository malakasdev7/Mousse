import { requireUser } from '@/lib/auth';
import { accessToken, sameOrigin, supabaseRequest, noStore } from '@/lib/supabase-server';
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Origem inválida.' }, { status: 403 });
  try {
    const user = await requireUser(request);
    if (!user) return Response.json({ error: 'Sessão expirada.' }, { status: 401, headers: noStore });
    if (user.role !== 'admin') return Response.json({ error: 'Acesso negado.' }, { status: 403 });
    const body = await request.json();
    const response = await supabaseRequest('/functions/v1/account-admin', accessToken(request), { method: 'POST', body: JSON.stringify({ ...body, action: body.action === 'reset-password' ? 'reset-password' : 'create', storeId: user.storeId }) });
    return Response.json(await response.json(), { status: response.status, headers: noStore });
  } catch { return Response.json({ error: 'Não foi possível concluir. Tente novamente.' }, { status: 503, headers: noStore }); }
}
