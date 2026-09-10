export const recordKinds = [
  'ingredient',
  'packaging',
  'expense',
  'recipe',
  'product',
  'sale',
] as const;
export type RecordKind = (typeof recordKinds)[number];

const limits = { name: 120, short: 80, notes: 2000 };

export function isRecordKind(value: unknown): value is RecordKind {
  return typeof value === 'string' && recordKinds.includes(value as RecordKind);
}

export function validatePayload(
  kind: RecordKind,
  payload: unknown,
): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload))
    return { ok: false, error: 'Conteúdo inválido.' };
  const value = payload as Record<string, unknown>;
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  if (!name || name.length > limits.name)
    return {
      ok: false,
      error: 'Informe um nome válido com até 120 caracteres.',
    };
  const serialized = JSON.stringify(value);
  if (serialized.length > 50_000)
    return { ok: false, error: 'Registro muito grande.' };
  for (const [key, field] of Object.entries(value)) {
    if (typeof field === 'number' && (!Number.isFinite(field) || field < 0))
      return {
        ok: false,
        error: `O campo ${key} precisa ser um número positivo.`,
      };
    if (
      typeof field === 'string' &&
      field.length > (key === 'notes' ? limits.notes : limits.short) &&
      key !== 'name'
    )
      return { ok: false, error: `O campo ${key} excede o tamanho permitido.` };
  }
  if (kind === 'recipe' && Number(value.yieldQty) <= 0)
    return {
      ok: false,
      error: 'O rendimento da receita deve ser maior que zero.',
    };
  return { ok: true, value: { ...value, name } };
}
