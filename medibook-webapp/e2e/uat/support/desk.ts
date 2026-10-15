import { expect, type Locator, type Page } from '@playwright/test';

import type { DeskAppointment, TodaySession } from './booking.ts';
import { needs } from './steps.ts';
import { selectByPrefix, selectFirstReal, toast } from './ui.ts';

/**
 * Hospital front-desk screen helpers shared by the desk, queue and admin
 * sections.
 */

/** One doctor session's card on Token Management ("Dr. X · Morning OPD"). */
export function queueCard(page: Page, doctorName: string, sessionLabel: string): Locator {
  return page
    .locator('div')
    .filter({ has: page.getByText(`${doctorName} · ${sessionLabel}`, { exact: true }) })
    .filter({ has: page.getByText('Up next', { exact: true }) })
    .last();
}

const WALK_IN_PATH = '/api/v1/hospital/appointments';

/**
 * Fill New Appointment for `session`'s doctor (after `fillPatient` picked or
 * typed the patient), submit with `submitLabel`, and return the booking the
 * server answered.
 */
export async function bookWalkInOnScreen(
  page: Page,
  session: TodaySession,
  fillPatient: () => Promise<void>,
  submitLabel: 'Book & Collect Payment' | 'Book' = 'Book & Collect Payment',
): Promise<DeskAppointment> {
  await fillPatient();
  await selectByPrefix(
    page.getByRole('combobox', { name: 'Department for consultation 1' }),
    session.departmentName,
  );
  await selectByPrefix(
    page.getByRole('combobox', { name: 'Doctor for consultation 1' }),
    session.doctor.name,
  );
  await selectFirstReal(page.getByRole('combobox', { name: 'Time for consultation 1' }), (label) =>
    label.endsWith(`· ${session.label}`),
  );
  const [response] = await Promise.all([
    page.waitForResponse(
      (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === WALK_IN_PATH,
    ),
    page.getByRole('button', { name: submitLabel, exact: true }).click(),
  ]);
  expect(response.status(), 'the walk-in booking is accepted').toBe(201);
  const body = (await response.json()) as { appointments: DeskAppointment[] };
  const appointment = needs(body.appointments[0], 'the booking');
  await expect(toast(page, '1 appointment booked')).toBeVisible();
  return appointment;
}

/** The Appointments search box (patient, phone, MRN, token or booking ref). */
export function appointmentSearch(page: Page): Locator {
  return page.getByRole('textbox', { name: /Search by patient name, phone, MR number/ });
}

/** The Payments search box. */
export function paymentSearch(page: Page): Locator {
  return page.getByRole('textbox', { name: /Search by patient name, MR number or booking ref/ });
}

/** The cash drawer card's "Expected in drawer" amount on Payments. */
export function expectedInDrawer(page: Page): Locator {
  return page
    .getByText('Expected in drawer', { exact: true })
    .first()
    .locator('xpath=following-sibling::*[1]');
}

/** Rupees in a "₹ 1,250" or "₹ 1,250.50" text. */
export function rupeesIn(text: string): number {
  return Number(text.replace(/[^\d.]/g, ''));
}
