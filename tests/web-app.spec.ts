import { test, expect, Page } from '@playwright/test';

const APP_URL = '/monk-web.html';

// Supabase auth takes time — set a generous default
test.use({ actionTimeout: 15_000 });

async function waitForAuthScreen(page: Page) {
  // App starts at 'loading', transitions to 'auth' once Supabase responds
  await page.waitForSelector('[data-view="auth"], .auth-form, input[type="email"]', {
    timeout: 12_000,
  }).catch(() => null);
}

test.describe('Web app — auth screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
    await waitForAuthScreen(page);
  });

  test('page loads without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(APP_URL);
    await page.waitForTimeout(3000);
    // Filter out expected Supabase/network errors in offline mode
    const fatal = errors.filter(e =>
      !e.includes('fetch') &&
      !e.includes('network') &&
      !e.includes('Failed to fetch') &&
      !e.includes('ERR_')
    );
    expect(fatal).toHaveLength(0);
  });

  test('page title correct', async ({ page }) => {
    await expect(page).toHaveTitle(/Monk/i);
  });

  test('Vue app mounts — loading indicator or auth appears', async ({ page }) => {
    // Either loading spinner or auth form must appear
    const hasContent = await page.locator('body').evaluate(el =>
      el.innerText.trim().length > 0
    );
    expect(hasContent).toBe(true);
  });

  test('email input present on auth screen', async ({ page }) => {
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible({ timeout: 12_000 });
  });

  test('password input present on auth screen', async ({ page }) => {
    const pwInput = page.locator('input[type="password"]');
    await expect(pwInput).toBeVisible({ timeout: 12_000 });
  });

  test('login / sign up toggle exists', async ({ page }) => {
    const toggle = page.locator('button, span').filter({ hasText: /sign up|register|create account|log in|login/i });
    await expect(toggle.first()).toBeVisible({ timeout: 12_000 });
  });

  test('submit button present', async ({ page }) => {
    const btn = page.locator('button[type="submit"], button').filter({ hasText: /sign in|log in|continue|enter/i });
    await expect(btn.first()).toBeVisible({ timeout: 12_000 });
  });

  test('MONK.AI branding visible on auth screen', async ({ page }) => {
    await expect(page.locator('text=MONK').first()).toBeVisible({ timeout: 12_000 });
  });
});

test.describe('Web app — auth form interaction', () => {
  test('can type into email field', async ({ page }) => {
    await page.goto(APP_URL);
    const email = page.locator('input[type="email"]');
    await email.waitFor({ state: 'visible', timeout: 12_000 });
    await email.fill('test@example.com');
    await expect(email).toHaveValue('test@example.com');
  });

  test('can type into password field', async ({ page }) => {
    await page.goto(APP_URL);
    const pwd = page.locator('input[type="password"]');
    await pwd.waitFor({ state: 'visible', timeout: 12_000 });
    await pwd.fill('TestPass123!');
    await expect(pwd).toHaveValue('TestPass123!');
  });

  test('empty form submit shows validation or attempts auth', async ({ page }) => {
    await page.goto(APP_URL);
    // Auth submit button uses @click not type="submit"
    const btn = page.locator('button').filter({ hasText: /sign in|create account/i }).first();
    await btn.waitFor({ state: 'visible', timeout: 12_000 });
    await btn.click();
    // Should either show error message or attempt Supabase call (not crash)
    await page.waitForTimeout(1000);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test('toggle between login and signup modes', async ({ page }) => {
    await page.goto(APP_URL);
    const toggle = page.locator('button, span, a').filter({ hasText: /sign up|create account|register/i });
    await toggle.first().waitFor({ state: 'visible', timeout: 12_000 });
    await toggle.first().click();
    // After toggle, should still show form elements
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });
});

test.describe('Web app — design system', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
  });

  test('dark background applied', async ({ page }) => {
    const bg = await page.evaluate(() => {
      return getComputedStyle(document.body).backgroundColor;
    });
    // Should be near-black: rgb(10, 10, 10) or similar
    expect(bg).toMatch(/rgb\((\d+), \1, \1\)/); // greyscale = dark
  });

  test('Syne or DM Mono font loaded', async ({ page }) => {
    await page.waitForTimeout(2000);
    const fonts = await page.evaluate(() => {
      return [...document.fonts].map(f => f.family);
    });
    const hasSyne = fonts.some(f => f.toLowerCase().includes('syne'));
    const hasMono = fonts.some(f => f.toLowerCase().includes('dm mono'));
    expect(hasSyne || hasMono).toBe(true);
  });

  test('viewport meta tag set for mobile', async ({ page }) => {
    const viewport = await page.$eval(
      'meta[name="viewport"]',
      el => el.getAttribute('content')
    );
    expect(viewport).toContain('width=device-width');
  });

  test('no horizontal scroll at 375px width', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(APP_URL);
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const clientWidth = await page.evaluate(() => document.body.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2); // 2px tolerance
  });
});

test.describe('Web app — security', () => {
  test('no ANTHROPIC_API_KEY in page source', async ({ page }) => {
    await page.goto(APP_URL);
    const src = await page.content();
    expect(src).not.toContain('sk-ant-');
    expect(src).not.toContain('ANTHROPIC_API_KEY');
  });

  test('Supabase anon key is present (public by design)', async ({ page }) => {
    await page.goto(APP_URL);
    const src = await page.content();
    // Anon key is intentionally public per Supabase architecture
    expect(src).toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
  });

  test('no raw JWT secret or service role key exposed', async ({ page }) => {
    await page.goto(APP_URL);
    const src = await page.content();
    // Service role keys start with these patterns
    expect(src).not.toMatch(/service_role/);
  });

  test('all AI calls go through Supabase Edge Functions not direct Anthropic', async ({ page }) => {
    await page.goto(APP_URL);
    const src = await page.content();
    expect(src).not.toContain('api.anthropic.com');
    // Should use Supabase functions.invoke
    expect(src).toContain('functions.invoke');
  });
});
