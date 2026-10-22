import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests run against the production build (`vite preview`).
 * CHROMIUM_PATH lets you point at any local Chrome/Chromium if Playwright's own browser isn't installed.
 * The "camera" project feeds a synthetic cube video into Chrome's fake camera so real OpenCV detection runs.
 */
const executablePath = process.env.CHROMIUM_PATH || undefined;
const base = { ...devices['Pixel 7'], launchOptions: { executablePath, args: ['--no-sandbox'] } };

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  retries: 0,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173', trace: 'off' },
  webServer: { command: 'npm run build && npx vite preview --port 4173 --strictPort', url: 'http://localhost:4173', reuseExistingServer: true, timeout: 180_000 },
  projects: [
    { name: 'mobile', testIgnore: /camera\.spec/, use: { ...base } },
    {
      name: 'camera',
      testMatch: /camera\.spec/,
      use: {
        ...base,
        permissions: ['camera'],
        launchOptions: {
          executablePath,
          args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-video-capture=tests/fixtures/video/front-face.y4m'],
        },
      },
    },
  ],
});
