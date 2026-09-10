export type Unit = 'mg' | 'g' | 'kg' | 'ml' | 'l' | 'un';

const factors: Record<
  Unit,
  { family: 'mass' | 'volume' | 'unit'; factor: number }
> = {
  mg: { family: 'mass', factor: 0.001 },
  g: { family: 'mass', factor: 1 },
  kg: { family: 'mass', factor: 1000 },
  ml: { family: 'volume', factor: 1 },
  l: { family: 'volume', factor: 1000 },
  un: { family: 'unit', factor: 1 },
};

export function convertUnit(value: number, from: Unit, to: Unit) {
  if (!Number.isFinite(value) || value < 0)
    throw new Error('Quantidade inválida.');
  if (factors[from].family !== factors[to].family)
    throw new Error('Unidades incompatíveis.');
  return (value * factors[from].factor) / factors[to].factor;
}

export function normalizePurchaseQuantity(quantity: number, unit: Unit) {
  const target: Unit =
    factors[unit].family === 'mass'
      ? 'g'
      : factors[unit].family === 'volume'
        ? 'ml'
        : 'un';
  return { quantity: convertUnit(quantity, unit, target), unit: target };
}
