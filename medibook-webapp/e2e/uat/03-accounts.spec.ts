import { expect, test, type BrowserContext, type Page, type Response } from '@playwright/test';

import { hospitalStaff, platformStaff } from './support/accounts.ts';
import { ApiClient, type Page as ApiPage } from './support/api.ts';
import {
  bookWalkIn,
  cleanSessionToday,
  collectAtDesk,
  disposePatients,
  runTag,
} from './support/booking.ts';
import { paymentSearch } from './support/desk.ts';
import { pdfSyncMaxRows } from './support/env.ts';
import { needs, uatStep } from './support/steps.ts';
import { addDays, fmtDate, isoDateIn, previousMonth, rupees, todayIso } from './support/time.ts';
import {
  csvRows,
  dialog,
  download,
  isPdf,
  isXlsx,
  newBrowserSession,
  openNav,
  row,
  signIn,
  submitLogin,
  toast,
  topbarTitle,
  type StaffSession,
} from './support/ui.ts';

/**
 * Report §4.3 — Accounts (accountant, Lakeshore, `joseph.kurian`).
 * The accountant also holds `cash_desk.*` now (TEAM_BRIEF decision 2); these
 * steps refund UPI, which needs no drawer.
 */

test.describe.configure({ mode: 'serial' });

const DESK = '/receptionist';
const PAYMENT_LOOKBACK_DAYS = 60;
const REPORT_SPAN_DAYS = 1_825;
const EXPORT_WAIT_MS = 120_000;

interface PaymentLineDto {
  readonly id: string;
  readonly appointment_id: string | null;
  readonly visit_id: string | null;
  readonly method: string;
  readonly channel: 'desk' | 'online';
  readonly status: 'captured' | 'refunded' | 'failed';
  readonly amount_paise: number;
  readonly captured_at: string | null;
  readonly booking_refs: readonly string[];
  readonly appointment_status: string | null;
  readonly latest_refund: unknown;
  readonly patient: { readonly full_name: string } | null;
}

interface PeriodDto {
  readonly id: string;
  readonly period_start: string;
  readonly period_end: string;
  readonly net_payable_paise: number;
}

interface PeriodDetailDto extends PeriodDto {
  readonly statements?: readonly { readonly statement_no: string }[] | null;
}

interface ReportDto {
  readonly page: { readonly total: number };
  readonly kpis: readonly { readonly key: string; readonly label: string }[];
  readonly columns: readonly { readonly key: string; readonly label: string }[];
}

interface CatalogDto {
  readonly code: string;
  readonly title: string;
}

function isReportRead(code: string) {
  return (r: Response) =>
    r.request().method() === 'GET' &&
    new URL(r.url()).pathname === `/api/v1/hospital/reports/${code}`;
}

/** The tab list's tab whose name starts with `name` ("Pending (3)"). */
function tab(page: Page, name: string) {
  return page.getByRole('tab', { name: new RegExp(`^${name}`) });
}

test('4.3 Accounts — accountant, Lakeshore', async ({ browser }) => {
  const accountant = hospitalStaff('lakeshore', 'accountant');
  const admin = hospitalStaff('lakeshore', 'admin');
  const tag = runTag();
  const today = todayIso();

  const adminApi = await ApiClient.staff('hospital', admin.email);
  let desk: StaffSession | null = null;
  const contexts: BrowserContext[] = [];
  // Evidence on failure: the main desk and every other browser a step opened.
  const pages = () => [...(desk ? [desk.page] : []), ...contexts.flatMap((c) => c.pages())];
  const watch = () => (desk ? [desk.watch] : []);

  /* C-1 ------------------------------------------------------------------ */
  await uatStep('C-1', { pages }, async () => {
    const s = await newBrowserSession(browser, 'accountant');
    desk = { ...s, email: accountant.email };
    s.watch.begin();
    await signIn(s.page, 'hospital', accountant.email);
    await expect(s.page).toHaveURL(new RegExp(`${DESK}/dashboard$`));
    await expect(topbarTitle(s.page)).toHaveText('Front Desk');
    expect(s.watch.problems(), 'the dashboard loads without errors').toEqual([]);
    // Typing the Patients address: the screen says so instead of loading.
    await s.page.goto(`${DESK}/patients`);
    await expect(s.page.getByText("You don't have access to this screen")).toBeVisible();
  });

  /* C-2 ------------------------------------------------------------------ */
  await uatStep('C-2', { watch: watch(), pages }, async () => {
    const { page } = needs(desk, 'C-1');
    // Background data: one desk UPI payment taken and refunded today.
    const session = await cleanSessionToday(adminApi, { minOpenSlots: 2, clean: false });
    const walkIn = await bookWalkIn(
      adminApi,
      session.doctor,
      needs(session.openSlots[0], 'a slot').id,
      {
        firstName: 'Refund',
        lastName: `Uat${tag}`,
      },
    );
    await collectAtDesk(adminApi, walkIn, 'upi', `UPI${tag}C2`);
    await adminApi.post(`/appointments/${walkIn.id}/cancel`, { reason: 'UAT: refunded today' });
    // … and one desk UPI payment kept, so "Paid" has a line of today too.
    const kept = await bookWalkIn(
      adminApi,
      session.doctor,
      needs(session.openSlots[1], 'a slot').id,
      {
        firstName: 'Paid',
        lastName: `Uat${tag}`,
      },
    );
    await collectAtDesk(adminApi, kept, 'upi', `UPI${tag}C2K`);

    await openNav(page, 'Payments');
    await expect(page.getByRole('combobox', { name: 'Filter by date' })).toHaveValue('Today');
    const lines = page.getByRole('region', { name: 'Payments' }).getByRole('row');
    const todayCell = fmtDate(today);
    for (const [name, badge] of [
      ['Paid', 'Paid'],
      ['Refunded', 'Refunded'],
    ] as const) {
      await tab(page, name).click();
      await expect(tab(page, name)).toHaveAttribute('aria-selected', 'true');
      const body = lines.filter({ has: page.getByRole('cell') });
      await expect(body.first()).toBeVisible();
      // Every row of the tab (once its list has replaced the previous tab's):
      // today's date in the first column, the tab's status in "Status".
      await expect
        .poll(async () => {
          const dates = await body.locator('td:nth-child(1)').allInnerTexts();
          const statuses = await body.locator('td:nth-child(7)').allInnerTexts();
          return {
            notToday: dates.filter((d) => !d.includes(todayCell)).length,
            otherStatus: statuses.filter((t) => t.trim() !== badge).length,
            rows: dates.length,
          };
        })
        .toMatchObject({ notToday: 0, otherStatus: 0 });
    }
    await tab(page, 'Refunded').click();
    await expect(row(page, `Refund Uat${tag}`)).toBeVisible();
    await tab(page, 'All').click();
  });

  /* C-3 ------------------------------------------------------------------ */
  await uatStep('C-3', { watch: watch(), pages }, async () => {
    const { page } = needs(desk, 'C-1');
    await openNav(page, 'Payments');
    await tab(page, 'All').click();
    const showing = page.getByText(/^Showing \d+–\d+ of \d+ payment lines$/);
    await expect(showing).toBeVisible();
    const total = Number(/of (\d+)/.exec(await showing.innerText())?.[1] ?? '0');
    expect(total, 'payment lines today').toBeGreaterThan(0);

    const csv = await download(page, () =>
      page.getByRole('button', { name: 'Export CSV' }).click(),
    );
    const rows = csvRows(csv.text());
    expect(rows[0], 'human column headers').toContain('Booking refs');
    expect(rows.length - 1, 'the CSV has every line on screen').toBe(total);
    // Every patient on the first page is in the file. Unpaid walk-ins are
    // listed first as "Due" rows; they are not payment lines (the screen says
    // so) and are not exported.
    const firstPage = page
      .getByRole('region', { name: 'Payments' })
      .getByRole('row')
      .filter({
        has: page
          .getByRole('cell')
          .first()
          .filter({ hasText: fmtDate(today) }),
      });
    await expect(firstPage.first()).toBeVisible();
    for (const line of (await firstPage.all()).slice(0, 3)) {
      const name = (await line.getByRole('cell').nth(1).innerText()).split('\n')[0]?.trim() ?? '';
      if (name && name !== 'Patient unavailable') expect(csv.text()).toContain(name);
    }
    const xlsx = await download(page, () =>
      page.getByRole('button', { name: 'Export Excel' }).click(),
    );
    expect(isXlsx(xlsx.bytes), 'the Excel export is an XLSX workbook').toBe(true);
    const pdf = await download(page, () =>
      page.getByRole('button', { name: 'Export PDF' }).click(),
    );
    expect(isPdf(pdf.bytes), 'the PDF export is a PDF').toBe(true);
  });

  /* C-4 ------------------------------------------------------------------ */
  await uatStep('C-4', { watch: watch(), pages }, async () => {
    const { page } = needs(desk, 'C-1');
    const lines = await adminApi.all<PaymentLineDto>('/payments', {
      method: 'upi',
      channel: 'desk',
      status: 'captured',
      date_from: addDays(today, -PAYMENT_LOOKBACK_DAYS),
      date_to: today,
    });
    const line = needs(
      lines.find(
        (l) =>
          l.appointment_id &&
          !l.visit_id &&
          l.appointment_status === 'completed' &&
          !l.latest_refund &&
          l.captured_at &&
          l.patient,
      ),
      'a UPI payment of a completed booking (seed data)',
    );
    const day = isoDateIn(new Date(needs(line.captured_at, 'capture time')));
    const patientName = needs(line.patient, 'patient').full_name;
    const ref = needs(line.booking_refs[0], 'booking ref');

    await openNav(page, 'Payments');
    await page.getByRole('combobox', { name: 'Filter by date' }).selectOption('Custom range');
    await page.getByLabel('From date').fill(day);
    await page.getByLabel('To date').fill(day);
    await paymentSearch(page).fill(ref);
    const target = row(page, patientName).filter({ hasText: 'UPI' });
    await expect(target).toHaveCount(1);
    await target.getByRole('button', { name: 'Refund booking' }).click();
    const modal = dialog(page, 'Refund booking');
    await modal.getByLabel('Reason').fill('Duplicate charge reported by the patient');
    await modal
      .getByRole('button', { name: `Refund ${rupees(line.amount_paise / 100)} in full` })
      .click();
    await expect(toast(page, 'Refund recorded')).toBeVisible();
    await expect(target.getByText('Refunded', { exact: true }).first()).toBeVisible();
    await expect(target.getByRole('button', { name: 'Refund booking' })).toHaveCount(0);
  });

  /* C-5 ------------------------------------------------------------------ */
  await uatStep('C-5', { watch: watch(), pages }, async () => {
    const { page } = needs(desk, 'C-1');
    const periods = await adminApi.all<PeriodDto>('/settlements/periods');
    periods.sort((a, b) => b.period_start.localeCompare(a.period_start));
    let chosen: PeriodDetailDto | null = null;
    for (const p of periods) {
      const detail = await adminApi.get<PeriodDetailDto>(`/settlements/periods/${p.id}`);
      if ((detail.statements ?? []).length > 0) {
        chosen = detail;
        break;
      }
    }
    const period = needs(chosen, 'a closed period with a statement (seed data)');
    const label = `${fmtDate(period.period_start)} – ${fmtDate(period.period_end)}`;

    await openNav(page, 'Billing & Settlements');
    await expect(topbarTitle(page)).toHaveText('Billing & Settlements');
    const line = row(page, label);
    await expect(line).toBeVisible();
    await expect(line.getByText(rupees(period.net_payable_paise / 100))).toBeVisible();
    await line.getByRole('button', { name: 'Details' }).click();
    const drawer = dialog(page, label);
    await expect(drawer.getByText('How the net was reached')).toBeVisible();
    await expect(drawer.getByText('Net payable')).toBeVisible();
    await expect(drawer.getByText(rupees(period.net_payable_paise / 100)).first()).toBeVisible();
    // SET-01: the ledger, adjustments and TDS add up to the net payable.
    await expect(drawer.getByText(/Ask Medibook to\s+explain the difference/)).toHaveCount(0);
    const statement = drawer.getByRole('button', { name: /^Statement / }).first();
    const file = await download(page, () => statement.click());
    expect(isPdf(file.bytes), 'the statement downloads as a PDF').toBe(true);
    await page.keyboard.press('Escape');
  });

  /* C-6 ------------------------------------------------------------------ */
  await uatStep('C-6', { watch: watch(), pages }, async () => {
    const { page } = needs(desk, 'C-1');
    // A request left pending by an earlier run hides the button: operations
    // turns it down first, as they would.
    const me = await adminApi.get<{ readonly hospital: { readonly id: string } }>('/me');
    const owner = await ApiClient.staff('platform', platformStaff('owner').email);
    const pending = await owner.all<{ readonly id: string; readonly status: string }>(
      '/billing/plan-change-requests',
      { hospital_id: me.hospital.id, status: 'requested' },
    );
    for (const p of pending.filter((r) => r.status === 'requested')) {
      await owner.post(`/billing/plan-change-requests/${p.id}/reject`, {
        review_note: 'Superseded by a newer UAT request',
      });
    }
    await owner.dispose();

    await openNav(page, 'Billing & Settlements');
    await page.getByRole('tab', { name: 'Plan & Billing' }).click();
    await page.getByRole('button', { name: 'View invoice' }).first().click();
    const invoice = dialog(page, /^Invoice /);
    await expect(invoice.getByText('Tax Invoice')).toBeVisible();
    await expect(invoice.getByText(/GST @/).first()).toBeVisible();
    await expect(invoice.getByText('Taxable value')).toBeVisible();
    await expect(invoice.getByText('Total', { exact: true })).toBeVisible();
    await invoice.getByRole('button', { name: 'Close' }).first().click();

    await page.getByRole('button', { name: 'Request Plan Change' }).click();
    const modal = dialog(page, 'Request Plan Change');
    const plan = modal.getByRole('combobox', { name: /Requested Plan/ });
    const current = (await plan.locator('option').allTextContents()).find((o) =>
      o.endsWith('— current plan'),
    );
    await plan.selectOption({ label: needs(current, 'the current plan in the list') });
    await expect(modal.getByText('Same plan, new billing cycle')).toBeVisible();
    await modal
      .getByLabel(/Note for Medibook/)
      .fill(`UAT ${tag}: moving to the other billing cycle`);
    await modal.getByRole('button', { name: 'Send Request' }).click();
    await expect(toast(page, 'Plan change request sent to Medibook')).toBeVisible();
    await expect(page.getByText(/requested · pending Medibook review/)).toBeVisible();
  });

  /* C-7 ------------------------------------------------------------------ */
  await uatStep('C-7', { watch: watch(), pages }, async () => {
    const { page } = needs(desk, 'C-1');
    const month = previousMonth(today);
    await openNav(page, 'Reports');
    await page.getByRole('button', { name: /^Revenue Report/ }).click();
    const [answer] = await Promise.all([
      page.waitForResponse(
        (r) =>
          isReportRead('revenue')(r) && new URL(r.url()).searchParams.get('date_to') === month.to,
      ),
      (async () => {
        await page
          .getByLabel(/ from$/)
          .first()
          .fill(month.from);
        await page.getByLabel(/ to$/).first().fill(month.to);
      })(),
    ]);
    expect(answer.status()).toBe(200);
    const report = (await answer.json()) as ReportDto;
    expect(report.page.total, 'rows for last month').toBeGreaterThan(0);
    for (const kpi of report.kpis)
      await expect(page.getByText(kpi.label, { exact: true }).first()).toBeVisible();
    const table = page.getByRole('region', { name: 'Revenue Report rows' });
    await expect(table.getByRole('row').nth(1)).toBeVisible();
    const csv = await download(page, () =>
      page.getByRole('button', { name: 'Export CSV' }).click(),
    );
    expect(csvRows(csv.text()).length, 'the CSV carries the rows').toBeGreaterThan(1);
    const xlsx = await download(page, () =>
      page.getByRole('button', { name: 'Export Excel' }).click(),
    );
    expect(isXlsx(xlsx.bytes), 'Excel export (UAT-67)').toBe(true);
  });

  /* C-8 ------------------------------------------------------------------ */
  // A large export is built in the background and emailed as
  // `<app>/reports/downloads/<file id>`; the export id the screen is given is
  // that file id. PDFs above the sync ceiling (2,000 rows; the live stack sets
  // REPORT_PDF_SYNC_MAX_ROWS lower) go to the background (M-26).
  await uatStep('C-8', { watch: watch(), pages }, async () => {
    const { page } = needs(desk, 'C-1');
    const reports = (await adminApi.get<ApiPage<CatalogDto>>('/reports')).results;
    // The report with the most rows over the widest range the server allows.
    const from = addDays(today, -REPORT_SPAN_DAYS);
    let biggest: { code: string; title: string; total: number } | null = null;
    for (const r of reports) {
      const data = await adminApi
        .get<ReportDto>(`/reports/${r.code}`, { date_from: from, date_to: today, page_size: 1 })
        .catch(() => null);
      if (data && (!biggest || data.page.total > biggest.total)) {
        biggest = { ...r, total: data.page.total };
      }
    }
    const target = needs(biggest, 'a report');
    const syncMax = pdfSyncMaxRows();
    if (target.total <= syncMax) {
      throw new Error(
        `No report has more than ${syncMax} rows (largest: ${target.title}, ${target.total}), so no export is large enough to be built in the background and emailed with the seeded data.`,
      );
    }
    await openNav(page, 'Reports');
    await page.getByRole('button', { name: new RegExp(`^${target.title}`) }).click();
    await page
      .getByLabel(/ from$/)
      .first()
      .fill(from);
    await page.getByLabel(/ to$/).first().fill(today);
    const [queued] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.request().method() === 'GET' &&
          /\/reports\/[^/]+\/export\.pdf$/.test(new URL(r.url()).pathname),
      ),
      page.getByRole('button', { name: 'Save as PDF' }).click(),
    ]);
    expect(queued.status(), 'a large export is accepted for background building').toBe(202);
    const { export_id: exportId } = (await queued.json()) as { export_id: string };
    await expect(toast(page, /This export is large/)).toBeVisible();
    await expect(page.getByRole('button', { name: /^Download/ })).toBeVisible({
      timeout: EXPORT_WAIT_MS,
    });

    // The emailed link, opened in a browser that is not signed in.
    const fresh = await newBrowserSession(browser, 'accountant-email-link');
    contexts.push(fresh.context);
    await fresh.page.goto(`/reports/downloads/${exportId}`);
    await expect(fresh.page).toHaveURL(/\/auth\/login\?next=/);
    await expect(
      fresh.page.getByText('Sign in to download the report from your email.'),
    ).toBeVisible();
    const file = await download(fresh.page, () =>
      submitLogin(fresh.page, 'hospital', accountant.email),
    );
    expect(isPdf(file.bytes), 'the emailed report downloads').toBe(true);
    await expect(fresh.page.getByText('Your report is ready')).toBeVisible();
  });

  for (const context of contexts) await context.close();
  if (desk) await (desk as StaffSession).context.close();
  await adminApi.dispose();
  await disposePatients();
});
