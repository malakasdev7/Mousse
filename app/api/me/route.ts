import { requireUser } from '@/lib/auth';

export async function GET(request: Request) {
  const user = await requireUser(request);
  const headers = { 'cache-control': 'private, no-store' };
  if (!user)
    return Response.json(
      { error: 'Não autenticado.' },
      { status: 401, headers },
    );
  return Response.json(user, { headers });
}
