import type { APIRequestContext, Page } from '@playwright/test';

export type Surface = 'hospital' | 'platform';

/** Where the app keeps a session's refresh token (`src/core/api/tokens.ts`). */
const REFRESH_KEY: Readonly<Record<Surface, string>> = {
  hospital: 'medibook.auth.hospital.refresh',
  platform: 'medibook.auth.platform.refresh',
};

const API_PREFIX = '/api/v1';

export const e2eEnv = {
  baseUrl: process.env.E2E_BASE_URL ?? '',
  apiBase: process.env.E2E_API_BASE ?? `${process.env.E2E_BASE_URL ?? ''}${API_PREFIX}`,
  adminEmail: process.env.E2E_ADMIN_EMAIL ?? '',
  receptionEmail: process.env.E2E_RECEPTION_EMAIL ?? '',
  platformEmail: process.env.E2E_PLATFORM_EMAIL ?? '',
  password: process.env.E2E_PASSWORD ?? '',
};

export const e2eConfigured = Object.values(e2eEnv).every((value) => value !== '');

export const E2E_SKIP_REASON =
  'Set E2E_BASE_URL, the E2E_*_EMAIL accounts and E2E_PASSWORD to run the smoke tests.';

/**
 * Sign in through the API once and hand the refresh token to the app, so the
 * page starts signed in without typing into the login form for every role.
 */
export async function signIn(
  page: Page,
  request: APIRequestContext,
  surface: Surface,
  email: string,
): Promise<void> {
  const response = await request.post(`${e2eEnv.apiBase}/${surface}/auth/login`, {
    data: { email, password: e2eEnv.password },
  });
  if (!response.ok()) throw new Error(`Sign-in as ${email} failed (${response.status()}).`);
  const { refresh } = (await response.json()) as { refresh: string };
  await page.addInitScript(
    ([key, token]) => {
      if (!window.sessionStorage.getItem(key)) window.sessionStorage.setItem(key, token);
    },
    [REFRESH_KEY[surface], refresh] as const,
  );
}

/** Go to another screen inside the app without reloading (a reload refreshes the token). */
export async function navigateInApp(page: Page, path: string): Promise<void> {
  await page.evaluate((to) => {
    window.history.pushState({}, '', to);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
}
