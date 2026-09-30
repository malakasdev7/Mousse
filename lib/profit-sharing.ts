/**
 * Motor de Cálculo, Validação e Gestão de Divisão de Resultados (Profit Sharing & Cash Withdrawals)
 * Implementa precisão monetária em centavos, limites de segurança, segregação de reservas
 * e compliance societário/fiscal.
 */

export type BeneficiaryType = 'socio' | 'outro';

export type WithdrawalCategory =
  | 'distribuicao_lucros' // Exclusiva de sócios, isenta de IR se houver lucro apurado e caixa
  | 'pro_labore'          // Remuneração de trabalho do sócio/administrador, tributada
  | 'retirada_caixa'      // Simulação / antecipação de caixa sem qualificação de lucros
  | 'reembolso'           // Reembolso de despesas operacionais adiantadas
  | 'bonificacao';        // Bonificação / PLR para colaboradores ou terceiros

export type DivisionRule =
  | 'equal'          // A. Divisão igualitária
  | 'percentage'     // B. Divisão por percentual (soma = 100%)
  | 'shares'         // C. Divisão por cotas
  | 'custom_values'; // D. Divisão por valores definidos

export type ParticipantStatus = 'previsto' | 'aprovado' | 'pago' | 'cancelado';

export type DivisionParticipant = {
  id: string;
  name: string;
  beneficiaryType: BeneficiaryType;
  companyRole: string; // Ex: Sócio Administrador, Sócio Fundador, Colaborador, Gerente
  percentage?: number; // Para regra de percentual (0 a 100)
  shares?: number;     // Para regra de cotas (número positivo)
  customValue?: number;// Para regra de valores definidos
  calculatedAmount: number; // Valor monetário com 2 casas decimais
  effectivePercentage: number; // % equivalente na divisão (0 a 100)
  status: ParticipantStatus;
  paidAt?: string;
  paymentMethod?: string;
  paymentReference?: string;
  paidByUserName?: string;
  notes?: string;
};

export type DivisionTemplate = {
  name: string;
  rule: DivisionRule;
  description?: string;
  participants: Array<{
    name: string;
    beneficiaryType: BeneficiaryType;
    companyRole: string;
    percentage?: number;
    shares?: number;
    customValue?: number;
  }>;
};

export type FinancialSnapshot = {
  cashBalance: number; // Saldo atual em caixa e bancos
  cashCheckedAt?: string;
  profitCalculated: number | null; // Lucro líquido apurado no período (null se não apurado)
  isProfitReliable: boolean; // Se há registros financeiros suficientes
  unreliableReason?: string; // Explicação clara de por que não foi apurado
  accountsPayable: number; // Contas a pagar e despesas operacionais do período
  taxesAndObligations: number; // Impostos e obrigações previstos
  committedWithdrawals: number; // Retiradas aprovadas ainda não pagas
  workingCapitalReserve: number; // Reserva de capital de giro
  additionalReserve: number; // Reserva adicional definida pela empresa
  cashAvailable: number; // Disponibilidade líquida de caixa
  distributableProfit: number; // Lucro disponível para distribuição
  effectiveLimit: number; // Menor valor entre caixa e lucro (se distribuição de lucros)
  projectedBalanceAfter: number; // Saldo de caixa previsto após a divisão
};

export type AuditEvent = {
  action: 'created' | 'updated' | 'approved' | 'payment_registered' | 'cancelled' | 'adjusted';
  actorId: string;
  actorName: string;
  timestamp: string;
  details: string;
};

export type ProfitSharingRecord = {
  name: string;
  periodType: 'weekly' | 'monthly' | 'quarterly' | 'custom';
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;   // YYYY-MM-DD
  storeId?: string;
  storeName?: string;
  category: WithdrawalCategory;
  rule: DivisionRule;
  targetAmount: number; // Valor total escolhido para a divisão
  totalDistributed: number; // Soma exata distribuída
  unallocatedAmount: number; // targetAmount - totalDistributed (>= 0)
  pennyAdjustmentParticipantId?: string;
  pennyAdjustmentAmount?: number;
  pennyAdjustmentNote?: string;
  financialSnapshot: FinancialSnapshot;
  participants: DivisionParticipant[];
  status: 'draft' | 'approved' | 'paid_partial' | 'paid' | 'cancelled';
  approvedAt?: string;
  approvedByUserId?: string;
  approvedByUserName?: string;
  cancelledAt?: string;
  cancelledByUserId?: string;
  cancelledReason?: string;
  auditTrail: AuditEvent[];
  notes?: string;
};

/**
 * Utilitário de precisão monetária (2 casas decimais, evita imprecisão float).
 */
export function roundCents(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export const CATEGORY_LABELS: Record<WithdrawalCategory, { label: string; desc: string; partnerOnly: boolean }> = {
  distribuicao_lucros: {
    label: 'Distribuição de Lucros',
    desc: 'Exclusiva para sócios. Isenta de IR conforme legislação societária, limitada ao lucro líquido apurado e à disponibilidade real de caixa.',
    partnerOnly: true,
  },
  pro_labore: {
    label: 'Pró-labore',
    desc: 'Remuneração pelo trabalho dos sócios/administradores da empresa, sujeita à retenção de INSS e IRPF.',
    partnerOnly: true,
  },
  retirada_caixa: {
    label: 'Retirada de Caixa / Antecipação',
    desc: 'Simulação de retirada de recursos de caixa. Não deve ser formalizada como lucro sem prévia apuração contábil.',
    partnerOnly: false,
  },
  reembolso: {
    label: 'Reembolso de Despesas',
    desc: 'Devolução de valores operacionais adiantados por sócios ou colaboradores em favor da empresa.',
    partnerOnly: false,
  },
  bonificacao: {
    label: 'Bonificação / Participação nos Resultados',
    desc: 'Premiação por metas ou participação de colaboradores e equipe, com tratamento trabalhista/tributário próprio.',
    partnerOnly: false,
  },
};

export const RULE_LABELS: Record<DivisionRule, { label: string; desc: string }> = {
  equal: {
    label: 'Divisão Igualitária',
    desc: 'O valor escolhido é distribuído em partes iguais entre todos os participantes.',
  },
  percentage: {
    label: 'Divisão por Percentual',
    desc: 'Cada participante recebe um percentual definido. A soma deve ser exatamente 100%.',
  },
  shares: {
    label: 'Divisão por Cotas',
    desc: 'Cada participante tem um número de cotas. O sistema calcula a proporção exata.',
  },
  custom_values: {
    label: 'Valores Definidos',
    desc: 'O administrador informa o valor exato de cada um. A soma não pode ultrapassar o valor autorizado.',
  },
};

export type CalculateDivisionResult = {
  ok: boolean;
  error?: string;
  participants: DivisionParticipant[];
  totalDistributed: number;
  unallocatedAmount: number;
  pennyAdjustmentParticipantId?: string;
  pennyAdjustmentAmount?: number;
  pennyAdjustmentNote?: string;
};

/**
 * Calcula a divisão de valores entre participantes garantindo:
 * - Precisão decimal de 2 casas em centavos
 * - Soma das parcelas estritamente igual ao total distribuído
 * - Tratamento transparente e explícito de centavos residuais
 */
export function calculateDivision(
  rule: DivisionRule,
  targetAmount: number,
  participants: Array<{
    id?: string;
    name: string;
    beneficiaryType: BeneficiaryType;
    companyRole: string;
    percentage?: number;
    shares?: number;
    customValue?: number;
    status?: ParticipantStatus;
    paidAt?: string;
    paymentMethod?: string;
    notes?: string;
  }>,
): CalculateDivisionResult {
  const cleanTarget = roundCents(targetAmount);

  if (cleanTarget < 0) {
    return { ok: false, error: 'O valor da divisão não pode ser negativo.', participants: [], totalDistributed: 0, unallocatedAmount: 0 };
  }

  if (!participants || participants.length === 0) {
    return { ok: false, error: 'Selecione ao menos um participante para a divisão.', participants: [], totalDistributed: 0, unallocatedAmount: 0 };
  }

  const validParticipants = participants.filter(p => p.status !== 'cancelado');
  if (validParticipants.length === 0) {
    return { ok: false, error: 'Todos os participantes foram cancelados.', participants: [], totalDistributed: 0, unallocatedAmount: 0 };
  }

  const result: DivisionParticipant[] = [];
  let pennyAdjustmentParticipantId: string | undefined;
  let pennyAdjustmentAmount: number | undefined;
  let pennyAdjustmentNote: string | undefined;

  if (rule === 'equal') {
    const count = validParticipants.length;
    const baseCentsPerPerson = Math.floor(Math.round(cleanTarget * 100) / count);
    const totalAllocatedCents = baseCentsPerPerson * count;
    const remainderCents = Math.round(cleanTarget * 100) - totalAllocatedCents; // Entre 0 e count - 1

    let idx = 0;
    for (const p of participants) {
      if (p.status === 'cancelado') {
        result.push({
          id: p.id || `part-${idx + 1}`,
          name: p.name,
          beneficiaryType: p.beneficiaryType,
          companyRole: p.companyRole,
          percentage: 0,
          calculatedAmount: 0,
          effectivePercentage: 0,
          status: 'cancelado',
        });
        idx++;
        continue;
      }

      // Atribui o centavo residual de forma explícita e previsível aos primeiros participantes
      const extraCent = idx < remainderCents ? 1 : 0;
      const amountCents = baseCentsPerPerson + extraCent;
      const amount = amountCents / 100;
      const effectivePct = cleanTarget > 0 ? roundCents((amount / cleanTarget) * 100) : roundCents(100 / count);

      if (idx === 0 && remainderCents > 0) {
        pennyAdjustmentParticipantId = p.id || `part-1`;
        pennyAdjustmentAmount = remainderCents / 100;
        pennyAdjustmentNote = `Ajuste residual de ${remainderCents} centavo(s) distribuído de forma determinística aos primeiros participantes para garantir soma exata de 100%.`;
      }

      result.push({
        id: p.id || `part-${idx + 1}`,
        name: p.name,
        beneficiaryType: p.beneficiaryType,
        companyRole: p.companyRole,
        calculatedAmount: amount,
        effectivePercentage: effectivePct,
        status: p.status || 'previsto',
        paidAt: p.paidAt,
        paymentMethod: p.paymentMethod,
        notes: p.notes,
      });
      idx++;
    }

    const totalDistributed = roundCents(result.reduce((s, p) => s + (p.status !== 'cancelado' ? p.calculatedAmount : 0), 0));
    return {
      ok: true,
      participants: result,
      totalDistributed,
      unallocatedAmount: roundCents(Math.max(0, cleanTarget - totalDistributed)),
      pennyAdjustmentParticipantId,
      pennyAdjustmentAmount,
      pennyAdjustmentNote,
    };
  }

  if (rule === 'percentage') {
    const sumPct = validParticipants.reduce((s, p) => s + (Number(p.percentage) || 0), 0);
    const roundedSum = roundCents(sumPct);
    if (Math.abs(roundedSum - 100) > 0.05) {
      return {
        ok: false,
        error: `A soma dos percentuais deve ser exatamente 100%. Soma atual: ${roundedSum}%.`,
        participants: [],
        totalDistributed: 0,
        unallocatedAmount: 0,
      };
    }

    let allocatedCents = 0;
    let idx = 0;
    const computedAmounts: number[] = [];

    for (const p of participants) {
      if (p.status === 'cancelado') {
        computedAmounts.push(0);
        idx++;
        continue;
      }
      const pct = Number(p.percentage) || 0;
      const rawVal = (cleanTarget * pct) / 100;
      const valCents = Math.round(rawVal * 100);
      computedAmounts.push(valCents);
      allocatedCents += valCents;
      idx++;
    }

    // Centavo residual por arredondamento proporcional
    const targetCents = Math.round(cleanTarget * 100);
    const diffCents = targetCents - allocatedCents;

    // Se houver diferença de centavos, aplica ao primeiro participante válido
    const firstValidIdx = participants.findIndex(p => p.status !== 'cancelado');
    if (diffCents !== 0 && firstValidIdx >= 0) {
      computedAmounts[firstValidIdx] += diffCents;
      pennyAdjustmentParticipantId = participants[firstValidIdx].id || `part-${firstValidIdx + 1}`;
      pennyAdjustmentAmount = diffCents / 100;
      pennyAdjustmentNote = `Diferença residual de arredondamento de ${diffCents > 0 ? '+' : ''}${(diffCents / 100).toFixed(2)} atribuída a ${participants[firstValidIdx].name} para fechamento exato do total.`;
    }

    idx = 0;
    for (const p of participants) {
      const amount = (computedAmounts[idx] || 0) / 100;
      const effectivePct = cleanTarget > 0 ? roundCents((amount / cleanTarget) * 100) : Number(p.percentage || 0);

      result.push({
        id: p.id || `part-${idx + 1}`,
        name: p.name,
        beneficiaryType: p.beneficiaryType,
        companyRole: p.companyRole,
        percentage: Number(p.percentage) || 0,
        calculatedAmount: amount,
        effectivePercentage: effectivePct,
        status: p.status || 'previsto',
        paidAt: p.paidAt,
        paymentMethod: p.paymentMethod,
        notes: p.notes,
      });
      idx++;
    }

    const totalDistributed = roundCents(result.reduce((s, p) => s + (p.status !== 'cancelado' ? p.calculatedAmount : 0), 0));
    return {
      ok: true,
      participants: result,
      totalDistributed,
      unallocatedAmount: roundCents(Math.max(0, cleanTarget - totalDistributed)),
      pennyAdjustmentParticipantId,
      pennyAdjustmentAmount,
      pennyAdjustmentNote,
    };
  }

  if (rule === 'shares') {
    const totalShares = validParticipants.reduce((s, p) => s + (Number(p.shares) || 0), 0);
    if (totalShares <= 0) {
      return {
        ok: false,
        error: 'Informe um número positivo de cotas para os participantes.',
        participants: [],
        totalDistributed: 0,
        unallocatedAmount: 0,
      };
    }

    let allocatedCents = 0;
    let idx = 0;
    const computedAmounts: number[] = [];

    for (const p of participants) {
      if (p.status === 'cancelado') {
        computedAmounts.push(0);
        idx++;
        continue;
      }
      const shares = Number(p.shares) || 0;
      const fraction = shares / totalShares;
      const valCents = Math.floor(Math.round(cleanTarget * 100) * fraction);
      computedAmounts.push(valCents);
      allocatedCents += valCents;
      idx++;
    }

    const targetCents = Math.round(cleanTarget * 100);
    const remainderCents = targetCents - allocatedCents;

    const firstValidIdx = participants.findIndex(p => p.status !== 'cancelado');
    if (remainderCents > 0 && firstValidIdx >= 0) {
      computedAmounts[firstValidIdx] += remainderCents;
      pennyAdjustmentParticipantId = participants[firstValidIdx].id || `part-${firstValidIdx + 1}`;
      pennyAdjustmentAmount = remainderCents / 100;
      pennyAdjustmentNote = `Diferença de arredondamento de ${remainderCents} centavo(s) proporcional atribuída a ${participants[firstValidIdx].name}.`;
    }

    idx = 0;
    for (const p of participants) {
      const amount = (computedAmounts[idx] || 0) / 100;
      const effectivePct = cleanTarget > 0 ? roundCents((amount / cleanTarget) * 100) : 0;

      result.push({
        id: p.id || `part-${idx + 1}`,
        name: p.name,
        beneficiaryType: p.beneficiaryType,
        companyRole: p.companyRole,
        shares: Number(p.shares) || 0,
        calculatedAmount: amount,
        effectivePercentage: effectivePct,
        status: p.status || 'previsto',
        paidAt: p.paidAt,
        paymentMethod: p.paymentMethod,
        notes: p.notes,
      });
      idx++;
    }

    const totalDistributed = roundCents(result.reduce((s, p) => s + (p.status !== 'cancelado' ? p.calculatedAmount : 0), 0));
    return {
      ok: true,
      participants: result,
      totalDistributed,
      unallocatedAmount: roundCents(Math.max(0, cleanTarget - totalDistributed)),
      pennyAdjustmentParticipantId,
      pennyAdjustmentAmount,
      pennyAdjustmentNote,
    };
  }

  if (rule === 'custom_values') {
    let totalCustom = 0;
    let idx = 0;
    for (const p of participants) {
      const val = p.status === 'cancelado' ? 0 : roundCents(Number(p.customValue) || 0);
      totalCustom += val;
      const effectivePct = cleanTarget > 0 ? roundCents((val / cleanTarget) * 100) : 0;
      result.push({
        id: p.id || `part-${idx + 1}`,
        name: p.name,
        beneficiaryType: p.beneficiaryType,
        companyRole: p.companyRole,
        customValue: Number(p.customValue) || 0,
        calculatedAmount: val,
        effectivePercentage: effectivePct,
        status: p.status || 'previsto',
        paidAt: p.paidAt,
        paymentMethod: p.paymentMethod,
        notes: p.notes,
      });
      idx++;
    }

    totalCustom = roundCents(totalCustom);
    if (totalCustom > cleanTarget) {
      return {
        ok: false,
        error: `A soma dos valores individuais (R$ ${totalCustom.toFixed(2)}) ultrapassa o valor autorizado para a divisão (R$ ${cleanTarget.toFixed(2)}).`,
        participants: result,
        totalDistributed: totalCustom,
        unallocatedAmount: 0,
      };
    }

    return {
      ok: true,
      participants: result,
      totalDistributed: totalCustom,
      unallocatedAmount: roundCents(Math.max(0, cleanTarget - totalCustom)),
    };
  }

  return { ok: false, error: 'Regra de divisão inválida.', participants: [], totalDistributed: 0, unallocatedAmount: 0 };
}

/**
 * Analisa a integridade financeira real e calcula limites de segurança
 */
export function assessFinancialContext(params: {
  cashBalance: number;
  cashCheckedAt?: string;
  sales: Array<{ date?: string; netRevenue?: number; gross?: number; cost?: number; profit?: number; status?: string }>;
  expenses: Array<{ type?: 'monthly' | 'one_off'; date?: string; value?: number; dueDay?: string; category?: string }>;
  existingApprovedDivisions: ProfitSharingRecord[];
  periodStart: string;
  periodEnd: string;
  workingCapitalReserve: number;
  additionalReserve: number;
  category: WithdrawalCategory;
  targetAmount: number;
  currentDivisionId?: number; // Para ignorar a própria divisão ao recalcular
}): FinancialSnapshot {
  const {
    cashBalance,
    cashCheckedAt,
    sales,
    expenses,
    existingApprovedDivisions,
    periodStart,
    periodEnd,
    workingCapitalReserve,
    additionalReserve,
    category,
    targetAmount,
    currentDivisionId,
  } = params;

  // 1. Filtrar vendas válidas do período
  const periodSales = sales.filter((sale) => {
    if (sale.status === 'Cancelada') return false;
    if (!sale.date) return false;
    const d = sale.date.slice(0, 10);
    return d >= periodStart && d <= periodEnd;
  });

  // 2. Filtrar despesas do período
  const periodExpenses = expenses.filter((exp) => {
    const isMonthly = exp.type === 'monthly' || (!exp.type && !exp.date);
    if (isMonthly) {
      // Despesas fixas mensais são consideradas para o período
      return true;
    }
    if (exp.date) {
      const d = exp.date.slice(0, 10);
      return d >= periodStart && d <= periodEnd;
    }
    return true;
  });

  // 3. Validação de suficiência de dados para apuração de lucro
  let isProfitReliable = true;
  const missingReasons: string[] = [];

  if (sales.length === 0) {
    isProfitReliable = false;
    missingReasons.push('Nenhuma venda cadastrada no sistema.');
  } else if (periodSales.length === 0) {
    isProfitReliable = false;
    missingReasons.push('Nenhuma venda registrada no período selecionado.');
  }

  if (expenses.length === 0) {
    isProfitReliable = false;
    missingReasons.push('Nenhuma despesa ou custo operacional cadastrado.');
  }

  // 4. Apuração de Receitas, Custos e Lucro do Período
  const grossRevenue = periodSales.reduce((sum, s) => sum + (s.gross || 0), 0);
  const netRevenue = periodSales.reduce((sum, s) => sum + (s.netRevenue || s.gross || 0), 0);
  const totalCpv = periodSales.reduce((sum, s) => sum + (s.cost || 0), 0);
  const totalExpenses = periodExpenses.reduce((sum, e) => sum + (e.value || 0), 0);

  let profitCalculated: number | null = null;
  if (isProfitReliable) {
    // Lucro Líquido = Receita Líquida - Custo dos Produtos (CPV) - Despesas Totais
    profitCalculated = roundCents(netRevenue - totalCpv - totalExpenses);
  }

  // 5. Contas a pagar e obrigações previstas
  // Considera despesas do período como contas a pagar/obrigações operacionais
  const accountsPayable = roundCents(totalExpenses);

  // Estimativa de impostos e obrigações (mínimo de 6% sobre receita líquida para confeitaria/simples, ou despesas de tributos)
  const taxesExpense = periodExpenses
    .filter(e => (e.category || '').toLowerCase().includes('imposto') || (e.category || '').toLowerCase().includes('mei'))
    .reduce((s, e) => s + (e.value || 0), 0);
  const taxesAndObligations = roundCents(taxesExpense > 0 ? taxesExpense : netRevenue * 0.04);

  // 6. Valores já comprometidos (retiradas aprovadas que ainda não foram totalmente pagas)
  let committedWithdrawals = 0;
  for (const div of existingApprovedDivisions) {
    // Se for a mesma divisão sendo editada, ignora
    if (currentDivisionId && (div as any).id === currentDivisionId) continue;
    if (div.status === 'approved' || div.status === 'paid_partial') {
      const pendingSum = div.participants
        .filter(p => p.status === 'previsto' || p.status === 'aprovado')
        .reduce((sum, p) => sum + p.calculatedAmount, 0);
      committedWithdrawals += pendingSum;
    }
  }
  committedWithdrawals = roundCents(committedWithdrawals);

  // 7. Lucros já distribuídos no mesmo período
  let alreadyDistributedInPeriod = 0;
  for (const div of existingApprovedDivisions) {
    if (currentDivisionId && (div as any).id === currentDivisionId) continue;
    if (div.category === 'distribuicao_lucros' && div.status !== 'cancelled') {
      if (div.periodStart === periodStart && div.periodEnd === periodEnd) {
        alreadyDistributedInPeriod += div.totalDistributed;
      }
    }
  }

  // 8. Disponibilidade de Caixa
  // Disponibilidade = Saldo em Caixa - Contas a Pagar - Impostos - Retiradas Aprovadas Pendentes - Reservas
  const rawCashAvailable =
    cashBalance -
    accountsPayable -
    taxesAndObligations -
    committedWithdrawals -
    workingCapitalReserve -
    additionalReserve;
  const cashAvailable = roundCents(Math.max(0, rawCashAvailable));

  // 9. Lucro Distribuível
  const distributableProfit = isProfitReliable && profitCalculated !== null
    ? roundCents(Math.max(0, profitCalculated - alreadyDistributedInPeriod))
    : 0;

  // 10. Limite Efetivo Sugerido
  let effectiveLimit = cashAvailable;
  if (category === 'distribuicao_lucros') {
    effectiveLimit = roundCents(Math.min(cashAvailable, distributableProfit));
  }

  // 11. Saldo de Caixa Previsto após a divisão solicitada
  const projectedBalanceAfter = roundCents(cashBalance - targetAmount);

  return {
    cashBalance: roundCents(cashBalance),
    cashCheckedAt,
    profitCalculated,
    isProfitReliable,
    unreliableReason: missingReasons.length > 0 ? missingReasons.join(' ') : undefined,
    accountsPayable,
    taxesAndObligations,
    committedWithdrawals,
    workingCapitalReserve: roundCents(workingCapitalReserve),
    additionalReserve: roundCents(additionalReserve),
    cashAvailable,
    distributableProfit,
    effectiveLimit,
    projectedBalanceAfter,
  };
}

/**
 * Validação rigorosa dos limites e regras societárias antes do registro ou aprovação
 */
export function validateProfitSharingLimits(
  category: WithdrawalCategory,
  targetAmount: number,
  participants: DivisionParticipant[],
  snapshot: FinancialSnapshot,
): { allowed: boolean; blockingReason?: string; warnings: string[] } {
  const warnings: string[] = [];

  // 1. Participantes não-sócios
  const nonPartners = participants.filter(p => p.beneficiaryType !== 'socio');
  if (category === 'distribuicao_lucros' && nonPartners.length > 0) {
    return {
      allowed: false,
      blockingReason: `Participantes que não são sócios (${nonPartners.map(p => p.name).join(', ')}) não podem receber 'Distribuição de Lucros'. Altere a categoria para 'Bonificação / Participação nos Resultados' ou altere o tipo de participante para sócio se devidamente constituído no contrato social.`,
      warnings,
    };
  }

  // 2. Se for Distribuição de Lucros, lucro precisa estar apurado e confiável
  if (category === 'distribuicao_lucros') {
    if (!snapshot.isProfitReliable || snapshot.profitCalculated === null) {
      return {
        allowed: false,
        blockingReason: `Não é possível registrar uma 'Distribuição de Lucros' pois o lucro do período não foi apurado (${snapshot.unreliableReason || 'dados incompletos'}). Salve apenas como 'Retirada de Caixa' (simulação) até que os registros financeiros estejam completos.`,
        warnings,
      };
    }

    if (snapshot.profitCalculated <= 0) {
      return {
        allowed: false,
        blockingReason: `O resultado apurado no período é nulo ou negativo (${roundCents(snapshot.profitCalculated).toFixed(2)}). A legislação veda distribuição de lucros sem resultado positivo efetivo.`,
        warnings,
      };
    }

    if (targetAmount > snapshot.distributableProfit) {
      return {
        allowed: false,
        blockingReason: `O valor solicitado (R$ ${targetAmount.toFixed(2)}) ultrapassa o lucro líquido apurado e ainda não distribuído do período (R$ ${snapshot.distributableProfit.toFixed(2)}). A distribuição não pode exceder o lucro apurado.`,
        warnings,
      };
    }
  }

  // 3. Limite de Disponibilidade de Caixa
  if (targetAmount > snapshot.cashAvailable) {
    if (category === 'distribuicao_lucros') {
      return {
        allowed: false,
        blockingReason: `O valor solicitado (R$ ${targetAmount.toFixed(2)}) ultrapassa a disponibilidade real de caixa (R$ ${snapshot.cashAvailable.toFixed(2)}) após deduzir contas a pagar (R$ ${snapshot.accountsPayable.toFixed(2)}), reservas obrigatórias (R$ ${(snapshot.workingCapitalReserve + snapshot.additionalReserve).toFixed(2)}) e retiradas já comprometidas (R$ ${snapshot.committedWithdrawals.toFixed(2)}).`,
        warnings,
      };
    } else {
      warnings.push(`Atenção: O valor de retirada (R$ ${targetAmount.toFixed(2)}) é maior que a disponibilidade de caixa recomendada (R$ ${snapshot.cashAvailable.toFixed(2)}). Essa operação poderá consumir o capital de giro ou reservas da empresa.`);
    }
  }

  // 4. Saldo previsto negativo
  if (snapshot.projectedBalanceAfter < 0) {
    return {
      allowed: false,
      blockingReason: `Operação bloqueada: o saldo final em caixa ficaria negativo (R$ ${snapshot.projectedBalanceAfter.toFixed(2)}). Não há fundos suficientes em caixa e bancos para essa retirada.`,
      warnings,
    };
  }

  // 5. Alertas contábeis informativos
  if (category === 'pro_labore') {
    warnings.push('Nota Contábil: O pró-labore exige apuração e recolhimento de encargos (INSS/IRRF). Consulte a contabilidade para emissão dos holerites e guias de recolhimento.');
  } else if (category === 'bonificacao') {
    warnings.push('Nota Trabalhista: Pagamentos a colaboradores requerem verificação do enquadramento trabalhista e convenção coletiva.');
  }

  return { allowed: true, warnings };
}
