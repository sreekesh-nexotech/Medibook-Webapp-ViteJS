import { expect, test, type BrowserContext, type Page, type Response } from '@playwright/test';

import { hospitalStaff } from './support/accounts.ts';
import { ApiClient, type Page as ApiPage } from './support/api.ts';
import {
  bookOnline,
  bookWalkIn,
  cleanSessionToday,
  collectAtDesk,
  createDeskPatient,
  disposePatients,
  hospitalDepartments,
  hospitalDoctors,
  hospitalHolidays,
  isHoliday,
  randomMobile,
  runTag,
  waitForOnlineSlots,
  workingWeekdays,
  type HolidayRow,
  type OnlineBooking,
} from './support/booking.ts';
import { appointmentSearch, expectedInDrawer, paymentSearch, rupeesIn } from './support/desk.ts';
import { waitForDevToken } from './support/devTokens.ts';
import { UAT_ENV } from './support/env.ts';
import { needs, uatStep } from './support/steps.ts';
import {
  addDays,
  clockIn,
  fmtDate,
  isoDateIn,
  isSunday,
  rupees,
  todayIso,
} from './support/time.ts';
import {
  closeDialogs,
  csvRows,
  dialog,
  download,
  escapeRegExp,
  goTo,
  isXlsx,
  newBrowserSession,
  openNav,
  openStaff,
  row,
  signIn,
  signOut,
  TINY_PNG,
  toast,
  topbarTitle,
  type StaffSession,
} from './support/ui.ts';

/**
 * Report §4.4 — Hospital admin (Lakeshore, `anita.menon`).
 * A-9: a tax rate still billed by a service cannot be deleted (B4,
 * `TAX_RATE_IN_USE`); the service is moved to "No tax" first, then the rate
 * goes and stops applying. A-12: nobody approves their own change request
 * (B2 §7, L-09), so the receptionist edits and the admin approves.
 */

test.describe.configure({ mode: 'serial' });

const ADMIN = '/admin';
const DRAWER_FLOAT_RUPEES = 1_000;
const PAYMENT_LOOKBACK_DAYS = 60;
const SLOT_WAIT_MS = 120_000;
const REFUND_WAIT_MS = 120_000;
const DELIVERY_WAIT_MS = 60_000;
const AFTERNOON = '13:00';
const INVITEE_PASSWORD = 'Invitee#Secure-Pass-58';

interface PaymentLineDto {
  readonly appointment_id: string | null;
  readonly visit_id: string | null;
  readonly method: string;
  readonly amount_paise: number;
  readonly captured_at: string | null;
  readonly booking_refs: readonly string[];
  readonly appointment_status: string | null;
  readonly latest_refund: unknown;
  readonly patient: { readonly full_name: string } | null;
}

interface ReportDto {
  readonly page: { readonly total: number };
  readonly kpis: readonly { readonly label: string }[];
  readonly columns: readonly { readonly label: string }[];
}

function isPath(method: string, pathname: RegExp) {
  return (r: Response) =>
    r.request().method() === method && pathname.test(new URL(r.url()).pathname);
}

/** A slot button on the Slots grid for `doctorName`. */
function slotCells(page: Page, doctorName: string) {
  return page.getByRole('button', { name: new RegExp(`^${escapeRegExp(doctorName)}, `) });
}

test('4.4 Hospital admin — Lakeshore', async ({ browser }) => {
  const admin = hospitalStaff('lakeshore', 'admin');
  const receptionist = hospitalStaff('lakeshore', 'receptionist');
  const sahyadriAdmin = hospitalStaff('sahyadri', 'admin');
  const tag = runTag();
  const today = todayIso();

  const adminApi = await ApiClient.staff('hospital', admin.email);
  let desk: StaffSession | null = null;
  const contexts: BrowserContext[] = [];
  // Evidence on failure: the main desk and every other browser a step opened.
  const pages = () => [...(desk ? [desk.page] : []), ...contexts.flatMap((c) => c.pages())];
  const watch = () => (desk ? [desk.watch] : []);

  let doctor: { readonly id: string; readonly name: string } | null = null;
  let dates: { leave: string; exception: string; bulk: string; weekly: string } | null = null;
  let holiday: { readonly id: string; readonly name: string } | null = null;
  let refundedAppointmentId: string | null = null;
  let holidays: HolidayRow[] = [];

  /* A-1 ------------------------------------------------------------------ */
  await uatStep('A-1', { pages }, async () => {
    const s = await newBrowserSession(browser, 'admin');
    desk = { ...s, email: admin.email };
    s.watch.begin();
    await signIn(s.page, 'hospital', admin.email);
    await expect(s.page).toHaveURL(new RegExp(`${ADMIN}/dashboard$`));
    await expect(topbarTitle(s.page)).toHaveText('Hospital Dashboard');
    const period = s.page.getByRole('combobox', { name: 'Show figures for this period' });
    for (const [label, code] of [
      ['Last 7 days', '7d'],
      ['Last 30 days', '30d'],
      ['This month', 'mtd'],
    ] as const) {
      const [answer] = await Promise.all([
        s.page.waitForResponse(
          (r) =>
            isPath('GET', /\/hospital\/dashboard\/admin$/)(r) &&
            new URL(r.url()).searchParams.get('period') === code,
        ),
        period.selectOption(label),
      ]);
      expect(answer.status()).toBe(200);
      await expect(s.page.getByText(`Appointments by Department — ${label}`)).toBeVisible();
      await expect(s.page.getByText(`Appointments by Status — ${label}`)).toBeVisible();
    }
    // Back to Today (read when the dashboard opened, so it may come from the cache).
    await period.selectOption('Today');
    await expect(s.page.getByText('Appointments by Department — Today')).toBeVisible();
    await expect(s.page.getByText('Appointments Today', { exact: true })).toBeVisible();
    expect(s.watch.problems(), 'every period loads without errors').toEqual([]);
  });

  /* A-2 ------------------------------------------------------------------ */
  await uatStep('A-2', { watch: watch(), pages }, async () => {
    const { page } = needs(desk, 'A-1');
    const name = `Uat Clinic ${tag}`;
    const renamed = `Uat Wellness ${tag}`;
    await openNav(page, 'Doctors & Departments');
    await page.getByRole('tab', { name: 'Departments' }).click();
    await page.getByRole('button', { name: 'Add Department' }).click();
    let modal = dialog(page, 'Add Department');
    await modal.getByLabel(/Department Name/).fill(name);
    await modal.getByLabel(/About/).fill('Preventive check-ups (UAT).');
    await modal.getByRole('button', { name: 'Add Department' }).click();
    await expect(toast(page, 'Department added')).toBeVisible();
    await expect(page.getByText(name, { exact: true })).toBeVisible();

    // Rename (UAT-06: edits carry If-Match).
    await page.getByTitle(`Edit ${name}`, { exact: true }).click();
    modal = dialog(page, 'Edit Department');
    await modal.getByLabel(/Department Name/).fill(renamed);
    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(toast(page, 'Department updated')).toBeVisible();
    await expect(page.getByText(renamed, { exact: true })).toBeVisible();

    // Switch it off.
    await page.getByTitle(`Edit ${renamed}`, { exact: true }).click();
    modal = dialog(page, 'Edit Department');
    await modal.getByRole('combobox', { name: 'Status' }).selectOption('Inactive');
    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(toast(page, 'Department updated')).toBeVisible();
    const card = page.getByRole('button').filter({ hasText: renamed });
    await expect(card.getByText('Inactive', { exact: true })).toBeVisible();
  });

  /* A-3 ------------------------------------------------------------------ */
  await uatStep('A-3', { watch: watch(), pages }, async () => {
    const { page } = needs(desk, 'A-1');
    const name = `Dr. Uat ${tag}`;
    const department = needs(
      (await hospitalDepartments(adminApi)).find(
        (d) => d.is_active && d.name === 'General Medicine',
      ) ?? (await hospitalDepartments(adminApi)).find((d) => d.is_active),
      'an active department',
    );
    await openNav(page, 'Doctors & Departments');
    await page.getByRole('tab', { name: 'Doctors' }).click();
    await page.getByRole('button', { name: 'Add Doctor' }).click();
    await expect(page).toHaveURL(/\/admin\/doctors\/new/);
    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'doctor.png',
      mimeType: 'image/png',
      buffer: TINY_PNG,
    });
    await expect(page.getByText('Change Photo')).toBeVisible();
    await page.getByLabel(/Full Name/).fill(name);
    await page.getByLabel(/Specialization/).fill('General Physician');
    await page.getByLabel(/Qualification/).fill('MBBS, MD');
    await page.getByLabel(/Consultation Fee/).fill('450.50');
    await page.getByLabel(/Follow-up Fee/).fill('200');
    await page.getByRole('radio', { name: department.name }).click();

    // Weekly hours: Monday–Friday 9–5 by default; add a Saturday morning.
    await page.getByRole('tab', { name: 'Availability' }).click();
    await page.getByRole('switch', { name: 'Sat open for consultation' }).click();
    await page.getByRole('combobox', { name: 'Sat start time' }).selectOption('9:00 am');
    await page.getByRole('combobox', { name: 'Sat end time' }).selectOption('1:00 pm');

    const [created] = await Promise.all([
      page.waitForResponse(isPath('POST', /\/api\/v1\/hospital\/doctors$/)),
      page.getByRole('button', { name: 'Add Doctor' }).click(),
    ]);
    expect(created.status(), 'the doctor is created').toBe(201);
    const body = (await created.json()) as {
      id: string;
      consultation_fee_paise: number;
      photo_file_id: string | null;
    };
    // UAT-08: a fee with paise is saved exactly.
    expect(body.consultation_fee_paise).toBe(45_050);
    expect(body.photo_file_id, 'the photo is attached').not.toBeNull();
    await expect(toast(page, 'Doctor added')).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/doctors$/);
    doctor = { id: body.id, name };

    // Slots appear for the coming days.
    holidays = await hospitalHolidays(adminApi);
    const [leave, exception, bulk] = workingWeekdays(addDays(today, 2), 3, holidays);
    const weekdays = new Set(
      [leave, exception, bulk].map((d) => new Date(`${d}T00:00:00Z`).getUTCDay()),
    );
    const weeklyDay = [1, 2, 3, 4, 5].find((d) => !weekdays.has(d)) ?? 1;
    dates = {
      leave: needs(leave, 'a weekday'),
      exception: needs(exception, 'a weekday'),
      bulk: needs(bulk, 'a weekday'),
      weekly: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][weeklyDay] ?? 'Mon',
    };
    const nextDay = needs(workingWeekdays(addDays(today, 1), 1, holidays)[0], 'a coming weekday');
    await openNav(page, 'Slots & Availability');
    await page.getByRole('combobox', { name: 'Filter slots by doctor' }).selectOption(name);
    await page.getByLabel('Slot grid date').fill(nextDay);
    await expect
      .poll(
        async () => {
          await page.getByRole('button', { name: 'Refresh the slot grid' }).click();
          return slotCells(page, name).count();
        },
        { timeout: SLOT_WAIT_MS, message: `slots for ${name} on ${nextDay}` },
      )
      .toBeGreaterThan(0);
  });

  /* A-4 ------------------------------------------------------------------ */
  await uatStep('A-4', { watch: watch(), pages }, async () => {
    const { page } = needs(desk, 'A-1');
    const doc = needs(doctor, 'A-3');
    const day = needs(dates, 'A-3');
    // A patient has booked the new doctor on the day the leave will cover.
    await waitForOnlineSlots(doc.id, day.leave);
    const booking = await bookOnline({ doctorId: doc.id, date: day.leave });

    await goTo(page, `${ADMIN}/doctors/${doc.id}?tab=availability`);
    await expect(page.getByText('Leave / Unavailability')).toBeVisible();

    // Leave: the affected booking is listed before anything is applied.
    // The section header's button (the empty state offers the same action).
    await page.getByRole('button', { name: 'Add Leave' }).first().click();
    const leave = dialog(page, 'Add Leave');
    await leave.getByLabel(/^From/).fill(day.leave);
    await leave.getByLabel(/^To/).fill(day.leave);
    await leave.getByLabel(/^Reason/).fill('Medical conference');
    await leave.getByRole('button', { name: 'Add Leave' }).click();
    const confirm = dialog(page, 'Cancel existing bookings?');
    await expect(
      confirm.getByText(booking.appointment.booking_ref, { exact: false }),
    ).toBeVisible();
    await confirm.getByRole('button', { name: 'Apply & cancel 1 booking' }).click();
    await expect(toast(page, 'Leave added')).toBeVisible();

    // A weekly session: shorter hours on a day without bookings.
    await page.getByRole('combobox', { name: `${day.weekly} end time` }).selectOption('4:00 pm');
    await page.getByRole('button', { name: 'Save Changes' }).click();
    const noBookings = dialog(page, 'Apply this change?');
    if (await noBookings.isVisible().catch(() => false)) {
      await noBookings.getByRole('button', { name: 'Apply' }).click();
    }
    await expect(toast(page, 'Doctor profile saved')).toBeVisible();

    // A date exception: closed all day.
    await goTo(page, `${ADMIN}/doctors/${doc.id}?tab=availability`);
    await page.getByRole('button', { name: 'Add Date Exception' }).first().click();
    const exception = dialog(page, 'Add Date Exception');
    await exception.getByLabel(/^Date/).fill(day.exception);
    await exception.getByRole('switch', { name: 'Closed all day' }).click();
    await exception.getByLabel(/^Reason/).fill('Out of station');
    await exception.getByRole('button', { name: 'Add Exception' }).click();
    await expect(toast(page, 'Date exception added')).toBeVisible();

    // The changes apply: the next 14 days show them.
    await page.reload();
    const upcoming = page.getByText('Next 14 days').locator('xpath=../..');
    await expect(upcoming.getByText('On leave')).toBeVisible();
    await expect(upcoming.getByText('Closed (date exception)')).toBeVisible();
    await expect(upcoming.getByText(/Morning 9:00 am–4:00 pm/).first()).toBeVisible();
    const cancelled = await booking.patient.get<{ status: string }>(
      `/patient/appointments/${booking.appointment.id}`,
    );
    expect(cancelled.status, 'the booking on the leave day is cancelled').toBe('cancelled');
  });

  /* A-5 ------------------------------------------------------------------ */
  await uatStep('A-5', { watch: watch(), pages }, async () => {
    const { page } = needs(desk, 'A-1');
    const doc = needs(doctor, 'A-3');
    const day = needs(dates, 'A-3');
    const afternoon = (slot: { readonly starts_at: string }) =>
      clockIn(new Date(slot.starts_at)) >= AFTERNOON;
    await waitForOnlineSlots(doc.id, day.bulk, afternoon);
    const booking = await bookOnline({ doctorId: doc.id, date: day.bulk, slotFilter: afternoon });

    await openNav(page, 'Slots & Availability');
    await page.getByRole('combobox', { name: 'Filter slots by doctor' }).selectOption(doc.name);
    await page.getByLabel('Slot grid date').fill(day.bulk);
    // Block one free slot, then reopen it.
    const cell = page
      .getByRole('button', {
        name: new RegExp(`^${escapeRegExp(doc.name)}, .*Block this slot\\.$`),
      })
      .first();
    await expect(cell).toBeVisible();
    const label = needs(
      /, (.+?) — /.exec((await cell.getAttribute('aria-label')) ?? '')?.[1],
      'a slot',
    );
    await cell.click();
    await expect(toast(page, `${doc.name} · ${label} blocked`)).toBeVisible();
    const blocked = page.getByRole('button', {
      name: new RegExp(`^${escapeRegExp(doc.name)}, ${escapeRegExp(label)} — .*Open this slot\\.$`),
    });
    await blocked.click();
    await expect(toast(page, `${doc.name} · ${label} opened`)).toBeVisible();

    // Bulk-block the afternoon: the booking in it is listed before confirming.
    await page.getByRole('button', { name: 'Bulk Update', exact: true }).click();
    const bulk = dialog(page, 'Bulk Update Slots');
    await bulk.getByRole('combobox', { name: /Apply to/ }).selectOption('This date — one doctor');
    await bulk.getByRole('combobox', { name: /^Doctor/ }).selectOption(doc.name);
    await bulk.getByRole('combobox', { name: /^From/ }).selectOption('1:00 pm');
    await bulk.getByRole('combobox', { name: /^To/ }).selectOption('5:00 pm');
    await bulk.getByRole('combobox', { name: /^Action/ }).selectOption('Block');
    await expect(bulk.getByText(/1 booking will be cancelled with a full refund/)).toBeVisible();
    await bulk.getByRole('button', { name: /^Block \d+ slots?$/ }).click();
    const confirm = dialog(page, 'Block Slots');
    await expect(confirm.getByText(booking.personName, { exact: false })).toBeVisible();
    await confirm.getByRole('button', { name: 'Block and cancel 1 booking' }).click();
    await expect(toast(page, /blocked, 1 booking cancelled and refunded/)).toBeVisible();

    // Regenerate this doctor's slots.
    await page.getByRole('button', { name: `Regenerate ${doc.name}` }).click();
    const result = dialog(page, 'Slots regenerated');
    await expect(result).toBeVisible();
    await result.getByRole('button', { name: 'Done' }).click();
  });

  /* A-6 ------------------------------------------------------------------ */
  await uatStep('A-6', { watch: watch(), pages }, async () => {
    const { page } = needs(desk, 'A-1');
    holidays = await hospitalHolidays(adminApi);
    const used = Object.values(dates ?? {});
    let date = addDays(today, 7);
    while (isSunday(date) || isHoliday(holidays, date) || used.includes(date))
      date = addDays(date, 1);
    // Someone has booked that day, so the closure has bookings to list.
    const doctors = (await hospitalDoctors(adminApi)).filter(
      (d) => d.status === 'active' && d.is_bookable_online,
    );
    let booking: OnlineBooking | null = null;
    for (const d of doctors) {
      booking = await bookOnline({ doctorId: d.id, date }).catch(() => null);
      if (booking) break;
    }
    const affected = needs(booking, 'an online booking on the closure day');
    const name = `UAT closure ${tag}`;

    await openNav(page, 'Hospital Profile');
    await page.getByRole('tab', { name: 'Holiday Calendar' }).click();
    await page.getByRole('button', { name: 'Add Closure' }).click();
    const modal = dialog(page, 'Add Closure');
    await modal.getByLabel(/Closure Name/).fill(name);
    await modal.getByLabel('Closure start date').fill(date);
    await modal.getByLabel('Closure end date').fill(date);
    await modal.getByRole('button', { name: 'Add Closure' }).click();
    const confirm = dialog(page, 'Cancel existing bookings?');
    await expect(
      confirm.getByText(affected.appointment.booking_ref, { exact: false }),
    ).toBeVisible();
    await confirm.getByRole('button', { name: /^Apply & cancel \d+ bookings?$/ }).click();
    await expect(toast(page, /^Holiday added — slots will not be generated/)).toBeVisible();
    await expect(row(page, name)).toBeVisible();

    // Bookings that day are blocked: the slot grid shows the closure.
    const saved = needs(
      (await hospitalHolidays(adminApi)).find((h) => h.name === name),
      'the new closure',
    );
    holiday = { id: saved.id, name };
    await openNav(page, 'Slots & Availability');
    await page.getByLabel('Slot grid date').fill(date);
    await expect(page.getByText(`${name} — the hospital is closed on this date`)).toBeVisible();

    // Edit it (BE-12: the edit carries If-Match).
    await openNav(page, 'Hospital Profile');
    await page.getByRole('tab', { name: 'Holiday Calendar' }).click();
    await page.getByTitle(`Edit ${name}`, { exact: true }).click();
    const edit = dialog(page, 'Edit Closure');
    await edit.getByLabel(/^Note/).fill('Emergency care only.');
    await edit.getByRole('button', { name: 'Save Closure' }).click();
    // The dry run may list bookings it keeps (already being seen elsewhere on
    // the horizon); a note edit must cancel none.
    const keepList = dialog(page, 'Apply this change?');
    const saved2 = toast(page, /^Holiday saved/);
    await expect(keepList.or(saved2).first()).toBeVisible();
    if (await keepList.isVisible()) {
      await expect(keepList.getByText('Applying the change cancels no bookings.')).toBeVisible();
      await keepList.getByRole('button', { name: 'Apply', exact: true }).click();
    }
    await expect(saved2).toBeVisible();
    await expect(row(page, name).getByText('Emergency care only.')).toBeVisible();
  });

  /* A-7 ------------------------------------------------------------------ */
  await uatStep('A-7', { watch: watch(), pages }, async () => {
    const { page } = needs(desk, 'A-1');
    const line2 = `Opp. Vyttila Hub, UAT ${tag}`;
    await openNav(page, 'Hospital Settings');
    await page
      .getByRole('navigation', { name: 'Hospital settings sections' })
      .getByRole('button', { name: 'General' })
      .click();
    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'logo.png',
      mimeType: 'image/png',
      buffer: TINY_PNG,
    });
    await expect(page.getByText('Uploading…')).toHaveCount(0);
    await page.getByLabel(/Address Line 2/).fill(line2);
    await page.getByRole('button', { name: 'Save Settings' }).click();
    await expect(toast(page, 'Settings saved')).toBeVisible();

    // The next receipt carries the new address.
    const session = await cleanSessionToday(adminApi, { minOpenSlots: 1, clean: false });
    const walkIn = await bookWalkIn(
      adminApi,
      session.doctor,
      needs(session.openSlots[0], 'a slot').id,
      {
        firstName: 'Receipt',
        lastName: `Uat${tag}`,
      },
    );
    await collectAtDesk(adminApi, walkIn, 'upi', `UPI${tag}A7`);
    await goTo(page, `${ADMIN}/appointments?appointment=${walkIn.id}`);
    await dialog(page, `Receipt Uat${tag}`).getByRole('button', { name: 'Receipt' }).click();
    await expect(dialog(page, 'Receipt').getByText(line2, { exact: false })).toBeVisible();
    await closeDialogs(page);
  });

  /* A-8 ------------------------------------------------------------------ */
  await uatStep('A-8', { watch: watch(), pages }, async () => {
    const { page } = needs(desk, 'A-1');
    const sections = page.getByRole('navigation', { name: 'Hospital settings sections' });
    const restore: (() => Promise<void>)[] = [];
    try {
      await openNav(page, 'Hospital Settings');

      // Booking window and follow-up window.
      await sections.getByRole('button', { name: 'Booking & Cancellation' }).click();
      const windowField = page.getByLabel('Booking window in days');
      const followField = page.getByLabel('Follow-up window in days');
      const windowWas = await windowField.inputValue();
      const followWas = await followField.inputValue();
      await windowField.fill(String(Number(windowWas) + 1));
      await followField.fill(String(Number(followWas) + 1));
      restore.push(async () => {
        await sections.getByRole('button', { name: 'Booking & Cancellation' }).click();
        await windowField.fill(windowWas);
        await followField.fill(followWas);
      });

      // Token scheme: the desk marker.
      await sections.getByRole('button', { name: 'Queue & Tokens' }).click();
      const deskMarker = page.getByLabel(/Desk marker/);
      const markerWas = await deskMarker.inputValue();
      const markerNow = markerWas === 'D' ? 'X' : 'D';
      await deskMarker.fill(markerNow);
      restore.push(async () => {
        await sections.getByRole('button', { name: 'Queue & Tokens' }).click();
        await deskMarker.fill(markerWas);
      });

      // Hours: Saturday closes half an hour earlier.
      await sections.getByRole('button', { name: 'Working Hours' }).click();
      const satClose = page.getByRole('combobox', { name: 'Saturday closing time' });
      const closeWas = await satClose.inputValue();
      await satClose.selectOption('7:30 pm');
      restore.push(async () => {
        await sections.getByRole('button', { name: 'Working Hours' }).click();
        await satClose.selectOption(closeWas);
      });

      await page.getByRole('button', { name: 'Save Settings' }).click();
      await expect(toast(page, /^Settings saved/)).toBeVisible();

      // They took effect: re-read after a reload, and a new desk token carries the new marker.
      await page.reload();
      await sections.getByRole('button', { name: 'Booking & Cancellation' }).click();
      await expect(page.getByLabel('Booking window in days')).toHaveValue(
        String(Number(windowWas) + 1),
      );
      await expect(page.getByLabel('Follow-up window in days')).toHaveValue(
        String(Number(followWas) + 1),
      );
      await sections.getByRole('button', { name: 'Working Hours' }).click();
      await expect(page.getByRole('combobox', { name: 'Saturday closing time' })).toHaveValue(
        '7:30 pm',
      );
      const session = await cleanSessionToday(adminApi, { minOpenSlots: 1, clean: false });
      const walkIn = await bookWalkIn(
        adminApi,
        session.doctor,
        needs(session.openSlots[0], 'a slot').id,
        {
          firstName: 'Marker',
          lastName: `Uat${tag}`,
        },
      );
      expect(walkIn.token_label?.startsWith(markerNow), `desk token ${walkIn.token_label}`).toBe(
        true,
      );

      // Bank account: a new bank name.
      await sections.getByRole('button', { name: 'Bank & Payouts' }).click();
      const edit = page.getByRole('button', { name: /^Edit account ending / }).first();
      await edit.click();
      const modal = dialog(page, 'Edit Bank Account');
      const bank = modal.getByLabel(/^Bank/);
      const bankWas = await bank.inputValue();
      await bank.fill(`${bankWas.replace(/ \(UAT\)$/, '')} (UAT)`);
      await modal.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(toast(page, 'Bank account saved')).toBeVisible();
      await expect(page.getByText(`${bankWas.replace(/ \(UAT\)$/, '')} (UAT)`)).toBeVisible();
      await page
        .getByRole('button', { name: /^Edit account ending / })
        .first()
        .click();
      await dialog(page, 'Edit Bank Account')
        .getByLabel(/^Bank/)
        .fill(bankWas.replace(/ \(UAT\)$/, ''));
      await dialog(page, 'Edit Bank Account')
        .getByRole('button', { name: 'Save', exact: true })
        .click();
      await expect(toast(page, 'Bank account saved')).toBeVisible();
    } finally {
      // Put the hospital's rules back for the other sections and later runs.
      if (restore.length > 0) {
        await page.reload();
        for (const undo of restore) await undo();
        await page.getByRole('button', { name: 'Save Settings' }).click();
        await expect(toast(page, /^Settings saved/)).toBeVisible();
      }
    }
  });

  /* A-9 ------------------------------------------------------------------ */
  await uatStep(
    'A-9',
    {
      watch: watch(),
      pages,
      allow: [
        {
          status: 409,
          path: /^DELETE \/api\/v1\/hospital\/tax-rates\//,
          why: 'B4: a rate still billed by a service is refused with TAX_RATE_IN_USE',
        },
      ],
    },
    async () => {
      const { page } = needs(desk, 'A-1');
      const taxName = `UAT GST ${tag}`;
      const serviceName = `UAT Scan ${tag}`;
      const couponCode = `UAT${tag.toUpperCase()}10`;
      const department = needs(
        (await hospitalDepartments(adminApi)).find((d) => d.is_active),
        'an active department',
      );
      await openNav(page, 'Services & Pricing');

      // A tax rate.
      await page.getByRole('tab', { name: 'Taxes' }).click();
      await page.getByRole('button', { name: 'Add Tax Rate' }).click();
      const tax = dialog(page, 'Add Tax Rate');
      await tax.getByLabel(/Tax Name/).fill(taxName);
      await tax.getByLabel(/Rate \(%\)/).fill('12');
      await tax.getByRole('button', { name: 'Add Tax Rate' }).click();
      await expect(toast(page, 'Tax rate added')).toBeVisible();

      // A service billed with it: the price shows the tax.
      await page.getByRole('tab', { name: 'Services' }).click();
      await page.getByRole('button', { name: 'Add Service' }).click();
      const service = dialog(page, 'Add Service');
      await service.getByLabel(/Service Name/).fill(serviceName);
      await service.getByRole('combobox', { name: /Department/ }).selectOption(department.name);
      await service.getByLabel(/Duration/).fill('15');
      await service.getByLabel(/Price/).fill('1000');
      await service.getByRole('combobox', { name: /^Tax/ }).selectOption(`${taxName} 12%`);
      await service.getByRole('button', { name: 'Add Service' }).click();
      await expect(toast(page, 'Service added')).toBeVisible();
      // Earlier runs' services page the list: find this one by name.
      const findService = () =>
        page.getByRole('textbox', { name: 'Search services' }).fill(serviceName);
      await findService();
      const serviceRow = row(page, serviceName);
      await expect(serviceRow.getByText(rupees(1120))).toBeVisible();
      await expect(serviceRow.getByText(`+ ${rupees(120)} tax`)).toBeVisible();

      // A coupon (department-scoped only, decision 7).
      await page.getByRole('tab', { name: 'Coupons' }).click();
      await page.getByRole('button', { name: 'Create Coupon' }).click();
      const coupon = dialog(page, 'Create Coupon');
      await coupon.getByLabel(/^Code/).fill(couponCode);
      await coupon.getByLabel(/Discount \(%\)/).fill('10');
      await coupon.getByLabel('Valid from').fill(today);
      await coupon.getByLabel('Valid until').fill(addDays(today, 30));
      await coupon.getByRole('combobox', { name: /Departments/ }).selectOption(department.name);
      await coupon.getByRole('button', { name: 'Create Coupon' }).click();
      await expect(toast(page, 'Coupon created')).toBeVisible();
      // Earlier runs' coupons page the list: find this one by its code.
      await page.getByRole('textbox', { name: 'Search coupon codes' }).fill(couponCode);
      await expect(row(page, couponCode)).toBeVisible();

      // Delete the rate: refused while the service bills with it …
      await page.getByRole('tab', { name: 'Taxes' }).click();
      await page.getByTitle(`Delete ${taxName}`, { exact: true }).click();
      // The rate in use is refused up front (B4, TAX_RATE_IN_USE), naming the service.
      const inUse = dialog(page, new RegExp(`^${escapeRegExp(taxName)}( \\d+%)? is still in use$`));
      const askFirst = dialog(page, 'Delete this tax rate?');
      await expect(inUse.or(askFirst).first()).toBeVisible();
      if (await askFirst.isVisible())
        await askFirst.getByRole('button', { name: 'Delete' }).click();
      await expect(inUse.getByText(serviceName)).toBeVisible();
      await inUse.getByRole('button', { name: 'OK' }).click();
      // … so the service goes to "No tax" first, then the rate is deleted.
      await page.getByRole('tab', { name: 'Services' }).click();
      await findService();
      await page.getByTitle(`Edit ${serviceName}`, { exact: true }).click();
      const edit = dialog(page, 'Edit Service');
      await edit.getByRole('combobox', { name: /^Tax/ }).selectOption('No tax (exempt)');
      await edit.getByRole('button', { name: 'Save Service' }).click();
      await expect(toast(page, 'Service saved')).toBeVisible();
      await page.getByRole('tab', { name: 'Taxes' }).click();
      await page.getByTitle(`Delete ${taxName}`, { exact: true }).click();
      await dialog(page, 'Delete this tax rate?').getByRole('button', { name: 'Delete' }).click();
      await expect(toast(page, `“${taxName}” deleted`)).toBeVisible();
      // The deleted rate no longer applies.
      await page.getByRole('tab', { name: 'Services' }).click();
      await findService();
      await expect(row(page, serviceName).getByText('tax exempt')).toBeVisible();
      await expect(row(page, serviceName).getByText(rupees(1000)).first()).toBeVisible();
    },
  );

  /* A-10 ----------------------------------------------------------------- */
  await uatStep('A-10', { watch: watch(), pages }, async () => {
    const { page } = needs(desk, 'A-1');
    const email = `uat.invitee.${tag.toLowerCase()}${Date.now() % 100_000}@lakeshore.medibook.example.com`;
    const name = `Revathi Uat${tag}`;
    await openNav(page, 'Users & Roles');
    await page.getByRole('button', { name: 'Add User' }).click();
    const modal = dialog(page, 'Add User');
    await modal.getByLabel(/Full Name/).fill(name);
    await modal.getByRole('combobox', { name: /^Role/ }).selectOption('Receptionist');
    await modal.getByLabel(/^Email/).fill(email);
    const since = new Date();
    await modal.getByRole('button', { name: 'Add User' }).click();
    await expect(
      toast(page, `Invitation sent to ${email} · access pending until they accept`),
    ).toBeVisible();

    // The invitee accepts from the emailed link and lands with the role.
    const invite = await waitForDevToken(email, 'invitation', since);
    expect(invite.link, 'the emailed link opens the web app (E1)').toMatch(
      new RegExp(`^${escapeRegExp(UAT_ENV.baseUrl)}/accept-invite\\?token=`),
    );
    const invitee = await newBrowserSession(browser, 'invitee');
    contexts.push(invitee.context);
    await invitee.page.goto(invite.link);
    await expect(invitee.page.getByText(/You've been invited as/)).toContainText('Receptionist');
    await invitee.page.getByLabel('Password', { exact: true }).fill(INVITEE_PASSWORD);
    await invitee.page.getByLabel('Confirm Password', { exact: true }).fill(INVITEE_PASSWORD);
    await invitee.page.getByRole('button', { name: 'Accept & Sign In' }).click();
    await expect(invitee.page).toHaveURL(/\/receptionist\/dashboard$/);
    await expect(invitee.page.getByRole('button', { name: /^Account menu for / })).toContainText(
      'Receptionist',
    );
    // … and signs in again with the password they set.
    const firstName = invitee.page.getByRole('button', { name: /^Account menu for / });
    const shown = ((await firstName.getAttribute('aria-label')) ?? '').replace(
      'Account menu for ',
      '',
    );
    await signOut(invitee.page, shown);
    await signIn(invitee.page, 'hospital', email, INVITEE_PASSWORD);
    await expect(invitee.page).toHaveURL(/\/receptionist\/dashboard$/);

    // A role's permission grid saves.
    await openNav(page, 'Users & Roles');
    await page.getByRole('tab', { name: 'Roles & Permissions' }).click();
    const roleCard = page.getByRole('button', { name: /Department Front Desk/ }).first();
    await roleCard.click();
    const editor = page
      .getByRole('dialog')
      .filter({ hasText: 'Choose what this role can do in each module' });
    const reportsView = editor.getByRole('checkbox', { name: 'View on Reports' });
    const was = (await reportsView.getAttribute('aria-checked')) === 'true';
    await reportsView.click();
    await editor.getByRole('button', { name: 'Save Role' }).click();
    await expect(toast(page, /updated$/)).toBeVisible();
    await page
      .getByRole('button', { name: /Department Front Desk/ })
      .first()
      .click();
    await expect(
      page.getByRole('dialog').getByRole('checkbox', { name: 'View on Reports' }),
    ).toHaveAttribute('aria-checked', String(!was));
    // Put the grid back.
    await page.getByRole('dialog').getByRole('checkbox', { name: 'View on Reports' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Save Role' }).click();
    // The first save's toast may still be up: this is the second one.
    await expect(toast(page, /updated$/)).toHaveCount(2);
  });

  /* A-11 ----------------------------------------------------------------- */
  await uatStep('A-11', { watch: watch(), pages }, async () => {
    const { page } = needs(desk, 'A-1');
    const lines = await adminApi.all<PaymentLineDto>('/payments', {
      method: 'cash',
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
          l.patient,
      ),
      'a cash payment of a completed walk-in (seed data)',
    );
    refundedAppointmentId = line.appointment_id;
    const amount = line.amount_paise / 100;
    const day = isoDateIn(new Date(needs(line.captured_at, 'capture time')));

    // Your own drawer, opened with a float.
    await openNav(page, 'Payments');
    const open = page.getByText('Your cash drawer is open');
    const closed = page.getByText('Your cash drawer is closed');
    await expect(open.or(closed)).toBeVisible();
    if (await closed.isVisible()) {
      await page.getByLabel(/Opening float/).fill(String(DRAWER_FLOAT_RUPEES));
      await page.getByRole('button', { name: 'Open drawer' }).click();
      await expect(open).toBeVisible();
    }
    const before = rupeesIn(await expectedInDrawer(page).innerText());

    await page.getByRole('combobox', { name: 'Filter by date' }).selectOption('Custom range');
    await page.getByLabel('From date').fill(day);
    await page.getByLabel('To date').fill(day);
    await paymentSearch(page).fill(needs(line.booking_refs[0], 'booking ref'));
    const target = row(page, needs(line.patient, 'patient').full_name).filter({ hasText: 'Cash' });
    await target.getByRole('button', { name: 'Refund booking' }).click();
    const modal = dialog(page, 'Refund booking');
    await expect(modal.getByText(/in cash is handed back from/)).toBeVisible();
    await modal.getByLabel('Reason').fill('Consultation not given — refunded at the desk');
    await modal.getByRole('button', { name: `Refund ${rupees(amount)} in full` }).click();
    await expect(toast(page, 'Refund recorded')).toBeVisible();
    await expect(target.getByText('Refunded', { exact: true }).first()).toBeVisible();
    // The cash came out of this drawer.
    await expect(expectedInDrawer(page)).toHaveText(rupees(before - amount));

    // Reconcile a receptionist's closed drawer: it leaves the queue.
    const queue = page.getByRole('region', { name: 'Cash drawers to reconcile' });
    const waiting = queue
      .getByRole('row')
      .filter({ has: page.getByRole('button', { name: 'Reconcile' }) });
    await expect(waiting.first()).toBeVisible();
    const preferred = waiting.filter({ hasText: receptionist.name });
    const drawer = (await preferred.count()) > 0 ? preferred.first() : waiting.first();
    const staffName = (
      (await drawer.getByRole('cell').first().innerText()).split('\n')[0] ?? ''
    ).trim();
    const count = await waiting.count();
    await drawer.getByRole('button', { name: 'Reconcile' }).click();
    const reconcile = dialog(page, `Reconcile ${staffName}’s drawer`);
    const found = reconcile.getByLabel(/Cash found in the drawer/);
    if (await found.isVisible()) {
      // A drawer closed at 23:59 without a count: count it now.
      const expected = rupeesIn(
        await reconcile
          .getByText('Expected', { exact: true })
          .locator('xpath=following-sibling::*[1]')
          .innerText(),
      );
      await found.fill(String(expected));
    }
    await reconcile
      .getByLabel('Reconcile note')
      .fill('Counted with the receptionist; variance explained.');
    await reconcile.getByRole('button', { name: 'Mark reconciled' }).click();
    await expect(toast(page, `${staffName}’s drawer reconciled`)).toBeVisible();
    await expect(waiting).toHaveCount(count - 1);

    // Close your own drawer again for the next run.
    const now = rupeesIn(await expectedInDrawer(page).innerText());
    await page.getByRole('button', { name: 'Close drawer' }).click();
    const close = dialog(page, 'Close your cash drawer');
    await close.getByLabel(/Cash counted/).fill(String(now));
    await close.getByRole('button', { name: 'Close drawer' }).click();
    await expect(page.getByText('Your cash drawer is closed')).toBeVisible();
  });

  /* A-12 ----------------------------------------------------------------- */
  await uatStep('A-12', { watch: watch(), pages }, async () => {
    const { page } = needs(desk, 'A-1');
    const record = await createDeskPatient(adminApi, { firstName: 'Lata', lastName: `Uat${tag}` });
    const newPhone = randomMobile().slice(3);

    // The receptionist edits the phone; the hospital requires approval (D-29).
    const reception = await openStaff(browser, 'hospital', receptionist.email);
    contexts.push(reception.context);
    await goTo(reception.page, `/receptionist/patients/${encodeURIComponent(record.mrn)}`);
    await reception.page.getByRole('button', { name: 'Edit', exact: true }).click();
    const edit = dialog(reception.page, 'Edit Patient');
    await edit.getByLabel(/Phone Number/).fill(newPhone);
    await edit.getByRole('button', { name: 'Save Changes' }).click();
    await expect(toast(reception.page, 'Changes sent to an admin for approval')).toBeVisible();

    // The admin sees exactly the phone change and approves it.
    await openNav(page, 'Patients');
    await page.getByRole('tab', { name: /^Approvals/ }).click();
    const request = row(page, `Lata Uat${tag}`);
    await expect(request).toBeVisible();
    await expect(request.getByRole('term')).toHaveCount(1);
    await expect(request.getByRole('term')).toContainText(/phone/i);
    await expect(request.getByText(newPhone, { exact: false })).toBeVisible();
    await request.getByRole('button', { name: 'Approve' }).click();
    await expect(toast(page, 'Change approved')).toBeVisible();

    // Only the phone changed.
    const after = await adminApi.get<{ full_name: string; phone_e164: string | null }>(
      `/patients/${record.id}`,
    );
    expect(after.phone_e164).toBe(`+91${newPhone}`);
    expect(after.full_name).toBe(record.full_name);
  });

  /* A-13 ----------------------------------------------------------------- */
  await uatStep('A-13', { pages }, async () => {
    const sahyadriApi = await ApiClient.staff('hospital', sahyadriAdmin.email);
    const bookable = (await hospitalDoctors(sahyadriApi)).filter(
      (d) => d.status === 'active' && d.is_bookable_online,
    );
    await sahyadriApi.dispose();
    // Two paid online requests (Sahyadri approves online bookings, Q90).
    const requests: OnlineBooking[] = [];
    for (let day = 1; day <= 7 && requests.length < 2; day += 1) {
      for (const d of bookable) {
        if (requests.length >= 2) break;
        const booked = await bookOnline({ doctorId: d.id, date: addDays(today, day) }).catch(
          () => null,
        );
        if (booked) requests.push(booked);
      }
    }
    const [toApprove, toReject] = [
      needs(requests[0], 'an online request'),
      needs(requests[1], 'a second request'),
    ];
    expect(toApprove.appointment.status).toBe('pending_approval');

    const sahyadri = await openStaff(browser, 'hospital', sahyadriAdmin.email);
    contexts.push(sahyadri.context);
    const { page } = sahyadri;
    await openNav(page, 'Appointments');
    await page.getByRole('tab', { name: /^Needs Approval/ }).click();
    await appointmentSearch(page).fill(toApprove.appointment.booking_ref);
    const first = row(page, toApprove.personName);
    // The search narrows the upcoming requests to this booking.
    await expect(first).toHaveCount(1);
    await first.getByRole('button', { name: 'Approve' }).click();
    await expect(toast(page, 'Booking approved')).toBeVisible();

    await goTo(page, `${ADMIN}/appointments?appointment=${toApprove.appointment.id}`);
    await expect(
      page.getByRole('dialog').getByText('Scheduled', { exact: true }).first(),
    ).toBeVisible();
    await closeDialogs(page);

    await goTo(page, `${ADMIN}/appointments?appointment=${toReject.appointment.id}`);
    const drawer = page.getByRole('dialog');
    await drawer.getByRole('button', { name: 'Reject' }).click();
    const reason = dialog(page, 'Reject Booking');
    await expect(reason.getByText(/refunded/)).toBeVisible();
    await reason.getByLabel('Reason').fill('Doctor unavailable that day — patient informed');
    await reason.getByRole('button', { name: 'Reject & refund' }).click();
    await expect(toast(page, /Booking rejected/)).toBeVisible();
    // The rejected booking is refunded in full (online refunds settle via the gateway).
    await expect
      .poll(
        async () =>
          (
            await toReject.patient.get<{ status: string; payment_status: string }>(
              `/patient/appointments/${toReject.appointment.id}`,
            )
          ).payment_status,
        { timeout: REFUND_WAIT_MS, message: 'the rejected booking is refunded' },
      )
      .toBe('refunded');
    await page.reload();
    await expect(
      page.getByRole('dialog').getByText('Refunded', { exact: true }).first(),
    ).toBeVisible();
  });

  /* A-14 ----------------------------------------------------------------- */
  await uatStep('A-14', { watch: watch(), pages }, async () => {
    const { page } = needs(desk, 'A-1');
    const doctors = (await hospitalDoctors(adminApi)).filter(
      (d) => d.status === 'active' && d.is_bookable_online,
    );
    let booking: OnlineBooking | null = null;
    for (let day = 1; day <= 7 && !booking; day += 1) {
      for (const d of doctors) {
        booking = await bookOnline({ doctorId: d.id, date: addDays(today, day) }).catch(() => null);
        if (booking) break;
      }
    }
    const appt = needs(booking, 'an upcoming booking');
    const desk2 = await adminApi.get<{ patient: { mrn: string } | null }>(
      `/appointments/${appt.appointment.id}`,
    );
    const mrn = needs(desk2.patient, 'the patient record').mrn;

    await openNav(page, 'Messaging');
    await page.getByRole('tab', { name: 'Send & Outbox' }).click();
    await page.getByRole('button', { name: 'Send a Message' }).click();
    const modal = dialog(page, 'Send a message');
    await modal.getByLabel(/Find patient/).fill(mrn);
    const patientSelect = modal.getByRole('combobox', { name: /^Patient/ });
    await expect
      .poll(async () =>
        (await patientSelect.locator('option').allTextContents()).some((o) => o.includes(mrn)),
      )
      .toBe(true);
    const patientOption = (await patientSelect.locator('option').allTextContents()).find((o) =>
      o.includes(mrn),
    );
    await patientSelect.selectOption({ label: needs(patientOption, 'the patient') });
    const apptSelect = modal.getByRole('combobox', { name: /^Appointment/ });
    await expect
      .poll(async () =>
        (await apptSelect.locator('option').allTextContents()).some((o) =>
          o.startsWith(appt.appointment.booking_ref),
        ),
      )
      .toBe(true);
    const apptOption = (await apptSelect.locator('option').allTextContents()).find((o) =>
      o.startsWith(appt.appointment.booking_ref),
    );
    await apptSelect.selectOption({ label: needs(apptOption, 'the booking') });
    await modal.getByRole('combobox', { name: /^Message/ }).selectOption('Reminder');
    await modal.getByRole('button', { name: 'Review & queue' }).click();
    await dialog(page, 'Queue this message?')
      .getByRole('button', { name: 'Queue message' })
      .click();
    const queued = toast(page, /^Reminder queued for .+ by SMS to /);
    await expect(queued).toBeVisible();
    const address = ((await queued.innerText()).split(' to ').pop() ?? '').trim();

    // The delivery is listed with its status.
    const search = page.getByRole('textbox', { name: 'Search the outbox by exact value' });
    await search.fill(address);
    await search.press('Enter');
    const delivery = row(page, address).filter({ hasText: 'Reminder' }).first();
    await expect(delivery).toBeVisible({ timeout: DELIVERY_WAIT_MS });
    await expect(
      delivery.getByText(/^(Queued|Sending|Sent|Delivered|Failed|Bounced|Suppressed)$/),
    ).toBeVisible();
  });

  /* A-15 ----------------------------------------------------------------- */
  await uatStep('A-15', { watch: watch(), pages }, async () => {
    const { page } = needs(desk, 'A-1');
    const closure = needs(holiday, 'A-6');
    const refunded = needs(refundedAppointmentId, 'A-11');
    await openNav(page, 'Audit Trail');
    const search = page.getByRole('textbox', { name: 'Search the audit trail by exact value' });
    const trail = page.getByRole('region', { name: 'Audit trail' });

    await search.fill(closure.id);
    await search.press('Enter');
    // The actor column names the person; your own entries read "You".
    const actor = new RegExp(`\\b(You|${escapeRegExp(admin.name)})\\b`);
    const holidayRows = trail.getByRole('row').filter({ hasText: actor });
    await expect(holidayRows.first()).toBeVisible();
    await expect(holidayRows.first().getByText(fmtDate(today).slice(0, 6))).toBeVisible();

    const csv = await download(page, () =>
      page.getByRole('button', { name: 'Export CSV' }).click(),
    );
    expect(csv.text(), 'the export carries the holiday entries').toContain(closure.id);
    expect(csvRows(csv.text()).length).toBeGreaterThan(1);

    await search.fill(refunded);
    await search.press('Enter');
    const refundRow = trail
      .getByRole('row')
      .filter({ hasText: /\/refunds/ })
      .filter({ hasText: actor });
    await expect(refundRow.first()).toBeVisible();
  });

  /* A-16 ----------------------------------------------------------------- */
  await uatStep('A-16', { watch: watch(), pages }, async () => {
    const { page } = needs(desk, 'A-1');
    const catalog = (await adminApi.get<ApiPage<{ code: string; title: string }>>('/reports'))
      .results;
    expect(catalog.length, 'every hospital report of the sheet').toBe(14);
    await openNav(page, 'Reports');
    for (const report of catalog) {
      const [answer] = await Promise.all([
        page.waitForResponse(isPath('GET', new RegExp(`/api/v1/hospital/reports/${report.code}$`))),
        page.getByRole('button', { name: new RegExp(`^${escapeRegExp(report.title)}`) }).click(),
      ]).catch(async () => {
        // The first report is already open: re-read it.
        return Promise.all([
          page.waitForResponse(
            isPath('GET', new RegExp(`/api/v1/hospital/reports/${report.code}$`)),
          ),
          page.getByRole('button', { name: `Refresh the ${report.title.toLowerCase()}` }).click(),
        ]);
      });
      expect(answer.status(), `${report.title} loads`).toBe(200);
      const data = (await answer.json()) as ReportDto;
      const table = page.getByRole('region', { name: `${report.title} rows` });
      for (const column of data.columns) {
        await expect(table.getByRole('columnheader', { name: column.label }).first()).toBeVisible();
      }
      for (const kpi of data.kpis) {
        await expect(page.getByText(kpi.label, { exact: true }).first()).toBeVisible();
      }
    }
    // Export one of them.
    await page.getByRole('button', { name: /^Appointment Report/ }).click();
    const xlsx = await download(page, () =>
      page.getByRole('button', { name: 'Export Excel' }).click(),
    );
    expect(isXlsx(xlsx.bytes), 'the report exports to Excel (UAT-67)').toBe(true);
  });

  // Housekeeping: the doctor this run added is removed again (plan limits).
  if (doctor) {
    const added = doctor as { readonly id: string };
    await adminApi
      .delete(`/doctors/${added.id}`, { params: { confirm: true } })
      .catch(() => undefined);
  }
  for (const context of contexts) await context.close();
  if (desk) await (desk as StaffSession).context.close();
  await adminApi.dispose();
  await disposePatients();
});
