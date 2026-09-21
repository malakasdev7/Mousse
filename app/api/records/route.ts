import { requireUser } from '@/lib/auth';
import { accessToken, sameOrigin, supabaseRequest, noStore } from '@/lib/supabase-server';
import { isRecordKind, validatePayload } from '@/lib/records';
import { recalculateRecords } from '@/lib/recipe-costs';

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: noStore });
type Row = { id: number; kind: string; payload: Record<string, unknown>; updated_at?: string };
async function readAll(token: string, storeId: string) {
  const rows: Row[] = [];
  for (let offset = 0; ; offset += 500) {
    const response = await supabaseRequest('/rest/v1/audit_records?select=id,kind,payload,updated_at&store_id=eq.' + storeId + '&order=id.desc&limit=500&offset=' + offset, token);
    if (!response.ok) throw new Error('READ_FAILED');
    const page = await response.json() as Row[];
    rows.push(...page);
    if (page.length < 500) return rows;
  }
}
async function handle(request: Request) {
  if (request.method !== 'GET' && !sameOrigin(request)) return json({ error: 'Origem inválida.' }, 403);
  try {
    const user = await requireUser(request);
    if (!user) return json({ error: 'Sessão expirada. Entre novamente.' }, 401);
    const token = accessToken(request);
    if (request.method === 'GET') return json(recalculateRecords(await readAll(token, user.storeId)));
    if (user.role === 'viewer' || (request.method === 'DELETE' && user.role !== 'admin')) return json({ error: 'Seu nível de acesso não permite esta ação.' }, 403);
    const text = await request.text();
    if (text.length > 2_000_000) return json({ error: 'Arquivo muito grande. Limite: 2 MB.' }, 413);
    let body;
    try { body = JSON.parse(text); } catch { return json({ error: 'Requisição inválida.' }, 400); }
    if (request.method === 'POST' && Array.isArray(body.records)) {
      if (user.role !== 'admin') return json({ error: 'Apenas administradores podem restaurar backups.' }, 403);
      if (!/^[a-f0-9]{64}$/.test(body.batchKey || '') || body.records.length < 1 || body.records.length > 1000) return json({ error: 'Backup inválido ou acima de 1000 registros.' }, 422);
      const ids = new Set<number>();
      for (const row of body.records) {
        if (!Number.isSafeInteger(row.id) || ids.has(row.id) || !isRecordKind(row.kind)) return json({ error: 'Backup com IDs duplicados ou tipos inválidos.' }, 422);
        ids.add(row.id);
        const valid = validatePayload(row.kind, row.payload);
        if (!valid.ok) return json({ error: valid.error }, 422);
        row.payload = valid.value;
      }
      const response = await supabaseRequest('/rest/v1/rpc/import_records', token, { method: 'POST', body: JSON.stringify({ p_store: user.storeId, p_batch: body.batchKey, p_records: body.records }) });
      if (!response.ok) return json({ error: 'Backup não importado. Confira referências e campos; nenhum registro parcial foi salvo.' }, 422);
      return json({ ok: true, count: await response.json() }, 201);
    }
    let current: Row | undefined;
    if (request.method !== 'POST') {
      if (!Number.isSafeInteger(body.id) || body.id <= 0) return json({ error: 'Registro inválido.' }, 422);
      const response = await supabaseRequest('/rest/v1/audit_records?select=id,kind,payload,updated_at&store_id=eq.' + user.storeId + '&id=eq.' + body.id, token);
      if (!response.ok) throw new Error('READ_FAILED');
      current = (await response.json())[0];
      if (!current) return json({ error: 'Registro não encontrado.' }, 404);
    }
    if (request.method === 'DELETE') {
      const rows = await readAll(token, user.storeId);
      const used = rows.some(row => row.id !== body.id && (
        row.payload.recipeId === body.id || row.payload.packagingId === body.id || row.payload.productId === body.id ||
        (current?.kind === 'recipe' && row.kind === 'product' && row.payload.recipe === current.payload.name) ||
        (Array.isArray(row.payload.items) && row.payload.items.some((x: {ingredientId?:number;subrecipeId?:number}) => x.ingredientId === body.id || x.subrecipeId === body.id))
      ));
      if (used) return json({ error: 'Este registro está em uso. Remova suas referências antes de excluir.' }, 409);
      const response = await supabaseRequest('/rest/v1/audit_records?store_id=eq.' + user.storeId + '&id=eq.' + body.id, token, { method: 'DELETE' });
      if (!response.ok) throw new Error('WRITE_FAILED');
      return json({ ok: true });
    }
    const kind = current?.kind || body.kind;
    if (!isRecordKind(kind)) return json({ error: 'Tipo de registro inválido.' }, 422);
    const valid = validatePayload(kind, { ...current?.payload, ...body.payload });
    if (!valid.ok) return json({ error: valid.error }, 422);
    if (kind === 'recipe' || kind === 'product') {
      const rows = await readAll(token, user.storeId);
      const projected = recalculateRecords([...rows.filter(row => row.id !== body.id), { id: body.id || -1, kind, payload: valid.value }]);
      const candidate = projected.find(row => row.id === (body.id || -1));
      if (candidate?.payload.costError) return json({ error: candidate.payload.costError }, 422);
    }
    const requestKey = request.headers.get('idempotency-key');
    if (request.method === 'POST' && !/^[a-f0-9-]{36}$/i.test(requestKey || '')) return json({ error: 'Identificador de salvamento ausente.' }, 422);
    if (request.method === 'POST') {
      const prior = await supabaseRequest('/rest/v1/audit_records?select=id,kind,payload&store_id=eq.' + user.storeId + '&request_key=eq.' + requestKey, token);
      if (!prior.ok) throw new Error('READ_FAILED');
      const rows = await prior.json();
      if (rows[0]) return json(rows[0]);
    }
    const path = request.method === 'POST' ? '/rest/v1/audit_records' : '/rest/v1/audit_records?store_id=eq.' + user.storeId + '&id=eq.' + body.id;
    const response = await supabaseRequest(path, token, {
      method: request.method === 'POST' ? 'POST' : 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(request.method === 'POST' ? { store_id: user.storeId, kind, payload: valid.value, request_key: requestKey } : { payload: valid.value }),
    });
    if (!response.ok) return json({ error: 'Não foi possível salvar. Seus campos foram mantidos; tente novamente.' }, 503);
    const result = (await response.json())[0];
    return json(result, request.method === 'POST' ? 201 : 200);
  } catch {
    return json({ error: 'Não foi possível acessar os dados da empresa. Verifique a conexão e tente novamente.' }, 503);
  }
}
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
