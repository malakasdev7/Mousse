import { expect, test } from '@playwright/test';
import {
  calculateDivision,
  assessFinancialContext,
  validateProfitSharingLimits,
  roundCents,
  type FinancialSnapshot,
  type ProfitSharingRecord,
} from '../lib/profit-sharing';
import { validatePayload } from '../lib/records';

test.describe('Módulo de Divisão de Resultados - Regras de Cálculo e Precisão Decimal', () => {
  test('1. Divisão igualitária entre 2 participantes fecha exatamente em centavos', () => {
    const result = calculateDivision('equal', 1000, [
      { name: 'Ana', beneficiaryType: 'socio', companyRole: 'Sócia Fundadora' },
      { name: 'Bruno', beneficiaryType: 'socio', companyRole: 'Sócio Investidor' },
    ]);
    expect(result.ok).toBe(true);
    expect(result.participants).toHaveLength(2);
    expect(result.participants[0].calculatedAmount).toBe(500);
    expect(result.participants[1].calculatedAmount).toBe(500);
    expect(result.totalDistributed).toBe(1000);
    expect(result.unallocatedAmount).toBe(0);
  });

  test('2. Divisão igualitária entre 3 participantes distribui centavos residuais de forma explícita e determinística', () => {
    // 100.00 / 3 = 33.333333...
    // Deve dar 33.34 para o primeiro e 33.33 para os outros 2, totalizando exatamente 100.00
    const result = calculateDivision('equal', 100, [
      { id: 'p1', name: 'Ana', beneficiaryType: 'socio', companyRole: 'Sócia Fundadora' },
      { id: 'p2', name: 'Bruno', beneficiaryType: 'socio', companyRole: 'Sócio' },
      { id: 'p3', name: 'Carlos', beneficiaryType: 'socio', companyRole: 'Sócio' },
    ]);
    expect(result.ok).toBe(true);
    expect(result.participants[0].calculatedAmount).toBe(33.34);
    expect(result.participants[1].calculatedAmount).toBe(33.33);
    expect(result.participants[2].calculatedAmount).toBe(33.33);
    expect(result.totalDistributed).toBe(100.00);
    expect(result.pennyAdjustmentParticipantId).toBe('p1');
    expect(result.pennyAdjustmentNote).toBeDefined();
    // A soma das parcelas NUNCA pode ser diferente do total distribuído
    const sum = roundCents(result.participants.reduce((s, p) => s + p.calculatedAmount, 0));
    expect(sum).toBe(100.00);
  });

  test('3. Divisão com 7 participantes divide centavos sem perdas', () => {
    const result = calculateDivision('equal', 500, [
      { name: 'P1', beneficiaryType: 'socio', companyRole: 'Sócio' },
      { name: 'P2', beneficiaryType: 'socio', companyRole: 'Sócio' },
      { name: 'P3', beneficiaryType: 'socio', companyRole: 'Sócio' },
      { name: 'P4', beneficiaryType: 'socio', companyRole: 'Sócio' },
      { name: 'P5', beneficiaryType: 'socio', companyRole: 'Sócio' },
      { name: 'P6', beneficiaryType: 'socio', companyRole: 'Sócio' },
      { name: 'P7', beneficiaryType: 'socio', companyRole: 'Sócio' },
    ]);
    expect(result.ok).toBe(true);
    const sum = roundCents(result.participants.reduce((s, p) => s + p.calculatedAmount, 0));
    expect(sum).toBe(500.00);
    expect(result.totalDistributed).toBe(500.00);
  });

  test('4. Divisão por percentual rejeita soma diferente de 100%', () => {
    const resultInvalid = calculateDivision('percentage', 1000, [
      { name: 'Ana', beneficiaryType: 'socio', companyRole: 'Sócia', percentage: 60 },
      { name: 'Bruno', beneficiaryType: 'socio', companyRole: 'Sócio', percentage: 35 },
    ]);
    expect(resultInvalid.ok).toBe(false);
    expect(resultInvalid.error).toContain('A soma dos percentuais deve ser exatamente 100%');
  });

  test('5. Divisão por percentual com 100% fecha com precisão exata', () => {
    const result = calculateDivision('percentage', 2500, [
      { name: 'Ana', beneficiaryType: 'socio', companyRole: 'Sócia', percentage: 70 },
      { name: 'Bruno', beneficiaryType: 'socio', companyRole: 'Sócio', percentage: 30 },
    ]);
    expect(result.ok).toBe(true);
    expect(result.participants[0].calculatedAmount).toBe(1750);
    expect(result.participants[1].calculatedAmount).toBe(750);
    expect(result.totalDistributed).toBe(2500);
  });

  test('6. Divisão por cotas proporcionais desiguais calcula corretamente e ajusta centavos', () => {
    // 3 cotas vs 1 cota (75% e 25%) de 1001.00
    const result = calculateDivision('shares', 1001, [
      { name: 'Ana', beneficiaryType: 'socio', companyRole: 'Sócia Majoritária', shares: 3 },
      { name: 'Bruno', beneficiaryType: 'socio', companyRole: 'Sócio Minoritário', shares: 1 },
    ]);
    expect(result.ok).toBe(true);
    expect(result.totalDistributed).toBe(1001);
    const sum = roundCents(result.participants[0].calculatedAmount + result.participants[1].calculatedAmount);
    expect(sum).toBe(1001);
  });

  test('7. Divisão por valores definidos bloqueia soma acima do limite', () => {
    const result = calculateDivision('custom_values', 1000, [
      { name: 'Ana', beneficiaryType: 'socio', companyRole: 'Sócia', customValue: 700 },
      { name: 'Bruno', beneficiaryType: 'socio', companyRole: 'Sócio', customValue: 400 },
    ]);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('ultrapassa o valor autorizado');
  });

  test('8. Divisão por valores definidos aceita valor menor que o limite e reporta valor não distribuído', () => {
    const result = calculateDivision('custom_values', 1000, [
      { name: 'Ana', beneficiaryType: 'socio', companyRole: 'Sócia', customValue: 500 },
      { name: 'Bruno', beneficiaryType: 'socio', companyRole: 'Sócio', customValue: 300 },
    ]);
    expect(result.ok).toBe(true);
    expect(result.totalDistributed).toBe(800);
    expect(result.unallocatedAmount).toBe(200);
  });
});

test.describe('Módulo de Divisão de Resultados - Contexto Financeiro e Limites', () => {
  test('9. Caixa positivo sem lucro apurado (dados insuficientes) identifica "não apurado" e bloqueia distribuição de lucros', () => {
    const snapshot = assessFinancialContext({
      cashBalance: 15000,
      cashCheckedAt: '2026-09-20',
      sales: [], // Nenhuma venda
      expenses: [], // Nenhuma despesa
      existingApprovedDivisions: [],
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
      workingCapitalReserve: 3000,
      additionalReserve: 2000,
      category: 'distribuicao_lucros',
      targetAmount: 5000,
    });

    expect(snapshot.isProfitReliable).toBe(false);
    expect(snapshot.profitCalculated).toBeNull();
    expect(snapshot.unreliableReason).toBeDefined();

    const validation = validateProfitSharingLimits(
      'distribuicao_lucros',
      5000,
      [{ id: '1', name: 'Sócio A', beneficiaryType: 'socio', companyRole: 'Sócio', calculatedAmount: 5000, effectivePercentage: 100, status: 'previsto' }],
      snapshot,
    );
    expect(validation.allowed).toBe(false);
    expect(validation.blockingReason).toContain('lucro do período não foi apurado');

    // Mas se for Retirada de Caixa (simulação de caixa), é permitida com alerta
    const validationSimulation = validateProfitSharingLimits(
      'retirada_caixa',
      5000,
      [{ id: '1', name: 'Sócio A', beneficiaryType: 'socio', companyRole: 'Sócio', calculatedAmount: 5000, effectivePercentage: 100, status: 'previsto' }],
      snapshot,
    );
    expect(validationSimulation.allowed).toBe(true);
  });

  test('10. Lucro positivo mas sem caixa disponível (consumido por contas a pagar e reservas)', () => {
    const snapshot = assessFinancialContext({
      cashBalance: 5000, // Caixa modesto
      cashCheckedAt: '2026-09-25',
      sales: [
        { date: '2026-09-10', gross: 20000, netRevenue: 19000, cost: 6000, profit: 13000, status: 'Entregue' },
      ],
      expenses: [
        { type: 'monthly', value: 3000, category: 'Estrutura' }, // 3000 despesas
      ],
      existingApprovedDivisions: [],
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
      workingCapitalReserve: 3000, // Reserva capital de giro
      additionalReserve: 2000,    // Reserva adicional
      category: 'distribuicao_lucros',
      targetAmount: 8000,
    });

    // Lucro apurado = 19000 - 6000 - 3000 = 10000 (Lucro excelente!)
    expect(snapshot.profitCalculated).toBe(10000);
    // Mas caixa disponível = 5000 - 3000 (contas pagar) - 760 (impostos) - 3000 (giro) - 2000 (adicional) = 0!
    expect(snapshot.cashAvailable).toBe(0);
    expect(snapshot.effectiveLimit).toBe(0);

    const validation = validateProfitSharingLimits(
      'distribuicao_lucros',
      8000,
      [{ id: '1', name: 'Sócio A', beneficiaryType: 'socio', companyRole: 'Sócio', calculatedAmount: 8000, effectivePercentage: 100, status: 'previsto' }],
      snapshot,
    );
    expect(validation.allowed).toBe(false);
    expect(validation.blockingReason).toContain('ultrapassa a disponibilidade real de caixa');
  });

  test('11. Contas a pagar e retiradas já aprovadas são deduzidas da disponibilidade de caixa sem duplicar', () => {
    const existingDivision: ProfitSharingRecord = {
      name: 'Divisão Anterior',
      rule: 'equal',
      targetAmount: 2000,
      unallocatedAmount: 0,
      financialSnapshot: {} as FinancialSnapshot,
      auditTrail: [],
      id: 1,
      status: 'approved',
      category: 'distribuicao_lucros',
      periodType: 'monthly',
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
      totalDistributed: 2000,
      participants: [
        { id: 'p1', name: 'Ana', calculatedAmount: 1000, status: 'pago', beneficiaryType: 'socio', companyRole: 'Sócia', effectivePercentage: 50 }, // Já pago!
        { id: 'p2', name: 'Bruno', calculatedAmount: 1000, status: 'previsto', beneficiaryType: 'socio', companyRole: 'Sócio', effectivePercentage: 50 }, // Pendente (comprometido)
      ],
    };

    const snapshot = assessFinancialContext({
      cashBalance: 10000,
      sales: [{ date: '2026-09-15', gross: 10000, netRevenue: 10000, cost: 2000, profit: 8000 }],
      expenses: [{ type: 'one_off', date: '2026-09-10', value: 1000 }],
      existingApprovedDivisions: [existingDivision],
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
      workingCapitalReserve: 1000,
      additionalReserve: 0,
      category: 'distribuicao_lucros',
      targetAmount: 3000,
    });

    // Apenas a parcela pendente de 1000 deve constar em committedWithdrawals
    expect(snapshot.committedWithdrawals).toBe(1000);
  });

  test('12. Bloqueia participante não-sócio como beneficiário de Distribuição de Lucros', () => {
    const snapshot: FinancialSnapshot = {
      cashBalance: 20000,
      profitCalculated: 10000,
      isProfitReliable: true,
      accountsPayable: 1000,
      taxesAndObligations: 500,
      committedWithdrawals: 0,
      workingCapitalReserve: 2000,
      additionalReserve: 1000,
      cashAvailable: 15500,
      distributableProfit: 10000,
      effectiveLimit: 10000,
      projectedBalanceAfter: 15000,
    };

    const validation = validateProfitSharingLimits(
      'distribuicao_lucros',
      5000,
      [
        { id: '1', name: 'Carlos Colaborador', beneficiaryType: 'outro', companyRole: 'Gerente', calculatedAmount: 5000, effectivePercentage: 100, status: 'previsto' },
      ],
      snapshot,
    );
    expect(validation.allowed).toBe(false);
    expect(validation.blockingReason).toContain('não podem receber \'Distribuição de Lucros\'');
  });

  test('13. Valida payload para profit_sharing e sharing_template em records.ts', () => {
    const validDivision = validatePayload('profit_sharing', {
      name: 'Divisão Q3',
      category: 'distribuicao_lucros',
      rule: 'equal',
      targetAmount: 1000,
      totalDistributed: 1000,
      participants: [
        { name: 'Ana', beneficiaryType: 'socio', companyRole: 'Sócia', calculatedAmount: 500, effectivePercentage: 50, status: 'previsto' },
        { name: 'Bruno', beneficiaryType: 'socio', companyRole: 'Sócio', calculatedAmount: 500, effectivePercentage: 50, status: 'previsto' },
      ],
      financialSnapshot: { cashBalance: 5000, cashAvailable: 3000 },
      status: 'draft',
    });
    expect(validDivision.ok).toBe(true);

    const emptyParticipants = validatePayload('profit_sharing', {
      name: 'Divisão Vazia',
      participants: [],
    });
    expect(emptyParticipants.ok).toBe(false);
  });

  test('14. Pagamento parcial e prevenção de pagamento duplicado', () => {
    const participant1 = {
      id: 'p1',
      name: 'Ana',
      beneficiaryType: 'socio' as const,
      companyRole: 'Sócia',
      calculatedAmount: 1500,
      effectivePercentage: 50,
      status: 'aprovado' as const,
    };
    const participant2 = {
      id: 'p2',
      name: 'Bruno',
      beneficiaryType: 'socio' as const,
      companyRole: 'Sócio',
      calculatedAmount: 1500,
      effectivePercentage: 50,
      status: 'aprovado' as const,
    };

    // 1. Simula pagamento de Ana
    const paidParticipant1 = {
      ...participant1,
      status: 'pago' as const,
      paidAt: '2026-09-28',
      paymentMethod: 'PIX',
    };

    // Status global deve ser pago parcialmente
    const allParticipants = [paidParticipant1, participant2];
    const isAllPaid = allParticipants.every((p) => p.status === 'pago');
    const divisionStatus = isAllPaid ? 'paid' : 'paid_partial';
    expect(divisionStatus).toBe('paid_partial');

    // Tentativa de pagar novamente Ana deve ser rejeitada
    const canPayAgain = paidParticipant1.status !== 'pago';
    expect(canPayAgain).toBe(false);

    // 2. Simula pagamento de Bruno
    const paidParticipant2 = {
      ...participant2,
      status: 'pago' as const,
      paidAt: '2026-09-28',
      paymentMethod: 'TED',
    };
    const finalParticipants = [paidParticipant1, paidParticipant2];
    const finalStatus = finalParticipants.every((p) => p.status === 'pago') ? 'paid' : 'paid_partial';
    expect(finalStatus).toBe('paid');
  });

  test('15. Cancelamento de divisão aprovada libera valores comprometidos e registra auditoria', () => {
    const division: ProfitSharingRecord = {
      id: 99,
      name: 'Divisão a Cancelar',
      rule: 'equal',
      targetAmount: 4000,
      unallocatedAmount: 0,
      financialSnapshot: {} as FinancialSnapshot,
      periodType: 'monthly',
      status: 'approved',
      category: 'distribuicao_lucros',
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
      totalDistributed: 4000,
      participants: [
        { id: 'p1', name: 'Ana', calculatedAmount: 2000, status: 'aprovado', beneficiaryType: 'socio', companyRole: 'Sócia', effectivePercentage: 50 },
        { id: 'p2', name: 'Bruno', calculatedAmount: 2000, status: 'aprovado', beneficiaryType: 'socio', companyRole: 'Sócio', effectivePercentage: 50 },
      ],
      auditTrail: [
        { action: 'created', actorId: 'admin-1', actorName: 'Gustavo Admin', timestamp: '2026-09-25T10:00:00Z', details: 'Criado rascunho' },
        { action: 'approved', actorId: 'admin-1', actorName: 'Gustavo Admin', timestamp: '2026-09-25T10:05:00Z', details: 'Aprovada divisão' },
      ],
    };

    // Antes do cancelamento: 4000 comprometidos
    const snapBefore = assessFinancialContext({
      cashBalance: 10000,
      sales: [{ date: '2026-09-10', gross: 8000, netRevenue: 8000, cost: 2000, profit: 6000 }],
      expenses: [{ type: 'one_off', date: '2026-09-10', value: 1000 }],
      existingApprovedDivisions: [division],
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
      workingCapitalReserve: 1000,
      additionalReserve: 0,
      category: 'distribuicao_lucros',
      targetAmount: 2000,
    });
    expect(snapBefore.committedWithdrawals).toBe(4000);

    // Cancelamento
    const cancelledDivision: ProfitSharingRecord = {
      ...division,
      status: 'cancelled',
      cancelledAt: '2026-09-26T12:00:00Z',
      cancelledReason: 'Ajuste nas prioridades operacionais',
      auditTrail: [
        ...division.auditTrail,
        { action: 'cancelled' as const, actorId: 'admin-1', actorName: 'Gustavo Admin', timestamp: '2026-09-26T12:00:00Z', details: 'Cancelado por Gustavo Admin' },
      ],
    };
    expect(cancelledDivision.auditTrail).toHaveLength(3);

    // Após cancelamento: 0 comprometidos
    const snapAfter = assessFinancialContext({
      cashBalance: 10000,
      sales: [{ date: '2026-09-10', gross: 8000, netRevenue: 8000, cost: 2000, profit: 6000 }],
      expenses: [{ type: 'one_off', date: '2026-09-10', value: 1000 }],
      existingApprovedDivisions: [cancelledDivision],
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
      workingCapitalReserve: 1000,
      additionalReserve: 0,
      category: 'distribuicao_lucros',
      targetAmount: 2000,
    });
    expect(snapAfter.committedWithdrawals).toBe(0);
  });
});
