import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';

import {
  bookingPatients,
  hospitalName,
  hospitalStaff,
  platformStaff,
  rememberPassword,
  seededHospitalNames,
} from './support/accounts.ts';
import { ApiClient, type Page as ApiPage } from './support/api.ts';
import {
  bookOnlineSoon,
  disposePatients,
  hospitalDoctors,
  runTag,
  waitForOnlineSlots,
  type HospitalDoctor,
} from './support/booking.ts';
import { appointmentSearch } from './support/desk.ts';
import { waitForDevToken } from './support/devTokens.ts';
import { UAT_ENV } from './support/env.ts';
import { needs, uatStep } from './support/steps.ts';
import { spendSignIn } from './support/throttle.ts';
import { addDays, fmtDate, isoDateIn, mondayOf, rupees, todayIso } from './support/time.ts';
import { fileExportRequest } from './support/ops.ts';
import {
  cardWith,
  csvRows,
  dataRows,
  dialog,
  download,
  escapeRegExp,
  isCall,
  isXlsx,
  loginForm,
  newBrowserSession,
  openNav,
  row,
  selectFirstReal,
  signIn,
  signOut,
  TINY_PDF,
  TINY_PNG,
  toast,
  topbarTitle,
  type StaffSession,
} from './support/ui.ts';

/**
 * Report §4.5 — Operations (owner `kavya.iyer`).
 * O-2..O-5 follow one hospital from onboarding to live and back: its first
 * administrator accepts, the checklist is verified, it goes live open to
 * patients, takes a booking, and is suspended (writes refused, staff still
 * sign in and read — TEAM_BRIEF decision 9) and reactivated. New hospitals
 * get the `{SRC}{SEQ:3}` token format at onboarding (decision 8). O-7: the
 * plan-change list needs only `billing.view` (decision 13).
 */

test.describe.configure({ mode: 'serial' });

const OWNER = platformStaff('owner');
const NEW_ADMIN_PASSWORD = 'Uat#NewHospital-Admin-41';
const NEW_OPS_PASSWORD = 'Uat#Ops-Colleague-63';
const TEST_GST_PERCENT = '12';
const TEST_GST_BP = 1_200;
const NEW_COMMISSION = '12.5';
const NEW_FEE_RUPEES = 25;
const PLAN_PRICE = 2_500;
const PLAN_PRICE_EDITED = 2_750;
const TRIAL_DAYS = 14;
const GRACE_EXTRA_DAYS = 10;
const LISTING_WAIT_MS = 60_000;
const REMINDER_WAIT_MS = 120_000;
const QUOTE_WAIT_MS = 90_000;
const POLL_MS = 2_000;
const SESSION_START = '07:00';
const SESSION_END = '22:00';
const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

/* ------------------------------------------------------------- API shapes */

interface HospitalDetailDto {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly subscription: {
    readonly status: string;
    readonly plan_id: string;
    readonly billing_period: 'monthly' | 'yearly';
    readonly trial_ends_at: string | null;
  } | null;
}

interface CaseDto {
  readonly id: string;
  readonly stage: string;
}

interface CaseDetailDto {
  readonly id: string;
  readonly stage: string;
  readonly checklist: readonly {
    readonly code: string;
    readonly name: string;
    readonly status: string;
  }[];
}

interface InvoiceDto {
  readonly id: string;
  readonly invoice_no: string;
  readonly hospital_id: string;
  readonly hospital_name: string;
  readonly status: string;
  readonly due_at: string;
  readonly total_paise: number;
  readonly amount_paid_paise: number;
}

interface PlanChangeDto {
  readonly id: string;
  readonly hospital_id: string;
  readonly status: string;
}

interface ReportDefDto {
  readonly code: string;
  readonly title: string;
  readonly filters: readonly { readonly key: string; readonly kind: string }[];
  readonly columns: readonly { readonly key: string; readonly label: string }[];
}

interface PayoutDto {
  readonly id: string;
  readonly status: string;
  readonly utr_ref: string | null;
}

interface ScheduleChange {
  readonly preview_token?: string | null;
}

interface QuoteDto {
  readonly lines: readonly { readonly line: string; readonly tax_rate_bp: number }[];
}

interface TaxLineDto {
  readonly line: string;
  readonly rate_bp: number;
}

/** The hospital O-2 onboards and the later steps run. */
interface NewHospital {
  readonly id: string;
  readonly name: string;
  readonly adminEmail: string;
}

interface OnboardInput {
  readonly name: string;
  readonly prefix: string;
  readonly adminEmail: string;
  readonly adminLastName: string;
  readonly planName?: string;
}

/* ---------------------------------------------------------------- helpers */

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Ten digits of an Indian mobile, as a person types it. */
function mobileDigits(): string {
  const MOBILE_DIGITS = 9;
  return `9${String(Math.floor(Math.random() * 10 ** MOBILE_DIGITS)).padStart(MOBILE_DIGITS, '0')}`;
}

/** Hospitals › Onboard Hospital, filled the way an operator would; returns the new hospital's id. */
async function onboardOnScreen(page: Page, h: OnboardInput): Promise<string> {
  await openNav(page, 'Hospitals');
  await page.getByRole('button', { name: 'Onboard Hospital' }).click();
  const form = dialog(page, 'Onboard Hospital');
  await form.getByLabel(/^Hospital Name/).fill(h.name);
  await form
    .getByLabel(/^Hospital Email/)
    .fill(`desk.${h.prefix.toLowerCase()}@uat-hospital.example.com`);
  await form.getByLabel(/^Hospital Phone/).fill(mobileDigits());
  await form.getByLabel(/^Address/).fill('14 Marine Drive');
  await form.getByLabel(/^City/).fill('Kochi');
  await form.getByLabel(/^State/).fill('Kerala');
  await form.getByLabel(/^PIN Code/).fill('682031');
  const plan = form.getByRole('combobox', { name: /^Subscription Plan/ });
  if (h.planName) await plan.selectOption({ label: h.planName });
  else await selectFirstReal(plan);
  await form.getByLabel(/^Commission \(%\)/).fill('10');
  await form.getByLabel(/^Amount/).fill('20');
  await form.getByLabel(/^Number Prefix/).fill(h.prefix);
  await form.getByLabel(/^First Name/).fill('Meenakshi');
  await form.getByLabel(/^Last Name/).fill(h.adminLastName);
  await form.getByLabel(/^Email/).fill(h.adminEmail);
  const [response] = await Promise.all([
    page.waitForResponse(isCall('POST', /^\/api\/v1\/platform\/hospitals$/)),
    form.getByRole('button', { name: 'Onboard Hospital' }).click(),
  ]);
  expect(response.status(), 'the hospital is provisioned').toBe(201);
  const created = (await response.json()) as { readonly hospital: { readonly id: string } };
  await expect(
    toast(page, `${h.name} onboarded. Its administrator has been invited.`),
  ).toBeVisible();
  await expect(topbarTitle(page)).toHaveText('Hospital Profile');
  return created.hospital.id;
}

/** Open a hospital's profile from the registry search. */
async function openHospital(page: Page, name: string): Promise<void> {
  await openNav(page, 'Hospitals');
  await page.getByRole('textbox', { name: /Search hospital name/ }).fill(name);
  await page.getByTitle(`Open ${name}`, { exact: true }).click();
  await expect(topbarTitle(page)).toHaveText('Hospital Profile');
}

/** One "Commercial Terms" entry (label, value, sub line, Change button). */
function commercialTerm(page: Page, label: string): Locator {
  return page.getByText(label, { exact: true }).locator('xpath=../..');
}

/**
 * The new hospital's first doctor, sessions on every weekday and a payout
 * account, made by its own administrator through the hospital API — the
 * hospital-side setup the operations script assumes before go-live.
 */
async function setUpNewHospital(api: ApiClient, tag: string): Promise<HospitalDoctor> {
  await api.post('/billing/bank-accounts', {
    account_holder: `Uat Care ${tag}`,
    account_number: `5010${String(Date.now()).slice(-10)}`,
    ifsc: 'HDFC0001234',
    bank_name: 'HDFC Bank',
    is_primary: true,
  });
  const department = await api.post<{ readonly id: string }>('/departments', {
    name: 'General Medicine',
  });
  const doctor = await api.post<HospitalDoctor>('/doctors', {
    department_id: department.id,
    name: `Dr. Uat Onboard ${tag}`,
    specialisation: 'General Physician',
    consultation_fee_paise: 50_000,
    slot_length_min: 15,
    status: 'active',
    is_bookable_online: true,
  });
  const sessions = WEEKDAYS.map((weekday) => ({
    weekday,
    session_code: 'custom-1',
    label: 'OPD',
    starts_at: SESSION_START,
    ends_at: SESSION_END,
  }));
  const path = `/doctors/${doctor.id}/weekly-sessions`;
  const dry = await api.put<ScheduleChange>(
    path,
    { sessions },
    {
      ifMatch: doctor.version,
      params: { confirm: false },
    },
  );
  await api.put(
    path,
    { sessions },
    {
      ifMatch: doctor.version,
      params: { confirm: true, ...(dry.preview_token ? { preview_token: dry.preview_token } : {}) },
    },
  );
  return doctor;
}

/** The settlements screen's card for payout run `runNo`. */
function runCardOf(page: Page, runNo: string): Locator {
  return cardWith(
    page,
    page.getByRole('heading', { name: new RegExp(`^Payout run ${escapeRegExp(runNo)} · `) }),
    page.getByRole('region', { name: 'Statements in this payout run' }),
  );
}

/** Reload the page until `done` holds (a background job finishes); fails after `waitMs`. */
async function reloadUntil(
  session: StaffSession,
  done: () => Promise<boolean>,
  waitMs: number,
): Promise<void> {
  const deadline = Date.now() + waitMs;
  while (!(await done())) {
    if (Date.now() > deadline)
      throw new Error(`Still not done after ${waitMs / 1000}s of reloading.`);
    await sleep(POLL_MS);
    await session.page.reload();
    await expect(topbarTitle(session.page)).toBeVisible();
    await session.watch.settled();
  }
}

/* ------------------------------------------------------------------- test */

test('4.5 Operations — owner', async ({ browser }) => {
  const tag = runTag();
  const today = todayIso();
  const lakeshoreAdmin = hospitalStaff('lakeshore', 'admin');
  const lakeshoreName = hospitalName('lakeshore');
  const owner = await ApiClient.staff('platform', OWNER.email);
  const lakeshoreApi = await ApiClient.staff('hospital', lakeshoreAdmin.email);
  const lakeshoreId = (
    await lakeshoreApi.get<{ readonly hospital: { readonly id: string } }>('/me')
  ).hospital.id;
  const patient = needs(
    bookingPatients().find((p) => p.email),
    'a seeded patient with an email address',
  );

  let ops: StaffSession | null = null;
  let newAdmin: StaffSession | null = null;
  let newAdminApi: ApiClient | null = null;
  let hospital: NewHospital | null = null;
  let newDoctor: HospitalDoctor | null = null;
  const contexts: BrowserContext[] = [];
  const pages = () => [ops, newAdmin].flatMap((s) => (s ? [s.page] : []));
  const watch = () => [ops, newAdmin].flatMap((s) => (s ? [s.watch] : []));

  /* O-1 ------------------------------------------------------------------ */
  await uatStep('O-1', { pages }, async () => {
    const s = await newBrowserSession(browser, 'owner');
    ops = { ...s, email: OWNER.email };
    s.watch.begin();
    await signIn(s.page, 'platform', OWNER.email);
    await expect(s.page).toHaveURL(/\/ops\/dashboard$/);
    await expect(topbarTitle(s.page)).toHaveText('Operations Dashboard');
    await expect(s.page.getByRole('heading', { name: 'Critical Alerts' })).toBeVisible();
    await s.watch.settled();
    // BE-30: an unreconciled-cash alert names the hospitals, not an id fragment.
    const cashAlert = s.page.getByText(/cash sessions? unreconciled for over a day/);
    if ((await cashAlert.count()) > 0) {
      const sub = cashAlert.first().locator('xpath=following-sibling::*[1]');
      await expect(sub).toContainText(
        new RegExp(seededHospitalNames().map(escapeRegExp).join('|')),
      );
      await expect(sub).not.toContainText(/\b[0-9a-f]{8}\b/);
    }
    // UAT-44: signing out returns to the Operations sign-in tab.
    await signOut(s.page, OWNER.name);
    await expect(loginForm(s.page).opsTab).toHaveAttribute('aria-pressed', 'true');
    await signIn(s.page, 'platform', OWNER.email);
    await expect(topbarTitle(s.page)).toHaveText('Operations Dashboard');
    const problems = s.watch.problems();
    if (problems.length > 0) throw new Error(problems.join('\n'));
  });

  /* O-2 ------------------------------------------------------------------ */
  await uatStep('O-2', { watch: watch(), pages }, async () => {
    const { page } = needs(ops, 'O-1');
    const name = `Uat Care Hospital ${tag}`;
    const adminEmail = `uat.admin.${tag.toLowerCase()}${Date.now() % 100_000}@uat-hospital.example.com`;
    const since = new Date();
    const id = await onboardOnScreen(page, {
      name,
      prefix: `U${tag.toUpperCase()}`,
      adminEmail,
      adminLastName: `Uat${tag}`,
    });
    hospital = { id, name, adminEmail };

    // The first administrator accepts from the emailed link (E1, E3).
    const invite = await waitForDevToken(adminEmail, 'invitation', since);
    expect(invite.link, 'the emailed link opens the web app').toMatch(
      new RegExp(`^${escapeRegExp(UAT_ENV.baseUrl)}/accept-invite\\?token=`),
    );
    const admin = await newBrowserSession(browser, 'new-admin');
    contexts.push(admin.context);
    admin.watch.begin();
    await admin.page.goto(invite.link);
    await expect(admin.page.getByText(/You've been invited as/)).toBeVisible();
    await admin.page.getByLabel('Password', { exact: true }).fill(NEW_ADMIN_PASSWORD);
    await admin.page.getByLabel('Confirm Password', { exact: true }).fill(NEW_ADMIN_PASSWORD);
    await spendSignIn(adminEmail);
    await admin.page.getByRole('button', { name: 'Accept & Sign In' }).click();
    await expect(admin.page).toHaveURL(/\/admin\/dashboard$/);
    rememberPassword(adminEmail, NEW_ADMIN_PASSWORD);
    newAdmin = { ...admin, email: adminEmail };

    // Operations moves the case on to the documents stage.
    await openNav(page, 'Onboarding');
    await page.getByRole('textbox', { name: /Search applicant hospital by name/ }).fill(name);
    await page
      .getByRole('button', { name: new RegExp(`^${escapeRegExp(name)}`) })
      .first()
      .click();
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    await page
      .getByRole('combobox', { name: 'Onboarding stage', exact: true })
      .selectOption('Documents requested');
    await expect(toast(page, 'Moved to Documents requested.')).toBeVisible();
    const cases = await owner.get<ApiPage<CaseDto>>('/onboarding/cases', { hospital_id: id });
    expect(cases.results[0]?.stage, 'the case is waiting on documents').toBe('documents_pending');
    const problems = admin.watch.problems();
    if (problems.length > 0) throw new Error(problems.join('\n'));
  });

  /* O-3 ------------------------------------------------------------------ */
  await uatStep('O-3', { watch: watch(), pages }, async () => {
    const { page } = needs(ops, 'O-1');
    const h = needs(hospital, 'O-2');
    newAdminApi = await ApiClient.staff('hospital', h.adminEmail);
    newDoctor = await setUpNewHospital(newAdminApi, tag);

    const caseRow = needs(
      (await owner.get<ApiPage<CaseDto>>('/onboarding/cases', { hospital_id: h.id })).results[0],
      'the onboarding case',
    );
    const detail = await owner.get<CaseDetailDto>(`/onboarding/cases/${caseRow.id}`);
    expect(detail.checklist.length, 'the default checklist is on the case').toBeGreaterThan(0);
    await page.reload();
    await expect(page.getByRole('heading', { name: h.name, exact: true })).toBeVisible();
    for (const [i, item] of detail.checklist.entries()) {
      if (i === 0) {
        // A scan of the first document, handed over in person (ENV-02).
        const [chooser] = await Promise.all([
          page.waitForEvent('filechooser'),
          page.getByRole('button', { name: `Attach scan of ${item.name}`, exact: true }).click(),
        ]);
        await chooser.setFiles({
          name: 'kyc-scan.pdf',
          mimeType: 'application/pdf',
          buffer: TINY_PDF,
        });
        await expect(toast(page, `Scan attached to ${item.name}.`)).toBeVisible();
      } else {
        await page.getByTitle(`Mark ${item.name} received (no scan)`, { exact: true }).click();
        await expect(toast(page, `${item.name} marked received.`)).toBeVisible();
      }
      await page.getByTitle(`Verify ${item.name}`, { exact: true }).click();
      await expect(toast(page, `${item.name} verified.`)).toBeVisible();
    }
    await expect(page.getByRole('button', { name: 'Download scan' })).toBeVisible();

    await page.getByRole('button', { name: 'Approve', exact: true }).click();
    await expect(toast(page, `${h.name} approved — waiting on go-live.`)).toBeVisible();
    await expect(page.getByText('Ready to go live — nothing is blocking')).toBeVisible();
    await page.getByRole('button', { name: 'Go Live', exact: true }).click();
    const confirm = dialog(page, 'Take this hospital live?');
    await expect(confirm.getByRole('switch', { name: 'Open to patients now' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await confirm.getByRole('button', { name: 'Go Live', exact: true }).click();
    await expect(toast(page, `${h.name} is live and taking online bookings.`)).toBeVisible();

    // Listed in the patient app.
    const anonymous = await ApiClient.anonymous();
    try {
      await expect
        .poll(
          async () =>
            (
              await anonymous.get<ApiPage<{ readonly name: string }>>('/patient/hospitals', {
                q: h.name,
              })
            ).results.map((r) => r.name),
          { timeout: LISTING_WAIT_MS, message: 'the patient app lists the new hospital' },
        )
        .toContain(h.name);
    } finally {
      await anonymous.dispose();
    }
  });

  /* O-4 ------------------------------------------------------------------ */
  await uatStep('O-4', { watch: watch(), pages }, async () => {
    const admin = needs(newAdmin, 'O-2');
    const doctor = needs(newDoctor, 'O-3');
    await waitForOnlineSlots(doctor.id, addDays(today, 1));
    const booking = await bookOnlineSoon(doctor.id, 'checkout');
    // Decision 8: a new hospital's token format is `{SRC}{SEQ:3}` — the online marker leads.
    const policy = await needs(newAdminApi, 'O-3').get<{ readonly online_marker?: string }>(
      '/token-policy',
    );
    const marker = needs(policy.online_marker, 'the online token marker');
    expect(booking.appointment.token_label ?? '', 'the token carries the online marker').toMatch(
      new RegExp(`^${escapeRegExp(marker)}\\d{3}$`),
    );

    const { page } = admin;
    await page.reload();
    await openNav(page, 'Appointments');
    await page.getByRole('combobox', { name: 'Filter by date' }).selectOption('Upcoming');
    await appointmentSearch(page).fill(booking.appointment.booking_ref);
    const line = row(page, booking.personName);
    await expect(line).toHaveCount(1);
    await expect(line.getByText(doctor.name)).toBeVisible();
  });

  /* O-5 ------------------------------------------------------------------ */
  await uatStep(
    'O-5',
    {
      watch: watch(),
      pages,
      allow: [
        {
          status: 403,
          path: /^(POST|PUT|PATCH|DELETE) \/api\/v1\/hospital\//,
          why: 'the suspended hospital refuses writes (decision 9)',
        },
      ],
    },
    async () => {
      const { page } = needs(ops, 'O-1');
      const h = needs(hospital, 'O-2');
      const admin = needs(newAdmin, 'O-2');
      const adminApi = needs(newAdminApi, 'O-3');
      const tomorrow = addDays(today, 1);
      await openHospital(page, h.name);
      await page.getByRole('tab', { name: 'Billing & Settlements' }).click();

      // Commission from tomorrow: shown as scheduled before it applies (API-01).
      await commercialTerm(page, 'Platform commission')
        .getByRole('button', { name: 'Change' })
        .click();
      const commission = dialog(page, `Commission for ${h.name}`);
      await commission.getByLabel(/^Commission \(%\)/).fill(NEW_COMMISSION);
      await commission.getByLabel(/^Starts On/).fill(tomorrow);
      await commission.getByRole('button', { name: 'Save Commission' }).click();
      await expect(
        toast(
          page,
          `Commission for ${h.name} changes to ${NEW_COMMISSION}% on ${fmtDate(tomorrow)}.`,
        ),
      ).toBeVisible();
      await expect(commercialTerm(page, 'Platform commission')).toContainText(
        `Changes to ${NEW_COMMISSION}% from ${fmtDate(tomorrow)}.`,
      );

      // The patient convenience fee.
      await commercialTerm(page, 'Patient convenience fee')
        .getByRole('button', { name: 'Change' })
        .click();
      const fee = dialog(page, `Convenience fee for ${h.name}`);
      await fee.getByLabel(/^Amount \(₹\)/).fill(String(NEW_FEE_RUPEES));
      await fee.getByRole('button', { name: 'Save Fee' }).click();
      const feeCopy = `${rupees(NEW_FEE_RUPEES)} per booking`;
      await expect(toast(page, `Convenience fee for ${h.name} is now ${feeCopy}.`)).toBeVisible();
      await expect(commercialTerm(page, 'Patient convenience fee')).toContainText(feeCopy);

      // Suspend: staff still sign in and read; every write is refused.
      await page.getByRole('button', { name: 'Suspend Instance' }).click();
      const suspend = dialog(page, 'Suspend this hospital?');
      await suspend.getByRole('combobox', { name: 'Reason' }).selectOption('Compliance');
      await suspend
        .getByLabel('Note (kept on the record)')
        .fill(`UAT ${tag}: licence renewal pending`);
      await suspend.getByRole('button', { name: 'Suspend Instance' }).click();
      await expect(toast(page, `${h.name} suspended.`)).toBeVisible();
      // Staff can still sign in (decision 9) …
      const signedIn = await ApiClient.staff('hospital', h.adminEmail);
      await signedIn.dispose();
      // … and read, with the reason shown.
      await admin.page.reload();
      await expect(admin.page.getByText('This hospital is suspended')).toBeVisible();
      await expect(topbarTitle(admin.page)).toBeVisible();
      const refused = await adminApi.statusOf('POST', '/departments', {
        name: 'Refused while suspended',
      });
      expect(refused, 'writes are refused while suspended').toEqual({
        status: 403,
        code: 'HOSPITAL_SUSPENDED',
      });

      await page.getByRole('button', { name: 'Reactivate Instance' }).click();
      await dialog(page, 'Reactivate this hospital?')
        .getByRole('button', { name: 'Reactivate' })
        .click();
      await expect(toast(page, `${h.name} reactivated.`)).toBeVisible();
      await admin.page.reload();
      await expect(topbarTitle(admin.page)).toBeVisible();
      await expect(admin.page.getByText('This hospital is suspended')).toHaveCount(0);
      const detail = await owner.get<HospitalDetailDto>(`/hospitals/${h.id}`);
      expect(detail.status, 'the hospital is active again').toBe('active');
    },
  );

  /* O-6 ------------------------------------------------------------------ */
  await uatStep('O-6', { watch: watch(), pages }, async () => {
    const { page } = needs(ops, 'O-1');
    const planName = `UAT Plan ${tag}`;
    await openNav(page, 'Subscription Plans');
    await page.getByRole('button', { name: 'Create Plan' }).click();
    const create = dialog(page, 'Create Plan');
    await create.getByLabel(/^Plan Name/).fill(planName);
    await create.getByLabel(/^Monthly Price/).fill(String(PLAN_PRICE));
    // Trial Days is left alone: the platform default applies (BE-11).
    await expect(create.getByLabel(/^Trial Days/)).toHaveValue(String(TRIAL_DAYS));
    await create.getByRole('button', { name: 'Create Plan' }).click();
    await expect(toast(page, `Plan "${planName}" created.`)).toBeVisible();
    const card = () =>
      cardWith(
        page,
        page.getByRole('heading', { name: planName, exact: true }),
        page.getByTitle(`Edit ${planName}`, { exact: true }),
      );
    await expect(card()).toContainText(`${TRIAL_DAYS}-day trial`);

    // A hospital onboarded on the plan starts on a 14-day trial, not an invoice (UAT-14).
    const trialName = `Uat Trial Clinic ${tag}`;
    const trialId = await onboardOnScreen(page, {
      name: trialName,
      prefix: `T${tag.toUpperCase()}`,
      adminEmail: `uat.trial.${tag.toLowerCase()}${Date.now() % 100_000}@uat-hospital.example.com`,
      adminLastName: `Trial${tag}`,
      planName,
    });
    await page.getByRole('tab', { name: 'Billing & Settlements' }).click();
    await expect(page.getByText(/^trialing · billed monthly/)).toBeVisible();
    const trial = await owner.get<HospitalDetailDto>(`/hospitals/${trialId}`);
    const sub = needs(trial.subscription, 'the trial hospital subscription');
    expect(sub.status).toBe('trialing');
    expect(
      isoDateIn(new Date(needs(sub.trial_ends_at, 'a trial end'))),
      'the trial runs 14 days',
    ).toBe(addDays(today, TRIAL_DAYS));

    // Edit, then archive.
    await openNav(page, 'Subscription Plans');
    await page.getByTitle(`Edit ${planName}`, { exact: true }).click();
    const edit = dialog(page, `Edit ${planName}`);
    await edit.getByLabel(/^Monthly Price/).fill(String(PLAN_PRICE_EDITED));
    await edit.getByRole('button', { name: 'Save Plan' }).click();
    await expect(toast(page, `Plan "${planName}" updated.`)).toBeVisible();
    await expect(card()).toContainText(rupees(PLAN_PRICE_EDITED));
    await card().getByRole('button', { name: 'Archive plan' }).click();
    await dialog(page, 'Archive this plan?').getByRole('button', { name: 'Archive Plan' }).click();
    await expect(toast(page, `Plan "${planName}" archived.`)).toBeVisible();
    await expect(card()).toContainText(/Archived/i);
  });

  /* O-7 ------------------------------------------------------------------ */
  await uatStep('O-7', { watch: watch(), pages }, async () => {
    const { page } = needs(ops, 'O-1');
    // A plan change waiting for review (C-6 leaves Lakeshore's; make one if none is pending).
    let pending = await owner.all<PlanChangeDto>('/billing/plan-change-requests', {
      status: 'requested',
    });
    if (pending.length === 0) {
      const current = needs(
        (await owner.get<HospitalDetailDto>(`/hospitals/${lakeshoreId}`)).subscription,
        "Lakeshore's subscription",
      );
      await lakeshoreApi.post('/billing/plan-change-requests', {
        to_plan_id: current.plan_id,
        to_billing_period: current.billing_period === 'monthly' ? 'yearly' : 'monthly',
        note: `UAT ${tag}: other billing cycle`,
      });
      pending = await owner.all<PlanChangeDto>('/billing/plan-change-requests', {
        status: 'requested',
      });
    }
    expect(pending.length, 'a plan change is waiting for review').toBeGreaterThan(0);

    await openNav(page, 'Billing');
    await page.getByRole('tab', { name: 'Plan Changes' }).click();
    await page
      .getByRole('combobox', { name: 'Filter plan changes by status' })
      .selectOption('Requested');
    // The request may be newer than the list this browser read moments ago (the
    // Plans screen reads the same list): refresh, as a tester would.
    await page.getByRole('button', { name: 'Refresh plan changes' }).click();
    await page.getByRole('button', { name: 'Approve plan change' }).first().click();
    await dialog(page, 'Approve this plan change?')
      .getByRole('button', { name: 'Approve Change' })
      .click();
    await expect(toast(page, /^Plan changed to /)).toBeVisible();
    const changed = dialog(page, 'Plan changed');
    await expect(changed.getByText(/The hospital is now on /)).toBeVisible();
    await changed.getByRole('button', { name: 'Done' }).click();

    // An unpaid invoice: a read-only hospital's first (paying reinstates it), else any.
    const open = [
      ...(await owner.all<InvoiceDto>('/billing/invoices', { status: 'overdue' })),
      ...(await owner.all<InvoiceDto>('/billing/invoices', { status: 'issued' })),
    ];
    let invoice: InvoiceDto | null = null;
    for (const candidate of open) {
      const h = await owner.get<HospitalDetailDto>(`/hospitals/${candidate.hospital_id}`);
      if (h.subscription?.status === 'read_only') {
        invoice = candidate;
        break;
      }
    }
    invoice ??= open[0] ?? null;
    const inv = needs(invoice, 'an unpaid subscription invoice');

    await page.getByRole('tab', { name: 'Invoices' }).click();
    await page.getByRole('textbox', { name: /Search invoice number/ }).fill(inv.invoice_no);
    await row(page, inv.invoice_no).first().click();
    await expect(topbarTitle(page)).toHaveText('Invoice Detail');

    // A reminder is queued and then shows as sent (UAT-56).
    const sentBadges = () =>
      page.getByRole('region', { name: 'Reminder history' }).getByText('Sent', { exact: true });
    await expect(page.getByRole('region', { name: 'Reminder history' })).toBeVisible();
    await needs(ops, 'O-1').watch.settled();
    const sentBefore = await sentBadges().count();
    await page.getByRole('button', { name: 'Send Reminder' }).click();
    await dialog(page, `Queue a payment reminder for ${inv.invoice_no}?`)
      .getByRole('button', { name: 'Queue Reminder' })
      .click();
    await expect(toast(page, `Reminder queued for ${inv.invoice_no}.`)).toBeVisible();
    await reloadUntil(
      needs(ops, 'O-1'),
      async () => (await sentBadges().count()) > sentBefore,
      REMINDER_WAIT_MS,
    );

    // The grace window is extended.
    const graceEnd = addDays(
      inv.due_at.slice(0, 10) > today ? inv.due_at.slice(0, 10) : today,
      GRACE_EXTRA_DAYS,
    );
    await page.getByRole('button', { name: 'Grace Window' }).click();
    const grace = dialog(page, `Grace window for ${inv.invoice_no}`);
    await grace.getByLabel(/^Grace Ends On/).fill(graceEnd);
    await grace.getByRole('button', { name: 'Save Grace Window' }).click();
    await expect(
      toast(page, `Grace window for ${inv.invoice_no} now ends ${fmtDate(graceEnd)}.`),
    ).toBeVisible();

    // Paid in full; the hospital is no longer read-only.
    await page.getByRole('button', { name: 'Mark as Paid', exact: true }).click();
    const paid = dialog(page, `Mark ${inv.invoice_no} as paid`);
    await paid.getByLabel(/^Reference/).fill(`NEFT-UAT-${tag}`);
    await paid.getByRole('button', { name: 'Record Payment' }).click();
    await expect(
      toast(page, new RegExp(`^${escapeRegExp(inv.invoice_no)} marked paid`)),
    ).toBeVisible();
    const after = await owner.get<InvoiceDto>(`/billing/invoices/${inv.id}`);
    expect(after.status, 'the invoice is paid').toBe('paid');
    const reinstated = await owner.get<HospitalDetailDto>(`/hospitals/${inv.hospital_id}`);
    expect(reinstated.subscription?.status, 'the hospital is reinstated').not.toBe('read_only');
    expect(reinstated.status).not.toBe('suspended');
  });

  /* O-8 ------------------------------------------------------------------ */
  await uatStep('O-8', { watch: watch(), pages }, async () => {
    const { page } = needs(ops, 'O-1');
    const lastMonday = addDays(mondayOf(today), -7);
    await openNav(page, 'Hospital Settlements');

    // Close last week (a no-op when the weekly job already closed it).
    await page.getByRole('button', { name: 'Close Period' }).click();
    const close = dialog(page, 'Close Settlement Period');
    await close.getByLabel('First day of the period').fill(lastMonday);
    await close.getByLabel('Last day of the period').fill(addDays(lastMonday, 6));
    await close.getByRole('button', { name: 'Preview' }).click();
    const closeButton = close.getByRole('button', {
      name: /^(Close \d+ periods?|Nothing to close)$/,
    });
    await expect(closeButton).toBeVisible();
    if ((await closeButton.textContent())?.startsWith('Close')) {
      await closeButton.click();
      await expect(toast(page, /closed.*ready for a payout run/)).toBeVisible();
    } else {
      await close.getByRole('button', { name: 'Cancel' }).click();
    }

    // A draft run for the closed statements, approved, then released with UTRs.
    const createRun = page.getByRole('button', { name: /^Create Payout Run \(\d+\)$/ });
    let runNo: string;
    if ((await createRun.count()) > 0) {
      await createRun.first().click();
      const [response] = await Promise.all([
        page.waitForResponse(isCall('POST', /^\/api\/v1\/platform\/settlements\/payout-runs$/)),
        dialog(page, 'Create Payout Run').getByRole('button', { name: 'Create Draft Run' }).click(),
      ]);
      expect(response.status(), 'the run is created').toBe(201);
      await expect(toast(page, /created as a draft — approve it to release\./)).toBeVisible();
      runNo = needs(
        /Payout run (\S+) created/.exec(
          (await toast(page, /created as a draft/).textContent()) ?? '',
        )?.[1],
        'the run number',
      );
    } else {
      // Nothing new to batch: carry on with a run that is still waiting.
      let waiting: string | null = null;
      for (const heading of await page.getByRole('heading', { name: /^Payout run \S+ · / }).all()) {
        const no = /^Payout run (\S+) ·/.exec((await heading.textContent()) ?? '')?.[1];
        if (!no) continue;
        const pending = runCardOf(page, no).getByRole('button', {
          name: /^(Approve Run|Release Run \()/,
        });
        if ((await pending.count()) > 0) {
          waiting = no;
          break;
        }
      }
      runNo = needs(waiting, 'a payout run with something to pay');
    }
    const runCard = () => runCardOf(page, runNo);
    const approve = runCard().getByRole('button', { name: 'Approve Run' });
    if ((await approve.count()) > 0) {
      await approve.click();
      await expect(toast(page, `Payout run ${runNo} approved — ready to release.`)).toBeVisible();
    }
    await runCard()
      .getByRole('button', { name: /^Release Run \(/ })
      .click();
    const release = page.getByRole('dialog').filter({ has: page.getByText('Total to release') });
    const utrs = release.getByRole('textbox', { name: /^Transfer reference \(UTR\) for / });
    const count = await utrs.count();
    expect(count, 'statements to release').toBeGreaterThan(0);
    const entered: { hospital: string; utr: string }[] = [];
    for (let i = 0; i < count; i += 1) {
      const input = utrs.nth(i);
      const hospitalOf = ((await input.getAttribute('aria-label')) ?? '').replace(
        'Transfer reference (UTR) for ',
        '',
      );
      const utr = `UTRUAT${tag.toUpperCase()}${i}${Date.now() % 10_000}`;
      await input.fill(utr);
      entered.push({ hospital: hospitalOf, utr });
    }
    await release.getByRole('button', { name: /^Record \d+ Releases?$/ }).click();
    await expect(toast(page, /^Payout run recorded — \d+ settlements? released\.$/)).toBeVisible();

    // The hospital sees its settlement released (Lakeshore's, when it was in the run).
    const mine = entered.find((e) => e.hospital === lakeshoreName);
    if (mine) {
      const payouts = await lakeshoreApi.all<PayoutDto>('/settlements/payouts', {
        status: 'released',
      });
      expect(
        payouts.map((p) => p.utr_ref),
        "Lakeshore's payout shows released",
      ).toContain(mine.utr);
    }
    const released = await owner.all<PayoutDto>('/settlements/payouts', { status: 'released' });
    for (const e of entered) {
      expect(
        released.map((p) => p.utr_ref),
        `${e.hospital}'s payout is released`,
      ).toContain(e.utr);
    }
  });

  /* O-9 ------------------------------------------------------------------ */
  await uatStep('O-9', { watch: watch(), pages }, async () => {
    const s = needs(ops, 'O-1');
    const { page } = s;
    const otherHospitals = seededHospitalNames().filter((n) => n !== lakeshoreName);

    // Analytics follows the reporting period.
    await openNav(page, 'Usage Analytics');
    const [overview] = await Promise.all([
      page.waitForResponse(
        (r) =>
          isCall('GET', /^\/api\/v1\/platform\/analytics\/overview$/)(r) &&
          new URL(r.url()).searchParams.get('period') === '7d',
      ),
      page.getByRole('combobox', { name: 'Reporting period' }).selectOption('Last 7 days'),
    ]);
    expect(overview.status()).toBe(200);
    const span = (await overview.json()) as {
      readonly date_from: string;
      readonly date_to: string;
    };
    // Analytics come from the nightly rollup, so every window ends yesterday (IST),
    // the last rolled-up day (backend analytics_queries.parse; the screen says so).
    const yesterday = addDays(today, -1);
    expect(span.date_to, 'the window ends on the last rolled-up day').toBe(yesterday);
    expect(span.date_from, 'the window is 7 days').toBe(addDays(yesterday, -6));
    await expect(
      page.getByText(`${fmtDate(span.date_from)} – ${fmtDate(span.date_to)}`).first(),
    ).toBeVisible();
    for (const tab of ['Providers', 'Error Rates', 'Bookings']) {
      await page.getByRole('tab', { name: tab }).click();
      await s.watch.settled();
      await expect(page.getByText("Analytics didn't load")).toHaveCount(0);
    }

    // A report filtered to one hospital exports only that hospital (UAT-36).
    const catalog = (await owner.get<ApiPage<ReportDefDto>>('/reports')).results;
    const report = needs(
      catalog.find(
        (r) =>
          r.filters.some((f) => f.key === 'hospital') &&
          r.columns.some((c) => /hospital/i.test(c.label)),
      ),
      'a platform report with a hospital filter and column',
    );
    await openNav(page, 'Reports');
    await cardWith(
      page,
      page.getByRole('heading', { name: report.title, exact: true }),
      page.getByRole('button', { name: 'Open report' }),
    )
      .getByRole('button', { name: 'Open report' })
      .click();
    await page.getByRole('combobox', { name: 'Filter by hospital' }).selectOption(lakeshoreName);
    const [run] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.request().method() === 'GET' &&
          new URL(r.url()).pathname === `/api/v1/platform/reports/${report.code}` &&
          // The catalog's `hospital` filter is sent as its `hospital_id` param.
          new URL(r.url()).searchParams.get('hospital_id') === lakeshoreId,
      ),
      page.getByRole('button', { name: 'Run report' }).click(),
    ]);
    expect(run.status()).toBe(200);
    const csv = await download(page, () =>
      page.getByRole('button', { name: 'CSV', exact: true }).click(),
    );
    const text = csv.text();
    expect(csvRows(text).length, 'the CSV has a header').toBeGreaterThan(0);
    for (const other of otherHospitals) {
      expect(text, `the Lakeshore export holds no ${other} rows`).not.toContain(other);
    }
    const xlsx = await download(page, () =>
      page.getByRole('button', { name: 'Excel', exact: true }).click(),
    );
    expect(isXlsx(xlsx.bytes), 'the Excel export is an XLSX file').toBe(true);

    // Compliance Logs: hospital, module and severity filters all narrow the rows (UAT-53).
    await openNav(page, 'Compliance Logs');
    const logRows = () => dataRows(page, 'Compliance log entries');
    const cellOf = (r: Locator, index: number) => r.getByRole('cell').nth(index);
    await page.getByRole('combobox', { name: 'Filter by hospital' }).selectOption(lakeshoreName);
    await s.watch.settled();
    await expect(logRows().first()).toBeVisible();
    await expect
      .poll(async () => [...new Set(await logRows().locator('td:nth-child(3)').allTextContents())])
      .toEqual([lakeshoreName]);
    const firstModule = ((await cellOf(logRows().first(), 1).textContent()) ?? '').trim();
    await page.getByRole('combobox', { name: 'Filter by module' }).selectOption(firstModule);
    await s.watch.settled();
    await expect
      .poll(async () => [...new Set(await logRows().locator('td:nth-child(2)').allTextContents())])
      .toEqual([firstModule]);
    const firstSeverity = ((await cellOf(logRows().first(), 5).textContent()) ?? '').trim();
    await page.getByRole('combobox', { name: 'Filter by severity' }).selectOption(firstSeverity);
    await s.watch.settled();
    await expect
      .poll(async () => [...new Set(await logRows().locator('td:nth-child(6)').allTextContents())])
      .toEqual([firstSeverity]);
    // Search by a resource id finds the new hospital's trail.
    const h = needs(hospital, 'O-2');
    await page.getByRole('button', { name: 'Clear all' }).click();
    await page
      .getByRole('textbox', {
        name: 'Search the audit trail by exact action code, request id or UUID',
      })
      .fill(h.id);
    await s.watch.settled();
    await expect(logRows().first()).toBeVisible();

    // Compliance: every register loads; an export request is filed and listed.
    await openNav(page, 'Compliance');
    for (const tab of ['Configuration Changes', 'Patient Record Access', 'Staff Logins']) {
      await page.getByRole('tab', { name: tab }).click();
      await s.watch.settled();
    }
    await page.getByRole('tab', { name: 'Export on Request' }).click();
    const requestNo = await fileExportRequest(page, {
      email: needs(patient.email, 'a patient email'),
      name: patient.name,
    });
    const listed = row(page, requestNo);
    await expect(listed).toBeVisible();
    await expect(listed).toContainText(patient.name);
  });

  /* O-10 ----------------------------------------------------------------- */
  await uatStep('O-10', { watch: watch(), pages }, async () => {
    const { page } = needs(ops, 'O-1');
    const name = `Nisha Uat${tag}`;
    const email = `uat.ops.${tag.toLowerCase()}${Date.now() % 100_000}@medibook.example.com`;
    await openNav(page, 'Users & Roles');
    await page.getByRole('button', { name: 'Add User', exact: true }).click();
    const modal = dialog(page, 'Add User');
    await modal.getByLabel(/^Full Name/).fill(name);
    await modal.getByLabel(/^Work Email/).fill(email);
    await modal.getByRole('combobox', { name: /^Role/ }).selectOption('Support');
    const since = new Date();
    await modal.getByRole('button', { name: 'Add User' }).click();
    await expect(toast(page, `${name} added.`)).toBeVisible();

    // The emailed link opens the operations reset page (UAT-03).
    const link = await waitForDevToken(email, 'password_reset', since);
    expect(link.link, 'the emailed link opens the operations reset page').toMatch(
      new RegExp(`^${escapeRegExp(UAT_ENV.baseUrl)}/ops/reset-password\\?token=`),
    );
    const colleague = await newBrowserSession(browser, 'new-ops-user');
    contexts.push(colleague.context);
    colleague.watch.begin();
    await colleague.page.goto(link.link);
    await expect(colleague.page.getByText('Set a new password')).toBeVisible();
    await colleague.page.getByLabel('New Password', { exact: true }).fill(NEW_OPS_PASSWORD);
    await colleague.page.getByLabel('Confirm New Password', { exact: true }).fill(NEW_OPS_PASSWORD);
    await spendSignIn(email);
    await colleague.page.getByRole('button', { name: 'Update Password' }).click();
    await expect(colleague.page.getByText('Password updated')).toBeVisible();
    rememberPassword(email, NEW_OPS_PASSWORD);
    await colleague.page.getByRole('button', { name: 'Back to Login', exact: true }).click();
    await expect(loginForm(colleague.page).opsTab).toHaveAttribute('aria-pressed', 'true');
    await signIn(colleague.page, 'platform', email, NEW_OPS_PASSWORD);
    await expect(colleague.page).toHaveURL(/\/ops\//);
    await expect(
      colleague.page.getByRole('button', { name: `Account menu for ${name}` }),
    ).toContainText('Support');
    const problems = colleague.watch.problems();
    if (problems.length > 0) throw new Error(problems.join('\n'));
  });

  /* O-11 ----------------------------------------------------------------- */
  await uatStep('O-11', { watch: watch(), pages }, async () => {
    const s = needs(ops, 'O-1');
    const { page } = s;
    const email = needs(patient.email, 'a patient email');
    await openNav(page, 'Platform Users');
    await page
      .getByRole('textbox', { name: 'Search patient accounts by email or phone' })
      .fill(email);
    await page.getByTitle(`View ${patient.name}'s account`, { exact: true }).click();
    await expect(topbarTitle(page)).toHaveText('Patient Account');
    const userId = needs(
      /\/ops\/platform-users\/([^/?#]+)/.exec(page.url())?.[1],
      'the account id',
    );

    await page.getByRole('button', { name: 'Block Account' }).click();
    const block = dialog(page, 'Block this account?');
    await block.getByLabel(/^Reason/).fill(`UAT ${tag}: verifying the block flow`);
    await block.getByRole('button', { name: 'Block', exact: true }).click();
    await expect(toast(page, `${patient.name} blocked.`)).toBeVisible();
    await page.getByRole('button', { name: 'Unblock Account' }).click();
    await dialog(page, 'Unblock this account?')
      .getByRole('button', { name: 'Unblock', exact: true })
      .click();
    await expect(toast(page, `${patient.name} unblocked.`)).toBeVisible();

    // Both actions are in the audit trail, and opening the account was logged (BE-16).
    await openNav(page, 'Compliance Logs');
    for (const action of ['user.blocked', 'user.unblocked']) {
      await page.getByRole('textbox', { name: 'Filter by exact action code' }).fill(action);
      await s.watch.settled();
      await expect(dataRows(page, 'Compliance log entries').first()).toBeVisible();
      await expect(dataRows(page, 'Compliance log entries').first()).toContainText(action);
    }
    await openNav(page, 'Compliance');
    await page.getByRole('tab', { name: 'Patient Record Access' }).click();
    await page
      .getByRole('textbox', { name: 'Filter by a record id that appears in the results' })
      .fill(userId);
    await s.watch.settled();
    const reads = dataRows(page, 'Patient record reads');
    await expect(reads.first()).toBeVisible();
    await expect(reads.first()).toContainText(OWNER.name);
  });

  /* O-12 ----------------------------------------------------------------- */
  await uatStep('O-12', { watch: watch(), pages }, async () => {
    const { page } = needs(ops, 'O-1');
    const title = `UAT health camp ${tag}`;
    await openNav(page, 'Notifications');
    await page.getByRole('button', { name: 'Add Banner' }).click();
    const modal = dialog(page, 'Add Banner');
    await modal.getByLabel(/^Banner Title/).fill(title);
    await modal.getByLabel(/^Supporting text/).fill('Free BP and sugar checks this weekend');
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      modal.getByRole('button', { name: /Click to upload an image/ }).click(),
    ]);
    await chooser.setFiles({ name: 'banner.png', mimeType: 'image/png', buffer: TINY_PNG });
    await expect(modal.getByRole('img', { name: 'Banner preview' })).toBeVisible();
    await modal.getByLabel(/^Live From/).fill(today);
    await modal.getByLabel(/^Live Until/).fill(addDays(today, 7));
    await modal.getByRole('button', { name: 'Add Banner' }).click();
    await expect(toast(page, 'Banner added — it goes live on its start date.')).toBeVisible();

    // The patient app's home screen receives it (UAT-32).
    const anonymous = await ApiClient.anonymous();
    try {
      await expect
        .poll(
          async () =>
            (
              await anonymous.get<
                ApiPage<{ readonly title: string; readonly image_url: string | null }>
              >('/patient/content/banners')
            ).results.find((b) => b.title === title)?.image_url ?? null,
          { timeout: LISTING_WAIT_MS, message: 'the patient app serves the banner with its image' },
        )
        .not.toBeNull();
    } finally {
      await anonymous.dispose();
    }
    // Leave the patient app as it was.
    await page.getByTitle(`Delete “${title}”`, { exact: true }).click();
    await dialog(page, 'Delete this banner?')
      .getByRole('button', { name: 'Delete Banner' })
      .click();
    await expect(toast(page, 'Banner deleted.')).toBeVisible();
  });

  /* O-13 ----------------------------------------------------------------- */
  await uatStep('O-13', { watch: watch(), pages }, async () => {
    const { page } = needs(ops, 'O-1');
    await openNav(page, 'Platform Settings');
    const gst = page.getByLabel(/^Convenience-fee GST/);
    await expect(gst).not.toHaveValue('');
    const originalGst = await gst.inputValue();
    const flags = cardWith(
      page,
      page.getByRole('heading', { name: 'Feature Flags', exact: true }),
      page.getByRole('switch').first(),
    );
    const flag = flags.getByRole('switch').first();
    const flagKey = needs(await flag.getAttribute('aria-label'), 'a feature flag');
    const flagWasOn = (await flag.getAttribute('aria-checked')) === 'true';
    const doctors = (await hospitalDoctors(lakeshoreApi)).filter(
      (d) => d.status === 'active' && d.is_bookable_online,
    );
    const doctor = needs(doctors[0], 'a Lakeshore doctor patients can book');
    const quoter = await ApiClient.patient(patient.phone);
    try {
      await gst.fill(TEST_GST_PERCENT);
      await page.getByRole('button', { name: 'Save Changes' }).click();
      await expect(toast(page, 'Settings saved.')).toBeVisible();
      await flag.click();
      await expect(toast(page, `${flagKey} switched ${flagWasOn ? 'off' : 'on'}.`)).toBeVisible();
      await expect(flag).toHaveAttribute('aria-checked', String(!flagWasOn));

      // The next booking is priced with the new GST on its convenience fee (UAT-34).
      await expect
        .poll(
          async () =>
            (
              await quoter.get<QuoteDto>('/patient/fee-quotes', { doctor_id: doctor.id })
            ).lines.find((l) => l.line === 'convenience_fee')?.tax_rate_bp ?? null,
          { timeout: QUOTE_WAIT_MS, message: 'the fee quote uses the new convenience-fee GST' },
        )
        .toBe(TEST_GST_BP);
      const booking = await bookOnlineSoon(doctor.id, 'none');
      const booked = await booking.patient.get<{ readonly tax_lines: readonly TaxLineDto[] }>(
        `/patient/appointments/${booking.appointment.id}`,
      );
      expect(
        booked.tax_lines.find((l) => l.line === 'convenience_fee')?.rate_bp,
        'the booking snapshot carries the new GST',
      ).toBe(TEST_GST_BP);
    } finally {
      await quoter.dispose();
      // Put the platform back as it was.
      await openNav(page, 'Platform Settings');
      if ((await gst.inputValue()) !== originalGst) {
        await gst.fill(originalGst);
        await page.getByRole('button', { name: 'Save Changes' }).click();
        await expect(toast(page, 'Settings saved.').last()).toBeVisible();
      }
      if ((await flag.getAttribute('aria-checked')) !== String(flagWasOn)) {
        await flag.click();
        await expect(flag).toHaveAttribute('aria-checked', String(flagWasOn));
      }
    }
  });

  for (const context of contexts) await context.close();
  if (ops) await (ops as StaffSession).context.close();
  if (newAdminApi) await (newAdminApi as ApiClient).dispose();
  await owner.dispose();
  await lakeshoreApi.dispose();
  await disposePatients();
});
