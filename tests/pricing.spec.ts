import { expect, test } from '@playwright/test';
import { calculateBreakEven, calculatePricing, calculatePromotion, ingredientUnitCost } from '../lib/pricing';
import { convertUnit, normalizePurchaseQuantity } from '../lib/units';
import { validatePayload } from '../lib/records';
import { recalculateRecords } from '../lib/recipe-costs';

test('preserva precisão inferior a um centavo e recalcula dependências sem mudar vendas', () => {
  const rows = recalculateRecords<any>([
    { id: 1, kind: 'ingredient', payload: { name: 'Açúcar', qty: 1000, price: 4, baseUnit: 'g' } },
    { id: 2, kind: 'recipe', payload: { name: 'Calda', yieldQty: 10, yieldUnit: 'un', items: [{ ingredientId: 1, quantity: 250, unit: 'g' }] } },
    { id: 3, kind: 'recipe', payload: { name: 'Mousse', yieldQty: 2, items: [{ subrecipeId: 2, quantity: 4 }] } },
    { id: 4, kind: 'product', payload: { name: 'Pote', recipeId: 3, price: 10, targetMarginPercent: 50 } },
    { id: 5, kind: 'sale', payload: { name: 'Venda antiga', cost: 7, total: 15 } },
  ]);
  expect(rows[1].payload.cost).toBe(1);
  expect(rows[2].payload.unit).toBe(0.2);
  expect(rows[3].payload.cost).toBe(0.2);
  expect(rows[3].payload.price).toBe(10);
  expect(rows[4].payload.cost).toBe(7);
});

test('detecta ciclos de sub-receitas', () => {
  const rows = recalculateRecords<any>([
    { id: 1, kind: 'recipe', payload: { yieldQty: 1, items: [{ subrecipeId: 2, quantity: 1 }] } },
    { id: 2, kind: 'recipe', payload: { yieldQty: 1, items: [{ subrecipeId: 1, quantity: 1 }] } },
  ]);
  expect(rows.every(row => row.payload.costError)).toBe(true);
});

test('CMV não confunde mercadoria com mão de obra ou despesas fixas', () => {
  const calc = calculatePricing({ ingredients: 4, packaging: 1, labor: 3, fixedAllocation: 2, targetMarginPercent: 50 });
  expect(calc.recommendedPrice).toBe(20);
  expect(calc.cmvPercent).toBe(25);
  expect(calc.contributionMargin).toBe(12);
});

test('impede preço impossível quando taxas e margem atingem 100%', () => {
  expect(calculatePricing({ ingredients: 5, packaging: 1, targetMarginPercent: 70, marketplacePercent: 30 }).valid).toBe(false);
});

test.describe('motor de custos e precificação', () => {
  test('calcula custo útil do ingrediente com perda', () => {
    expect(ingredientUnitCost(10, 1000, 20)).toBe(0.0125);
    expect(ingredientUnitCost(8, 0, 0)).toBe(0);
  });

  test('diferencia margem sobre venda de markup', () => {
    const result = calculatePricing({ ingredients: 5, packaging: 0, targetMarginPercent: 40 });
    expect(result.recommendedPrice).toBe(8.33);
    expect(result.markup).toBe(1.67);
    expect(result.netMarginPercent).toBeCloseTo(40, 1);
  });

  test('incorpora cartão, marketplace e imposto antes da margem', () => {
    const result = calculatePricing({ ingredients: 5, packaging: 0, cardPercent: 3, marketplacePercent: 20, taxPercent: 6, targetMarginPercent: 40 });
    expect(result.totalRatePercent).toBe(29);
    expect(result.recommendedPrice).toBe(16.13);
    expect(result.minimumPrice).toBe(7.04);
  });

  test('alerta promoção abaixo do mínimo', () => {
    expect(calculatePromotion(10, 40, 7)).toEqual({ promotionalPrice: 6, belowMinimum: true });
  });

  test('calcula ponto de equilíbrio com margem de contribuição', () => {
    expect(calculateBreakEven(1000, 10, 4, 10)).toEqual({ unitContribution: 5, units: 200, revenue: 2000 });
  });
});

test.describe('unidades e validação', () => {
  test('converte massa e volume compatíveis', () => {
    expect(convertUnit(1, 'kg', 'g')).toBe(1000);
    expect(normalizePurchaseQuantity(2, 'l')).toEqual({ quantity: 2000, unit: 'ml' });
  });

  test('bloqueia conversão incompatível', () => expect(() => convertUnit(1, 'kg', 'ml')).toThrow('Unidades incompatíveis'));
  test('bloqueia receita com rendimento zero', () => expect(validatePayload('recipe', { name: 'Teste', yieldQty: 0 }).ok).toBe(false));
  test('aceita produto válido', () => expect(validatePayload('product', { name: 'Mousse', cost: 5 }).ok).toBe(true));
});
