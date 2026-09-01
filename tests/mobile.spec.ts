import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('fluxo principal funciona no celular', async ({ page }) => {
  await page.goto('http://localhost:3000/signin-with-chatgpt?return_to=/');
  await page.waitForLoadState('networkidle');
  const dock = page.getByRole('navigation', { name: 'Navegação rápida' });
  await expect(dock).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sua operação começa aqui.' })).toBeVisible();

  await dock.getByRole('button', { name: 'Insumos', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ingredientes e compras' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Salvar registro' })).toBeVisible();

  const testName = `Ingrediente teste ${Date.now()}`;
  await page.getByLabel('Nome').fill(testName);
  await page.getByLabel('Categoria').selectOption('Chocolates e cacau');
  await page.getByLabel('Embalagem de compra').fill('pacote 100 g');
  await page.getByLabel('Quantidade na embalagem').fill('100');
  await page.getByLabel('Unidade usada na receita').selectOption('g');
  await page.getByLabel('Preço pago').fill('20');
  await page.getByLabel('Estoque atual').fill('100');
  await page.getByLabel('Alerta de estoque mínimo').fill('20');
  await page.getByLabel('Fornecedor').fill('Fornecedor teste');
  await page.getByRole('button', { name: 'Salvar registro' }).click();
  await expect(page.getByText(testName, { exact: true })).toBeVisible();

  const row = page.getByRole('row').filter({ hasText: testName });
  await row.getByRole('button', { name: 'Editar' }).click();
  const editedName = `${testName} editado`;
  await page.getByLabel('Nome').fill(editedName);
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByText(editedName, { exact: true })).toBeVisible();

  await dock.getByRole('button', { name: 'Mais', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible();
  await page.getByRole('button', { name: 'Receitas' }).click();
  await expect(page.getByRole('heading', { name: 'Receitas', exact: true })).toBeVisible();
  const recipeName = `Receita teste ${Date.now()}`;
  await page.getByLabel('Nome da receita').fill(recipeName);
  await page.getByRole('button', { name: 'Adicionar' }).click();
  await expect(page.getByLabel('Ingrediente 1', { exact: true })).toContainText(editedName);
  await page.getByLabel('Quantidade do ingrediente 1').fill('50');
  await page.getByLabel('Rendimento', { exact: true }).fill('5');
  await page.getByLabel('Perda estimada (%)').fill('10');
  await expect(page.getByText('R$ 2,20', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Salvar registro' }).click();
  await expect(page.getByText(recipeName, { exact: true })).toBeVisible();

  page.once('dialog', dialog => dialog.accept());
  await page.getByText(recipeName, { exact: true }).locator('xpath=ancestor::article').getByRole('button', { name: 'Excluir' }).click();
  await expect(page.getByText(recipeName, { exact: true })).toHaveCount(0);

  await dock.getByRole('button', { name: 'Insumos', exact: true }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('row').filter({ hasText: editedName }).getByRole('button', { name: 'Excluir' }).click();
  await expect(page.getByText(editedName, { exact: true })).toHaveCount(0);

  await dock.getByRole('button', { name: 'Simular', exact: true }).click();
  await expect(page.getByText('PREÇO SUGERIDO')).toBeVisible();
  await expect(page.getByText('Informe os custos')).toBeVisible();

  const hasHorizontalPageOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasHorizontalPageOverflow).toBe(false);
});
