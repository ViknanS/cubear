import { expect, test } from '@playwright/test';

/**
 * Real browser + real OpenCV.js + Chrome's fake camera playing tests/fixtures/video/front-face.y4m
 * (a synthetic cube face). Verifies the live pipeline: getUserMedia → OpenCV grid detection → color
 * classification → stable capture. This is NOT a physical-device test.
 */
test('scan screen detects the synthetic cube face and captures it', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await page.getByRole('button', { name: 'Scan My Cube' }).click();
  await expect(page.getByTestId('scan-progress')).toContainText('Face 1 of 6');
  await expect(page.getByTestId('scan-status')).toContainText('Grid found', { timeout: 60_000 });
  await expect(page.getByTestId('capture')).toBeEnabled({ timeout: 30_000 });
  await page.getByTestId('capture').click();
  await expect(page.getByTestId('scan-progress')).toContainText('Face 2 of 6');
  // The same face is still in front of the camera, so the app must refuse it as a duplicate.
  await expect(page.getByTestId('scan-status')).toContainText('already scanned', { timeout: 30_000 });
  await expect(page.getByTestId('capture')).toBeDisabled();
  expect(errors).toEqual([]);
});
