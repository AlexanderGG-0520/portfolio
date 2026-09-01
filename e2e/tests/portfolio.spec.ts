import { expect, test, type Page } from '@playwright/test';

async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

async function expectHeroGeometry(page: Page) {
  const hero = page.locator('#hero-title');
  await expect(hero).toBeVisible();

  const box = await hero.boundingBox();
  const viewport = page.viewportSize();
  if (!box || !viewport) throw new Error('hero or viewport geometry unavailable');

  expect(box.width).toBeGreaterThan(200);
  expect(box.width).toBeLessThanOrEqual(viewport.width);
  expect(box.height).toBeGreaterThan(50);
  expect(box.height).toBeLessThan(viewport.height);
}

test.describe('portfolio browser smoke', () => {
  for (const locale of ['en', 'ja'] as const) {
    test(`${locale}: desktop layout and runtime stay healthy`, async ({ page }) => {
      await page.goto(`/${locale}/`);

      await expectHeroGeometry(page);
      await expectNoHorizontalOverflow(page);

      const runtime = page.locator('[data-live-runtime]');
      await expect(runtime).toHaveAttribute('data-runtime-state', 'healthy');
      await expect(page.locator('[data-runtime-http]')).toHaveText('200 / healthy');
      await expect(page.locator('[data-runtime-environment]')).toHaveText('ci');
    });
  }

  test('desktop controls preserve view mode and terminal focus contracts', async ({ page }) => {
    await page.goto('/en/');

    const root = page.locator('html');
    const viewToggle = page.locator('.home-nav [data-view-mode-toggle]');

    await expect(root).toHaveAttribute('data-view-mode', 'skim');
    await expect(viewToggle).toHaveAttribute('aria-pressed', 'false');
    await viewToggle.click();
    await expect(root).toHaveAttribute('data-view-mode', 'inspect');
    await expect(viewToggle).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-inspect-detail]').first()).toBeVisible();

    await viewToggle.click();
    await expect(root).toHaveAttribute('data-view-mode', 'skim');
    await expect(viewToggle).toHaveAttribute('aria-pressed', 'false');

    const terminalOpener = page.locator('.home-nav [data-terminal-open]');
    const terminal = page.locator('[data-terminal]');
    const terminalInput = page.locator('[data-terminal-input]');

    await terminalOpener.click();
    await expect(terminal).toHaveAttribute('data-open', 'true');
    await expect(terminal).toHaveAttribute('aria-hidden', 'false');
    await expect(terminalInput).toBeFocused();

    await terminalInput.fill('runtime');
    await terminalInput.press('Enter');
    await expect(page.locator('[data-terminal-output]')).toContainText('GET /api/runtime');

    await page.keyboard.press('Escape');
    await expect(terminal).toHaveAttribute('data-open', 'false');
    await expect(terminal).toHaveAttribute('aria-hidden', 'true');
    await expect(terminalOpener).toBeFocused();
  });

  test('compact layout owns horizontal overflow and mobile navigation focus', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/en/');

    await expectHeroGeometry(page);
    await expectNoHorizontalOverflow(page);

    const opener = page.locator('[data-mobile-nav-open]');
    const layer = page.locator('[data-mobile-nav]');

    await expect(opener).toBeVisible();
    await opener.click();
    await expect(layer).toHaveAttribute('data-open', 'true');
    await expect(layer).toHaveAttribute('aria-hidden', 'false');
    await expect(opener).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(layer).toHaveAttribute('data-open', 'false');
    await expect(layer).toHaveAttribute('aria-hidden', 'true');
    await expect(opener).toHaveAttribute('aria-expanded', 'false');
    await expect(opener).toBeFocused();

    await page.evaluate(() => window.scrollTo(10_000, 0));
    expect(await page.evaluate(() => window.scrollX)).toBe(0);

    await page.setViewportSize({ width: 844, height: 390 });
    await expectNoHorizontalOverflow(page);
  });
});
