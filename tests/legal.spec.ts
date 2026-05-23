import { test, expect } from '@playwright/test';

test.describe('Privacy Policy', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/privacy.html');
  });

  test('correct page title', async ({ page }) => {
    await expect(page).toHaveTitle(/Privacy/i);
  });

  test('10 numbered sections present', async ({ page }) => {
    const sections = page.locator('.section-num');
    await expect(sections).toHaveCount(10);
  });

  test('key section headings present', async ({ page }) => {
    const src = await page.content();
    for (const text of [
      'What We Collect',
      'How We Use It',
      'AI Processing',
      'Third-Party Services',
      'Data Retention',
      'Your Rights',
      'Security',
      'Children',
    ]) {
      expect(src, `missing: ${text}`).toContain(text);
    }
  });

  test('third-party providers listed', async ({ page }) => {
    const src = await page.content();
    expect(src).toContain('Supabase');
    expect(src).toContain('RevenueCat');
    expect(src).toContain('Anthropic');
  });

  test('privacy contact email present', async ({ page }) => {
    await expect(page.locator('a[href="mailto:privacy@monk.ai"]').first()).toBeVisible();
  });

  test('nav link to terms present', async ({ page }) => {
    await expect(page.locator('a[href="terms.html"]').first()).toBeVisible();
  });

  test('back to landing link navigates', async ({ page }) => {
    await page.locator('a[href="monk-landing.html"]').first().click();
    await expect(page).toHaveURL(/monk-landing\.html/);
  });

  test('dark background applied', async ({ page }) => {
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    // #0a0a0a = rgb(10, 10, 10)
    expect(bg).toMatch(/rgb\(10,\s*10,\s*10\)|rgb\(0,\s*0,\s*0\)/);
  });
});

test.describe('Terms of Service', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/terms.html');
  });

  test('correct page title', async ({ page }) => {
    await expect(page).toHaveTitle(/Terms/i);
  });

  test('15 numbered sections present', async ({ page }) => {
    const sections = page.locator('.section-num');
    await expect(sections).toHaveCount(15);
  });

  test('key section headings present', async ({ page }) => {
    const src = await page.content();
    for (const text of [
      'The Service',
      'Eligibility',
      'Acceptable Use',
      'AI Coaching',
      'Termination',
      'Contact',
    ]) {
      expect(src, `missing: ${text}`).toContain(text);
    }
  });

  test('AI limitations warning box — not a therapist disclaimer', async ({ page }) => {
    const src = await page.content();
    expect(src).toContain('not a licensed therapist');
  });

  test('legal contact email present', async ({ page }) => {
    await expect(page.locator('a[href="mailto:legal@monk.ai"]').first()).toBeVisible();
  });

  test('nav link to privacy present', async ({ page }) => {
    await expect(page.locator('a[href="privacy.html"]').first()).toBeVisible();
  });

  test('back to landing link navigates', async ({ page }) => {
    await page.locator('a[href="monk-landing.html"]').first().click();
    await expect(page).toHaveURL(/monk-landing\.html/);
  });
});
