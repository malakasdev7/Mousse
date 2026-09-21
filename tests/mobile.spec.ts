import { expect, test } from '@playwright/test';

const widths = [320, 375, 390, 414, 768, 1280];

for (const width of widths) {
  test(`interface utilizável em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 800 ? 844 : 900 });
    await page.route('**/api/me', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'test', username: 'teste', name: 'Teste', role: 'admin', storeId: 'store', companyName: 'Doce Margem' }),
    }));
    await page.route('**/api/records', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('http://localhost:3000');
    await expect(page.getByText('Doce Margem', { exact: true }).first()).toBeVisible();
    await expect(page.locator('main')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow).toBe(false);
    if (width <= 768) {
      const dock = page.getByRole('navigation', { name: 'Navegação rápida' });
      await expect(dock).toBeVisible();
      const sizes = await dock.locator('button').evaluateAll(buttons => buttons.map(button => button.getBoundingClientRect().height));
      expect(sizes.every(size => size >= 44)).toBe(true);
      await dock.getByRole('button', { name: 'Preços', exact: true }).click();
      await expect(page.getByRole('heading', { name: /Simulador/ })).toBeVisible();
    }
  });
}

test('falha lenta mantém o formulário e oferece nova tentativa', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/me', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'test', username: 'teste', name: 'Teste', role: 'admin', storeId: 'store', companyName: 'Doce Margem' }) }));
  await page.route('**/api/records', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    await new Promise(resolve => setTimeout(resolve, 500));
    return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Falha simulada de conexão.' }) });
  });
  await page.goto('http://localhost:3000');
  await page.getByRole('button', { name: 'Mais', exact: true }).click();
  await page.getByRole('button', { name: /Ingredientes/ }).first().click();
  await page.getByLabel('Nome').fill('Ingrediente mantido');
  await page.getByLabel('Embalagem de compra').fill('Pacote');
  await page.getByLabel('Quantidade útil na embalagem').fill('100');
  await page.getByLabel('Preço pago').fill('10');
  await page.getByRole('button', { name: 'Salvar registro' }).click();
  await expect(page.getByRole('button', { name: 'Salvando...' })).toBeVisible();
  await expect(page.locator('.operation-status[role="alert"]')).toContainText('Falha simulada de conexão.');
  await expect(page.getByLabel('Nome')).toHaveValue('Ingrediente mantido');
});

test('acesso sem sessão permanece no login', async ({ page }) => {
  await page.route('**/api/me', route => route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"Não autenticado."}' }));
  await page.route('**/api/auth/refresh', route => route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }));
  await page.goto('http://localhost:3000');
  await expect(page.getByRole('heading', { name: 'Entre na sua conta.' })).toBeVisible();
});
