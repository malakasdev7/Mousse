import { expect, test } from '@playwright/test';
import { validatePayload, isRecordKind } from '../lib/records';

test.describe('API de Records - Divisão de Resultados & Segurança Multi-Tenant', () => {
  test('Reconhece profit_sharing e sharing_template como tipos válidos de registro', () => {
    expect(isRecordKind('profit_sharing')).toBe(true);
    expect(isRecordKind('sharing_template')).toBe(true);
    expect(isRecordKind('invalid_kind')).toBe(false);
  });

  test('Valida campos obrigatórios da divisão de resultados', () => {
    const invalidNoParticipants = validatePayload('profit_sharing', {
      name: 'Divisão Inválida',
      targetAmount: 1000,
      participants: [],
    });
    expect(invalidNoParticipants.ok).toBe(false);
    if (!invalidNoParticipants.ok) {
      expect(invalidNoParticipants.error).toContain('ao menos um participante');
    }

    const validDivision = validatePayload('profit_sharing', {
      name: 'Divisão Válida',
      category: 'distribuicao_lucros',
      rule: 'equal',
      targetAmount: 5000,
      totalDistributed: 5000,
      unallocatedAmount: 0,
      participants: [
        {
          id: 'p1',
          name: 'Sócio 1',
          beneficiaryType: 'socio',
          companyRole: 'Sócio Administrador',
          calculatedAmount: 2500,
          effectivePercentage: 50,
          status: 'previsto',
        },
        {
          id: 'p2',
          name: 'Sócio 2',
          beneficiaryType: 'socio',
          companyRole: 'Sócio Fundador',
          calculatedAmount: 2500,
          effectivePercentage: 50,
          status: 'previsto',
        },
      ],
      status: 'draft',
    });
    expect(validDivision.ok).toBe(true);
  });

  test('Valida modelo de partilha (sharing_template)', () => {
    const invalidTemplate = validatePayload('sharing_template', {
      name: 'Modelo Vazio',
      participants: [],
    });
    expect(invalidTemplate.ok).toBe(false);

    const validTemplate = validatePayload('sharing_template', {
      name: 'Modelo Sócios 60/40',
      rule: 'percentage',
      participants: [
        { name: 'Sócio A', beneficiaryType: 'socio', companyRole: 'Sócio', percentage: 60 },
        { name: 'Sócio B', beneficiaryType: 'socio', companyRole: 'Sócio', percentage: 40 },
      ],
    });
    expect(validTemplate.ok).toBe(true);
  });

  test('Rejeita requisições não autenticadas ou com token inválido com 401', async ({ request }) => {
    const res = await request.post('http://localhost:3000/api/records', {
      headers: {
        'idempotency-key': '12345678-1234-1234-1234-1234567890ab',
      },
      data: {
        kind: 'profit_sharing',
        payload: {
          name: 'Divisão Não Autorizada',
          participants: [{ name: 'Intruso', beneficiaryType: 'socio', companyRole: 'Sócio', calculatedAmount: 100 }],
        },
      },
    });

    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Sessão expirada');
  });

  test('Bloqueia origens externas inválidas com 403 (proteção CSRF)', async ({ request }) => {
    const res = await request.post('http://localhost:3000/api/records', {
      headers: {
        origin: 'http://malicious-site.com',
        authorization: 'Bearer valid-test-token',
        'idempotency-key': '12345678-1234-1234-1234-1234567890ab',
      },
      data: { kind: 'profit_sharing' },
    });

    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('Origem inválida');
  });
});

