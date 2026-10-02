'use client';

import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Plus,
  Trash2,
  Download,
  Printer,
  Sparkles,
  Info,
  FileText,
  DollarSign,
  Lock,
  Layers,
  Save,
  RotateCcw,
  Building,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  calculateDivision,
  assessFinancialContext,
  validateProfitSharingLimits,
  roundCents,
  CATEGORY_LABELS,
  RULE_LABELS,
  type BeneficiaryType,
  type WithdrawalCategory,
  type DivisionRule,
  type ParticipantStatus,
  type DivisionParticipant,
  type DivisionTemplate,
  type ProfitSharingRecord,
  type FinancialSnapshot,
} from '@/lib/profit-sharing';
import { authenticatedFetch } from '@/lib/supabase-browser';

const money = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

type ApiRecord<T = Record<string, unknown>> = {
  id: number;
  kind: string;
  payload: T;
};

type CurrentUser = {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'employee' | 'viewer';
  storeId: string;
  companyName: string;
};

type Props = {
  user: CurrentUser;
  allRecords: ApiRecord[];
  onReload: () => Promise<void>;
  onNavigate?: (view: string) => void;
  onReportOperation: (status: string, error?: boolean) => void;
};

export function ProfitSharingView({
  user,
  allRecords,
  onReload,
  onNavigate: _onNavigate,
  onReportOperation,
}: Props) {
  const [activeTab, setActiveTab] = useState<'simulate' | 'history' | 'templates'>('simulate');

  // Período de simulação
  const [periodType, setPeriodType] = useState<'monthly' | 'weekly' | 'quarterly' | 'custom'>('monthly');
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-CA');
  const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toLocaleDateString('en-CA');
  const [periodStart, setPeriodStart] = useState<string>(defaultStart);
  const [periodEnd, setPeriodEnd] = useState<string>(defaultEnd);

  // Reservas configuráveis
  const [workingCapitalReserve, setWorkingCapitalReserve] = useState<number>(3000);
  const [additionalReserve, setAdditionalReserve] = useState<number>(0);
  const [showReservesConfig, setShowReservesConfig] = useState(false);
  const [showFinancialBreakdown, setShowFinancialBreakdown] = useState(false);

  // Parâmetros da Divisão
  const [divisionName, setDivisionName] = useState<string>(
    `Divisão de Resultados · ${now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`,
  );
  const [category, setCategory] = useState<WithdrawalCategory>('distribuicao_lucros');
  const [rule, setRule] = useState<DivisionRule>('equal');
  const [targetAmount, setTargetAmount] = useState<number>(0);

  // Participantes da simulação
  const [participants, setParticipants] = useState<
    Array<{
      id: string;
      name: string;
      beneficiaryType: BeneficiaryType;
      companyRole: string;
      percentage?: number;
      shares?: number;
      customValue?: number;
    }>
  >([
    {
      id: 'p-1',
      name: user.name || 'Sócio Administrador',
      beneficiaryType: 'socio',
      companyRole: 'Sócio Administrador',
      percentage: 50,
      shares: 1,
      customValue: 0,
    },
    {
      id: 'p-2',
      name: 'Sócio 2',
      beneficiaryType: 'socio',
      companyRole: 'Sócio Fundador',
      percentage: 50,
      shares: 1,
      customValue: 0,
    },
  ]);

  // Edição de rascunho existente
  const [editingDivisionId, setEditingDivisionId] = useState<number | null>(null);

  // Modal de pagamento
  const [paymentModalData, setPaymentModalData] = useState<{
    division: ApiRecord<ProfitSharingRecord>;
    participant: DivisionParticipant;
  } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('PIX');
  const [paymentDate, setPaymentDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Modal de cancelamento
  const [cancellationModalDivision, setCancellationModalDivision] = useState<ApiRecord<ProfitSharingRecord> | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  // Filtros do Histórico
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('all');
  const [historySearch, setHistorySearch] = useState<string>('');

type CashPayload = {
  name?: string;
  balance?: number;
  checkedAt?: string;
  notes?: string;
};

type SalePayload = {
  date?: string;
  netRevenue?: number;
  gross?: number;
  cost?: number;
  profit?: number;
  status?: string;
};

type ExpensePayload = {
  type?: 'monthly' | 'one_off';
  date?: string;
  value?: number;
  dueDay?: string;
  category?: string;
};

  // 1. Extrair registros do SaaS
  const cashRecord = useMemo(() => {
    return allRecords.find((r) => r.kind === 'settings' && (r.payload as CashPayload).name === 'Caixa');
  }, [allRecords]);

  const cashPayload = cashRecord ? (cashRecord.payload as CashPayload) : undefined;
  const cashBalance = Number(cashPayload?.balance || 0);
  const cashCheckedAt = cashPayload?.checkedAt;

  const sales = useMemo(() => {
    return allRecords
      .filter((r) => r.kind === 'sale')
      .map((r) => r.payload as SalePayload)
      .filter((s) => s.status !== 'Cancelada');
  }, [allRecords]);

  const expenses = useMemo(() => {
    return allRecords
      .filter((r) => r.kind === 'expense')
      .map((r) => r.payload as ExpensePayload);
  }, [allRecords]);

  const existingDivisions = useMemo(() => {
    return allRecords
      .filter((r) => r.kind === 'profit_sharing')
      .map((r) => ({
        id: r.id,
        kind: r.kind,
        payload: r.payload as unknown as ProfitSharingRecord,
      }));
  }, [allRecords]);

  const templates = useMemo(() => {
    return allRecords
      .filter((r) => r.kind === 'sharing_template')
      .map((r) => ({
        id: r.id,
        kind: r.kind,
        payload: r.payload as unknown as DivisionTemplate,
      }));
  }, [allRecords]);

  // Atualizar datas quando muda periodType
  const handlePeriodTypeChange = (type: 'monthly' | 'weekly' | 'quarterly' | 'custom') => {
    setPeriodType(type);
    const d = new Date();
    if (type === 'monthly') {
      setPeriodStart(new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString('en-CA'));
      setPeriodEnd(new Date(d.getFullYear(), d.getMonth() + 1, 0).toLocaleDateString('en-CA'));
    } else if (type === 'weekly') {
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const start = new Date(d.setDate(diff));
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      setPeriodStart(start.toLocaleDateString('en-CA'));
      setPeriodEnd(end.toLocaleDateString('en-CA'));
    } else if (type === 'quarterly') {
      const quarter = Math.floor(d.getMonth() / 3);
      const start = new Date(d.getFullYear(), quarter * 3, 1);
      const end = new Date(d.getFullYear(), quarter * 3 + 3, 0);
      setPeriodStart(start.toLocaleDateString('en-CA'));
      setPeriodEnd(end.toLocaleDateString('en-CA'));
    }
  };

  // 2. Apuração do Contexto Financeiro
  const financialSnapshot: FinancialSnapshot = useMemo(() => {
    return assessFinancialContext({
      cashBalance,
      cashCheckedAt,
      sales,
      expenses,
      existingApprovedDivisions: existingDivisions.map((d) => d.payload),
      periodStart,
      periodEnd,
      workingCapitalReserve,
      additionalReserve,
      category,
      targetAmount,
      currentDivisionId: editingDivisionId || undefined,
    });
  }, [
    cashBalance,
    cashCheckedAt,
    sales,
    expenses,
    existingDivisions,
    periodStart,
    periodEnd,
    workingCapitalReserve,
    additionalReserve,
    category,
    targetAmount,
    editingDivisionId,
  ]);

  // Categoria efetiva: se lucro não apurado, restringe a retirada de caixa (simulação)
  const effectiveCategory: WithdrawalCategory =
    !financialSnapshot.isProfitReliable && category === 'distribuicao_lucros'
      ? 'retirada_caixa'
      : category;

  // 3. Cálculo da Divisão
  const calculationResult = useMemo(() => {
    return calculateDivision(rule, targetAmount, participants);
  }, [rule, targetAmount, participants]);

  // 4. Validação de Limites e Compliance
  const limitsValidation = useMemo(() => {
    return validateProfitSharingLimits(
      effectiveCategory,
      targetAmount,
      calculationResult.participants,
      financialSnapshot,
    );
  }, [effectiveCategory, targetAmount, calculationResult.participants, financialSnapshot]);

  // Helper para adicionar participante
  const addParticipant = () => {
    const nextIdx = participants.length + 1;
    const newPart = {
      id: `part-${Date.now()}-${nextIdx}`,
      name: `Participante ${nextIdx}`,
      beneficiaryType: (effectiveCategory === 'distribuicao_lucros' || effectiveCategory === 'pro_labore' ? 'socio' : 'outro') as BeneficiaryType,
      companyRole: effectiveCategory === 'distribuicao_lucros' ? 'Sócio Cotista' : 'Colaborador',
      percentage: 0,
      shares: 1,
      customValue: 0,
    };
    setParticipants([...participants, newPart]);
  };

  // Helper para remover participante
  const removeParticipant = (index: number) => {
    if (participants.length <= 1) return;
    setParticipants(participants.filter((_, i) => i !== index));
  };

  // Helper para atualizar participante
  const updateParticipant = (index: number, updates: Partial<(typeof participants)[0]>) => {
    setParticipants((prev) =>
      prev.map((p, i) => (i === index ? { ...p, ...updates } : p)),
    );
  };

  // Aplicar Template salvo
  const applyTemplate = (tpl: DivisionTemplate) => {
    setRule(tpl.rule);
    setParticipants(
      tpl.participants.map((p, idx) => ({
        id: `tpl-part-${idx + 1}`,
        name: p.name,
        beneficiaryType: p.beneficiaryType,
        companyRole: p.companyRole,
        percentage: p.percentage ?? 0,
        shares: p.shares ?? 1,
        customValue: p.customValue ?? 0,
      })),
    );
    onReportOperation(`Modelo "${tpl.name}" aplicado.`);
  };

  // Salvar modelo atual como template
  const saveAsTemplate = async () => {
    const name = window.prompt('Nome para este modelo de divisão (ex.: Divisão Sócios 60/40):');
    if (!name || !name.trim()) return;

    try {
      const templatePayload: DivisionTemplate = {
        name: name.trim(),
        rule,
        description: `Modelo criado em ${new Date().toLocaleDateString('pt-BR')} com ${participants.length} participantes`,
        participants: participants.map((p) => ({
          name: p.name,
          beneficiaryType: p.beneficiaryType,
          companyRole: p.companyRole,
          percentage: p.percentage,
          shares: p.shares,
          customValue: p.customValue,
        })),
      };

      const res = await authenticatedFetch('/api/records', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': crypto.randomUUID(),
        },
        body: JSON.stringify({
          kind: 'sharing_template',
          payload: templatePayload,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao salvar modelo.');
      }

      await onReload();
      onReportOperation('Modelo salvo com sucesso!');
    } catch (err: unknown) {
      onReportOperation(err instanceof Error ? err.message : 'Falha ao salvar modelo.', true);
    }
  };

  // Salvar Divisão (Rascunho ou Aprovada)
  const saveDivision = async (desiredStatus: 'draft' | 'approved') => {
    if (!calculationResult.ok) {
      onReportOperation(calculationResult.error || 'Revise a divisão dos participantes.', true);
      return;
    }

    if (desiredStatus === 'approved') {
      if (user.role !== 'admin') {
        onReportOperation('Apenas administradores podem aprovar divisões de resultados.', true);
        return;
      }
      if (!limitsValidation.allowed) {
        onReportOperation(limitsValidation.blockingReason || 'Operação excede limites de segurança.', true);
        return;
      }
    }

    try {
      const participantsWithStatus = calculationResult.participants.map((p) => ({
        ...p,
        status: desiredStatus === 'approved' ? ('aprovado' as ParticipantStatus) : ('previsto' as ParticipantStatus),
      }));

      const payload: ProfitSharingRecord = {
        name: divisionName.trim() || `Divisão · ${periodStart} a ${periodEnd}`,
        periodType,
        periodStart,
        periodEnd,
        storeId: user.storeId,
        storeName: user.companyName,
        category: effectiveCategory,
        rule,
        targetAmount,
        totalDistributed: calculationResult.totalDistributed,
        unallocatedAmount: calculationResult.unallocatedAmount,
        pennyAdjustmentParticipantId: calculationResult.pennyAdjustmentParticipantId,
        pennyAdjustmentAmount: calculationResult.pennyAdjustmentAmount,
        pennyAdjustmentNote: calculationResult.pennyAdjustmentNote,
        financialSnapshot,
        participants: participantsWithStatus,
        status: desiredStatus,
        approvedAt: desiredStatus === 'approved' ? new Date().toISOString() : undefined,
        approvedByUserId: desiredStatus === 'approved' ? user.id : undefined,
        approvedByUserName: desiredStatus === 'approved' ? user.name : undefined,
        auditTrail: [
          {
            action: desiredStatus === 'approved' ? 'approved' : 'created',
            actorId: user.id,
            actorName: user.name,
            timestamp: new Date().toISOString(),
            details:
              desiredStatus === 'approved'
                ? `Divisão aprovada no valor de ${money.format(calculationResult.totalDistributed)} por ${user.name}`
                : `Rascunho salvo no valor de ${money.format(calculationResult.totalDistributed)} por ${user.name}`,
          },
        ],
      };

      const res = await authenticatedFetch('/api/records', {
        method: editingDivisionId ? 'PUT' : 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': crypto.randomUUID(),
        },
        body: JSON.stringify(
          editingDivisionId
            ? { id: editingDivisionId, payload }
            : { kind: 'profit_sharing', payload },
        ),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao registrar divisão.');
      }

      await onReload();
      onReportOperation(
        desiredStatus === 'approved'
          ? 'Divisão aprovada com sucesso! Os valores constam como comprometidos até o pagamento.'
          : 'Rascunho salvo com sucesso na sua conta.',
      );
      setEditingDivisionId(null);
      setActiveTab('history');
    } catch (err: unknown) {
      onReportOperation(err instanceof Error ? err.message : 'Falha ao salvar divisão.', true);
    }
  };

  // Carregar rascunho para edição
  const startEditingDivision = (rec: ApiRecord<ProfitSharingRecord>) => {
    setEditingDivisionId(rec.id);
    setDivisionName(rec.payload.name);
    setPeriodType(rec.payload.periodType);
    setPeriodStart(rec.payload.periodStart);
    setPeriodEnd(rec.payload.periodEnd);
    setCategory(rec.payload.category);
    setRule(rec.payload.rule);
    setTargetAmount(rec.payload.targetAmount);
    setParticipants(
      rec.payload.participants.map((p) => ({
        id: p.id,
        name: p.name,
        beneficiaryType: p.beneficiaryType,
        companyRole: p.companyRole,
        percentage: p.percentage,
        shares: p.shares,
        customValue: p.customValue,
      })),
    );
    setActiveTab('simulate');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Registrar Pagamento de Participante
  const handleConfirmPayment = async () => {
    if (!paymentModalData) return;
    if (user.role !== 'admin') {
      onReportOperation('Apenas administradores podem registrar pagamentos.', true);
      return;
    }

    const { division, participant } = paymentModalData;
    if (participant.status === 'pago') {
      onReportOperation('Este pagamento já foi registrado anteriormente.', true);
      return;
    }

    setIsProcessingPayment(true);
    try {
      const amountToPay = participant.calculatedAmount;

      // 1. Atualizar status do participante na divisão
      const updatedParticipants = division.payload.participants.map((p) => {
        if (p.id === participant.id) {
          return {
            ...p,
            status: 'pago' as ParticipantStatus,
            paidAt: paymentDate,
            paymentMethod,
            paymentReference: paymentNotes.trim() || undefined,
            paidByUserName: user.name,
          };
        }
        return p;
      });

      const allPaid = updatedParticipants.every((p) => p.status === 'pago' || p.status === 'cancelado');
      const newStatus = allPaid ? 'paid' : 'paid_partial';

      const updatedAuditTrail = [
        ...(division.payload.auditTrail || []),
        {
          action: 'payment_registered' as const,
          actorId: user.id,
          actorName: user.name,
          timestamp: new Date().toISOString(),
          details: `Pagamento de ${money.format(amountToPay)} registrado para ${participant.name} via ${paymentMethod}`,
        },
      ];

      const divisionPayload: ProfitSharingRecord = {
        ...division.payload,
        participants: updatedParticipants,
        status: newStatus,
        auditTrail: updatedAuditTrail,
      };

      const resDiv = await authenticatedFetch('/api/records', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: division.id, payload: divisionPayload }),
      });

      if (!resDiv.ok) {
        const err = await resDiv.json();
        throw new Error(err.error || 'Erro ao registrar baixa do pagamento.');
      }

      // 2. Atualizar o caixa real (deduzindo o valor pago do saldo real)
      if (cashRecord) {
        const cashPayloadData = cashRecord.payload as CashPayload;
        const currentBalance = Number(cashPayloadData?.balance || 0);
        const newBalance = roundCents(Math.max(0, currentBalance - amountToPay));

        await authenticatedFetch('/api/records', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            id: cashRecord.id,
            payload: {
              ...cashPayloadData,
              balance: newBalance,
              checkedAt: paymentDate,
              notes: `Baixa de divisão de resultados (${participant.name} - ${money.format(amountToPay)})`,
            },
          }),
        });
      }

      await onReload();
      onReportOperation(`Pagamento de ${money.format(amountToPay)} registrado com sucesso e deduzido do caixa!`);
      setPaymentModalData(null);
    } catch (err: unknown) {
      onReportOperation(err instanceof Error ? err.message : 'Falha ao processar pagamento.', true);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Cancelar Divisão
  const handleConfirmCancel = async () => {
    if (!cancellationModalDivision) return;
    if (user.role !== 'admin') {
      onReportOperation('Apenas administradores podem cancelar divisões.', true);
      return;
    }

    if (!cancelReason.trim()) {
      onReportOperation('Informe o motivo do cancelamento.', true);
      return;
    }

    setIsCancelling(true);
    try {
      const division = cancellationModalDivision;
      const hasPaid = division.payload.participants.some((p) => p.status === 'pago');

      if (hasPaid) {
        throw new Error('Esta divisão possui parcelas já pagas. Não é permitido cancelamento automático de parcelas quitadas sem estorno prévio.');
      }

      const updatedAuditTrail = [
        ...(division.payload.auditTrail || []),
        {
          action: 'cancelled' as const,
          actorId: user.id,
          actorName: user.name,
          timestamp: new Date().toISOString(),
          details: `Divisão cancelada por ${user.name}. Motivo: ${cancelReason.trim()}`,
        },
      ];

      const divisionPayload: ProfitSharingRecord = {
        ...division.payload,
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
        cancelledByUserId: user.id,
        cancelledReason: cancelReason.trim(),
        auditTrail: updatedAuditTrail,
      };

      const res = await authenticatedFetch('/api/records', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: division.id, payload: divisionPayload }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao cancelar divisão.');
      }

      await onReload();
      onReportOperation('Divisão cancelada. Os valores comprometidos foram liberados.');
      setCancellationModalDivision(null);
      setCancelReason('');
    } catch (err: unknown) {
      onReportOperation(err instanceof Error ? err.message : 'Falha ao cancelar divisão.', true);
    } finally {
      setIsCancelling(false);
    }
  };

  // Exportar Relatório Histórico em CSV
  const exportHistoryCsv = () => {
    const rows = [
      [
        'ID',
        'Nome da Divisão',
        'Período',
        'Categoria',
        'Regra',
        'Status',
        'Total da Divisão (R$)',
        'Participante',
        'Tipo',
        'Vínculo',
        'Valor da Parcela (R$)',
        'Status Parcela',
        'Data Pagamento',
        'Forma Pagamento',
      ],
    ];

    for (const div of existingDivisions) {
      for (const p of div.payload.participants) {
        rows.push([
          String(div.id),
          div.payload.name,
          `${div.payload.periodStart} a ${div.payload.periodEnd}`,
          CATEGORY_LABELS[div.payload.category]?.label || div.payload.category,
          RULE_LABELS[div.payload.rule]?.label || div.payload.rule,
          div.payload.status,
          div.payload.totalDistributed.toFixed(2),
          p.name,
          p.beneficiaryType === 'socio' ? 'Sócio' : 'Outro Beneficiário',
          p.companyRole,
          p.calculatedAmount.toFixed(2),
          p.status,
          p.paidAt || '—',
          p.paymentMethod || '—',
        ]);
      }
    }

    const csvContent = '\uFEFF' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `divisao-resultados-${new Date().toLocaleDateString('en-CA')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="profit-sharing-view" style={{ width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>
      {/* Top Header */}
      <div className="page-heading module-heading">
        <div>
          <p className="eyebrow">MÓDULO SOCIETÁRIO & FINANCEIRO</p>
          <h1>Divisão de Resultados</h1>
          <p>
            Simule retiradas e distribuição de lucros com segregação real de caixa, reservas e respeito às obrigações da empresa.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <Button
            variant={activeTab === 'simulate' ? 'default' : 'outline'}
            onClick={() => setActiveTab('simulate')}
            className={activeTab === 'simulate' ? 'primary-action' : 'button-secondary'}
          >
            <Sparkles size={16} /> Simular & Nova Divisão
          </Button>
          <Button
            variant={activeTab === 'history' ? 'default' : 'outline'}
            onClick={() => setActiveTab('history')}
            className={activeTab === 'history' ? 'primary-action' : 'button-secondary'}
          >
            <FileText size={16} /> Histórico & Pagamentos
            {existingDivisions.some((d) => d.payload.status === 'approved' || d.payload.status === 'paid_partial') && (
              <span
                style={{
                  marginLeft: '0.4rem',
                  background: '#f59e0b',
                  color: '#000',
                  borderRadius: '999px',
                  padding: '0.1rem 0.45rem',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                }}
              >
                Ativas
              </span>
            )}
          </Button>
          <Button
            variant={activeTab === 'templates' ? 'default' : 'outline'}
            onClick={() => setActiveTab('templates')}
            className={activeTab === 'templates' ? 'primary-action' : 'button-secondary'}
          >
            <Layers size={16} /> Modelos Salvos
          </Button>
        </div>
      </div>

      {/* Nota de Governança e Contabilidade */}
      <div
        className="panel"
        style={{
          padding: '0.85rem 1.15rem',
          marginBottom: '1.25rem',
          background: 'rgba(99, 102, 241, 0.06)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          borderRadius: '0.75rem',
          display: 'flex',
          gap: '0.75rem',
          alignItems: 'center',
          fontSize: '0.85rem',
        }}
      >
        <Info size={20} style={{ color: '#6366f1', flexShrink: 0 }} />
        <div>
          <strong style={{ color: 'var(--foreground)' }}>Aviso Legal & Diretriz Financeira: </strong>
          <span style={{ color: 'var(--muted-foreground)' }}>
            O saldo em caixa não representa lucro integral. Este módulo apoia decisões de gestão, separando contas a pagar, reservas de capital de giro e lucros efetivamente apurados antes de qualquer retirada.
          </span>
        </div>
      </div>

      {/* ================= ABA 1: SIMULAÇÃO & NOVA DIVISÃO ================= */}
      {activeTab === 'simulate' && (
        <div className="simulate-tab-container">
          {/* Barra de Filtro de Período & Empresa */}
          <div
            className="panel"
            style={{
              padding: '1.15rem',
              marginBottom: '1.25rem',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Building size={18} style={{ color: 'var(--primary)' }} />
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', display: 'block' }}>UNIDADE / EMPRESA</span>
                <strong style={{ fontSize: '0.95rem' }}>{user.companyName}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', maxWidth: '100%' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', fontWeight: 600 }}>PERÍODO:</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', maxWidth: '100%' }}>
                {(['weekly', 'monthly', 'quarterly', 'custom'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handlePeriodTypeChange(t)}
                    style={{
                      padding: '0.35rem 0.6rem',
                      borderRadius: '0.4rem',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: periodType === t ? '2px solid var(--primary)' : '1px solid var(--border)',
                      background: periodType === t ? 'var(--accent)' : 'var(--card)',
                      color: periodType === t ? 'var(--primary)' : 'var(--foreground)',
                    }}
                  >
                    {t === 'weekly' && 'Semanal'}
                    {t === 'monthly' && 'Mensal'}
                    {t === 'quarterly' && 'Trimestral'}
                    {t === 'custom' && 'Personalizado'}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem', maxWidth: '100%' }}>
                <input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  style={{
                    padding: '0.35rem 0.4rem',
                    fontSize: '0.75rem',
                    borderRadius: '0.4rem',
                    border: '1px solid var(--border)',
                    background: 'var(--card)',
                    maxWidth: '130px',
                  }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>até</span>
                <input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  style={{
                    padding: '0.35rem 0.4rem',
                    fontSize: '0.75rem',
                    borderRadius: '0.4rem',
                    border: '1px solid var(--border)',
                    background: 'var(--card)',
                    maxWidth: '130px',
                  }}
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={onReload}
                title="Recarregar vendas e despesas"
                style={{ height: '32px', padding: '0 0.6rem' }}
              >
                <RotateCcw size={14} /> Atualizar
              </Button>
            </div>
          </div>

          {/* PAINEL DE METRICAS FINANCEIRAS E LIMITES (10 itens separados) */}
          <div
            className="summary-strip"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
              gap: '1rem',
              marginBottom: '1.25rem',
            }}
          >
            {/* 1. Saldo em Caixa */}
            <div className="panel" style={{ padding: '1.1rem' }}>
              <p className="section-kicker" style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', marginBottom: '0.2rem' }}>
                1. SALDO EM CAIXA & BANCOS
              </p>
              <strong style={{ fontSize: '1.35rem', color: 'var(--foreground)' }}>
                {money.format(financialSnapshot.cashBalance)}
              </strong>
              <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.2rem' }}>
                {financialSnapshot.cashCheckedAt
                  ? `Conferido em ${new Date(`${financialSnapshot.cashCheckedAt}T12:00:00`).toLocaleDateString('pt-BR')}`
                  : 'Origem: Módulo Caixa'}
              </p>
            </div>

            {/* 2. Lucro Apurado no Período */}
            <div
              className="panel"
              style={{
                padding: '1.1rem',
                border: financialSnapshot.isProfitReliable ? '1px solid var(--border)' : '1px solid #f59e0b',
                background: financialSnapshot.isProfitReliable ? 'var(--card)' : 'rgba(245, 158, 11, 0.05)',
              }}
            >
              <p className="section-kicker" style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', marginBottom: '0.2rem' }}>
                2. LUCRO APURADO NO PERÍODO
              </p>
              {financialSnapshot.isProfitReliable && financialSnapshot.profitCalculated !== null ? (
                <>
                  <strong
                    style={{
                      fontSize: '1.35rem',
                      color: financialSnapshot.profitCalculated >= 0 ? '#10b981' : '#ef4444',
                    }}
                  >
                    {money.format(financialSnapshot.profitCalculated)}
                  </strong>
                  <p style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '0.2rem', fontWeight: 600 }}>
                    ✓ Apuração completa do período
                  </p>
                </>
              ) : (
                <>
                  <strong style={{ fontSize: '1.2rem', color: '#f59e0b' }}>Não apurado</strong>
                  <p style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', marginTop: '0.2rem' }}>
                    {financialSnapshot.unreliableReason || 'Faltam vendas ou despesas registradas'}
                  </p>
                </>
              )}
            </div>

            {/* 3. Contas a Pagar e Despesas */}
            <div className="panel" style={{ padding: '1.1rem' }}>
              <p className="section-kicker" style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', marginBottom: '0.2rem' }}>
                3. CONTAS A PAGAR NO PERÍODO
              </p>
              <strong style={{ fontSize: '1.35rem', color: '#f87171' }}>
                -{money.format(financialSnapshot.accountsPayable)}
              </strong>
              <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.2rem' }}>
                Despesas fixas e pontuais consideradas
              </p>
            </div>

            {/* 4. Impostos e Obrigações */}
            <div className="panel" style={{ padding: '1.1rem' }}>
              <p className="section-kicker" style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', marginBottom: '0.2rem' }}>
                4. IMPOSTOS & OBRIGAÇÕES
              </p>
              <strong style={{ fontSize: '1.35rem', color: '#f87171' }}>
                -{money.format(financialSnapshot.taxesAndObligations)}
              </strong>
              <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.2rem' }}>
                Previsão fiscal e tributária
              </p>
            </div>

            {/* 5. Valores Já Comprometidos */}
            <div className="panel" style={{ padding: '1.1rem' }}>
              <p className="section-kicker" style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', marginBottom: '0.2rem' }}>
                5. VALORES JÁ COMPROMETIDOS
              </p>
              <strong style={{ fontSize: '1.35rem', color: '#f59e0b' }}>
                -{money.format(financialSnapshot.committedWithdrawals)}
              </strong>
              <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.2rem' }}>
                Divisões aprovadas ainda pendentes
              </p>
            </div>

            {/* 6. Reserva Capital de Giro */}
            <div className="panel" style={{ padding: '1.1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p className="section-kicker" style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', marginBottom: '0.2rem' }}>
                  6. CAPITAL DE GIRO
                </p>
                <button
                  type="button"
                  onClick={() => setShowReservesConfig(!showReservesConfig)}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                >
                  {showReservesConfig ? 'Fechar' : 'Ajustar'}
                </button>
              </div>
              <strong style={{ fontSize: '1.35rem', color: '#38bdf8' }}>
                -{money.format(financialSnapshot.workingCapitalReserve)}
              </strong>
              <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.2rem' }}>
                Blindagem operacional da loja
              </p>
            </div>

            {/* 7. Reserva Adicional */}
            <div className="panel" style={{ padding: '1.1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p className="section-kicker" style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', marginBottom: '0.2rem' }}>
                  7. RESERVA ADICIONAL
                </p>
                <button
                  type="button"
                  onClick={() => setShowReservesConfig(!showReservesConfig)}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                >
                  {showReservesConfig ? 'Fechar' : 'Ajustar'}
                </button>
              </div>
              <strong style={{ fontSize: '1.35rem', color: '#818cf8' }}>
                -{money.format(financialSnapshot.additionalReserve)}
              </strong>
              <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.2rem' }}>
                Expansão ou investimentos futuros
              </p>
            </div>

            {/* 8. Disponibilidade Líquida de Caixa */}
            <div
              className="panel"
              style={{
                padding: '1.1rem',
                background: financialSnapshot.cashAvailable > 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                border: financialSnapshot.cashAvailable > 0 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
              }}
            >
              <p className="section-kicker" style={{ fontSize: '0.72rem', color: 'var(--primary)', marginBottom: '0.2rem' }}>
                8. DISPONÍVEL P/ RETIRADA
              </p>
              <strong style={{ fontSize: '1.45rem', color: financialSnapshot.cashAvailable > 0 ? '#10b981' : '#ef4444' }}>
                {money.format(financialSnapshot.cashAvailable)}
              </strong>
              <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.2rem' }}>
                Caixa livre após todas as deduções
              </p>
            </div>

            {/* 9. Valor Escolhido para Divisão */}
            <div className="panel" style={{ padding: '1.1rem', background: 'var(--accent)', border: '1px solid var(--border)' }}>
              <p className="section-kicker" style={{ fontSize: '0.72rem', color: 'var(--foreground)', marginBottom: '0.2rem' }}>
                9. VALOR DA SIMULAÇÃO
              </p>
              <strong style={{ fontSize: '1.45rem', color: 'var(--foreground)' }}>
                {money.format(targetAmount)}
              </strong>
              <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.2rem' }}>
                {calculationResult.totalDistributed > 0
                  ? `${money.format(calculationResult.totalDistributed)} distribuídos`
                  : 'Nenhum valor definido'}
              </p>
            </div>

            {/* 10. Saldo Previsto Após Divisão */}
            <div
              className="panel"
              style={{
                padding: '1.1rem',
                border: financialSnapshot.projectedBalanceAfter >= 0 ? '1px solid var(--border)' : '1px solid #ef4444',
                background: financialSnapshot.projectedBalanceAfter < 0 ? 'rgba(239, 68, 68, 0.08)' : undefined,
              }}
            >
              <p className="section-kicker" style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', marginBottom: '0.2rem' }}>
                10. SALDO PREVISTO APÓS RETIRADA
              </p>
              <strong
                style={{
                  fontSize: '1.35rem',
                  color: financialSnapshot.projectedBalanceAfter >= 0 ? 'var(--foreground)' : '#ef4444',
                }}
              >
                {money.format(financialSnapshot.projectedBalanceAfter)}
              </strong>
              <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.2rem' }}>
                Saldo remanescente em caixa e bancos
              </p>
            </div>
          </div>

          {/* Configuração de Reservas (Expansível) */}
          {showReservesConfig && (
            <div
              className="panel"
              style={{
                padding: '1.25rem',
                marginBottom: '1.25rem',
                background: 'var(--card)',
                border: '1px dashed var(--primary)',
              }}
            >
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Lock size={16} /> Configuração de Reservas da Empresa
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)', marginBottom: '1rem' }}>
                Estes valores ficam blindados na disponibilidade de caixa e não serão consumidos pela divisão.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <label>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Reserva de Capital de Giro (R$)</span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={workingCapitalReserve}
                    onChange={(e) => setWorkingCapitalReserve(Math.max(0, Number(e.target.value) || 0))}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.4rem', border: '1px solid var(--border)' }}
                  />
                  <small style={{ color: 'var(--muted-foreground)', display: 'block', marginTop: '0.25rem' }}>
                    Recomendado: equivalente a 1 mês de despesas fixas.
                  </small>
                </label>

                <label>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Reserva Adicional / Emergência (R$)</span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={additionalReserve}
                    onChange={(e) => setAdditionalReserve(Math.max(0, Number(e.target.value) || 0))}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.4rem', border: '1px solid var(--border)' }}
                  />
                  <small style={{ color: 'var(--muted-foreground)', display: 'block', marginTop: '0.25rem' }}>
                    Fundo para reformas, novos equipamentos ou décimo terceiro.
                  </small>
                </label>
              </div>
            </div>
          )}

          {/* Origem Detalhada dos Valores (Transparência Total) */}
          <div style={{ marginBottom: '1.25rem' }}>
            <button
              type="button"
              onClick={() => setShowFinancialBreakdown(!showFinancialBreakdown)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <Info size={16} /> {showFinancialBreakdown ? 'Ocultar origem dos valores apurados' : 'Ver origem detalhada de cada valor considerado no cálculo'}
            </button>

            {showFinancialBreakdown && (
              <div className="panel" style={{ padding: '1rem', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                <h4 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Detalhamento da Apuração do Período ({periodStart} a {periodEnd}):</h4>
                <ul style={{ paddingLeft: '1.25rem', lineHeight: '1.6', color: 'var(--muted-foreground)' }}>
                  <li>
                    <strong>Saldo de Caixa:</strong> R$ {financialSnapshot.cashBalance.toFixed(2)} registrado na conferência de {financialSnapshot.cashCheckedAt || 'data atual'}.
                  </li>
                  <li>
                    <strong>Vendas Registradas:</strong> {sales.filter(s => s.date && s.date.slice(0, 10) >= periodStart && s.date.slice(0, 10) <= periodEnd).length} vendas válidas no período, totalizando receita líquida de R${' '}
                    {sales
                      .filter(s => s.date && s.date.slice(0, 10) >= periodStart && s.date.slice(0, 10) <= periodEnd)
                      .reduce((acc, s) => acc + (s.netRevenue || s.gross || 0), 0)
                      .toFixed(2)}.
                  </li>
                  <li>
                    <strong>Custo dos Produtos Vendidos (CPV):</strong> R${' '}
                    {sales
                      .filter(s => s.date && s.date.slice(0, 10) >= periodStart && s.date.slice(0, 10) <= periodEnd)
                      .reduce((acc, s) => acc + (s.cost || 0), 0)
                      .toFixed(2)}.
                  </li>
                  <li>
                    <strong>Despesas Operacionais do Período:</strong> R$ {financialSnapshot.accountsPayable.toFixed(2)} lançadas no módulo de Despesas.
                  </li>
                  <li>
                    <strong>Valores Já Comprometidos:</strong> R$ {financialSnapshot.committedWithdrawals.toFixed(2)} referentes a divisões aprovadas cujos pagamentos ainda não foram registrados.
                  </li>
                </ul>
              </div>
            )}
          </div>

          {/* FORMULÁRIO DE SIMULAÇÃO E PARTICIPANTES */}
          <div className="module-layout" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '1.25rem', maxWidth: '100%' }}>
            {/* COLUNA ESQUERDA: PARÂMETROS DA OPERAÇÃO */}
            <div className="panel" style={{ padding: '1.25rem' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                {editingDivisionId ? 'Editar Simulação / Rascunho' : 'Configurar Nova Divisão'}
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', marginBottom: '1.25rem' }}>
                Preencha a classificação, o valor total e selecione a regra desejada.
              </p>

              <form onSubmit={(e) => e.preventDefault()} className="data-form">
                <label>
                  <span>Identificação da Divisão</span>
                  <input
                    value={divisionName}
                    onChange={(e) => setDivisionName(e.target.value)}
                    required
                    maxLength={120}
                    placeholder="Ex.: Distribuição Q3 Sócios"
                  />
                </label>

                {/* Classificação Societária / Operacional */}
                <label>
                  <span>Classificação da Operação</span>
                  <select
                    value={effectiveCategory}
                    onChange={(e) => setCategory(e.target.value as WithdrawalCategory)}
                    style={{ fontWeight: 600 }}
                  >
                    <option value="distribuicao_lucros" disabled={!financialSnapshot.isProfitReliable}>
                      Distribuição de Lucros (Exclusivo Sócios {!financialSnapshot.isProfitReliable ? '- Bloqueado: Lucro não apurado' : ''})
                    </option>
                    <option value="retirada_caixa">
                      Retirada de Caixa / Antecipação (Simulação de Caixa)
                    </option>
                    <option value="pro_labore">
                      Pró-labore (Remuneração do Sócio/Administrador)
                    </option>
                    <option value="reembolso">
                      Reembolso de Despesas
                    </option>
                    <option value="bonificacao">
                      Bonificação / Participação nos Resultados (Colaboradores)
                    </option>
                  </select>
                </label>

                {/* Explicação da Categoria */}
                <div
                  style={{
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    background: 'var(--accent)',
                    border: '1px solid var(--border)',
                    fontSize: '0.8rem',
                    marginBottom: '0.75rem',
                  }}
                >
                  <p style={{ margin: 0, fontWeight: 600, color: 'var(--primary)' }}>
                    {CATEGORY_LABELS[effectiveCategory].label}
                  </p>
                  <p style={{ margin: '0.25rem 0 0 0', color: 'var(--muted-foreground)' }}>
                    {CATEGORY_LABELS[effectiveCategory].desc}
                  </p>
                  {effectiveCategory === 'retirada_caixa' && !financialSnapshot.isProfitReliable && (
                    <div style={{ marginTop: '0.5rem', color: '#f59e0b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <AlertTriangle size={14} />
                      Simulação identificada estritamente como retirada de caixa (sem classificação de lucros).
                    </div>
                  )}
                </div>

                {/* Valor Total a Dividir */}
                <label>
                  Valor Escolhido para Divisão (R$)
                  <span style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', display: 'block', margin: '0.2rem 0 0.35rem 0' }}>
                    Máx. recomendado: {money.format(financialSnapshot.effectiveLimit)}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={targetAmount || ''}
                    onChange={(e) => setTargetAmount(Math.max(0, Number(e.target.value) || 0))}
                    placeholder="0,00"
                    style={{ fontSize: '1.25rem', fontWeight: 700 }}
                  />
                </label>

                {/* Atalhos Rápidos */}
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                  <button
                    type="button"
                    onClick={() => setTargetAmount(roundCents(financialSnapshot.effectiveLimit))}
                    style={{
                      padding: '0.3rem 0.6rem',
                      borderRadius: '0.35rem',
                      fontSize: '0.75rem',
                      background: 'var(--accent)',
                      border: '1px solid var(--border)',
                      cursor: 'pointer',
                    }}
                  >
                    100% do Limite ({money.format(financialSnapshot.effectiveLimit)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetAmount(roundCents(financialSnapshot.effectiveLimit * 0.75))}
                    style={{
                      padding: '0.3rem 0.6rem',
                      borderRadius: '0.35rem',
                      fontSize: '0.75rem',
                      background: 'var(--accent)',
                      border: '1px solid var(--border)',
                      cursor: 'pointer',
                    }}
                  >
                    75% ({money.format(financialSnapshot.effectiveLimit * 0.75)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetAmount(roundCents(financialSnapshot.effectiveLimit * 0.5))}
                    style={{
                      padding: '0.3rem 0.6rem',
                      borderRadius: '0.35rem',
                      fontSize: '0.75rem',
                      background: 'var(--accent)',
                      border: '1px solid var(--border)',
                      cursor: 'pointer',
                    }}
                  >
                    50% ({money.format(financialSnapshot.effectiveLimit * 0.5)})
                  </button>
                </div>

                {/* Escolha da Regra */}
                <label>
                  <span>Forma de Divisão</span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.4rem', marginTop: '0.35rem' }}>
                    {(['equal', 'percentage', 'shares', 'custom_values'] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRule(r)}
                        style={{
                          padding: '0.55rem',
                          borderRadius: '0.45rem',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          textAlign: 'center',
                          cursor: 'pointer',
                          border: rule === r ? '2px solid var(--primary)' : '1px solid var(--border)',
                          background: rule === r ? 'var(--accent)' : 'var(--card)',
                          color: rule === r ? 'var(--primary)' : 'var(--foreground)',
                        }}
                      >
                        {r === 'equal' && 'A. Igualitária'}
                        {r === 'percentage' && 'B. Percentual (100%)'}
                        {r === 'shares' && 'C. Por Cotas'}
                        {r === 'custom_values' && 'D. Valores Definidos'}
                      </button>
                    ))}
                  </div>
                </label>

                <p style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', marginTop: '0.35rem' }}>
                  {RULE_LABELS[rule].desc}
                </p>

                {/* Feedback e Alertas de Limite */}
                {!limitsValidation.allowed && (
                  <div
                    style={{
                      padding: '0.85rem',
                      borderRadius: '0.5rem',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid #ef4444',
                      color: '#ef4444',
                      fontSize: '0.85rem',
                      marginTop: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
                      <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                      <div>
                        <strong>Bloqueio de Conformidade Financeira:</strong>
                        <p style={{ margin: '0.25rem 0 0 0', lineHeight: '1.4' }}>{limitsValidation.blockingReason}</p>
                      </div>
                    </div>
                  </div>
                )}

                {limitsValidation.allowed && limitsValidation.warnings.length > 0 && (
                  <div
                    style={{
                      padding: '0.75rem',
                      borderRadius: '0.5rem',
                      background: 'rgba(245, 158, 11, 0.1)',
                      border: '1px solid #f59e0b',
                      color: '#b45309',
                      fontSize: '0.8rem',
                      marginTop: '0.75rem',
                    }}
                  >
                    {limitsValidation.warnings.map((w, idx) => (
                      <p key={idx} style={{ margin: idx > 0 ? '0.25rem 0 0 0' : 0 }}>
                        ⚠️ {w}
                      </p>
                    ))}
                  </div>
                )}
              </form>
            </div>

            {/* COLUNA DIREITA: PARTICIPANTES & PRÉVIA */}
            <div className="panel" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0 }}>
                    Participantes da Divisão ({participants.length})
                  </h3>
                  <small style={{ color: 'var(--muted-foreground)' }}>
                    Adicione quantas pessoas forem necessárias
                  </small>
                </div>

                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <Button size="sm" variant="outline" onClick={addParticipant} className="button-secondary">
                    <Plus size={14} /> Participante
                  </Button>
                  <Button size="sm" variant="outline" onClick={saveAsTemplate} className="button-secondary" title="Salvar regra para reutilizar">
                    <Save size={14} /> Salvar Modelo
                  </Button>
                </div>
              </div>

              {/* Status de Percentual se Regra for 'percentage' */}
              {rule === 'percentage' && (
                <div
                  style={{
                    padding: '0.5rem 0.8rem',
                    borderRadius: '0.4rem',
                    marginBottom: '0.75rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    background:
                      Math.abs(participants.reduce((s, p) => s + (Number(p.percentage) || 0), 0) - 100) < 0.01
                        ? 'rgba(16, 185, 129, 0.1)'
                        : 'rgba(239, 68, 68, 0.1)',
                    color:
                      Math.abs(participants.reduce((s, p) => s + (Number(p.percentage) || 0), 0) - 100) < 0.01
                        ? '#10b981'
                        : '#ef4444',
                  }}
                >
                  <span>Soma dos percentuais:</span>
                  <span>
                    {participants.reduce((s, p) => s + (Number(p.percentage) || 0), 0).toFixed(1)}% / 100.0%
                  </span>
                </div>
              )}

              {/* LISTA DE PARTICIPANTES (Cards Responsivos) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
                {participants.map((p, idx) => {
                  const calcPart = calculationResult.participants.find((cp) => cp.id === p.id);
                  return (
                    <div
                      key={p.id}
                      style={{
                        padding: '0.9rem',
                        borderRadius: '0.6rem',
                        border: '1px solid var(--border)',
                        background: 'var(--card)',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>
                          #{idx + 1} PARTICIPANTE
                        </span>
                        {participants.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeParticipant(idx)}
                            aria-label={`Remover ${p.name}`}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#ef4444',
                              cursor: 'pointer',
                              padding: '0.2rem',
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <label style={{ fontSize: '0.78rem' }}>
                          Nome
                          <input
                            value={p.name}
                            onChange={(e) => updateParticipant(idx, { name: e.target.value })}
                            placeholder="Nome completo"
                            required
                            style={{ padding: '0.4rem', fontSize: '0.85rem' }}
                          />
                        </label>

                        <label style={{ fontSize: '0.78rem' }}>
                          Tipo de Beneficiário
                          <select
                            value={p.beneficiaryType}
                            onChange={(e) => updateParticipant(idx, { beneficiaryType: e.target.value as BeneficiaryType })}
                            style={{ padding: '0.4rem', fontSize: '0.85rem' }}
                          >
                            <option value="socio">Sócio (Contrato Social)</option>
                            <option value="outro">Outro Beneficiário (Equipe/Terceiro)</option>
                          </select>
                        </label>

                        <label style={{ fontSize: '0.78rem' }}>
                          Vínculo / Cargo
                          <input
                            value={p.companyRole}
                            onChange={(e) => updateParticipant(idx, { companyRole: e.target.value })}
                            placeholder="Ex.: Sócio Administrador"
                            style={{ padding: '0.4rem', fontSize: '0.85rem' }}
                          />
                        </label>

                        {/* Campo dinâmico conforme regra */}
                        {rule === 'percentage' && (
                          <label style={{ fontSize: '0.78rem' }}>
                            Percentual (%)
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={p.percentage || ''}
                              onChange={(e) => updateParticipant(idx, { percentage: Math.max(0, Number(e.target.value) || 0) })}
                              placeholder="50"
                              style={{ padding: '0.4rem', fontSize: '0.85rem', fontWeight: 700 }}
                            />
                          </label>
                        )}

                        {rule === 'shares' && (
                          <label style={{ fontSize: '0.78rem' }}>
                            Número de Cotas
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={p.shares || ''}
                              onChange={(e) => updateParticipant(idx, { shares: Math.max(1, Number(e.target.value) || 1) })}
                              placeholder="1"
                              style={{ padding: '0.4rem', fontSize: '0.85rem', fontWeight: 700 }}
                            />
                          </label>
                        )}

                        {rule === 'custom_values' && (
                          <label style={{ fontSize: '0.78rem' }}>
                            Valor Definido (R$)
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={p.customValue || ''}
                              onChange={(e) => updateParticipant(idx, { customValue: Math.max(0, Number(e.target.value) || 0) })}
                              placeholder="0,00"
                              style={{ padding: '0.4rem', fontSize: '0.85rem', fontWeight: 700 }}
                            />
                          </label>
                        )}
                      </div>

                      {/* Prévia Individual do Participante */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.4rem 0.6rem',
                          background: 'var(--accent)',
                          borderRadius: '0.4rem',
                          fontSize: '0.85rem',
                        }}
                      >
                        <span style={{ color: 'var(--muted-foreground)' }}>
                          Participação: <strong>{calcPart?.effectivePercentage?.toFixed(1) || '0.0'}%</strong>
                        </span>
                        <strong style={{ fontSize: '1.05rem', color: 'var(--foreground)' }}>
                          {money.format(calcPart?.calculatedAmount || 0)}
                        </strong>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* CARD DE PRÉVIA DE FECHAMENTO (PRECISÃO EM CENTAVOS) */}
              <div
                style={{
                  padding: '1rem',
                  borderRadius: '0.6rem',
                  border: '1px solid var(--border)',
                  background: 'var(--accent)',
                  marginBottom: '1.25rem',
                }}
              >
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem' }}>Prévia de Distribuição:</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: 'var(--muted-foreground)' }}>Total Distribuído:</span>
                    <p style={{ margin: '0.1rem 0 0 0', fontWeight: 700, fontSize: '1.1rem', color: 'var(--foreground)' }}>
                      {money.format(calculationResult.totalDistributed)}
                    </p>
                  </div>
                  <div>
                    <span style={{ color: 'var(--muted-foreground)' }}>Não Distribuído:</span>
                    <p style={{ margin: '0.1rem 0 0 0', fontWeight: 600, color: calculationResult.unallocatedAmount > 0 ? '#f59e0b' : 'var(--muted-foreground)' }}>
                      {money.format(calculationResult.unallocatedAmount)}
                    </p>
                  </div>
                  <div>
                    <span style={{ color: 'var(--muted-foreground)' }}>Saldo Final Previsto:</span>
                    <p
                      style={{
                        margin: '0.1rem 0 0 0',
                        fontWeight: 700,
                        color: financialSnapshot.projectedBalanceAfter >= 0 ? '#10b981' : '#ef4444',
                      }}
                    >
                      {money.format(financialSnapshot.projectedBalanceAfter)}
                    </p>
                  </div>
                </div>

                {calculationResult.pennyAdjustmentNote && (
                  <p style={{ margin: '0.6rem 0 0 0', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                    ℹ️ {calculationResult.pennyAdjustmentNote}
                  </p>
                )}
              </div>

              {/* BOTÕES DE AÇÃO */}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <Button
                  onClick={() => saveDivision('draft')}
                  variant="outline"
                  className="button-secondary"
                  style={{ flex: 1 }}
                >
                  <Save size={16} /> Salvar como Rascunho
                </Button>

                {user.role === 'admin' ? (
                  <Button
                    onClick={() => saveDivision('approved')}
                    disabled={!limitsValidation.allowed || !calculationResult.ok || targetAmount <= 0}
                    className="primary-action"
                    style={{ flex: 1 }}
                  >
                    <CheckCircle2 size={16} /> Aprovar Divisão
                  </Button>
                ) : (
                  <div style={{ flex: 1, fontSize: '0.8rem', color: 'var(--muted-foreground)', alignSelf: 'center', textAlign: 'center' }}>
                    🔒 Somente Administradores podem aprovar divisões.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= ABA 2: HISTÓRICO & PAGAMENTOS ================= */}
      {activeTab === 'history' && (
        <div className="history-tab-container">
          {/* Barra de Filtro do Histórico */}
          <div
            className="panel"
            style={{
              padding: '1.15rem',
              marginBottom: '1.25rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {[
                { key: 'all', label: 'Todas' },
                { key: 'draft', label: 'Rascunhos' },
                { key: 'approved', label: 'Aprovadas (Abertas)' },
                { key: 'paid_partial', label: 'Pagas Parcialmente' },
                { key: 'paid', label: 'Quitadas' },
                { key: 'cancelled', label: 'Canceladas' },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setHistoryStatusFilter(f.key)}
                  style={{
                    padding: '0.4rem 0.75rem',
                    borderRadius: '0.4rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: historyStatusFilter === f.key ? '2px solid var(--primary)' : '1px solid var(--border)',
                    background: historyStatusFilter === f.key ? 'var(--accent)' : 'var(--card)',
                    color: historyStatusFilter === f.key ? 'var(--primary)' : 'var(--foreground)',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="search"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Buscar divisão ou participante..."
                style={{
                  padding: '0.35rem 0.6rem',
                  fontSize: '0.8rem',
                  borderRadius: '0.4rem',
                  border: '1px solid var(--border)',
                  background: 'var(--card)',
                  minWidth: '200px',
                }}
              />
              <Button onClick={exportHistoryCsv} variant="outline" className="button-secondary">
                <Download size={15} /> Exportar (.csv)
              </Button>
              <Button onClick={() => window.print()} variant="outline" className="button-secondary">
                <Printer size={15} /> Imprimir / PDF
              </Button>
            </div>
          </div>

          {/* LISTAGEM DE DIVISÕES */}
          {existingDivisions.length === 0 ? (
            <div className="panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>
              <Building size={36} style={{ margin: '0 auto 0.75rem auto', opacity: 0.4 }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--foreground)' }}>
                Nenhuma divisão de resultados registrada ainda
              </h3>
              <p style={{ fontSize: '0.85rem', maxWidth: '400px', margin: '0.5rem auto 1.5rem auto' }}>
                Crie simulações na aba &ldquo;Simular &amp; Nova Divisão&rdquo; para planejar retiradas com segurança financeira.
              </p>
              <Button onClick={() => setActiveTab('simulate')} className="primary-action">
                <Sparkles size={16} /> Criar Primeira Simulação
              </Button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {existingDivisions
                .filter((d) => {
                  if (historyStatusFilter !== 'all' && d.payload.status !== historyStatusFilter) return false;
                  if (historySearch.trim()) {
                    const q = historySearch.toLowerCase();
                    const matchName = d.payload.name.toLowerCase().includes(q);
                    const matchParticipant = d.payload.participants.some(
                      (p) => p.name.toLowerCase().includes(q) || p.companyRole.toLowerCase().includes(q),
                    );
                    return matchName || matchParticipant;
                  }
                  return true;
                })
                .map((division) => {
                  const pStatusCounts = {
                    total: division.payload.participants.length,
                    pago: division.payload.participants.filter((p) => p.status === 'pago').length,
                    pendente: division.payload.participants.filter((p) => p.status === 'previsto' || p.status === 'aprovado').length,
                  };

                  const totalPaid = division.payload.participants
                    .filter((p) => p.status === 'pago')
                    .reduce((sum, p) => sum + p.calculatedAmount, 0);

                  const totalPending = division.payload.participants
                    .filter((p) => p.status === 'previsto' || p.status === 'aprovado')
                    .reduce((sum, p) => sum + p.calculatedAmount, 0);

                  return (
                    <div
                      key={division.id}
                      className="panel"
                      style={{
                        padding: '1.25rem',
                        borderLeft:
                          division.payload.status === 'paid'
                            ? '5px solid #10b981'
                            : division.payload.status === 'approved' || division.payload.status === 'paid_partial'
                              ? '5px solid #f59e0b'
                              : division.payload.status === 'cancelled'
                                ? '5px solid #ef4444'
                                : '5px solid #94a3b8',
                      }}
                    >
                      {/* Topo da Divisão */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          flexWrap: 'wrap',
                          gap: '0.75rem',
                          marginBottom: '1rem',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                            <strong style={{ fontSize: '1.15rem' }}>{division.payload.name}</strong>
                            <span
                              style={{
                                padding: '0.15rem 0.5rem',
                                borderRadius: '0.35rem',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                background:
                                  division.payload.status === 'paid'
                                    ? 'rgba(16, 185, 129, 0.15)'
                                    : division.payload.status === 'approved' || division.payload.status === 'paid_partial'
                                      ? 'rgba(245, 158, 11, 0.15)'
                                      : division.payload.status === 'cancelled'
                                        ? 'rgba(239, 68, 68, 0.15)'
                                        : 'rgba(148, 163, 184, 0.15)',
                                color:
                                  division.payload.status === 'paid'
                                    ? '#10b981'
                                    : division.payload.status === 'approved' || division.payload.status === 'paid_partial'
                                      ? '#f59e0b'
                                      : division.payload.status === 'cancelled'
                                        ? '#ef4444'
                                        : '#94a3b8',
                              }}
                            >
                              {division.payload.status === 'paid' && 'Quitada'}
                              {division.payload.status === 'paid_partial' && 'Paga Parcialmente'}
                              {division.payload.status === 'approved' && 'Aprovada'}
                              {division.payload.status === 'draft' && 'Rascunho'}
                              {division.payload.status === 'cancelled' && 'Cancelada'}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                            <span>Período: {division.payload.periodStart} a {division.payload.periodEnd}</span>
                            <span>Classificação: {CATEGORY_LABELS[division.payload.category]?.label || division.payload.category}</span>
                            <span>Regra: {RULE_LABELS[division.payload.rule]?.label || division.payload.rule}</span>
                          </div>
                        </div>

                        {/* Ações da Divisão */}
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          {division.payload.status === 'draft' && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => startEditingDivision(division)}>
                                Editar
                              </Button>
                              {user.role === 'admin' && (
                                <Button
                                  size="sm"
                                  className="primary-action"
                                  onClick={async () => {
                                    startEditingDivision(division);
                                    // Abrir na aba de simulação para aprovar
                                  }}
                                >
                                  Revisar & Aprovar
                                </Button>
                              )}
                            </>
                          )}

                          {(division.payload.status === 'approved' || division.payload.status === 'paid_partial') && user.role === 'admin' && (
                            <Button
                              size="sm"
                              variant="outline"
                              style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                              onClick={() => {
                                setCancellationModalDivision(division);
                                setCancelReason('');
                              }}
                            >
                              Cancelar Divisão
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Resumo Financeiro da Divisão */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                          gap: '0.75rem',
                          padding: '0.75rem',
                          background: 'var(--accent)',
                          borderRadius: '0.5rem',
                          marginBottom: '1rem',
                          fontSize: '0.85rem',
                        }}
                      >
                        <div>
                          <span style={{ color: 'var(--muted-foreground)', fontSize: '0.75rem' }}>VALOR TOTAL:</span>
                          <strong style={{ display: 'block', fontSize: '1.05rem' }}>
                            {money.format(division.payload.totalDistributed)}
                          </strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--muted-foreground)', fontSize: '0.75rem' }}>VALOR PAGO:</span>
                          <strong style={{ display: 'block', fontSize: '1.05rem', color: '#10b981' }}>
                            {money.format(totalPaid)}
                          </strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--muted-foreground)', fontSize: '0.75rem' }}>PENDENTE (COMPROMETIDO):</span>
                          <strong style={{ display: 'block', fontSize: '1.05rem', color: totalPending > 0 ? '#f59e0b' : 'var(--muted-foreground)' }}>
                            {money.format(totalPending)}
                          </strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--muted-foreground)', fontSize: '0.75rem' }}>PARTICIPANTES:</span>
                          <strong style={{ display: 'block', fontSize: '1.05rem' }}>
                            {pStatusCounts.pago}/{pStatusCounts.total} pagos
                          </strong>
                        </div>
                      </div>

                      {/* Tabela de Participantes e Baixa de Pagamento */}
                      <div className="product-table-wrap" style={{ marginBottom: '1rem' }}>
                        <table>
                          <thead>
                            <tr>
                              <th>Participante</th>
                              <th>Vínculo / Tipo</th>
                              <th style={{ textAlign: 'right' }}>Parcela (R$)</th>
                              <th style={{ textAlign: 'center' }}>Status</th>
                              <th>Pagamento Realizado</th>
                              <th style={{ textAlign: 'right' }}>Ação</th>
                            </tr>
                          </thead>
                          <tbody>
                            {division.payload.participants.map((p) => {
                              const isPaid = p.status === 'pago';
                              return (
                                <tr key={p.id}>
                                  <td>
                                    <strong>{p.name}</strong>
                                    <small className="table-subtitle">
                                      {p.effectivePercentage.toFixed(1)}% da divisão
                                    </small>
                                  </td>
                                  <td>
                                    <span>{p.companyRole}</span>
                                    <small className="table-subtitle">
                                      {p.beneficiaryType === 'socio' ? 'Sócio' : 'Outro Beneficiário'}
                                    </small>
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                    {money.format(p.calculatedAmount)}
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    <span
                                      style={{
                                        padding: '0.15rem 0.5rem',
                                        borderRadius: '0.35rem',
                                        fontSize: '0.72rem',
                                        fontWeight: 700,
                                        background: isPaid ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                        color: isPaid ? '#10b981' : '#f59e0b',
                                      }}
                                    >
                                      {isPaid ? 'Pago' : p.status === 'aprovado' ? 'Aprovado' : p.status}
                                    </span>
                                  </td>
                                  <td>
                                    {isPaid ? (
                                      <div style={{ fontSize: '0.8rem' }}>
                                        <span>{p.paidAt ? new Date(`${p.paidAt}T12:00:00`).toLocaleDateString('pt-BR') : '—'}</span>
                                        <small className="table-subtitle">{p.paymentMethod || 'PIX'}</small>
                                      </div>
                                    ) : (
                                      <span style={{ color: 'var(--muted-foreground)', fontSize: '0.8rem' }}>Pendente</span>
                                    )}
                                  </td>
                                  <td style={{ textAlign: 'right' }}>
                                    {isPaid ? (
                                      <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>
                                        ✓ Quitado
                                      </span>
                                    ) : division.payload.status === 'approved' || division.payload.status === 'paid_partial' ? (
                                      user.role === 'admin' ? (
                                        <Button
                                          size="sm"
                                          className="primary-action"
                                          onClick={() => {
                                            setPaymentModalData({ division, participant: p });
                                            setPaymentMethod('PIX');
                                            setPaymentDate(new Date().toLocaleDateString('en-CA'));
                                            setPaymentNotes('');
                                          }}
                                          style={{ fontSize: '0.78rem', height: '28px', padding: '0 0.6rem' }}
                                        >
                                          <DollarSign size={13} /> Pagar
                                        </Button>
                                      ) : (
                                        <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                                          Aguardando Admin
                                        </span>
                                      )
                                    ) : (
                                      <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                                        {division.payload.status === 'draft' ? 'Rascunho' : 'Cancelado'}
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Trilha de Auditoria (Audit Trail) */}
                      {division.payload.auditTrail && division.payload.auditTrail.length > 0 && (
                        <details style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>
                          <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--primary)' }}>
                            Trilha de Auditoria e Histórico ({division.payload.auditTrail.length} eventos)
                          </summary>
                          <div style={{ marginTop: '0.5rem', paddingLeft: '0.75rem', borderLeft: '2px solid var(--border)' }}>
                            {division.payload.auditTrail.map((ev, i) => (
                              <div key={i} style={{ marginBottom: '0.35rem' }}>
                                <strong>{new Date(ev.timestamp).toLocaleString('pt-BR')}</strong> · {ev.actorName} ({ev.action}): {ev.details}
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* ================= ABA 3: MODELOS SALVOS (TEMPLATES) ================= */}
      {activeTab === 'templates' && (
        <div className="templates-tab-container">
          <div className="panel" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.25rem' }}>
              Modelos de Regras e Participantes
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)', marginBottom: '1rem' }}>
              Salve regras habituais (ex: Divisão Societária 70/30, Divisão Igualitária de 3 Sócios) para agilizar as simulações mensais sem precisar redigitar.
            </p>

            {templates.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>
                <p>Nenhum modelo salvo ainda.</p>
                <small>
                  Você pode configurar participantes na aba &ldquo;Simular &amp; Nova Divisão&rdquo; e clicar em &ldquo;Salvar Modelo&rdquo;.
                </small>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                {templates.map((tpl) => (
                  <div
                    key={tpl.id}
                    style={{
                      padding: '1rem',
                      borderRadius: '0.6rem',
                      border: '1px solid var(--border)',
                      background: 'var(--card)',
                    }}
                  >
                    <strong style={{ fontSize: '1rem', display: 'block', marginBottom: '0.25rem' }}>
                      {tpl.payload.name}
                    </strong>
                    <p style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', margin: '0 0 0.75rem 0' }}>
                      {RULE_LABELS[tpl.payload.rule]?.label || tpl.payload.rule} · {tpl.payload.participants.length} participantes
                    </p>

                    <div style={{ fontSize: '0.82rem', marginBottom: '1rem' }}>
                      {tpl.payload.participants.map((p, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                          <span>{p.name} ({p.companyRole})</span>
                          <span style={{ fontWeight: 600 }}>
                            {tpl.payload.rule === 'percentage' && `${p.percentage}%`}
                            {tpl.payload.rule === 'shares' && `${p.shares} cotas`}
                            {tpl.payload.rule === 'custom_values' && money.format(p.customValue || 0)}
                            {tpl.payload.rule === 'equal' && 'Igual'}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <Button
                        size="sm"
                        className="primary-action"
                        style={{ flex: 1 }}
                        onClick={() => {
                          applyTemplate(tpl.payload);
                          setActiveTab('simulate');
                        }}
                      >
                        Usar este Modelo
                      </Button>
                      {user.role === 'admin' && (
                        <Button
                          size="sm"
                          variant="outline"
                          style={{ color: '#ef4444' }}
                          onClick={async () => {
                            if (window.confirm(`Excluir modelo "${tpl.payload.name}"?`)) {
                              await authenticatedFetch('/api/records', {
                                method: 'DELETE',
                                headers: { 'content-type': 'application/json' },
                                body: JSON.stringify({ id: tpl.id }),
                              });
                              await onReload();
                              onReportOperation('Modelo excluído.');
                            }
                          }}
                        >
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= MODAL: REGISTRAR PAGAMENTO ================= */}
      {paymentModalData && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            zIndex: 1000,
          }}
        >
          <div
            className="panel"
            style={{
              width: '100%',
              maxWidth: '460px',
              padding: '1.5rem',
              borderRadius: '0.75rem',
              background: 'var(--card)',
            }}
          >
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.25rem' }}>
              Registrar Pagamento de Parcela
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)', marginBottom: '1.25rem' }}>
              Ao confirmar, o valor de <strong>{money.format(paymentModalData.participant.calculatedAmount)}</strong> será efetivamente deduzido do caixa da loja.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleConfirmPayment();
              }}
              className="data-form"
            >
              <div
                style={{
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  background: 'var(--accent)',
                  marginBottom: '1rem',
                  fontSize: '0.85rem',
                }}
              >
                <div>Beneficiário: <strong>{paymentModalData.participant.name}</strong></div>
                <div>Vínculo: <strong>{paymentModalData.participant.companyRole}</strong></div>
                <div style={{ marginTop: '0.25rem' }}>
                  Valor a pagar: <strong style={{ fontSize: '1.1rem', color: '#10b981' }}>{money.format(paymentModalData.participant.calculatedAmount)}</strong>
                </div>
              </div>

              <label>
                <span>Data do Pagamento</span>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              </label>

              <label>
                <span>Forma de Pagamento</span>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                  <option value="PIX">PIX</option>
                  <option value="Transferência / TED">Transferência / TED</option>
                  <option value="Dinheiro">Dinheiro (Caixa Físico)</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Outro">Outro</option>
                </select>
              </label>

              <label>
                <span>Comprovante / Código de Transação / Observações</span>
                <input
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Ex.: ID transação PIX E202609... ou recibo assinado"
                />
              </label>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
                <Button
                  type="button"
                  variant="outline"
                  className="button-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setPaymentModalData(null)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="primary-action"
                  style={{ flex: 1 }}
                  disabled={isProcessingPayment}
                >
                  {isProcessingPayment ? 'Processando...' : 'Confirmar & Baixar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: CANCELAMENTO COM JUSTIFICATIVA ================= */}
      {cancellationModalDivision && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            zIndex: 1000,
          }}
        >
          <div
            className="panel"
            style={{
              width: '100%',
              maxWidth: '460px',
              padding: '1.5rem',
              borderRadius: '0.75rem',
              background: 'var(--card)',
            }}
          >
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ef4444', marginBottom: '0.25rem' }}>
              Cancelar Divisão Aprovada
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)', marginBottom: '1.25rem' }}>
              O cancelamento irá liberar os valores comprometidos no caixa. O histórico permanecerá registrado na trilha de auditoria.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleConfirmCancel();
              }}
              className="data-form"
            >
              <label>
                <span>Motivo do Cancelamento (obrigatório para auditoria)</span>
                <textarea
                  required
                  maxLength={500}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Ex.: Mudança na prioridade de compras da empresa ou erro na proporção acordada..."
                  style={{ minHeight: '80px', padding: '0.5rem' }}
                />
              </label>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
                <Button
                  type="button"
                  variant="outline"
                  className="button-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setCancellationModalDivision(null)}
                >
                  Voltar
                </Button>
                <Button
                  type="submit"
                  style={{ flex: 1, background: '#ef4444', color: '#fff' }}
                  disabled={isCancelling}
                >
                  {isCancelling ? 'Cancelando...' : 'Confirmar Cancelamento'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
