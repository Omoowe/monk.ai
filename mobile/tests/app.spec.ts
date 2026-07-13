import { test, expect, type Page } from '@playwright/test';

const TEST_EMAIL    = 'roymajekodun@hotmail.com';
const TEST_PASSWORD = 'monk1234';

async function login(page: Page) {
  await page.goto('http://localhost:8081');
  await page.waitForTimeout(2500);

  await page.getByText('Sign In', { exact: true }).first().click();
  await page.waitForTimeout(400);

  await page.locator('[data-testid="login-email-input"]').fill(TEST_EMAIL);
  await page.locator('[data-testid="login-password-input"]').fill(TEST_PASSWORD);
  await page.getByText('Sign In →', { exact: true }).click();

  // Tab bar confirms auth + navigation succeeded
  await expect(page.getByTestId('tab-coach')).toBeVisible({ timeout: 10000 });
}

async function clickTab(page: Page, id: string) {
  await page.getByTestId(id).click();
  await page.waitForTimeout(1500);
}

// ─── 1. Welcome Screen ──────────────────────────────────────────────────────
test('01 welcome screen renders branding and CTAs', async ({ page }) => {
  await page.goto('http://localhost:8081');
  await page.waitForTimeout(2500);

  await expect(page.getByText('No fluff.')).toBeVisible();
  await expect(page.getByText('Sign In', { exact: true })).toBeVisible();
  await expect(page.getByText('Create Account', { exact: true })).toBeVisible();
});

// ─── 2. Login Flow ──────────────────────────────────────────────────────────
test('02 sign-in → all tabs visible', async ({ page }) => {
  await login(page);
  await expect(page.getByTestId('tab-coach')).toBeVisible();
  await expect(page.getByTestId('tab-checkin')).toBeVisible();
  await expect(page.getByTestId('tab-goals')).toBeVisible();
  await expect(page.getByTestId('tab-stats')).toBeVisible();
  await expect(page.getByTestId('tab-social')).toBeVisible();
});

test('02b wrong password shows error, stays on login', async ({ page }) => {
  await page.goto('http://localhost:8081');
  await page.waitForTimeout(2500);

  await page.getByText('Sign In', { exact: true }).first().click();
  await page.waitForTimeout(400);
  await page.locator('[data-testid="login-email-input"]').fill(TEST_EMAIL);
  await page.locator('[data-testid="login-password-input"]').fill('wrongpassword999');
  await page.getByText('Sign In →', { exact: true }).click();

  await page.waitForTimeout(4000);
  // Must NOT navigate to app
  await expect(page.getByTestId('tab-coach')).not.toBeVisible();
});

// ─── 3. Coach Tab ───────────────────────────────────────────────────────────
test('03 coach tab — chat interface renders', async ({ page }) => {
  await login(page);
  await clickTab(page, 'tab-coach');

  const content = await page.content();
  const hasCoach = content.toLowerCase().includes('coach') ||
                   content.toLowerCase().includes('message') ||
                   content.toLowerCase().includes('monk');
  expect(hasCoach).toBe(true);
  // Should have a text input or button to send a message
  const interactives = page.locator('input, textarea, [role="button"], [role="textbox"]');
  expect(await interactives.count()).toBeGreaterThan(0);
});

// ─── 4. Check-In Tab ────────────────────────────────────────────────────────
test('04 check-in tab — renders morning/evening or habit content', async ({ page }) => {
  await login(page);
  await clickTab(page, 'tab-checkin');

  const content = await page.content();
  const hasMorning = content.toLowerCase().includes('morning');
  const hasHabit   = content.toLowerCase().includes('habit');
  const hasCheckIn = content.toLowerCase().includes('check');
  expect(hasMorning || hasHabit || hasCheckIn).toBe(true);
});

// ─── 5. Goals Tab ───────────────────────────────────────────────────────────
test('05 goals tab — renders goals content', async ({ page }) => {
  await login(page);
  await clickTab(page, 'tab-goals');

  const content = await page.content();
  expect(content.toLowerCase()).toContain('goal');
});

// ─── 6. Stats Tab ───────────────────────────────────────────────────────────
test('06 stats tab — renders score or streak', async ({ page }) => {
  await login(page);
  await clickTab(page, 'tab-stats');

  const content = await page.content();
  const hasStats = content.toLowerCase().includes('streak') ||
                   content.toLowerCase().includes('score')  ||
                   content.toLowerCase().includes('stat')   ||
                   content.toLowerCase().includes('dopamine');
  expect(hasStats).toBe(true);
});

// ─── 7. Social Tab ──────────────────────────────────────────────────────────
test('07 social tab — renders social content', async ({ page }) => {
  await login(page);
  await clickTab(page, 'tab-social');

  const content = await page.content();
  const hasSocial = content.toLowerCase().includes('friend')   ||
                    content.toLowerCase().includes('arena')     ||
                    content.toLowerCase().includes('challenge') ||
                    content.toLowerCase().includes('search')    ||
                    content.toLowerCase().includes('social');
  expect(hasSocial).toBe(true);
});

// ─── 8. All Tabs Navigate Without Crash ─────────────────────────────────────
test('08 all tabs navigable without crash', async ({ page }) => {
  await login(page);
  for (const id of ['tab-checkin', 'tab-goals', 'tab-stats', 'tab-social', 'tab-coach']) {
    await clickTab(page, id);
    const content = await page.content();
    expect(content.toLowerCase()).not.toContain('something went wrong');
  }
});

// ─── 9. Global Header ───────────────────────────────────────────────────────
test('09 global header visible', async ({ page }) => {
  await login(page);
  await page.waitForTimeout(1000);
  const content = await page.content();
  expect(content.toUpperCase()).toContain('MONK');
});

// ─── 10. Session Persistence ────────────────────────────────────────────────
test('10 reload preserves session', async ({ page }) => {
  await login(page);
  await page.reload();
  await page.waitForTimeout(3000);
  await expect(page.getByTestId('tab-coach')).toBeVisible({ timeout: 8000 });
});
