import { expect, test, type BrowserContext } from '@playwright/test';

import { hospitalStaff, passwordOf, platformStaff, rememberPassword } from './support/accounts.ts';
import { ApiClient } from './support/api.ts';
import {
  bookOnline,
  bookOnlineSoon,
  bookWalkIn,
  cleanSessionToday,
  disposePatients,
  openSlotsOf,
  randomMobile,
  runTag,
  type DeskAppointment,
  type OnlineBooking,
  type TodaySession,
} from './support/booking.ts';
import {
  appointmentSearch,
  bookWalkInOnScreen,
  expectedInDrawer,
  paymentSearch,
  queueCard,
  rupeesIn,
} from './support/desk.ts';
import { waitForDevToken } from './support/devTokens.ts';
import { UAT_ENV } from './support/env.ts';
import { needs, uatStep } from './support/steps.ts';
import { spendSignIn } from './support/throttle.ts';
import { rupees, todayIso } from './support/time.ts';
import {
  closeDialogs,
  dialog,
  download,
  goTo,
  isPdf,
  loginForm,
  newBrowserSession,
  openNav,
  openStaff,
  pdfPageCount,
  row,
  signIn,
  toast,
  topbarTitle,
  type StaffSession,
} from './support/ui.ts';

/**
 * Report §4.1 — Front desk (receptionist, Lakeshore, `vineeth.kumar`).
 * R-10: desk cancel stays admin-only (TEAM_BRIEF decision 2), so the
 * receptionist is not offered Cancel; the admin cancels in Q-3.
 */

test.describe.configure({ mode: 'serial' });

const DESK = '/receptionist';
const FLOAT_RUPEES = 500;
const SHORT_RUPEES = 50;
const IDLE_MINUTES_SIMULATED = 16;
const NEW_PASSWORD = 'Lakeshore#Desk-Rotation-77';
const ROUTE_STATE_TIMEOUT_MS = 30_000;

/** The R-section's walk-in as the API answered it, plus its patient's name. */
interface WalkIn {
  readonly appointment: DeskAppointment;
  readonly patientName: string;
}

test('4.1 Front desk — receptionist, Lakeshore', async ({ browser }) => {
  const receptionist = hospitalStaff('lakeshore', 'receptionist');
  const admin = hospitalStaff('lakeshore', 'admin');
  const firstName = receptionist.name.split(' ')[0] ?? receptionist.name;
  const tag = runTag();

  const adminApi = await ApiClient.staff('hospital', admin.email);
  let desk: StaffSession | null = null;
  let rSession: TodaySession | null = null;
  let patient: { readonly name: string; readonly mrn: string } | null = null;
  let walkIn1: WalkIn | null = null;
  let walkIn2: WalkIn | null = null;
  let online: OnlineBooking | null = null;
  const extraContexts: BrowserContext[] = [];

  const pages = () => (desk ? [desk.page] : []);
  const watch = () => (desk ? [desk.watch] : []);

  /* R-1 ------------------------------------------------------------------ */
  await uatStep('R-1', { pages }, async () => {
    const s = await newBrowserSession(browser, 'receptionist');
    desk = { ...s, email: receptionist.email };
    s.watch.begin();
    const { page } = s;
    await page.goto('/auth/login');
    const form = loginForm(page);
    await expect(form.hospitalTab).toHaveAttribute('aria-pressed', 'true');
    await expect(form.remember).not.toBeChecked();
    await form.email.fill(receptionist.email);
    await form.password.fill(passwordOf(receptionist.email));
    await spendSignIn(receptionist.email);
    // UAT-70: Enter submits the form.
    await form.password.press('Enter');
    await expect(page).toHaveURL(new RegExp(`${DESK}/dashboard$`));
    await expect(topbarTitle(page)).toHaveText('Front Desk');
    await expect(page.getByText(`Welcome back, ${firstName}`)).toBeVisible();
    await expect(page.getByText('Appointments Today')).toBeVisible();
    await expect(page.getByText('Quick Actions')).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Appointment' }).first()).toBeVisible();
    // "Keep me signed in" off: the session lives in this tab only.
    const stored = await page.evaluate(() => ({
      local: window.localStorage.getItem('medibook.auth.hospital.refresh'),
      session: window.sessionStorage.getItem('medibook.auth.hospital.refresh'),
    }));
    expect(stored.local, 'refresh token kept out of localStorage').toBeNull();
    expect(stored.session, 'refresh token in sessionStorage').not.toBeNull();
    const problems = s.watch.problems();
    expect(problems, 'the dashboard loads without errors').toEqual([]);
  });

  /* R-2 ------------------------------------------------------------------ */
  await uatStep('R-2', { watch: watch(), pages }, async () => {
    const { page } = needs(desk, 'R-1');
    await openNav(page, 'Payments');
    await expect(topbarTitle(page)).toHaveText('Payments');
    const open = page.getByText('Your cash drawer is open');
    const closed = page.getByText('Your cash drawer is closed');
    await expect(open.or(closed)).toBeVisible();
    if (await open.isVisible()) {
      // A drawer left open by an earlier, interrupted run: count it out first.
      const expected = String(rupeesIn(await expectedInDrawer(page).innerText()));
      await page.getByRole('button', { name: 'Close drawer' }).click();
      const modal = dialog(page, 'Close your cash drawer');
      await modal.getByLabel(/Cash counted/).fill(expected);
      await modal.getByRole('button', { name: 'Close drawer' }).click();
      await expect(closed).toBeVisible();
    }
    await page.getByLabel(/Opening float/).fill(String(FLOAT_RUPEES));
    await page.getByRole('button', { name: 'Open drawer' }).click();
    await expect(toast(page, `Cash drawer opened with ${rupees(FLOAT_RUPEES)}`)).toBeVisible();
    await expect(open).toBeVisible();
    await expect(expectedInDrawer(page)).toHaveText(rupees(FLOAT_RUPEES));
  });

  /* R-3 ------------------------------------------------------------------ */
  await uatStep('R-3', { watch: watch(), pages }, async () => {
    const { page } = needs(desk, 'R-1');
    await openNav(page, 'Patients');
    await page.getByRole('button', { name: 'Add Patient', exact: true }).click();
    const modal = dialog(page, 'Add Patient');
    const last = `Uat${tag}`;
    await modal.getByLabel('First Name').fill('Meera');
    await modal.getByLabel('Last Name').fill(last);
    await modal.getByLabel('Phone Number').fill(randomMobile().slice(3));
    await modal.getByLabel('Date of Birth').fill('1990-05-14');
    await modal.getByLabel('City').fill('Kochi');
    await modal.getByLabel('State').fill('Kerala');
    await modal.getByLabel('PIN Code').fill('682020');
    await modal.getByRole('button', { name: 'Add Patient' }).click();
    const added = toast(page, /^Patient added as /);
    await expect(added).toBeVisible();
    const mrn = /Patient added as (\S+)/.exec(await added.innerText())?.[1] ?? '';
    expect(mrn, 'an MR number').toMatch(/\w/);
    await expect(topbarTitle(page)).toHaveText('Patient Profile');
    await expect(page.getByText(`MR: ${mrn}`)).toBeVisible();
    patient = { name: `Meera ${last}`, mrn };
  });

  /* R-4 ------------------------------------------------------------------ */
  await uatStep('R-4', { watch: watch(), pages }, async () => {
    const { page } = needs(desk, 'R-1');
    const who = needs(patient, 'R-3');
    rSession = await cleanSessionToday(adminApi, { minOpenSlots: 4, bookableOnline: true });
    const session = rSession;
    // "Book that patient": the profile's New Appointment hands the MRN over.
    await expect(page.getByText(`MR: ${who.mrn}`)).toBeVisible();
    await page.getByRole('button', { name: 'New Appointment' }).click();
    await expect(topbarTitle(page)).toHaveText('New Appointment');
    await expect(page.getByText(who.name)).toBeVisible();
    const appointment = await bookWalkInOnScreen(page, session, async () => undefined);
    const booked = dialog(page, `Booked for ${who.name}`);
    await expect(booked).toBeVisible();
    await expect(booked.getByText(appointment.booking_ref)).toBeVisible();
    await expect(
      booked.getByText(needs(appointment.token_label, 'a token'), { exact: true }),
    ).toBeVisible();
    walkIn1 = { appointment, patientName: who.name };
  });

  /* R-5 ------------------------------------------------------------------ */
  await uatStep('R-5', { watch: watch(), pages }, async () => {
    const { page } = needs(desk, 'R-1');
    const { appointment, patientName } = needs(walkIn1, 'R-4');
    const fee = appointment.total_paise / 100;
    const booked = dialog(page, `Booked for ${patientName}`);
    await expect(booked.getByRole('combobox', { name: 'Payment method' })).toHaveValue('Cash');
    await booked.getByRole('button', { name: `Collect ${rupees(fee)}` }).click();
    await expect(toast(page, `Payment of ${rupees(fee)} recorded`)).toBeVisible();
    await booked.getByRole('button', { name: 'Receipt' }).click();
    const receipt = dialog(page, 'Receipt');
    await expect(receipt.getByText('Tax Receipt')).toBeVisible();
    await expect(receipt.getByText('Receipt No.')).toBeVisible();
    await expect(receipt.getByText(new RegExp(`Paid by Cash ${rupees(fee)}`))).toBeVisible();
    await receipt.getByRole('button', { name: 'Done' }).click();
    await booked.getByRole('button', { name: 'Done' }).click();
    // The drawer's expected cash rises by the fee, without waiting for a poll (UAT-17).
    await openNav(page, 'Payments');
    await expect(expectedInDrawer(page)).toHaveText(rupees(FLOAT_RUPEES + fee));
  });

  /* R-6 ------------------------------------------------------------------ */
  await uatStep('R-6', { watch: watch(), pages }, async () => {
    const { page } = needs(desk, 'R-1');
    const { appointment, patientName } = needs(walkIn1, 'R-4');
    await goTo(page, `${DESK}/appointments?appointment=${appointment.id}`);
    const drawer = dialog(page, patientName);
    await expect(drawer).toBeVisible();
    await drawer.getByRole('button', { name: 'Receipt' }).click();
    const receipt = dialog(page, 'Receipt');
    // UAT-64: the receipt names the patient and carries the hospital address.
    await expect(receipt.getByText(patientName, { exact: false })).toBeVisible();
    const receiptPdf = await download(page, () =>
      receipt.getByRole('button', { name: 'Download PDF' }).click(),
    );
    await expect(page, 'the receipt downloads instead of replacing the app').toHaveURL(
      new RegExp(`^${UAT_ENV.baseUrl}`),
    );
    expect(isPdf(receiptPdf.bytes), 'the receipt is a PDF').toBe(true);
    expect(pdfPageCount(receiptPdf.bytes), 'the receipt prints on one page').toBe(1);
    await receipt.getByRole('button', { name: 'Done' }).click();

    await drawer.getByRole('button', { name: 'Token' }).click();
    const slip = dialog(page, 'Token Slip');
    const label = needs(appointment.token_label, 'a token');
    await expect(slip.getByText(label, { exact: true })).toBeVisible();
    const slipPdf = await download(page, () =>
      slip.getByRole('button', { name: 'Download PDF' }).click(),
    );
    expect(slipPdf.filename).toBe(`token-${label}.pdf`);
    expect(isPdf(slipPdf.bytes), 'the token slip is a PDF').toBe(true);
    expect(pdfPageCount(slipPdf.bytes), 'the token slip prints on one page').toBe(1);
    await slip.getByRole('button', { name: 'Done' }).click();
    await closeDialogs(page);
  });

  /* R-7 ------------------------------------------------------------------ */
  await uatStep('R-7', { watch: watch(), pages }, async () => {
    const { page } = needs(desk, 'R-1');
    const session = needs(rSession, 'R-4');
    const { appointment, patientName } = needs(walkIn1, 'R-4');
    const label = needs(appointment.token_label, 'a token');
    await openNav(page, 'Token Management');
    await expect(topbarTitle(page)).toHaveText('Live Token Queue');
    const card = queueCard(page, session.doctor.name, session.label);
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'Open session' }).click();
    await card.getByRole('button', { name: `Call token ${label}` }).click();
    await expect(card.getByText('Called', { exact: true })).toBeVisible();
    await expect(card.getByText(label, { exact: true })).toBeVisible();
    await expect(card.getByText(patientName)).toBeVisible();
  });

  /* R-8 ------------------------------------------------------------------ */
  await uatStep('R-8', { watch: watch(), pages }, async () => {
    const { page } = needs(desk, 'R-1');
    const session = needs(rSession, 'R-4');
    const reference = `UPI${tag.toUpperCase()}${Date.now() % 100000}`;
    const name = { first: 'Arun', last: `Uat${tag}` };
    await goTo(page, `${DESK}/appointments/new`);
    const appointment = await bookWalkInOnScreen(page, session, async () => {
      await page.getByRole('button', { name: 'Add new patient' }).click();
      await page.getByLabel('First Name').fill(name.first);
      await page.getByLabel('Last Name').fill(name.last);
      await page.getByLabel('Phone Number').fill(randomMobile().slice(3));
      await page.getByLabel('Date of Birth').fill('1985-02-03');
    });
    const patientName = `${name.first} ${name.last}`;
    const fee = appointment.total_paise / 100;
    const booked = dialog(page, `Booked for ${patientName}`);
    await booked.getByRole('combobox', { name: 'Payment method' }).selectOption({ label: 'UPI' });
    await booked.getByLabel('Reference').fill(reference);
    await booked.getByRole('button', { name: `Collect ${rupees(fee)}` }).click();
    await expect(toast(page, `Payment of ${rupees(fee)} recorded`)).toBeVisible();
    await booked.getByRole('button', { name: 'Receipt' }).click();
    const receipt = dialog(page, 'Receipt');
    await expect(receipt.getByText(`UPI ${rupees(fee)} (${reference})`)).toBeVisible();
    await receipt.getByRole('button', { name: 'Done' }).click();
    await booked.getByRole('button', { name: 'Done' }).click();
    walkIn2 = { appointment, patientName };
    // UPI never touches the drawer.
    const first = needs(walkIn1, 'R-4').appointment;
    await openNav(page, 'Payments');
    await expect(expectedInDrawer(page)).toHaveText(rupees(FLOAT_RUPEES + first.total_paise / 100));
  });

  /* R-9 ------------------------------------------------------------------ */
  await uatStep('R-9', { watch: watch(), pages }, async () => {
    const { page } = needs(desk, 'R-1');
    const session = needs(rSession, 'R-4');
    online = await bookOnline({
      doctorId: session.doctor.id,
      date: todayIso(),
      pay: 'checkout',
      sessionId: session.sessionId,
    });
    const ref = online.appointment.booking_ref;
    await openNav(page, 'Appointments');
    // The list has no booking-ref column; the search narrows it to this booking.
    await appointmentSearch(page).fill(ref);
    const line = row(page, online.personName);
    await expect(line).toHaveCount(1);
    await expect(line.getByText('Scheduled', { exact: true })).toBeVisible();
    await line.getByRole('button', { name: 'Check in' }).click();
    await expect(toast(page, 'Checked in')).toBeVisible();
    await expect(line.getByText('In Queue', { exact: true })).toBeVisible();
    // The token joins the doctor's queue.
    const label = needs(online.appointment.token_label, 'an online token');
    await openNav(page, 'Token Management');
    const card = queueCard(page, session.doctor.name, session.label);
    await expect(card.getByText(label, { exact: true })).toBeVisible();
  });

  /* R-10 ----------------------------------------------------------------- */
  await uatStep('R-10', { watch: watch(), pages }, async () => {
    const { page } = needs(desk, 'R-1');
    const session = needs(rSession, 'R-4');
    const called = needs(walkIn1, 'R-4');
    // Today's booking whose token was called (R-7): No-show is offered and taken.
    await goTo(page, `${DESK}/appointments?appointment=${called.appointment.id}`);
    let drawer = dialog(page, called.patientName);
    await drawer.getByRole('button', { name: 'No-show' }).click();
    await dialog(page, 'Mark as No-show').getByRole('button', { name: 'Mark No-show' }).click();
    await expect(toast(page, 'Marked as no-show')).toBeVisible();
    await expect(drawer.getByText('No-show', { exact: true }).first()).toBeVisible();
    await closeDialogs(page);

    // A booking on a later day: no No-show (UAT-13).
    const later = await bookOnlineSoon(session.doctor.id);
    await goTo(page, `${DESK}/appointments?appointment=${later.appointment.id}`);
    drawer = page.getByRole('dialog');
    await expect(drawer.getByText(later.appointment.booking_ref)).toBeVisible();
    await expect(drawer.getByRole('button', { name: 'No-show' })).toHaveCount(0);
    await closeDialogs(page);

    // An unpaid walk-in: the receptionist collects, but cancel is the admin's (decision 2).
    const slot = needs(
      (await openSlotsOf(adminApi, session.doctor.id, session.sessionId))[0],
      'a free slot',
    );
    const unpaid = await bookWalkIn(adminApi, session.doctor, slot.id, {
      firstName: 'Sunil',
      lastName: `Uat${tag}`,
    });
    await goTo(page, `${DESK}/appointments?appointment=${unpaid.id}`);
    drawer = dialog(page, `Sunil Uat${tag}`);
    await expect(drawer.getByRole('button', { name: /^Collect/ })).toBeVisible();
    await expect(drawer.getByRole('button', { name: /^Cancel/ })).toHaveCount(0);
    await closeDialogs(page);
  });

  /* R-11 ----------------------------------------------------------------- */
  await uatStep('R-11', { watch: watch(), pages }, async () => {
    const { page } = needs(desk, 'R-1');
    const cash = needs(walkIn1, 'R-4');
    const upi = needs(walkIn2, 'R-8');
    await openNav(page, 'Payments');
    const search = paymentSearch(page);
    for (const [booking, mode] of [
      [cash, 'Cash'],
      [upi, 'UPI'],
    ] as const) {
      await search.fill(booking.appointment.booking_ref);
      const line = row(page, booking.patientName);
      await expect(line).toHaveCount(1);
      // The method cell reads "<method> <collected by> · <counter>".
      await expect(line.getByRole('cell', { name: new RegExp(`^${mode}\\b`) })).toBeVisible();
      await expect(line.getByText(rupees(booking.appointment.total_paise / 100))).toBeVisible();
    }
    await search.fill('');
  });

  /* R-12 ----------------------------------------------------------------- */
  await uatStep('R-12', { watch: watch(), pages }, async () => {
    const { page } = needs(desk, 'R-1');
    await openNav(page, 'Payments');
    const expected = rupeesIn(await expectedInDrawer(page).innerText());
    const counted = expected - SHORT_RUPEES;
    await page.getByRole('button', { name: 'Close drawer' }).click();
    const modal = dialog(page, 'Close your cash drawer');
    await modal.getByLabel(/Cash counted/).fill(String(counted));
    await expect(
      modal.getByText(`Short by ${rupees(SHORT_RUPEES)}.`, { exact: false }),
    ).toBeVisible();
    await modal.getByRole('button', { name: 'Close drawer' }).click();
    await expect(toast(page, `Drawer closed short by ${rupees(SHORT_RUPEES)}`)).toBeVisible();
    await expect(page.getByText('Your cash drawer is closed')).toBeVisible();
  });

  /* R-13 ----------------------------------------------------------------- */
  await uatStep('R-13', { watch: watch(), pages }, async () => {
    const { page } = needs(desk, 'R-1');
    const subject = `UAT ${tag}: queue display shows an old token`;
    await openNav(page, 'Help & Support');
    await page.getByRole('button', { name: 'Raise a Ticket' }).first().click();
    const modal = dialog(page, 'Raise a Support Ticket');
    await modal.getByLabel('Subject').fill(subject);
    await modal.getByLabel('Topic').selectOption({ label: 'Technical issue' });
    await modal
      .getByLabel('Describe the issue')
      .fill('The waiting-room display kept the previous token for a few minutes after a call.');
    await modal.getByRole('button', { name: 'Send to Medibook' }).click();
    const sent = toast(page, /^Ticket \S+ sent to Medibook$/);
    await expect(sent).toBeVisible();
    const ticketNo = /Ticket (\S+) sent/.exec(await sent.innerText())?.[1] ?? '';
    await closeDialogs(page);

    // Medibook support answers from the operations console.
    const support = await openStaff(browser, 'platform', platformStaff('support').email);
    extraContexts.push(support.context);
    const reply = `Thanks — we reproduced it and are rolling out a fix (${tag}).`;
    await goTo(support.page, '/ops/support');
    await support.page
      .getByRole('textbox', { name: 'Find a ticket by its exact number' })
      .fill(ticketNo);
    await support.page.getByRole('button', { name: `Open ticket ${ticketNo}` }).click();
    const ticket = dialog(support.page, subject);
    await ticket.getByRole('textbox', { name: 'Reply' }).fill(reply);
    await ticket.getByRole('button', { name: 'Send reply' }).click();
    await expect(ticket.getByText(reply)).toBeVisible();

    // Back at the desk: the ticket is listed with Medibook's reply.
    await page.getByRole('button', { name: 'Refresh your tickets' }).click();
    await row(page, ticketNo).click();
    const thread = dialog(page, subject);
    await expect(thread.getByText(reply)).toBeVisible();
    await expect(thread.getByText(/Medibook support/)).toBeVisible();
    await closeDialogs(page);
  });

  /* R-14 ----------------------------------------------------------------- */
  await uatStep('R-14', { watch: watch(), pages }, async () => {
    const { page } = needs(desk, 'R-1');
    const other = await ApiClient.staff('hospital', receptionist.email);
    await goTo(page, `${DESK}/account`);
    await expect(topbarTitle(page)).toHaveText('My Account');
    // A run that stopped before R-16 leaves the rotated password in place.
    const current = passwordOf(receptionist.email);
    const next = current === NEW_PASSWORD ? `${NEW_PASSWORD}-b` : NEW_PASSWORD;
    await page.getByLabel(/^Current Password/).fill(current);
    await page.getByLabel(/^New Password/).fill(next);
    await page.getByLabel(/^Confirm New Password/).fill(next);
    await page.getByRole('button', { name: 'Change Password' }).click();
    await expect(
      toast(page, 'Password changed. Your other devices were signed out.'),
    ).toBeVisible();
    rememberPassword(receptionist.email, next);
    expect(await refreshWorks(other), 'the other device is signed out').toBe(false);
    await other.dispose();

    // Revoke one other session from the device list.
    const second = await ApiClient.staff('hospital', receptionist.email);
    await page.reload();
    const signOutOne = page.getByRole('button', { name: 'Sign out', exact: true });
    const devices = page.getByRole('listitem').filter({ has: signOutOne });
    await expect(devices).toHaveCount(1);
    await devices.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(toast(page, 'That device was signed out')).toBeVisible();
    expect(await refreshWorks(second), 'the revoked session is gone').toBe(false);
    await second.dispose();

    // Sign out everywhere, this browser included.
    const third = await ApiClient.staff('hospital', receptionist.email);
    await page.getByRole('button', { name: 'Sign out everywhere' }).click();
    await dialog(page, 'Sign out everywhere?')
      .getByRole('button', { name: 'Sign out everywhere' })
      .click();
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: ROUTE_STATE_TIMEOUT_MS });
    expect(await refreshWorks(third), 'every session is signed out').toBe(false);
    await third.dispose();
  });

  /* R-15 ----------------------------------------------------------------- */
  // The idle limit is 15 minutes of no input in ANY tab (UAT-04). The browser
  // clock is advanced 16 simulated minutes while the desk keeps typing in the
  // Appointments tab; the Token Management tab must not sign the desk out.
  await uatStep('R-15', { pages }, async () => {
    const s = await newBrowserSession(browser, 'receptionist-two-tabs');
    extraContexts.push(s.context);
    await s.context.clock.install({ time: new Date() });
    await signIn(s.page, 'hospital', receptionist.email);
    const queueTab = s.page;
    await goTo(queueTab, `${DESK}/token`);
    await expect(topbarTitle(queueTab)).toHaveText('Live Token Queue');
    const [workTab] = await Promise.all([
      s.context.waitForEvent('page'),
      queueTab.evaluate(() => {
        window.open('/receptionist/appointments', '_blank');
      }),
    ]);
    await expect(topbarTitle(workTab)).toHaveText('Appointments');
    const search = appointmentSearch(workTab);
    for (let minute = 1; minute <= IDLE_MINUTES_SIMULATED; minute += 1) {
      await search.click();
      await search.press('End');
      await search.pressSequentially('a');
      await search.press('Backspace');
      await s.context.clock.fastForward('01:00');
    }
    for (const tab of [queueTab, workTab]) {
      await expect(tab).not.toHaveURL(/\/auth\/login/);
      await expect(tab.getByRole('dialog', { name: 'Still there?' })).toHaveCount(0);
    }
    await expect(topbarTitle(queueTab)).toHaveText('Live Token Queue');
    await expect(topbarTitle(workTab)).toHaveText('Appointments');
  });

  /* R-16 ----------------------------------------------------------------- */
  await uatStep('R-16', { pages }, async () => {
    const { page } = needs(desk, 'R-1');
    // R-14 signed this browser out; start from the sign-in page either way.
    await page.goto('/auth/login');
    await page.getByRole('button', { name: 'Forgot Password?' }).click();
    await expect(page).toHaveURL(/\/auth\/forgot/);
    await page.getByLabel('Email Address').fill(receptionist.email);
    const since = new Date();
    await spendSignIn(receptionist.email);
    await page.getByRole('button', { name: 'Send Mail' }).click();
    await expect(page.getByText('Check your inbox')).toBeVisible();
    const emailed = await waitForDevToken(receptionist.email, 'password_reset', since);
    expect(emailed.link, 'the emailed link opens the hospital reset page (E1)').toMatch(
      new RegExp(`^${UAT_ENV.baseUrl}/reset-password\\?token=`),
    );
    await page.goto(emailed.link);
    await expect(page.getByText('Set a new password')).toBeVisible();
    await page.getByLabel('New Password', { exact: true }).fill(UAT_ENV.seedPassword);
    await page.getByLabel('Confirm New Password', { exact: true }).fill(UAT_ENV.seedPassword);
    await spendSignIn(receptionist.email);
    await page.getByRole('button', { name: 'Update Password' }).click();
    await expect(page.getByText('Password updated')).toBeVisible();
    rememberPassword(receptionist.email, UAT_ENV.seedPassword);
    await page.getByRole('button', { name: 'Back to Login', exact: true }).click();
    await signIn(page, 'hospital', receptionist.email, UAT_ENV.seedPassword);
    await expect(page).toHaveURL(new RegExp(`${DESK}/dashboard$`));
    await expect(topbarTitle(page)).toHaveText('Front Desk');
  });

  for (const context of extraContexts) await context.close();
  if (desk) await (desk as StaffSession).context.close();
  await adminApi.dispose();
  await disposePatients();
});

/** Can this API session still refresh its tokens? */
async function refreshWorks(client: ApiClient): Promise<boolean> {
  const response = await client.raw.post('/api/v1/hospital/auth/token/refresh', {
    data: { refresh: client.refreshToken },
  });
  return response.ok();
}
