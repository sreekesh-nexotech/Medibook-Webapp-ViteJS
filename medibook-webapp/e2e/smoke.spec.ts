import { expect, test, type Page } from '@playwright/test';

import {
  E2E_SKIP_REASON,
  e2eConfigured,
  e2eEnv,
  navigateInApp,
  signIn,
  type Surface,
} from './support/session.ts';

/**
 * Smoke test (checklist REL-03): every screen each role can reach loads its
 * data. A screen fails on any API error, any uncaught page error, or any of
 * the app's failure states. Read-only — nothing is created or changed.
 */

/** What the app shows when a screen's data failed (`ErrorState`, `TableState`). */
const FAILURE_TEXT = /didn[’']t load|could not be loaded|unexpected response|something went wrong/i;

/** A screen counts as settled once the network has been quiet this long after navigating. */
const QUIET_MS = 1_000;
const SETTLE_TIMEOUT_MS = 15_000;

interface Screen {
  readonly path: string;
  /** Checklist item for a failure the backend must fix; the test is expected to fail until then. */
  readonly knownFailure?: string;
}

interface Role {
  readonly name: string;
  readonly surface: Surface;
  readonly email: string;
  readonly screens: readonly Screen[];
}

const CORE_07 = 'CORE-07: receptionists lack doctors_departments.view (backend role template).';

const ROLES: readonly Role[] = [
  {
    name: 'hospital admin',
    surface: 'hospital',
    email: e2eEnv.adminEmail,
    screens: [
      'dashboard',
      'appointments',
      'appointments/new',
      'patients',
      'token',
      'payments',
      'settlements',
      'doctors',
      'users',
      'reports',
      'settings',
      'slots',
      'profile',
      'services',
      'messaging',
      'audit',
      'help',
      'account',
    ].map((view) => ({ path: `/admin/${view}` })),
  },
  {
    name: 'receptionist',
    surface: 'hospital',
    email: e2eEnv.receptionEmail,
    screens: [
      { path: '/receptionist/dashboard', knownFailure: CORE_07 },
      { path: '/receptionist/appointments', knownFailure: CORE_07 },
      { path: '/receptionist/appointments/new', knownFailure: CORE_07 },
      { path: '/receptionist/patients' },
      { path: '/receptionist/token', knownFailure: CORE_07 },
      { path: '/receptionist/payments', knownFailure: CORE_07 },
      { path: '/receptionist/help' },
      { path: '/receptionist/account' },
    ],
  },
  {
    name: 'platform owner',
    surface: 'platform',
    email: e2eEnv.platformEmail,
    screens: [
      'dashboard',
      'hospitals',
      'onboarding',
      'plans',
      'billing',
      'settlements',
      'analytics',
      'reports',
      'logs',
      'compliance',
      'users',
      'platform-users',
      'notifications',
      'settings',
      'account',
    ].map((view) => ({ path: `/ops/${view}` })),
  },
];

interface Watch {
  readonly apiErrors: string[];
  readonly pageErrors: string[];
  /** Call when navigating, so the quiet window starts from there. */
  touch: () => void;
  /** Resolves once nothing has been in flight for `QUIET_MS` (code chunks included). */
  settled: () => Promise<void>;
}

function watch(page: Page): Watch {
  const apiErrors: string[] = [];
  const pageErrors: string[] = [];
  let inFlight = 0;
  let lastActivity = Date.now();
  page.on('request', () => {
    inFlight += 1;
    lastActivity = Date.now();
  });
  const done = () => {
    inFlight = Math.max(0, inFlight - 1);
    lastActivity = Date.now();
  };
  page.on('requestfinished', done);
  page.on('requestfailed', done);
  page.on('response', (r) => {
    const path = new URL(r.url()).pathname;
    if (path.startsWith('/api/') && r.status() >= 400) {
      apiErrors.push(`${r.status()} ${r.request().method()} ${path}`);
    }
  });
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  return {
    apiErrors,
    pageErrors,
    touch: () => {
      lastActivity = Date.now();
    },
    settled: async () => {
      const deadline = Date.now() + SETTLE_TIMEOUT_MS;
      while (Date.now() < deadline) {
        if (inFlight === 0 && Date.now() - lastActivity >= QUIET_MS) return;
        await page.waitForTimeout(100);
      }
    },
  };
}

/** Everything wrong with the screen now on display. */
async function problemsOn(page: Page, screen: Screen, seen: Watch): Promise<string[]> {
  const problems: string[] = [];
  const path = new URL(page.url()).pathname;
  if (path !== screen.path) problems.push(`redirected to ${path}`);
  problems.push(...seen.apiErrors.map((e) => `API ${e}`));
  problems.push(...seen.pageErrors.map((e) => `page error: ${e}`));
  const text = await page.locator('body').innerText();
  const failure = FAILURE_TEXT.exec(text);
  if (failure) problems.push(`shows "${failure[0]}"`);
  // Violations of the production build's Content-Security-Policy (SEC-03).
  const violations = await page.evaluate(() => {
    const seen = (window as unknown as { __cspViolations?: string[] }).__cspViolations ?? [];
    return seen.splice(0, seen.length);
  });
  problems.push(...violations.map((v) => `CSP blocked ${v}`));
  return problems;
}

for (const role of ROLES) {
  test(`${role.name}: every screen loads`, async ({ page, playwright }) => {
    test.skip(!e2eConfigured, E2E_SKIP_REASON);
    const api = await playwright.request.newContext();
    await signIn(page, api, role.surface, role.email);
    await api.dispose();
    const seen = watch(page);
    await page.addInitScript(() => {
      const store = window as unknown as { __cspViolations: string[] };
      store.__cspViolations = [];
      document.addEventListener('securitypolicyviolation', (e) => {
        store.__cspViolations.push(`${e.violatedDirective}: ${e.blockedURI || 'inline'}`);
      });
    });
    await page.goto(role.screens[0].path);

    for (const [index, screen] of role.screens.entries()) {
      await test.step(screen.path, async () => {
        if (index > 0) {
          seen.apiErrors.length = 0;
          seen.pageErrors.length = 0;
          seen.touch();
          await navigateInApp(page, screen.path);
        }
        await seen.settled();
        const problems = await problemsOn(page, screen, seen);
        if (screen.knownFailure) {
          expect
            .soft(
              problems,
              `${screen.path} should still fail (${screen.knownFailure}) — remove the marker once it is fixed`,
            )
            .not.toEqual([]);
        } else {
          expect.soft(problems, screen.path).toEqual([]);
        }
      });
    }
  });
}
