import { requireUser } from '@/lib/auth';

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return Response.json({ error: 'Não autenticado.' }, { status: 401 });
  return Response.json(user);
}
