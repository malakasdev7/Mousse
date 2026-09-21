export const recordKinds = [
  'ingredient',
  'packaging',
  'expense',
  'recipe',
  'product',
  'sale',
  'supplier',
  'scenario',
  'settings',
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
    if (typeof field === 'number' && !Number.isFinite(field))
      return {
        ok: false,
        error: `O campo ${key} precisa ser um número válido.`,
      };
    if (
      typeof field === 'string' &&
      field.length > (['notes', 'instructions', 'costError'].includes(key) ? limits.notes : limits.short) &&
      key !== 'name'
    )
      return { ok: false, error: `O campo ${key} excede o tamanho permitido.` };
  }
  if (kind === 'recipe' && (!Number.isFinite(value.yieldQty) || Number(value.yieldQty) <= 0))
    return {
      ok: false,
      error: 'O rendimento da receita deve ser maior que zero.',
    };
  const nonnegative = ['price','qty','pack','stock','minStock','yieldQty','waste','wastePercent','quantity','unitPrice','discount','fee','deliveryCost','ingredientsCost','packagingCost','labor','extras','fees','fixedAllocation','totalWeight','totalVolume','additionalCost','wholesalePrice'];
  for (const key of nonnegative) {
    if (value[key] !== undefined && (typeof value[key] !== 'number' || !Number.isFinite(value[key]) || Number(value[key]) < 0)) return { ok: false, error: `Informe um valor não negativo para ${key}.` };
  }
  if (kind === 'ingredient' && (!(Number(value.qty) > 0) || typeof value.price !== 'number' || !['g','ml','un'].includes(String(value.baseUnit)))) return { ok: false, error: 'Informe quantidade útil, preço e unidade (g, ml ou un).' };
  if (kind === 'packaging' && (!(Number(value.pack) > 0) || typeof value.price !== 'number')) return { ok: false, error: 'Informe quantidade e preço da embalagem.' };
  if (kind === 'sale' && !(Number(value.quantity) > 0)) return { ok: false, error: 'A quantidade vendida deve ser maior que zero.' };
  for (const key of ['waste','wastePercent','taxPercent','cardPercent','marketplacePercent','commissionPercent','targetMarginPercent']) {
    if (value[key] !== undefined && (typeof value[key] !== 'number' || Number(value[key]) < 0 || Number(value[key]) >= 100)) return { ok: false, error: `O percentual ${key} deve estar entre 0 e menos de 100.` };
  }
  if (kind === 'product' && ['taxPercent','cardPercent','marketplacePercent','commissionPercent'].reduce((sum, key) => sum + Number(value[key] || 0), Number(value.targetMarginPercent ?? value.margin ?? 0)) >= 100) return { ok: false, error: 'Taxas e margem devem somar menos de 100%.' };
  if (kind === 'recipe') {
    if (!Array.isArray(value.items) || !value.items.length) return { ok: false, error: 'Adicione ao menos um ingrediente ou sub-receita.' };
    for (const item of value.items) {
      if (!item || typeof item.quantity !== 'number' || !Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isSafeInteger(item.subrecipeId || item.ingredientId)) return { ok: false, error: 'Revise os ingredientes e as quantidades da receita.' };
    }
  }
  return { ok: true, value: { ...value, name } };
}
