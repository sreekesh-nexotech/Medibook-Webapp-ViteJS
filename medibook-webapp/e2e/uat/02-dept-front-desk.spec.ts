import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';

import { hospitalStaff } from './support/accounts.ts';
import { ApiClient } from './support/api.ts';
import {
  bookOnline,
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
import { appointmentSearch, bookWalkInOnScreen, queueCard } from './support/desk.ts';
import { needs, uatStep } from './support/steps.ts';
import { todayIso } from './support/time.ts';
import {
  closeDialogs,
  dialog,
  goTo,
  openNav,
  openStaff,
  row,
  signIn,
  toast,
  topbarTitle,
  newBrowserSession,
  type StaffSession,
} from './support/ui.ts';

/**
 * Report §4.2 — Department front desk (Lakeshore, `nimmy.george`), the role
 * that runs the queue (Q62). Q-6: this role does not collect payments
 * (TEAM_BRIEF decision 2) — reception collects the walk-in's fee, then the
 * department desk checks the paid walk-in in.
 */

test.describe.configure({ mode: 'serial' });

const DESK = '/receptionist';
const WALK_INS_FOR_THE_QUEUE = 3;
const MAX_SKIPS = 6;
/** The queue push must beat the 30 s safety-net refetch of the token screen. */
const PUSH_TIMEOUT_MS = 15_000;

interface TokenPolicy {
  readonly online_marker?: string;
  readonly offline_marker?: string;
}

/** The serving box of a queue card (the token at the desk). */
function servingLabel(card: Locator, label: string): Locator {
  return card.getByText(label, { exact: true });
}

async function expectCalled(card: Locator, label: string): Promise<void> {
  await expect(servingLabel(card, label)).toBeVisible();
  await expect(card.getByText('Called', { exact: true })).toBeVisible();
}

/** Skip the token at the desk; returns true when the no-show offer opened. */
async function skipCurrent(page: Page, card: Locator): Promise<boolean> {
  const offer = dialog(page, 'Mark as no-show?');
  const skipped = toast(page, /^Skipped /);
  const before = await skipped.count();
  await card.getByRole('button', { name: 'Skip — call again later' }).click();
  // This skip's own answer: the no-show offer, or one more "Skipped …" toast.
  await expect
    .poll(async () => (await offer.isVisible()) || (await skipped.count()) > before, {
      message: 'the skip is answered',
    })
    .toBe(true);
  return offer.isVisible();
}

test('4.2 Department front desk — Lakeshore', async ({ browser }) => {
  const deptDesk = hospitalStaff('lakeshore', 'dept_front_desk');
  const admin = hospitalStaff('lakeshore', 'admin');
  const receptionist = hospitalStaff('lakeshore', 'receptionist');
  const tag = runTag();

  const adminApi = await ApiClient.staff('hospital', admin.email);
  let desk: StaffSession | null = null;
  let queueSession: TodaySession | null = null;
  let otherSession: TodaySession | null = null;
  let online: OnlineBooking | null = null;
  const contexts: BrowserContext[] = [];

  // Evidence on failure: the main desk and every other browser a step opened.
  const pages = () => [...(desk ? [desk.page] : []), ...contexts.flatMap((c) => c.pages())];
  const watch = () => (desk ? [desk.watch] : []);

  /* Q-1 ------------------------------------------------------------------ */
  await uatStep('Q-1', { pages }, async () => {
    const s = await newBrowserSession(browser, 'dept-front-desk');
    desk = { ...s, email: deptDesk.email };
    s.watch.begin();
    await signIn(s.page, 'hospital', deptDesk.email);
    await expect(s.page).toHaveURL(new RegExp(`${DESK}/dashboard$`));
    await expect(topbarTitle(s.page)).toHaveText('Front Desk');
    // UAT-60: only the actions this role may take are offered.
    await expect(s.page.getByRole('button', { name: 'New Appointment' })).toBeVisible();
    await expect(s.page.getByRole('button', { name: 'Department Queue' })).toBeVisible();
    await expect(s.page.getByRole('button', { name: 'Open Payments' })).toHaveCount(0);
    await expect(
      s.page.getByRole('navigation').getByRole('button', { name: 'Payments' }),
    ).toHaveCount(0);
    expect(s.watch.problems(), 'the dashboard loads without errors').toEqual([]);
  });

  /* Q-2 ------------------------------------------------------------------ */
  await uatStep('Q-2', { watch: watch(), pages }, async () => {
    const { page } = needs(desk, 'Q-1');
    queueSession = await cleanSessionToday(adminApi, { minOpenSlots: WALK_INS_FOR_THE_QUEUE });
    const session = queueSession;
    // Three patients waiting (background data: the step is about the queue).
    const tokens: DeskAppointment[] = [];
    for (const [i, slot] of session.openSlots.slice(0, WALK_INS_FOR_THE_QUEUE).entries()) {
      tokens.push(
        await bookWalkIn(adminApi, session.doctor, slot.id, {
          firstName: ['Kiran', 'Latha', 'Mohan'][i] ?? 'Guest',
          lastName: `Uat${tag}`,
        }),
      );
    }
    const [t1, t2, t3] = tokens.map((t) => needs(t.token_label, 'a token'));
    const first = needs(t1, 'token 1');
    const second = needs(t2, 'token 2');
    const third = needs(t3, 'token 3');

    await openNav(page, 'Token Management');
    const card = queueCard(page, session.doctor.name, session.label);
    await expect(card.getByText('Not opened', { exact: true })).toBeVisible();
    await card.getByRole('button', { name: 'Open session' }).click();
    await expect(card.getByText('Ready to call next')).toBeVisible();

    // Call next → start → done, and the queue offers the next patient (UAT-01).
    const callNext = card.getByRole('button', { name: 'Call Next' });
    await callNext.click();
    await expectCalled(card, first);
    await card.getByRole('button', { name: 'Start', exact: true }).click();
    await expect(card.getByText('In consultation', { exact: true })).toBeVisible();
    await card.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(callNext).toBeEnabled();

    // Skip → recall → no-show after the hospital's attempt limit (manual, Q27).
    await callNext.click();
    await expectCalled(card, second);
    let offered = await skipCurrent(page, card);
    await expect(card.getByRole('button', { name: `Call again token ${second}` })).toBeVisible();
    await expect(callNext, 'the next patient can be called past a skipped one').toBeEnabled();
    for (let skips = 1; !offered && skips < MAX_SKIPS; skips += 1) {
      const noShow = card.getByRole('button', { name: 'No-show?' });
      if (await noShow.isVisible()) {
        await noShow.click();
        offered = true;
        break;
      }
      await card.getByRole('button', { name: `Call again token ${second}` }).click();
      await expectCalled(card, second);
      offered = await skipCurrent(page, card);
    }
    expect(offered, 'No-show is offered after the attempt limit').toBe(true);
    await dialog(page, 'Mark as no-show?').getByRole('button', { name: 'Mark No-show' }).click();
    await expect(card.getByText(second, { exact: true })).toHaveCount(0);

    // Pause and resume: the called token still reads "Called" (BE-20).
    await callNext.click();
    await expectCalled(card, third);
    await card.getByRole('button', { name: 'Pause the session — take a break' }).click();
    await expect(card.getByText('On Break', { exact: true })).toBeVisible();
    await card.getByRole('button', { name: 'Resume the session' }).click();
    await expectCalled(card, third);
    await card.getByRole('button', { name: 'Done', exact: true }).click();

    // Close.
    await card.getByRole('button', { name: 'Close the session' }).click();
    await dialog(page, 'Close this session?')
      .getByRole('button', { name: 'Close session' })
      .click();
    await expect(card.getByText('Session closed')).toBeVisible();
  });

  /* Q-3 ------------------------------------------------------------------ */
  await uatStep('Q-3', { watch: watch(), pages }, async () => {
    const { page, context } = needs(desk, 'Q-1');
    otherSession = await cleanSessionToday(adminApi, {
      minOpenSlots: 4,
      excludeDoctorIds: queueSession ? [queueSession.doctor.id] : [],
      bookableOnline: true,
    });
    const session = otherSession;
    const slot = needs(session.openSlots[0], 'a free slot');
    const walkIn = await bookWalkIn(adminApi, session.doctor, slot.id, {
      firstName: 'Ravi',
      lastName: `Uat${tag}`,
    });
    const label = needs(walkIn.token_label, 'a token');

    // The second screen: Token Management in its own tab.
    const [screen] = await Promise.all([
      context.waitForEvent('page'),
      page.evaluate(() => {
        window.open('/receptionist/token', '_blank');
      }),
    ]);
    const card = queueCard(screen, session.doctor.name, session.label);
    await expect(card.getByText(label, { exact: true })).toBeVisible();

    // The admin cancels it at the desk (desk cancel is admin-only, decision 2).
    const adminUi = await openStaff(browser, 'hospital', admin.email);
    contexts.push(adminUi.context);
    await goTo(adminUi.page, `/admin/appointments?appointment=${walkIn.id}`);
    const drawer = dialog(adminUi.page, `Ravi Uat${tag}`);
    await drawer.getByRole('button', { name: 'Cancel', exact: true }).click();
    const reason = dialog(adminUi.page, 'Cancel Appointment');
    await reason.getByLabel('Reason').fill('Patient left before being seen');
    await reason.getByRole('button', { name: 'Cancel booking' }).click();
    await expect(toast(adminUi.page, /cancelled/i)).toBeVisible();

    // The token leaves "Up next" on the second screen, pushed live.
    await expect(card.getByText(label, { exact: true })).toHaveCount(0, {
      timeout: PUSH_TIMEOUT_MS,
    });
    await screen.close();
  });

  /* Q-4 ------------------------------------------------------------------ */
  await uatStep('Q-4', { watch: watch(), pages }, async () => {
    const { page } = needs(desk, 'Q-1');
    const session = needs(otherSession, 'Q-3');
    const policy = await adminApi.get<TokenPolicy>('/token-policy');
    const onlineMarker = needs(policy.online_marker, 'the online marker');
    const deskMarker = needs(policy.offline_marker, 'the desk marker');
    expect(onlineMarker, 'online and desk tokens are told apart').not.toBe(deskMarker);

    online = await bookOnline({
      doctorId: session.doctor.id,
      date: todayIso(),
      pay: 'checkout',
      sessionId: session.sessionId,
    });
    const onlineLabel = needs(online.appointment.token_label, 'an online token');
    const slot = needs(
      (await openSlotsOf(adminApi, session.doctor.id, session.sessionId))[0],
      'a free slot',
    );
    const walkIn = await bookWalkIn(adminApi, session.doctor, slot.id, {
      firstName: 'Usha',
      lastName: `Uat${tag}`,
    });
    const deskLabel = needs(walkIn.token_label, 'a desk token');
    expect(onlineLabel.startsWith(onlineMarker), `online token ${onlineLabel}`).toBe(true);
    expect(deskLabel.startsWith(deskMarker), `desk token ${deskLabel}`).toBe(true);

    // On screen …
    await openNav(page, 'Token Management');
    const card = queueCard(page, session.doctor.name, session.label);
    await expect(card.getByText(onlineLabel, { exact: true })).toBeVisible();
    await expect(card.getByText(deskLabel, { exact: true })).toBeVisible();
    // … and on each slip.
    for (const [id, label] of [
      [online.appointment.id, onlineLabel],
      [walkIn.id, deskLabel],
    ] as const) {
      await goTo(page, `${DESK}/appointments?appointment=${id}`);
      await page.getByRole('dialog').getByRole('button', { name: 'Token' }).click();
      await expect(dialog(page, 'Token Slip').getByText(label, { exact: true })).toBeVisible();
      await closeDialogs(page);
    }
  });

  /* Q-5 ------------------------------------------------------------------ */
  await uatStep('Q-5', { watch: watch(), pages }, async () => {
    const { page } = needs(desk, 'Q-1');
    const booking = needs(online, 'Q-4');
    await openNav(page, 'Appointments');
    await appointmentSearch(page).fill(booking.appointment.booking_ref);
    const line = row(page, booking.personName);
    await expect(line).toHaveCount(1);
    await line.getByRole('button', { name: 'Check in' }).click();
    await expect(toast(page, 'Checked in')).toBeVisible();
    await expect(line.getByText('In Queue', { exact: true })).toBeVisible();
  });

  /* Q-6 ------------------------------------------------------------------ */
  await uatStep('Q-6', { watch: watch(), pages }, async () => {
    const { page } = needs(desk, 'Q-1');
    const session = needs(otherSession, 'Q-3');
    const name = { first: 'Gita', last: `Uat${tag}` };
    const patientName = `${name.first} ${name.last}`;

    // The department desk books; it does not collect (UAT-45, decision 2).
    await goTo(page, `${DESK}/appointments/new`);
    await expect(page.getByText('Your role does not take payments')).toBeVisible();
    const appointment = await bookWalkInOnScreen(
      page,
      session,
      async () => {
        await page.getByRole('button', { name: 'Add new patient' }).click();
        await page.getByLabel('First Name').fill(name.first);
        await page.getByLabel('Last Name').fill(name.last);
        await page.getByLabel('Phone Number').fill(randomMobile().slice(3));
      },
      'Book',
    );
    const booked = dialog(page, `Booked for ${patientName}`);
    await expect(booked.getByText(/Send the patient to reception to pay/)).toBeVisible();
    // Only "Collect later" — no button that takes the money.
    await expect(booked.getByRole('button', { name: /^Collect(?! later$)/ })).toHaveCount(0);
    await booked.getByRole('button', { name: 'Collect later' }).click();

    // Reception collects the fee.
    const reception = await openStaff(browser, 'hospital', receptionist.email);
    contexts.push(reception.context);
    await openNav(reception.page, 'Appointments');
    await appointmentSearch(reception.page).fill(appointment.booking_ref);
    await row(reception.page, patientName).getByRole('button', { name: 'Collect' }).click();
    const pay = dialog(reception.page, 'Collect Payment');
    await pay.getByRole('combobox', { name: 'Method' }).selectOption({ label: 'UPI' });
    await pay.getByLabel('Reference').fill(`UPI${tag.toUpperCase()}Q6`);
    await pay.getByRole('button', { name: /^Record/ }).click();
    await expect(dialog(reception.page, 'Receipt')).toBeVisible();

    // The department desk checks the paid walk-in in.
    await openNav(page, 'Appointments');
    await appointmentSearch(page).fill(appointment.booking_ref);
    const line = row(page, patientName);
    await page.getByRole('button', { name: 'Refresh appointments' }).click();
    await line.getByRole('button', { name: 'Check in' }).click();
    await expect(toast(page, 'Checked in')).toBeVisible();
    await expect(line.getByText('In Queue', { exact: true })).toBeVisible();
  });

  for (const context of contexts) await context.close();
  if (desk) await (desk as StaffSession).context.close();
  await adminApi.dispose();
  await disposePatients();
});
