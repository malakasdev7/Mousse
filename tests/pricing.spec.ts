import { expect, test } from '@playwright/test';
import { calculateBreakEven, calculatePricing, calculatePromotion, ingredientUnitCost } from '../lib/pricing';
import { convertUnit, normalizePurchaseQuantity } from '../lib/units';
import { validatePayload } from '../lib/records';

test.describe('motor de custos e precificação', () => {
  test('calcula custo útil do ingrediente com perda', () => {
    expect(ingredientUnitCost(10, 1000, 20)).toBe(0.01);
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
