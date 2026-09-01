import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { auditRecords } from '@/db/schema';
import { requireUser } from '@/lib/auth';

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return Response.json({ error: 'Não autenticado.' }, { status: 401 });
  const records = await getDb().select().from(auditRecords).where(eq(auditRecords.ownerId, user.id)).orderBy(desc(auditRecords.id)).limit(500);
  return Response.json(records.map((record) => ({ ...record, payload: JSON.parse(record.payloadJson) })));
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user) return Response.json({ error: 'Não autenticado.' }, { status: 401 });
  const body = await request.json() as { kind?: string; payload?: unknown };
  if (!body.kind || !body.payload) return Response.json({ error: 'Dados inválidos.' }, { status: 400 });
  const result = await getDb().insert(auditRecords).values({ ownerId: user.id, kind: body.kind, payloadJson: JSON.stringify(body.payload) }).returning();
  return Response.json({ ...result[0], payload: JSON.parse(result[0].payloadJson) }, { status: 201 });
}

export async function PUT(request: Request) {
  const user = await requireUser(request);
  if (!user) return Response.json({ error: 'Não autenticado.' }, { status: 401 });
  const body = await request.json() as { id?: number; payload?: unknown };
  if (!body.id || !body.payload) return Response.json({ error: 'Dados inválidos.' }, { status: 400 });
  const result = await getDb().update(auditRecords).set({ payloadJson: JSON.stringify(body.payload), updatedAt: new Date().toISOString() }).where(and(eq(auditRecords.id, body.id), eq(auditRecords.ownerId, user.id))).returning();
  if (!result[0]) return Response.json({ error: 'Registro não encontrado.' }, { status: 404 });
  return Response.json({ ...result[0], payload: JSON.parse(result[0].payloadJson) });
}

export async function DELETE(request: Request) {
  const user = await requireUser(request);
  if (!user) return Response.json({ error: 'Não autenticado.' }, { status: 401 });
  const body = await request.json() as { id?: number };
  if (!body.id) return Response.json({ error: 'Registro inválido.' }, { status: 400 });
  await getDb().delete(auditRecords).where(and(eq(auditRecords.id, body.id), eq(auditRecords.ownerId, user.id)));
  return Response.json({ ok: true });
}
