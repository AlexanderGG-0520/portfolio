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

async function expectPresentationSignals(page: Page) {
  const heroEvidence = page.locator('[data-hero-evidence]');
  await expect(heroEvidence).toBeVisible();
  await expect(heroEvidence).toContainText('Alec / AlexanderGG-0520');
  await expect(heroEvidence).toContainText('Minecartainer · 20k+ image pulls');
  await expect(heroEvidence).toContainText('mc-router · production');

  await expect(page.locator('[data-case-signal="minecartainer"]')).toContainText('20k+ published image pulls');
  await expect(page.locator('[data-case-signal="mc-router"]')).toContainText('production-operated');
  await expect(page.locator('[data-case-signal="platform"]')).toContainText('1 physical failure domain');
}

test.describe('portfolio browser smoke', () => {
  for (const locale of ['en', 'ja'] as const) {
    test(`${locale}: desktop layout and runtime stay healthy`, async ({ page }) => {
      await page.goto(`/${locale}/`);

      await expectHeroGeometry(page);
      await expectPresentationSignals(page);
      await expectNoHorizontalOverflow(page);

      const runtime = page.locator('[data-live-runtime]');
      await expect(runtime).toHaveAttribute('data-runtime-state', 'healthy');
      await expect(page.locator('[data-runtime-http]')).toHaveText('200 / healthy');
      await expect(page.locator('[data-runtime-environment]')).toHaveText('ci');
    });
  }

  test('desktop controls preserve view mode and terminal focus contracts', async ({ page, context }) => {
    await context.route('https://github.com/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><title>terminal-link-target</title>',
      });
    });
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
    const terminal = page.locator('.terminal-drawer[data-terminal]');
    const terminalInput = page.locator('[data-terminal-input]');

    await terminalOpener.click();
    await expect(terminal).toHaveAttribute('data-open', 'true');
    await expect(terminal).toHaveAttribute('aria-hidden', 'false');
    await expect(terminalInput).toBeFocused();

    await terminalInput.fill('runtime');
    await terminalInput.press('Enter');
    await expect(page.locator('[data-terminal-output]')).toContainText('GET /api/runtime');

    await terminalInput.fill('github');
    await terminalInput.press('Enter');

    const terminalURL = page.locator('[data-terminal-url]').last();
    await expect(terminalURL).toHaveText('https://github.com/AlexanderGG-0520');
    await expect(terminalURL).toHaveAttribute('href', 'https://github.com/AlexanderGG-0520');
    await expect(terminalURL).toHaveAttribute('target', '_blank');

    const currentURL = page.url();
    await terminalURL.click();
    await expect(page).toHaveURL(currentURL);

    const popupPromise = page.waitForEvent('popup');
    await terminalURL.click({ modifiers: ['Control'] });
    const githubPage = await popupPromise;
    await githubPage.waitForLoadState('domcontentloaded');
    expect(githubPage.url()).toMatch(/^https:\/\/github\.com\/AlexanderGG-0520\/?$/);
    await githubPage.close();

    await page.keyboard.press('Escape');
    await expect(terminal).toHaveAttribute('data-open', 'false');
    await expect(terminal).toHaveAttribute('aria-hidden', 'true');
    await expect(terminalOpener).toBeFocused();
  });

  test('compact layout owns horizontal overflow and mobile navigation focus', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/en/');

    await expectHeroGeometry(page);
    await expect(page.locator('[data-hero-evidence]')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const opener = page.locator('[data-mobile-nav-open]');
    const layer = page.locator('.mobile-nav-layer[data-mobile-nav]');

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
