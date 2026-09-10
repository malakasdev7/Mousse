import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { auditLogs, auditRecords } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { isRecordKind, validatePayload } from '@/lib/records';

const noStore = { 'cache-control': 'private, no-store' };
const json = (body: unknown, init?: ResponseInit) => {
  const headers = new Headers(init?.headers);
  headers.set('cache-control', noStore['cache-control']);
  return Response.json(body, { ...init, headers });
};

async function parseBody(request: Request) {
  if (Number(request.headers.get('content-length') || 0) > 55_000)
    throw new Error('PAYLOAD_TOO_LARGE');
  return request.json();
}
function invalidRequest(error: unknown) {
  return json(
    {
      error:
        error instanceof Error && error.message === 'PAYLOAD_TOO_LARGE'
          ? 'Registro muito grande.'
          : 'Requisição inválida.',
    },
    { status: 400 },
  );
}

async function writeAudit(values: typeof auditLogs.$inferInsert) {
  try {
    const db = await getDb();
    await db.insert(auditLogs).values(values);
  } catch (err) {
    console.warn('Audit log write error:', err);
  }
}

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user)
    return json(
      { error: 'Sessão expirada. Entre novamente.' },
      { status: 401 },
    );
  try {
    const db = await getDb();
    const records = await db
      .select()
      .from(auditRecords)
      .where(eq(auditRecords.ownerId, user.dataOwnerId))
      .orderBy(desc(auditRecords.id))
      .limit(500);
    return json(
      records.map((record) => ({
        ...record,
        payload: JSON.parse(record.payloadJson),
      })),
    );
  } catch (err) {
    console.error('GET records error:', err);
    return json([], { status: 200 });
  }
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user)
    return json(
      { error: 'Sessão expirada. Entre novamente.' },
      { status: 401 },
    );
  if (user.role === 'viewer')
    return json({ error: 'Seu acesso é somente para consulta.' }, { status: 403 });
  try {
    const body = (await parseBody(request)) as {
      kind?: unknown;
      payload?: unknown;
    };
    if (!isRecordKind(body.kind))
      return json({ error: 'Tipo de registro inválido.' }, { status: 400 });
    const validated = validatePayload(body.kind, body.payload);
    if (!validated.ok) return json({ error: validated.error }, { status: 422 });
    const payloadJson = JSON.stringify(validated.value);
    const db = await getDb();
    const result = await db
      .insert(auditRecords)
      .values({ ownerId: user.dataOwnerId, kind: body.kind, payloadJson })
      .returning();
    void writeAudit({
      ownerId: user.dataOwnerId,
      recordId: result[0].id,
      kind: body.kind,
      action: 'create',
      afterJson: payloadJson,
    });
    return json({ ...result[0], payload: validated.value }, { status: 201 });
  } catch (error) {
    console.error('POST records error:', error);
    return invalidRequest(error);
  }
}

export async function PUT(request: Request) {
  const user = await requireUser(request);
  if (!user)
    return json(
      { error: 'Sessão expirada. Entre novamente.' },
      { status: 401 },
    );
  if (user.role === 'viewer')
    return json({ error: 'Seu acesso é somente para consulta.' }, { status: 403 });
  try {
    const body = (await parseBody(request)) as {
      id?: number;
      payload?: unknown;
    };
    if (!Number.isInteger(body.id) || Number(body.id) <= 0)
      return json({ error: 'Registro inválido.' }, { status: 400 });
    const db = await getDb();
    const current = await db
      .select()
      .from(auditRecords)
      .where(
        and(
          eq(auditRecords.id, body.id!),
          eq(auditRecords.ownerId, user.dataOwnerId),
        ),
      )
      .limit(1);
    if (!current[0] || !isRecordKind(current[0].kind))
      return json({ error: 'Registro não encontrado.' }, { status: 404 });
    const validated = validatePayload(current[0].kind, body.payload);
    if (!validated.ok) return json({ error: validated.error }, { status: 422 });
    const payloadJson = JSON.stringify(validated.value);
    const result = await db
      .update(auditRecords)
      .set({ payloadJson, updatedAt: new Date().toISOString() })
      .where(
        and(
          eq(auditRecords.id, body.id!),
          eq(auditRecords.ownerId, user.dataOwnerId),
        ),
      )
      .returning();
    void writeAudit({
      ownerId: user.dataOwnerId,
      recordId: body.id!,
      kind: current[0].kind,
      action: 'update',
      beforeJson: current[0].payloadJson,
      afterJson: payloadJson,
    });
    return json({ ...result[0], payload: validated.value });
  } catch (error) {
    console.error('PUT records error:', error);
    return invalidRequest(error);
  }
}

export async function DELETE(request: Request) {
  const user = await requireUser(request);
  if (!user)
    return json(
      { error: 'Sessão expirada. Entre novamente.' },
      { status: 401 },
    );
  if (user.role !== 'admin')
    return json(
      { error: 'Somente administradores podem excluir.' },
      { status: 403 },
    );
  try {
    const body = (await parseBody(request)) as { id?: number };
    if (!Number.isInteger(body.id) || Number(body.id) <= 0)
      return json({ error: 'Registro inválido.' }, { status: 400 });
    const db = await getDb();
    const current = await db
      .select()
      .from(auditRecords)
      .where(
        and(
          eq(auditRecords.id, body.id!),
          eq(auditRecords.ownerId, user.dataOwnerId),
        ),
      )
      .limit(1);
    if (!current[0])
      return json({ error: 'Registro não encontrado.' }, { status: 404 });
    void writeAudit({
      ownerId: user.dataOwnerId,
      recordId: body.id!,
      kind: current[0].kind,
      action: 'delete',
      beforeJson: current[0].payloadJson,
    });
    await db
      .delete(auditRecords)
      .where(
        and(
          eq(auditRecords.id, body.id!),
          eq(auditRecords.ownerId, user.dataOwnerId),
        ),
      );
    return json({ ok: true });
  } catch (error) {
    console.error('DELETE records error:', error);
    return invalidRequest(error);
  }
}
