import { calculatePricing, ingredientUnitCost } from './pricing';
import { convertUnit, type Unit } from './units';
type Data = Record<string, any>;
export type CostRecord = { id: number; kind: string; payload: Data; updated_at?: string };

// Derived costs are recomputed from current inputs. Sales remain historical snapshots.
export function recalculateRecords<T extends CostRecord>(source: T[]): T[] {
  const records = source.map(row => ({ ...row, payload: { ...row.payload } }));
  const byId = new Map(records.map(row => [row.id, row]));
  const done = new Set<number>();
  const active = new Set<number>();
  function recipe(id: number): Data {
    const row = byId.get(id);
    if (!row || row.kind !== 'recipe') throw new Error('Sub-receita não encontrada.');
    if (active.has(id)) throw new Error('Uma receita não pode conter a si mesma, direta ou indiretamente.');
    if (done.has(id)) return row.payload;
    active.add(id);
    const p = row.payload;
    if (!(Number(p.yieldQty) > 0)) throw new Error('Informe um rendimento maior que zero.');
    const items = (p.items || []).map((item: Data) => {
      let unitCost = 0;
      let name = item.name;
      if (item.subrecipeId) {
        const child = recipe(Number(item.subrecipeId));
        unitCost = child.cost / child.yieldQty;
        if (item.unit && child.yieldUnit && item.unit !== child.yieldUnit) unitCost *= convertUnit(1, item.unit as Unit, child.yieldUnit as Unit);
        name = child.name;
      } else {
        const ingredient = byId.get(Number(item.ingredientId));
        if (!ingredient || ingredient.kind !== 'ingredient') throw new Error('Ingrediente não encontrado na empresa.');
        const i = ingredient.payload;
        if (!(i.qty > 0)) throw new Error('Ingrediente sem quantidade útil.');
        unitCost = ingredientUnitCost(i.price, i.qty, i.wastePercent);
        if (item.unit && i.baseUnit && item.unit !== i.baseUnit) unitCost *= convertUnit(1, item.unit as Unit, i.baseUnit as Unit);
        name = i.name;
      }
      return { ...item, name, unitCost, cost: unitCost * item.quantity };
    });
    const cost = items.reduce((sum: number, item: Data) => sum + item.cost, 0) * (1 + Number(p.waste || 0) / 100) + Number(p.additionalCost || 0);
    row.payload = { ...p, items, cost, unit: cost / p.yieldQty, costPerGram: p.totalWeight > 0 ? cost / p.totalWeight : null, costPerMl: p.totalVolume > 0 ? cost / p.totalVolume : null, costError: null };
    done.add(id); active.delete(id);
    return row.payload;
  }
  for (const row of records.filter(r => r.kind === 'recipe')) {
    try { recipe(row.id); } catch (error) { active.clear(); row.payload.costError = error instanceof Error ? error.message : 'Custo indisponível.'; }
  }
  for (const row of records.filter(r => r.kind === 'product')) {
    const p = row.payload;
    const matches = records.filter(r => r.kind === 'recipe' && r.payload.name === p.recipe);
    const base = p.recipeId ? byId.get(Number(p.recipeId)) : matches.length === 1 ? matches[0] : undefined;
    const pack = p.packagingId ? byId.get(Number(p.packagingId)) : undefined;
    if (base?.payload.costError) { p.costError = base.payload.costError; continue; }
    if (p.recipeId && (!base || base.kind !== 'recipe')) { p.costError = 'Receita base não encontrada.'; continue; }
    if (p.packagingId && (!pack || pack.kind !== 'packaging')) { p.costError = 'Embalagem não encontrada.'; continue; }
    const ingredients = base ? Number(base.payload.unit) * Number(p.recipeQuantity || 1) : Number(p.ingredientsCost || 0);
    const packaging = pack ? Number(pack.payload.price) / Number(pack.payload.pack) : Number(p.packagingCost || 0);
    const calc = calculatePricing({ ingredients, packaging, addons: Number(p.extras || 0), delivery: Number(p.delivery || 0) + Number(p.fees || 0), labor: p.labor, wastePercent: p.wastePercent, fixedAllocation: p.fixedAllocation, taxPercent: p.taxPercent, cardPercent: p.cardPercent, marketplacePercent: p.marketplacePercent, sellerCommissionPercent: p.commissionPercent, targetMarginPercent: p.targetMarginPercent ?? p.margin });
    const price = Number(p.price || 0);
    const profit = price * (1 - calc.totalRatePercent / 100) - calc.totalCostBeforeRates;
    row.payload = { ...p, ingredientsCost: ingredients, packagingCost: packaging, recipeId: base?.id || p.recipeId, recipe: base?.payload.name || p.recipe, cost: calc.totalCostBeforeRates, recommendedPrice: calc.recommendedPrice, minimumPrice: calc.minimumPrice, cmvPercent: price > 0 ? (calc.directCost + calc.wasteCost) / price * 100 : 0, contributionMargin: price * (1 - calc.totalRatePercent / 100) - calc.variableCostBeforeRates, costError: calc.error || null, costOutdated: Math.abs(Number(p.cost || 0) - calc.totalCostBeforeRates) > 0.005, profit, margin: price > 0 ? profit / price * 100 : 0, targetMarginPercent: p.targetMarginPercent ?? p.margin };
  }
  return records as T[];
}
