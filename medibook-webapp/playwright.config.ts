import { defineConfig, devices } from '@playwright/test';

/**
 * Browser smoke tests (`npm run e2e`) against a running app and a seeded
 * backend — staging, or the dev server with its proxy. Read-only: they sign
 * in once per role and open every screen. Configure with:
 *
 *   E2E_BASE_URL            the app, e.g. http://localhost:5173
 *   E2E_API_BASE            the API, when not `<E2E_BASE_URL>/api/v1`
 *   E2E_ADMIN_EMAIL         a hospital admin
 *   E2E_RECEPTION_EMAIL     a receptionist at the same hospital
 *   E2E_PLATFORM_EMAIL      a platform owner
 *   E2E_PASSWORD            their shared password
 *
 * Without them every test is skipped. Sign-in is rate-limited per account
 * (five a minute), so leave a minute between runs.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  // One test signs in once per role and walks every screen.
  timeout: 180_000,
  use: {
    baseURL: process.env.E2E_BASE_URL,
    trace: 'retain-on-failure',
    viewport: { width: 1440, height: 1000 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } },
    },
  ],
});
