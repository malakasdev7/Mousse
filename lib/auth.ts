import { getDb } from '@/db';
import { users } from '@/db/schema';

export type CurrentUser = { id: string; email: string; name: string };

function decodeName(request: Request) {
  const value = request.headers.get('oai-authenticated-user-full-name');
  if (!value) return '';
  if (request.headers.get('oai-authenticated-user-full-name-encoding') !== 'percent-encoded-utf-8') return value;
  try { return decodeURIComponent(value); } catch { return ''; }
}

export async function requireUser(request: Request): Promise<CurrentUser | null> {
  const id = request.headers.get('oai-authenticated-user-id');
  const email = request.headers.get('oai-authenticated-user-email');
  if (!id || !email) return null;
  const name = decodeName(request) || email.split('@')[0];
  await getDb().insert(users).values({ id, email, name, role: 'user' }).onConflictDoUpdate({
    target: users.id,
    set: { email, name, updatedAt: new Date().toISOString() },
  });
  return { id, email, name };
}
