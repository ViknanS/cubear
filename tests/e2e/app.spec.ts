import { expect, test, type Page } from '@playwright/test';

const errors: string[] = [];
test.beforeEach(async ({ page }) => {
  errors.length = 0;
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  // clear storage once per test (sessionStorage survives reloads, so persistence can be tested)
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('cleared')) { localStorage.clear(); sessionStorage.setItem('cleared', '1'); }
  });
});
test.afterEach(() => {
  // WebGL may be unavailable in headless CI; that is handled by a 2D fallback and not an error.
  expect(errors.filter((e) => !/WebGL|GPU|getUserMedia|Permission|NotAllowed|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ERR_INTERNET/i.test(e))).toEqual([]);
});

async function solveDemo(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try Demo' }).click();
  await expect(page.getByTestId('validation-ok')).toBeVisible();
  await page.getByTestId('solve').click();
  await expect(page.getByTestId('move-count')).toBeVisible({ timeout: 30_000 });
}

test('home screen shows the three entry points', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/CubeAR/);
  await expect(page.getByRole('button', { name: 'Scan My Cube' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Manual Entry' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try Demo' })).toBeVisible();
});

test('demo cube is solved in a Web Worker and the solution can be stepped', async ({ page }) => {
  await solveDemo(page);
  const n = Number(await page.getByTestId('move-count').textContent());
  expect(n).toBeGreaterThan(0);
  expect(n).toBeLessThanOrEqual(22);
  await expect(page.getByTestId('step-label')).toHaveText(`Step 1 of ${n}`);
  await page.getByRole('button', { name: 'Next move' }).click();
  await expect(page.getByTestId('step-label')).toHaveText(`Step 2 of ${n}`);
  await page.getByRole('button', { name: 'Previous move' }).click();
  await expect(page.getByTestId('step-label')).toHaveText(`Step 1 of ${n}`);
  await expect(page.getByTestId('move-list').getByRole('button')).toHaveCount(n);
});

test('AR guide: controls update progress, 3D fallback is explicitly labelled, finishing shows success', async ({ page, context }) => {
  await context.clearPermissions(); // no camera → fallback path
  await solveDemo(page);
  const n = Number(await page.getByTestId('move-count').textContent());
  await page.getByTestId('start-ar').click();
  await expect(page.getByTestId('ar-step')).toContainText(`Step 1 of ${n}`);
  await page.getByTestId('next').click();
  await expect(page.getByTestId('ar-step')).toContainText(`Step 2 of ${n}`);
  await page.getByRole('button', { name: 'Previous move' }).click();
  await expect(page.getByTestId('ar-step')).toContainText(`Step 1 of ${n}`);
  await page.getByTestId('pause').click();
  await expect(page.getByTestId('track-status')).toContainText(/Paused|3D/);
  await page.getByTestId('toggle-view').click();
  await expect(page.getByTestId('track-status')).toContainText('3D instruction view — not camera-tracked');
  for (let i = 0; i < n; i++) await page.getByTestId('next').click();
  await expect(page.getByTestId('ar-step')).toContainText(`All ${n} moves done`);
  await page.getByTestId('finish').click();
  await expect(page.getByTestId('success')).toBeVisible();
});

test('camera permission denied shows a usable fallback', async ({ page, context }) => {
  await context.clearPermissions();
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError'));
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Scan My Cube' }).click();
  await expect(page.getByTestId('camera-fallback')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Camera access was blocked');
  await page.getByRole('button', { name: 'Enter colors manually instead' }).click();
  await expect(page.getByTestId('cube-net')).toBeVisible();
});

test('manual entry: painting stickers updates the cube and validation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Manual Entry' }).click();
  await expect(page.getByTestId('validation-issues')).toContainText('no color yet');
  await page.getByTestId('palette-red').click();
  await page.getByTestId('sticker-0').click();
  await expect(page.getByTestId('sticker-0')).toHaveAttribute('data-color', 'red');
  await page.getByTestId('palette-blue').click();
  await page.getByTestId('sticker-0').click();
  await expect(page.getByTestId('sticker-0')).toHaveAttribute('data-color', 'blue');
  await expect(page.getByTestId('solve')).toBeDisabled();
});

test('demo cube: correcting a sticker invalidates, then restoring it re-validates', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try Demo' }).click();
  const s = page.getByTestId('sticker-0');
  const original = await s.getAttribute('data-color');
  await s.click();
  await page.getByRole('dialog', { name: 'Choose sticker color' }).getByTestId(original === 'red' ? 'palette-blue' : 'palette-red').click();
  await expect(page.getByTestId('validation-issues')).toContainText('exactly 9 times');
  await expect(page.getByTestId('solve')).toBeDisabled();
  await s.click();
  await page.getByRole('dialog', { name: 'Choose sticker color' }).getByTestId(`palette-${original}`).click();
  await expect(page.getByTestId('validation-ok')).toBeVisible();
});

test('session persists across reloads', async ({ page }) => {
  await solveDemo(page);
  const n = Number(await page.getByTestId('move-count').textContent());
  await page.getByRole('button', { name: 'Next move' }).click();
  await expect(page.getByTestId('step-label')).toHaveText(`Step 2 of ${n}`);
  await page.reload();
  await expect(page.getByTestId('step-label')).toHaveText(`Step 2 of ${n}`);
});
