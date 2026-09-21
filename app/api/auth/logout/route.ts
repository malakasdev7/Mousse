import { accessToken, sameOrigin, sessionResponse, supabaseRequest } from '@/lib/supabase-server';
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Origem inválida.' }, { status: 403 });
  try { await supabaseRequest('/auth/v1/logout?scope=local', accessToken(request), { method: 'POST' }); } catch { /* Always clear this browser's cookies. */ }
  return sessionResponse(null);
}
