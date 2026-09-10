export type PricingInput = {
  ingredients: number;
  packaging: number;
  addons?: number;
  wastePercent?: number;
  labor?: number;
  delivery?: number;
  fixedAllocation?: number;
  taxPercent?: number;
  cardPercent?: number;
  marketplacePercent?: number;
  sellerCommissionPercent?: number;
  targetMarginPercent?: number;
};

export type PricingResult = {
  directCost: number;
  wasteCost: number;
  variableCostBeforeRates: number;
  fixedAllocation: number;
  totalCostBeforeRates: number;
  totalRatePercent: number;
  minimumPrice: number;
  recommendedPrice: number;
  contributionMargin: number;
  contributionMarginPercent: number;
  estimatedProfit: number;
  netMarginPercent: number;
  cmvPercent: number;
  markup: number;
};

const finiteNonNegative = (value = 0) =>
  Number.isFinite(value) ? Math.max(0, value) : 0;
const percent = (value = 0) => finiteNonNegative(value) / 100;
const roundMoney = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export function calculatePricing(input: PricingInput): PricingResult {
  const ingredients = finiteNonNegative(input.ingredients);
  const packaging = finiteNonNegative(input.packaging);
  const addons = finiteNonNegative(input.addons);
  const labor = finiteNonNegative(input.labor);
  const delivery = finiteNonNegative(input.delivery);
  const fixedAllocation = finiteNonNegative(input.fixedAllocation);
  const directCost = ingredients + packaging + addons;
  const wasteCost = directCost * percent(input.wastePercent);
  const variableCostBeforeRates = directCost + wasteCost + labor + delivery;
  const totalCostBeforeRates = variableCostBeforeRates + fixedAllocation;
  const totalRate =
    percent(input.taxPercent) +
    percent(input.cardPercent) +
    percent(input.marketplacePercent) +
    percent(input.sellerCommissionPercent);
  const targetMargin = percent(input.targetMarginPercent);
  const minimumDenominator = 1 - totalRate;
  const recommendedDenominator = 1 - totalRate - targetMargin;
  const minimumPrice =
    minimumDenominator > 0 ? totalCostBeforeRates / minimumDenominator : 0;
  const recommendedPrice =
    recommendedDenominator > 0
      ? totalCostBeforeRates / recommendedDenominator
      : 0;
  const price = recommendedPrice;
  const rateCost = price * totalRate;
  const contributionMargin = price - variableCostBeforeRates - rateCost;
  const estimatedProfit = price - totalCostBeforeRates - rateCost;

  return {
    directCost: roundMoney(directCost),
    wasteCost: roundMoney(wasteCost),
    variableCostBeforeRates: roundMoney(variableCostBeforeRates),
    fixedAllocation: roundMoney(fixedAllocation),
    totalCostBeforeRates: roundMoney(totalCostBeforeRates),
    totalRatePercent: roundMoney(totalRate * 100),
    minimumPrice: roundMoney(minimumPrice),
    recommendedPrice: roundMoney(recommendedPrice),
    contributionMargin: roundMoney(contributionMargin),
    contributionMarginPercent: price
      ? roundMoney((contributionMargin / price) * 100)
      : 0,
    estimatedProfit: roundMoney(estimatedProfit),
    netMarginPercent: price ? roundMoney((estimatedProfit / price) * 100) : 0,
    cmvPercent: price ? roundMoney((variableCostBeforeRates / price) * 100) : 0,
    markup: totalCostBeforeRates ? roundMoney(price / totalCostBeforeRates) : 0,
  };
}

export function calculatePromotion(
  price: number,
  discountPercent: number,
  minimumPrice: number,
) {
  const promotionalPrice = roundMoney(
    finiteNonNegative(price) * (1 - Math.min(percent(discountPercent), 1)),
  );
  return {
    promotionalPrice,
    belowMinimum: promotionalPrice < finiteNonNegative(minimumPrice),
  };
}

export function calculateBreakEven(
  fixedExpenses: number,
  unitPrice: number,
  unitVariableCost: number,
  ratePercent = 0,
) {
  const contribution =
    finiteNonNegative(unitPrice) * (1 - percent(ratePercent)) -
    finiteNonNegative(unitVariableCost);
  const units =
    contribution > 0
      ? Math.ceil(finiteNonNegative(fixedExpenses) / contribution)
      : 0;
  return {
    unitContribution: roundMoney(contribution),
    units,
    revenue: roundMoney(units * finiteNonNegative(unitPrice)),
  };
}

export function ingredientUnitCost(
  price: number,
  purchasedQuantity: number,
  wastePercent = 0,
) {
  const usableQuantity =
    finiteNonNegative(purchasedQuantity) *
    (1 - Math.min(percent(wastePercent), 0.99));
  return usableQuantity > 0
    ? roundMoney(finiteNonNegative(price) / usableQuantity)
    : 0;
}
