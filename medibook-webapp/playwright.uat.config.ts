import { defineConfig, devices } from '@playwright/test';

/**
 * Live UAT (`npm run uat`): re-runs the role scripts of
 * `docs/UAT_REPORT_2026-10-07.md` §4 in a real browser against the live stack
 * (`/home/user/live/stack.sh up` + `web`). One spec per role section, one
 * `test.step('<ID> …')` per script step; `e2e/uat/support/stepReporter.ts`
 * writes `e2e/uat/results.json`. Serial on one worker: the steps share one
 * seeded database and build on each other.
 *
 *   UAT_BASE_URL     the web app (default http://localhost:5173, Vite with its proxy)
 *   UAT_API_URL      the API for setup calls (default http://127.0.0.1:8000)
 *   UAT_BACKEND_DIR  the backend checkout the stack runs (seed output, dev_tokens)
 *   PW_CHROMIUM      the Chromium binary (the container's build; never `playwright install`)
 */

/** A section runs every one of its steps in one test; the slowest takes ~25 minutes. */
const SECTION_TIMEOUT_MS = 60 * 60_000;
const EXPECT_TIMEOUT_MS = 15_000;
const ACTION_TIMEOUT_MS = 20_000;
const NAVIGATION_TIMEOUT_MS = 45_000;

export default defineConfig({
  testDir: 'e2e/uat',
  testMatch: /\d\d-.*\.spec\.ts$/,
  // The seeded history has finished replaying through the workers (support/globalSetup.ts).
  globalSetup: './e2e/uat/support/globalSetup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  timeout: SECTION_TIMEOUT_MS,
  expect: { timeout: EXPECT_TIMEOUT_MS },
  outputDir: 'test-results/uat',
  reporter: [['list'], ['./e2e/uat/support/stepReporter.ts']],
  use: {
    baseURL: process.env.UAT_BASE_URL ?? 'http://localhost:5173',
    actionTimeout: ACTION_TIMEOUT_MS,
    navigationTimeout: NAVIGATION_TIMEOUT_MS,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    acceptDownloads: true,
    viewport: { width: 1440, height: 1000 },
    // Testers' PCs are in India; the app reads "today" from the browser too.
    timezoneId: 'Asia/Kolkata',
    locale: 'en-IN',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 1000 },
        launchOptions: { executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' },
      },
    },
  ],
});
