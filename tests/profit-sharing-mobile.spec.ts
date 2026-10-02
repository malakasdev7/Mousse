import { expect, test } from '@playwright/test';

const mobileWidths = [320, 375, 390];

for (const width of mobileWidths) {
  test(`Módulo Divisão de Resultados é totalmente funcional e responsivo em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });

    // Mock do usuário admin
    await page.route('**/api/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'admin-1',
          username: 'admin.mousse',
          name: 'Gustavo Admin',
          role: 'admin',
          storeId: 'store-1',
          companyName: 'Mousse Mania Delícias',
        }),
      }),
    );

    // Mock dos registros: caixa, vendas e despesas
    let mockRecords: Array<{ id: number; kind: string; payload: Record<string, unknown> }> = [
      {
        id: 1,
        kind: 'settings',
        payload: {
          name: 'Caixa',
          balance: 10000,
          checkedAt: new Date().toLocaleDateString('en-CA'),
          notes: 'Conferido com saldos bancários',
        },
      },
      {
        id: 2,
        kind: 'sale',
        payload: {
          productId: 1,
          productName: 'Mousse Tradicional',
          quantity: 200,
          unitPrice: 15,
          gross: 3000,
          netRevenue: 2800,
          cost: 1000,
          profit: 1800,
          date: new Date().toLocaleDateString('en-CA'),
          status: 'Entregue',
        },
      },
      {
        id: 3,
        kind: 'expense',
        payload: {
          name: 'Energia Elétrica',
          category: 'Energia, Água e Gás',
          value: 400,
          type: 'monthly',
        },
      },
    ];

    await page.route('**/api/records', async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockRecords) });
      }
      if (method === 'POST') {
        const body = route.request().postDataJSON();
        const newRecord = { id: Date.now(), kind: body.kind, payload: body.payload };
        mockRecords.push(newRecord);
        return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(newRecord) });
      }
      if (method === 'PUT') {
        const body = route.request().postDataJSON();
        mockRecords = mockRecords.map((r) => (r.id === body.id ? { ...r, payload: body.payload } : r));
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    await page.goto('http://localhost:3000');
    await expect(page.locator('main')).toBeVisible();

    // 1. Acessar menu "Mais" no celular e navegar até "Divisão de resultados"
    const dock = page.getByRole('navigation', { name: 'Navegação rápida' });
    await expect(dock).toBeVisible();
    await dock.getByRole('button', { name: 'Mais', exact: true }).click();
    const navBtn = page.getByRole('button', { name: 'Divisão de resultados' });
    await expect(navBtn).toBeInViewport();
    await navBtn.click();

    // 2. Verificar título do módulo e cabeçalho
    await expect(page.getByRole('heading', { name: 'Divisão de Resultados' })).toBeVisible();

    // 3. Verificar ausência de overflow horizontal na viewport do celular
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(hasOverflow).toBe(false);

    // 4. Verificar dados de diagnóstico financeiro
    await expect(page.getByText('1. SALDO EM CAIXA & BANCOS')).toBeVisible();
    await expect(page.getByText('R$ 10.000,00').first()).toBeVisible();
    await expect(page.getByText('2. LUCRO APURADO NO PERÍODO')).toBeVisible();

    // 5. Preencher valor da simulação
    const targetInput = page.getByLabel('Valor Escolhido para Divisão (R$)');
    await targetInput.fill('1000');

    // 6. Testar adição de participante
    await page.getByRole('button', { name: 'Participante' }).click();
    await expect(page.getByText('#3 PARTICIPANTE')).toBeVisible();

    // 7. Salvar como Rascunho
    await page.getByRole('button', { name: 'Salvar como Rascunho' }).click();

    // 8. O sistema deve navegar para a aba de Histórico
    await expect(page.getByText('Rascunho').first()).toBeVisible();
  });
}

test('Fluxo completo: Simular, Aprovar, Pagar Parcela e Deduzir Caixa no Celular (375px)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 844 });

  let currentCash = 10000;
  let divisions: Array<{ id: number; kind: string; payload: Record<string, unknown> }> = [];

  await page.route(/\/api\/me/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'admin-1',
        username: 'admin.mousse',
        name: 'Gustavo Admin',
        role: 'admin',
        storeId: 'store-1',
        companyName: 'Mousse Mania Delícias',
      }),
    }),
  );

  await page.route(/\/api\/records/, async (route) => {
    const method = route.request().method();
    console.log('ROUTE /api/records CALLED:', method, route.request().url());
    if (method === 'GET') {
      const records = [
        {
          id: 1,
          kind: 'settings',
          payload: { name: 'Caixa', balance: currentCash, checkedAt: new Date().toLocaleDateString('en-CA') },
        },
        {
          id: 2,
          kind: 'sale',
          payload: {
            quantity: 50,
            unitPrice: 20,
            gross: 10000,
            netRevenue: 9500,
            cost: 3000,
            profit: 6500,
            date: new Date().toLocaleDateString('en-CA'),
            status: 'Entregue',
          },
        },
        {
          id: 3,
          kind: 'expense',
          payload: { name: 'Aluguel', value: 1200, type: 'monthly' },
        },
        ...divisions,
      ];
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(records) });
    }

    try {
      if (method === 'POST') {
        const raw = route.request().postData();
        const body = raw ? JSON.parse(raw) : {};
        const newRec = { id: 100 + divisions.length, kind: body.kind, payload: body.payload };
        divisions.push(newRec);
        return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(newRec) });
      }

      if (method === 'PUT') {
        const raw = route.request().postData();
        const body = raw ? JSON.parse(raw) : {};
        if (body.payload?.name === 'Caixa') {
          currentCash = body.payload.balance;
        } else {
          divisions = divisions.map((d) => (d.id === body.id ? { ...d, payload: body.payload } : d));
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      }
    } catch (err) {
      console.error('Error handling route in test:', err);
    }

    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', (err) => console.log('PAGE ERR:', err));
  page.on('response', (res) => {
    if (res.status() === 401) console.log('401 URL:', res.url());
  });

  await page.goto('http://localhost:3000');
  await expect(page.getByText('Mousse Mania Delícias').first()).toBeVisible();

  // Navegar via menu mobile
  const dock = page.getByRole('navigation', { name: 'Navegação rápida' });
  await expect(dock).toBeVisible();
  await dock.getByRole('button', { name: 'Mais', exact: true }).click();
  const navBtn = page.getByRole('button', { name: 'Divisão de resultados' });
  await expect(navBtn).toBeInViewport();
  await navBtn.click();

  // Simular 2000 reais
  await page.getByLabel('Valor Escolhido para Divisão (R$)').fill('2000');

  // Aprovar Divisão
  await page.getByRole('button', { name: 'Aprovar Divisão' }).click({ force: true });

  // Deve estar na lista de Histórico como Aprovada
  await expect(page.getByText('Aprovada').first()).toBeVisible();
  await expect(page.getByText('R$ 2.000,00').first()).toBeVisible();

  // Clicar em "Pagar" no primeiro participante
  const payBtn = page.getByRole('button', { name: 'Pagar' }).first();
  await payBtn.click({ force: true });

  // Modal de pagamento deve abrir
  await expect(page.getByRole('heading', { name: 'Registrar Pagamento de Parcela' })).toBeVisible();

  // Confirmar pagamento
  await page.getByRole('button', { name: 'Confirmar & Baixar' }).click();

  // Parcela deve estar quitada
  await expect(page.getByText('✓ Quitado').first()).toBeVisible();

  // Saldo do caixa foi reduzido em 1.000 (de 10.000 para 9.000)
  expect(currentCash).toBe(9000);
});
