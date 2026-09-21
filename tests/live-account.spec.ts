import { expect, test, type Page } from '@playwright/test';

test('cadastro aparece em outra sessão da mesma empresa', async ({ browser }) => {
  test.skip(!process.env.LIVE_USERNAME || !process.env.LIVE_PASSWORD, 'Defina credenciais reais somente no ambiente de teste.');
  const name = `Teste entre dispositivos ${Date.now()}`;
  const login = async (page: Page) => {
    await page.goto('http://localhost:3000');
    await page.getByLabel(/Usuário/).fill(process.env.LIVE_USERNAME!);
    await page.getByLabel('Senha').fill(process.env.LIVE_PASSWORD!);
    await page.getByRole('button', { name: 'Entrar no Sistema' }).click();
    await expect(page.getByText(/operação em números/i).first()).toBeVisible({ timeout: 20_000 });
  };
  const first = await browser.newContext();
  const page = await first.newPage();
  await login(page);
  await page.getByRole('button', { name: /Ingredientes/ }).first().click();
  await page.getByLabel('Nome').fill(name);
  await page.getByLabel('Embalagem de compra').fill('pacote 100 g');
  await page.getByLabel('Quantidade útil na embalagem').fill('100');
  await page.getByLabel('Unidade usada na receita').selectOption('g');
  await page.getByLabel('Preço pago').fill('10');
  await page.getByRole('button', { name: /Salvar/ }).click();
  await expect(page.getByText('Salvo na conta')).toBeVisible();
  await first.close();
  const second = await browser.newContext();
  const otherPage = await second.newPage();
  await login(otherPage);
  await otherPage.getByRole('button', { name: /Ingredientes/ }).first().click();
  await expect(otherPage.getByText(name, { exact: true })).toBeVisible();
  otherPage.once('dialog', dialog => dialog.accept());
  await otherPage.getByRole('row').filter({ hasText: name }).getByRole('button', { name: 'Excluir' }).click();
  await expect(otherPage.getByText(name, { exact: true })).toHaveCount(0);
  await second.close();
});
