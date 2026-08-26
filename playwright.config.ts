import { defineConfig, devices } from '@playwright/test';

/**
 * One smoke path, run against the real dev server.
 *
 * The scripts in `scripts/` prove the export and import seams and the vitest
 * suites prove the reducers, but nothing proved that a person can create a deck,
 * change it, and find their change still there after a reload. That is the path
 * a broken build breaks first, and it is the one this covers.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5199',
    trace: 'on-first-retry',
    // The studio is a desktop tool (see the tablet floor in App.tsx), so the
    // smoke path runs at a desktop size.
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx vite --port 5199 --strictPort',
    url: 'http://localhost:5199',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
