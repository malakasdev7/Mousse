import { desc } from 'drizzle-orm';
import { getDb } from '@/db';
import { auditRecords } from '@/db/schema';

export async function GET() {
  const records = await getDb().select().from(auditRecords).orderBy(desc(auditRecords.id)).limit(100);
  return Response.json(records.map((record) => ({ ...record, payload: JSON.parse(record.payloadJson) })));
}

export async function POST(request: Request) {
  const body = await request.json() as { kind?: string; payload?: unknown };
  if (!body.kind || !body.payload) return Response.json({ error: 'Dados inválidos.' }, { status: 400 });
  const result = await getDb().insert(auditRecords).values({ kind: body.kind, payloadJson: JSON.stringify(body.payload) }).returning();
  return Response.json(result[0], { status: 201 });
}
