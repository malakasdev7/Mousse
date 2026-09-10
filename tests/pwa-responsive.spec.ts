import { expect, test } from '@playwright/test';

test('manifesto e cache não incluem APIs ou dados protegidos', async ({ request }) => {
  const manifest = await request.get('http://localhost:3000/manifest.webmanifest');
  expect(manifest.ok()).toBeTruthy();
  expect((await manifest.json()).display).toBe('standalone');
  const worker = await (await request.get('http://localhost:3000/sw.js')).text();
  expect(worker).toContain("request.url.includes('/api/')");
  expect(worker).toContain('/offline.html');
});

for (const viewport of [{ width: 375, height: 812 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 844, height: 390 }]) {
  test(`layout sem corte em ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('http://localhost:3000/signin-with-chatgpt?return_to=/');
    await expect(page.getByRole('heading', { name: 'Sua operação em números.' })).toBeVisible();
    const metrics = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth + 1);
  });
}

test('página offline orienta sem revelar dados', async ({ page, context }) => {
  await page.goto('http://localhost:3000/signin-with-chatgpt?return_to=/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  await page.goto('http://localhost:3000/offline.html');
  await expect(page.getByRole('heading', { name: 'Você está sem conexão.' })).toBeVisible();
  await expect(page.getByText('Seus dados protegidos não são guardados no cache.')).toBeVisible();
  await context.setOffline(false);
});
