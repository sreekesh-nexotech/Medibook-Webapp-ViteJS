import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

import { bookingPatients, platformStaff, type PlatformRoleCode } from './support/accounts.ts';
import { fileExportRequest } from './support/ops.ts';
import { needs, uatStep } from './support/steps.ts';
import {
  dataRows,
  dialog,
  newBrowserSession,
  openNav,
  row,
  signIn,
  topbarTitle,
  type StaffSession,
} from './support/ui.ts';

/**
 * Report §4.6 — the other operations roles. Each one signs in and opens every
 * screen its sidebar offers: every screen loads with no refused read (403) and
 * no "no access" page (SEC-05, UAT-35, UAT-59). The sidebar each role gets is
 * its role template (backend `core/seeds/v1.py` PLATFORM_ROLES): banners stay
 * `settings.*` and review moderation `notifications.edit` (TEAM_BRIEF decision
 * 14); the plan-change list needs only `billing.view` (decision 13).
 */

test.describe.configure({ mode: 'serial' });

/** Sidebar label → the screen's title in the top bar (`app/layouts/ops-nav.ts` OPS_META). */
const SCREEN_TITLE: Readonly<Record<string, string>> = {
  Dashboard: 'Operations Dashboard',
  Hospitals: 'Hospital Management',
  Onboarding: 'Hospital Onboarding',
  Compliance: 'Compliance',
  'Subscription Plans': 'Subscription Plans',
  Billing: 'Billing',
  'Hospital Settlements': 'Hospital Settlements',
  'Usage Analytics': 'Usage Analytics',
  Reports: 'Reports',
  'Compliance Logs': 'Compliance Logs',
  'Users & Roles': 'Users & Roles',
  'Platform Users': 'Platform Users',
  Notifications: 'Notifications',
  'Review Moderation': 'Review Moderation',
  'Support Desk': 'Support Desk',
  'Platform Settings': 'Platform Settings',
  'Patient App Content': 'Patient App Content',
  'Message Templates': 'Message Templates',
  'Onboarding Documents': 'Onboarding Documents',
};

/** What each role's sidebar holds, in sidebar order. */
const SIDEBAR: Readonly<
  Record<'finance' | 'support' | 'compliance' | 'read_only', readonly string[]>
> = {
  finance: [
    'Hospitals',
    'Subscription Plans',
    'Billing',
    'Hospital Settlements',
    'Usage Analytics',
    'Reports',
  ],
  support: ['Hospitals', 'Compliance Logs', 'Platform Users', 'Review Moderation', 'Support Desk'],
  compliance: ['Compliance', 'Compliance Logs', 'Platform Users'],
  read_only: [
    'Dashboard',
    'Hospitals',
    'Onboarding',
    'Compliance',
    'Subscription Plans',
    'Billing',
    'Hospital Settlements',
    'Usage Analytics',
    'Reports',
    'Compliance Logs',
    'Users & Roles',
    'Platform Users',
    'Notifications',
    'Support Desk',
    'Platform Settings',
    'Patient App Content',
    'Message Templates',
    'Onboarding Documents',
  ],
};

const NO_ACCESS = "You don't have access to this screen";
const BILLING_TABS = ['Invoices', 'Payments', 'Subscriptions', 'Dunning', 'Plan Changes'] as const;

/** Buttons that change something (a read-only role must not be offered any of them). */
const CHANGE_ACTION =
  /^(Add|Create|New|Edit|Delete|Remove|Save(?! as PDF)|Approve|Reject|Archive|Restore|Suspend|Reactivate|Lift|Mark|Send|Queue|Close Period|Release|Record|Block|Unblock|Onboard|Go Live|Change|Update|Void|Issue|Reply|Assign|Resolve|Publish|Unlock|Re-send|Move|Prepare|Upload|Attach|Verify|Waive|Retry|Schedule)\b/;

/** Change controls a page offers: enabled, visible action buttons and switches. */
async function offeredChanges(page: Page): Promise<string[]> {
  const offered: string[] = [];
  for (const button of await page.getByRole('button', { name: CHANGE_ACTION }).all()) {
    if ((await button.isVisible()) && (await button.isEnabled())) {
      offered.push(
        `button "${((await button.getAttribute('aria-label')) ?? (await button.textContent()) ?? '').trim()}"`,
      );
    }
  }
  for (const toggle of await page.getByRole('switch').all()) {
    if ((await toggle.isVisible()) && (await toggle.isEnabled())) {
      offered.push(`switch "${(await toggle.getAttribute('aria-label')) ?? ''}"`);
    }
  }
  return offered;
}

interface WalkOptions {
  /** Fail when a screen offers a control that changes something. */
  readonly readOnly?: boolean;
}

/** The screen has loaded what it loads, says nothing about access, and (read-only) offers no change. */
async function checkScreen(
  session: StaffSession,
  where: string,
  options: WalkOptions,
): Promise<void> {
  await session.watch.settled();
  await expect(session.page.getByText(NO_ACCESS), `${where} is open to this role`).toHaveCount(0);
  if (options.readOnly) {
    expect(await offeredChanges(session.page), `${where} offers nothing to change`).toEqual([]);
  }
}

/** Open every sidebar entry, the first hospital's tabs and the billing tabs. */
async function walkConsole(
  session: StaffSession,
  expected: readonly string[],
  options: WalkOptions = {},
): Promise<void> {
  const { page } = session;
  const nav = page.getByRole('navigation').getByRole('button');
  await expect
    .poll(async () => (await nav.allTextContents()).map((t) => t.trim()), {
      message: 'the sidebar offers exactly this role’s screens',
    })
    .toEqual([...expected]);
  for (const label of expected) {
    await openNav(page, label);
    await expect(topbarTitle(page)).toHaveText(needs(SCREEN_TITLE[label], `a title for ${label}`));
    await checkScreen(session, label, options);
  }
  if (expected.includes('Hospitals')) {
    await openNav(page, 'Hospitals');
    await page.getByRole('button', { name: 'View hospital' }).first().click();
    await expect(topbarTitle(page)).toHaveText('Hospital Profile');
    const tabs = page.getByRole('tablist', { name: 'Hospital profile' }).getByRole('tab');
    for (const tab of (await tabs.allTextContents()).map((t) => t.trim())) {
      await page.getByRole('tab', { name: tab, exact: true }).click();
      await checkScreen(session, `Hospital profile › ${tab}`, options);
    }
  }
  if (expected.includes('Billing')) {
    await openNav(page, 'Billing');
    for (const tab of BILLING_TABS) {
      await page.getByRole('tab', { name: tab, exact: true }).click();
      await checkScreen(session, `Billing › ${tab}`, options);
    }
    await page.getByRole('tab', { name: 'Invoices', exact: true }).click();
    await page.getByRole('button', { name: 'View invoice' }).first().click();
    await expect(topbarTitle(page)).toHaveText('Invoice Detail');
    await checkScreen(session, 'Invoice detail', options);
  }
}

/** Sign `role` in through the Operations tab; lands on the role's first screen. */
async function signInRole(
  browser: Browser,
  role: PlatformRoleCode,
  contexts: BrowserContext[],
): Promise<StaffSession> {
  const account = platformStaff(role);
  const s = await newBrowserSession(browser, role);
  contexts.push(s.context);
  s.watch.begin();
  await signIn(s.page, 'platform', account.email);
  await expect(s.page).toHaveURL(/\/ops\//);
  return { ...s, email: account.email };
}

function throwProblems(session: StaffSession): void {
  const problems = session.watch.problems();
  if (problems.length > 0) throw new Error(`Unexpected errors:\n${problems.join('\n')}`);
}

test('4.6 Other operations roles', async ({ browser }) => {
  const contexts: BrowserContext[] = [];
  const patient = needs(
    bookingPatients().find((p) => p.email),
    'a seeded patient with an email address',
  );
  const patientEmail = needs(patient.email, 'a patient email');
  let current: StaffSession | null = null;
  const pages = (): Page[] => (current ? [current.page] : []);

  /* P-1 ------------------------------------------------------------------ */
  await uatStep('P-1', { pages }, async () => {
    const s = await signInRole(browser, 'finance', contexts);
    current = s;
    await expect(s.page).toHaveURL(/\/ops\/hospitals$/);
    await walkConsole(s, SIDEBAR.finance);
    // Finance work is offered, e.g. closing a settlement period.
    await openNav(s.page, 'Hospital Settlements');
    await expect(s.page.getByRole('button', { name: 'Close Period' })).toBeEnabled();
    throwProblems(s);
  });

  /* P-2 ------------------------------------------------------------------ */
  await uatStep('P-2', { pages }, async () => {
    const s = await signInRole(browser, 'support', contexts);
    current = s;
    const { page } = s;
    await walkConsole(s, SIDEBAR.support);
    // Tickets: open one and answer it from the drawer.
    await openNav(page, 'Support Desk');
    await page
      .getByRole('button', { name: /^Open ticket / })
      .first()
      .click();
    const drawer = page
      .getByRole('dialog')
      .filter({ has: page.getByRole('heading', { name: 'Conversation' }) });
    await expect(drawer.getByRole('textbox', { name: 'Reply' })).toBeVisible();
    await page.keyboard.press('Escape');
    // Patient accounts: found by exact email, read-only (no block for support).
    await openNav(page, 'Platform Users');
    await page
      .getByRole('textbox', { name: 'Search patient accounts by email or phone' })
      .fill(patientEmail);
    await page.getByTitle(`View ${patient.name}'s account`, { exact: true }).click();
    await expect(topbarTitle(page)).toHaveText('Patient Account');
    await s.watch.settled();
    await expect(page.getByRole('button', { name: 'Block Account' })).toHaveCount(0);
    throwProblems(s);
  });

  /* P-3 ------------------------------------------------------------------ */
  await uatStep('P-3', { pages }, async () => {
    const s = await signInRole(browser, 'compliance', contexts);
    current = s;
    const { page } = s;
    const officer = platformStaff('compliance');
    await walkConsole(s, SIDEBAR.compliance);
    // A data request is recorded and listed with the subject's and requester's names.
    await openNav(page, 'Compliance');
    await page.getByRole('tab', { name: 'Export on Request' }).click();
    const requestNo = await fileExportRequest(page, { email: patientEmail, name: patient.name });
    const listed = row(page, requestNo);
    await expect(listed).toContainText(patient.name);
    await expect(listed).toContainText(officer.name);
    await listed.click();
    const drawer = dialog(page, requestNo);
    await expect(drawer).toContainText(patient.name);
    await page.keyboard.press('Escape');
    // Log rows carry hospital and actor names, not ids (appendix 12 F17).
    await openNav(page, 'Compliance Logs');
    await s.watch.settled();
    const hospitals = await dataRows(page, 'Compliance log entries')
      .locator('td:nth-child(3)')
      .allTextContents();
    expect(hospitals.length, 'the audit trail has rows').toBeGreaterThan(0);
    expect(
      hospitals.filter((h) => /^[0-9a-f]{6,}/i.test(h.trim())),
      'hospitals are named, not shown as ids',
    ).toEqual([]);
    throwProblems(s);
  });

  /* P-4 ------------------------------------------------------------------ */
  await uatStep('P-4', { pages }, async () => {
    const s = await signInRole(browser, 'read_only', contexts);
    current = s;
    await expect(s.page).toHaveURL(/\/ops\/dashboard$/);
    await walkConsole(s, SIDEBAR.read_only, { readOnly: true });
    throwProblems(s);
  });

  for (const context of contexts) await context.close();
});
