import { readFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';

import {
  expect,
  type Browser,
  type BrowserContext,
  type Download,
  type Locator,
  type Page,
  type Response,
} from '@playwright/test';

import { passwordOf } from './accounts.ts';
import { HOSPITAL_TIME_ZONE, UAT_ENV } from './env.ts';
import { spendSignIn } from './throttle.ts';
import { ApiWatch } from './watch.ts';

/**
 * Browser-side helpers: one signed-in browser context per account (its own
 * cookies and storage, like a separate desk PC), sign-in through the real
 * login form, in-app navigation, toasts, dialogs and downloads.
 */

export type StaffSurface = 'hospital' | 'platform';

export interface StaffSession {
  readonly context: BrowserContext;
  readonly page: Page;
  readonly watch: ApiWatch;
  readonly email: string;
}

const VIEWPORT = { width: 1440, height: 1000 } as const;
const LOGIN_PATH = '/auth/login';
const SIGN_IN_TIMEOUT_MS = 30_000;

/** A fresh browser context (a separate "computer") with the API watch on its first page. */
export async function newBrowserSession(
  browser: Browser,
  label: string,
): Promise<{ context: BrowserContext; page: Page; watch: ApiWatch }> {
  // A desk PC in India: the app reads "today" and times from the browser too.
  const context = await browser.newContext({
    baseURL: UAT_ENV.baseUrl,
    viewport: VIEWPORT,
    acceptDownloads: true,
    timezoneId: HOSPITAL_TIME_ZONE,
    locale: 'en-IN',
  });
  const page = await context.newPage();
  return { context, page, watch: new ApiWatch(page, label) };
}

/** The login form's fields and button. */
export function loginForm(page: Page) {
  return {
    email: page.getByLabel('Email Address'),
    password: page.getByLabel('Password', { exact: true }),
    remember: page.getByRole('checkbox', { name: /Keep me signed in/ }),
    submit: page.getByRole('button', { name: 'Login', exact: true }),
    opsTab: page.getByRole('button', { name: 'Operations Login' }),
    hospitalTab: page.getByRole('button', { name: 'Hospital Login' }),
  };
}

/** Fill and submit the login form on the current page (the login page must be open). */
export async function submitLogin(
  page: Page,
  surface: StaffSurface,
  email: string,
  password = passwordOf(email),
): Promise<void> {
  const form = loginForm(page);
  await (surface === 'platform' ? form.opsTab : form.hospitalTab).click();
  await form.email.fill(email);
  await form.password.fill(password);
  await spendSignIn(email);
  await form.submit.click();
}

/** Open the login page and sign in; resolves once the console has loaded. */
export async function signIn(
  page: Page,
  surface: StaffSurface,
  email: string,
  password = passwordOf(email),
): Promise<void> {
  await page.goto(surface === 'platform' ? `${LOGIN_PATH}?surface=ops` : LOGIN_PATH);
  await submitLogin(page, surface, email, password);
  await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: SIGN_IN_TIMEOUT_MS });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({
    timeout: SIGN_IN_TIMEOUT_MS,
  });
}

/** A new browser context signed in as `email`. */
export async function openStaff(
  browser: Browser,
  surface: StaffSurface,
  email: string,
): Promise<StaffSession> {
  const session = await newBrowserSession(browser, email);
  await signIn(session.page, surface, email);
  return { ...session, email };
}

/**
 * Go to another screen inside the app without reloading it, the way a click
 * on a link does (a reload would also work, it just costs a token refresh).
 */
export async function goTo(page: Page, path: string): Promise<void> {
  await page.evaluate((to) => {
    window.history.pushState({}, '', to);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await page.waitForURL((url) => `${url.pathname}${url.search}` === path);
}

/** Click a sidebar entry. */
export async function openNav(page: Page, label: string): Promise<void> {
  await page.getByRole('navigation').getByRole('button', { name: label, exact: true }).click();
}

/** The page's title in the top bar. */
export function topbarTitle(page: Page): Locator {
  return page.getByRole('heading', { level: 1 });
}

/**
 * A toast (confirmations are a polite status, errors an assertive alert). A
 * toast's text starts after its icon with a space, and Playwright tests a
 * RegExp against the untrimmed text, so a leading `^` allows that space.
 */
export function toast(page: Page, text: string | RegExp): Locator {
  const matcher =
    text instanceof RegExp && text.source.startsWith('^')
      ? new RegExp(`^\\s*${text.source.slice(1)}`, text.flags)
      : text;
  return page
    .locator('[role="status"][aria-live="polite"], [role="alert"][aria-live="assertive"]')
    .getByText(matcher);
}

/** A dialog, modal or drawer by its title. */
export function dialog(page: Page, name: string | RegExp): Locator {
  return page.getByRole('dialog', { name });
}

/** A table row containing `text`. */
export function row(scope: Page | Locator, text: string | RegExp): Locator {
  return scope.getByRole('row').filter({ hasText: text });
}

/** Close any open modal or drawer (Escape), e.g. before the next step starts. */
export async function closeDialogs(page: Page): Promise<void> {
  for (let i = 0; i < 3; i += 1) {
    if ((await page.getByRole('dialog').count()) === 0) return;
    await page.keyboard.press('Escape');
  }
}

/** Sign out from the account menu. */
export async function signOut(page: Page, userName: string): Promise<void> {
  await page.getByRole('button', { name: `Account menu for ${userName}` }).click();
  await page.getByRole('menuitem', { name: 'Log Out' }).click();
  await expect(page).toHaveURL(/\/auth\/login/);
}

/** A `waitForResponse` predicate: `method` on a path matching `pathname`. */
export function isCall(method: string, pathname: RegExp): (response: Response) => boolean {
  return (r) => r.request().method() === method && pathname.test(new URL(r.url()).pathname);
}

/** The deepest element holding both `inner` and `marker` — one card on a screen. */
export function cardWith(page: Page, inner: Locator, marker: Locator): Locator {
  return page.locator('div').filter({ has: inner }).filter({ has: marker }).last();
}

/** Data rows (rows with cells, not the header) of the table in scroll region `region`. */
export function dataRows(page: Page, region: string): Locator {
  return page
    .getByRole('region', { name: region })
    .getByRole('row')
    .filter({ has: page.getByRole('cell') });
}

/** `text` as a literal inside a RegExp. */
export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* -------------------------------------------------------------- selects */

const OPTIONS_TIMEOUT_MS = 20_000;

async function optionTexts(select: Locator): Promise<string[]> {
  return (await select.locator('option').allTextContents()).map((t) => t.trim());
}

/**
 * Pick the option whose label starts with `prefix` — option labels may carry a
 * disambiguating suffix ("Cardiology (cardiology_2)"). Waits for it to load.
 */
export async function selectByPrefix(select: Locator, prefix: string): Promise<string> {
  await expect
    .poll(async () => (await optionTexts(select)).some((o) => o.startsWith(prefix)), {
      timeout: OPTIONS_TIMEOUT_MS,
      message: `an option starting "${prefix}"`,
    })
    .toBe(true);
  const label = (await optionTexts(select)).find((o) => o.startsWith(prefix));
  if (label === undefined) throw new Error(`No option starting "${prefix}".`);
  await select.selectOption({ label });
  return label;
}

/** Pick the first real option (one with a value), waiting for the list to load. */
export async function selectFirstReal(
  select: Locator,
  matching: (label: string) => boolean = () => true,
): Promise<string> {
  // One read of every option: the list re-renders while a search answers, and
  // per-option reads would wait on an option that has just gone.
  const real = async () =>
    (
      await select
        .locator('option')
        .evaluateAll((options) =>
          options.map((o) => ({ value: o.getAttribute('value') ?? '', text: o.textContent ?? '' })),
        )
    )
      .map((o) => ({ value: o.value, text: o.text.trim() }))
      .filter((o) => o.value !== '' && matching(o.text))
      .map((o) => o.text);
  await expect
    .poll(async () => (await real()).length, {
      timeout: OPTIONS_TIMEOUT_MS,
      message: 'a selectable option',
    })
    .toBeGreaterThan(0);
  const [label] = await real();
  if (label === undefined) throw new Error('No selectable option.');
  await select.selectOption({ label });
  return label;
}

/* ------------------------------------------------------------ downloads */

export interface SavedDownload {
  readonly filename: string;
  readonly bytes: Buffer;
  text(): string;
}

/** Run `action` and capture the file the browser downloads. */
export async function download(page: Page, action: () => Promise<void>): Promise<SavedDownload> {
  const [file] = await Promise.all([page.waitForEvent('download'), action()]);
  return saved(file);
}

async function saved(file: Download): Promise<SavedDownload> {
  const path = await file.path();
  const bytes = await readFile(path);
  return {
    filename: file.suggestedFilename(),
    bytes,
    text: () => bytes.toString('utf-8'),
  };
}

const PDF_PAGE_OBJECT = /\/Type\s*\/Page(?![a-zA-Z])/g;
const PDF_STREAM = /stream\r?\n/g;

/**
 * Pages in a PDF: page objects carry `/Type /Page`, in the file or inside a
 * compressed object stream (WeasyPrint writes PDF 1.5+ object streams).
 */
export function pdfPageCount(bytes: Buffer): number {
  const raw = bytes.toString('latin1');
  let count = (raw.match(PDF_PAGE_OBJECT) ?? []).length;
  for (const match of raw.matchAll(PDF_STREAM)) {
    const start = match.index + match[0].length;
    const end = raw.indexOf('endstream', start);
    if (end < 0) continue;
    try {
      const inflated = inflateSync(bytes.subarray(start, end)).toString('latin1');
      count += (inflated.match(PDF_PAGE_OBJECT) ?? []).length;
    } catch {
      // Not a Flate stream (an image, a font): no page objects in it.
    }
  }
  return count;
}

export function isPdf(bytes: Buffer): boolean {
  return bytes.subarray(0, 5).toString('latin1') === '%PDF-';
}

/** XLSX (and every Office Open XML file) is a ZIP archive. */
export function isXlsx(bytes: Buffer): boolean {
  return bytes.subarray(0, 2).toString('latin1') === 'PK';
}

/** Rows of a CSV file (simple split; good enough for counting and searching). */
export function csvRows(text: string): string[] {
  return text
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '');
}

/* ---------------------------------------------------------------- files */

/** A 1×1 PNG, for photo and logo uploads. */
export const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

/** A one-page PDF, for scan uploads. */
export const TINY_PDF = Buffer.from(
  [
    '%PDF-1.4',
    '1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj',
    '2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj',
    '3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 200 200]>> endobj',
    'trailer <</Root 1 0 R>>',
    '%%EOF',
    '',
  ].join('\n'),
  'latin1',
);
