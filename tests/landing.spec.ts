import { test, expect } from '@playwright/test';

test.describe('Landing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/monk-landing.html');
  });

  test('page title and meta', async ({ page }) => {
    await expect(page).toHaveTitle(/Monk\.ai/);
  });

  test('nav brand MONK visible', async ({ page }) => {
    const brand = page.locator('#nav a').first();
    await expect(brand).toBeVisible();
    await expect(brand).toContainText('MONK');
  });

  test('nav CTA "Start Free" button exists', async ({ page }) => {
    const cta = page.locator('#nav a').filter({ hasText: 'Start Free' });
    await expect(cta).toBeVisible();
  });

  test('hero h1 visible with key text', async ({ page }) => {
    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible();
    await expect(h1).toContainText(/coach|mercy/i);
  });

  test('competitor contrast pill in page source', async ({ page }) => {
    const src = await page.content();
    expect(src).toContain('Habitica');
    expect(src).toContain('Fabulous');
  });

  test('6 coach personality slices render', async ({ page }) => {
    const slices = page.locator('.p-slice');
    await expect(slices).toHaveCount(6);
  });

  test('all 6 coach names in page source', async ({ page }) => {
    const src = await page.content();
    for (const name of ['Drill Sergeant', 'Stoic Mentor', 'Anime Sensei', 'Stay Hard', 'CEO Coach', 'Calm Therapist']) {
      expect(src).toContain(name);
    }
  });

  test('coach images use Unsplash CDN not picsum', async ({ page }) => {
    const src = await page.content();
    expect(src).not.toContain('picsum.photos/seed/military-harsh');
    expect(src).not.toContain('picsum.photos/seed/roman-stoic');
    expect(src).not.toContain('picsum.photos/seed/dojo-night');
    expect(src).not.toContain('picsum.photos/seed/endurance-dark');
    expect(src).not.toContain('picsum.photos/seed/boardroom-dim');
    expect(src).not.toContain('picsum.photos/seed/forest-calm');
    expect(src).toContain('images.unsplash.com');
  });

  test('comparison table renders', async ({ page }) => {
    // Section uses divs not <table>, scroll to trigger GSAP
    await page.evaluate(() => window.scrollBy(0, 2000));
    await page.waitForTimeout(500);
    const src = await page.content();
    expect(src).toContain('MONK.AI');
    expect(src).toContain('Habitica');
    expect(src).toContain('Fabulous');
  });

  test('pricing section anchor exists', async ({ page }) => {
    const pricing = page.locator('#pricing');
    await expect(pricing).toBeAttached();
  });

  test('footer privacy link present', async ({ page }) => {
    const link = page.locator('footer a[href="privacy.html"]');
    await expect(link).toBeVisible();
  });

  test('footer terms link present', async ({ page }) => {
    const link = page.locator('footer a[href="terms.html"]');
    await expect(link).toBeVisible();
  });

  test('footer mailto link correct', async ({ page }) => {
    const link = page.locator('footer a[href="mailto:hello@monk.ai"]');
    await expect(link).toBeVisible();
  });

  test('internal page links resolve (200)', async ({ page }) => {
    const hrefs = await page.locator('footer a[href]').evaluateAll(els =>
      els.map(el => (el as HTMLAnchorElement).href).filter(h => h.startsWith('http://localhost') && !h.includes('mailto'))
    );
    for (const href of hrefs) {
      const res = await page.request.get(href);
      expect(res.status(), `broken link: ${href}`).toBeLessThan(400);
    }
  });
});
