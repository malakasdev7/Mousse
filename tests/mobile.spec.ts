import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('fluxo principal funciona no celular', async ({ page }) => {
  await page.goto('http://localhost:3000/signin-with-chatgpt?return_to=/');
  await page.waitForLoadState('networkidle');
  const dock = page.getByRole('navigation', { name: 'Navegação rápida' });
  await expect(dock).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sua operação em números.' })).toBeVisible();

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

  await dock.getByRole('button', { name: 'Produtos', exact: true }).click();
  const productName = `Produto teste ${Date.now()}`;
  await page.getByLabel('Nome').fill(productName);
  await page.getByLabel('Tamanho ou apresentação').fill('Pote 120 ml');
  await page.getByLabel('Receita base').selectOption({ label: `${recipeName} · R$ 2,20 por porção` });
  await expect(page.getByLabel('Custo da receita')).toHaveValue('2.2');
  await page.getByRole('button', { name: 'Salvar registro' }).click();
  await expect(page.getByText(productName, { exact: true })).toBeVisible();

  await dock.getByRole('button', { name: 'Vendas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Lançar vendas' })).toBeVisible();
  await page.getByLabel('Produto').selectOption({ label: `${productName} · R$ 4,40` });
  await page.getByLabel('Quantidade').fill('2');
  await page.getByLabel('Desconto total').fill('0.8');
  await page.getByLabel('Taxas da venda').fill('0.5');
  await page.getByLabel('Custo de entrega').fill('0.7');
  await expect(page.getByText('R$ 2,40', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Salvar registro' }).click();
  await expect(page.getByRole('row').filter({ hasText: productName })).toBeVisible();

  const saleRow = page.getByRole('row').filter({ hasText: productName });
  await saleRow.getByRole('button', { name: 'Editar' }).click();
  await page.getByLabel('Quantidade').fill('3');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByRole('row').filter({ hasText: productName })).toContainText('3');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('row').filter({ hasText: productName }).getByRole('button', { name: 'Excluir' }).click();

  await dock.getByRole('button', { name: 'Produtos', exact: true }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('row').filter({ hasText: productName }).getByRole('button', { name: 'Excluir' }).click();

  await dock.getByRole('button', { name: 'Mais', exact: true }).click();
  await page.getByRole('button', { name: 'Receitas' }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByText(recipeName, { exact: true }).locator('xpath=ancestor::article').getByRole('button', { name: 'Excluir' }).click();
  await expect(page.getByText(recipeName, { exact: true })).toHaveCount(0);

  await dock.getByRole('button', { name: 'Insumos', exact: true }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('row').filter({ hasText: editedName }).getByRole('button', { name: 'Excluir' }).click();
  await expect(page.getByText(editedName, { exact: true })).toHaveCount(0);

  const hasHorizontalPageOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasHorizontalPageOverflow).toBe(false);
});
