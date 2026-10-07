import { ApiClient, isApiError, type Page } from './api.ts';
import { bookingPatients } from './accounts.ts';
import { sendPaymentCaptured } from './razorpay.ts';
import { addDays, clockIn, hhmm, minutesOf, minutesUntil, todayIso, weekdayOf } from './time.ts';

/**
 * Setup data the UAT scripts take from outside the web app: paid online
 * bookings made through the patient API (report §3 — the patient app cannot
 * book), and the lookups a step needs to act on live data (which doctor is in
 * session today, which slot is free). Hospital-side helpers exist only for
 * "background" data a step is not about (e.g. three waiting tokens so the
 * queue has something to call).
 */

/* ------------------------------------------------------------------ types */

export interface HospitalDoctor {
  readonly id: string;
  readonly name: string;
  readonly department_id: string;
  readonly status: 'active' | 'on_leave' | 'inactive';
  readonly is_bookable_online: boolean;
  readonly slot_length_min: number;
  readonly consultation_fee_paise: number;
  readonly version: number;
}

export interface HospitalDepartment {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly is_active: boolean;
}

export interface GridSlot {
  readonly id: string;
  readonly starts_at: string;
  readonly ends_at: string;
  readonly state: 'open' | 'held' | 'booked' | 'blocked' | 'past';
}

export interface GridSession {
  readonly id: string;
  readonly session_code?: string;
  readonly label: string;
  readonly status?: string;
  readonly starts_at: string;
  readonly ends_at: string;
  readonly slots: readonly GridSlot[];
}

interface DoctorDay {
  readonly doctor: { readonly id: string; readonly name: string; readonly department_id: string };
  readonly sessions: readonly GridSession[];
}

export interface QueueRow {
  readonly appointment_id: string;
  readonly token_no: number;
  readonly token_label?: string | null;
  readonly status: string;
  readonly kind: string;
  readonly patient_name?: string | null;
}

export interface SessionSnapshot {
  readonly id: string;
  readonly doctor_id: string;
  readonly date: string;
  readonly label: string;
  readonly status: 'scheduled' | 'open' | 'paused' | 'closed' | 'cancelled';
  readonly waiting_count: number;
  readonly current_appointment_id: string | null;
  readonly in_consultation_count?: number;
  readonly queue?: readonly QueueRow[] | null;
}

export interface DeskAppointment {
  readonly id: string;
  readonly booking_ref: string;
  readonly status: string;
  readonly source: 'online' | 'walk_in';
  readonly payment_status: string;
  readonly token_label: string | null;
  readonly token_no: number | null;
  readonly total_paise: number;
  readonly scheduled_date: string;
  readonly scheduled_start_at: string;
  readonly patient: {
    readonly id: string;
    readonly mrn: string;
    readonly full_name: string;
  } | null;
  readonly doctor: { readonly id: string; readonly name: string };
  readonly department: { readonly id: string; readonly name: string };
  readonly session: { readonly id: string; readonly label: string };
  readonly version: number;
}

export interface HospitalPatient {
  readonly id: string;
  readonly mrn: string;
  readonly full_name: string;
  readonly first_name: string;
  readonly last_name: string | null;
  readonly phone_e164: string | null;
  readonly version: number;
}

export interface PatientAppointment {
  readonly id: string;
  readonly booking_ref: string;
  readonly status: string;
  readonly payment_status: string;
  readonly token_label: string | null;
  readonly token_source?: string | null;
  readonly scheduled_date: string;
  readonly scheduled_start_at: string;
  readonly session_id: string;
  readonly person_id: string;
}

export interface PaymentOrder {
  readonly id: string;
  readonly amount_paise: number;
  readonly gateway_order_id: string;
  readonly status: string;
}

interface PatientPerson {
  readonly id: string;
  readonly is_self: boolean;
  readonly first_name: string;
  readonly last_name: string | null;
}

interface PatientSlots {
  readonly sessions: readonly {
    readonly session_id: string;
    readonly label: string;
    readonly status: string;
    readonly slots: readonly {
      readonly id: string;
      readonly starts_at: string;
      readonly state: string;
    }[];
  }[];
}

/* -------------------------------------------------------------- catalogue */

export function hospitalDoctors(admin: ApiClient): Promise<HospitalDoctor[]> {
  return admin.all<HospitalDoctor>('/doctors');
}

export function hospitalDepartments(admin: ApiClient): Promise<HospitalDepartment[]> {
  return admin.all<HospitalDepartment>('/departments');
}

/** One doctor's slot grid for a hospital-local date (`null` when the doctor has none). */
export async function slotDay(
  admin: ApiClient,
  doctorId: string,
  date: string,
): Promise<DoctorDay | null> {
  const page = await admin.get<Page<DoctorDay>>('/slots', { date, doctor_id: doctorId });
  return page.results.find((d) => d.doctor.id === doctorId) ?? null;
}

export function sessionsOn(admin: ApiClient, date: string): Promise<SessionSnapshot[]> {
  return admin.all<SessionSnapshot>('/sessions', { date });
}

export function sessionSnapshot(admin: ApiClient, sessionId: string): Promise<SessionSnapshot> {
  return admin.get<SessionSnapshot>(`/sessions/${sessionId}`);
}

/* --------------------------------------------------------- today's session */

/** A doctor in session today with free slots the desk (and the app) can still book. */
export interface TodaySession {
  readonly doctor: HospitalDoctor;
  readonly departmentName: string;
  readonly sessionId: string;
  readonly label: string;
  /** Open slots that start at least `leadMinutes` from now, earliest first. */
  readonly openSlots: readonly GridSlot[];
}

export interface CleanSessionOptions {
  /** How many free future slots the session must still have. */
  readonly minOpenSlots: number;
  /** Doctors another step already uses. */
  readonly excludeDoctorIds?: readonly string[];
  /** Slots must start this many minutes from now (online bookings need a future slot). */
  readonly leadMinutes?: number;
  /** Only doctors patients can book online. */
  readonly bookableOnline?: boolean;
}

const DEFAULT_LEAD_MINUTES = 5;
const UAT_SESSION_LABEL = 'UAT clinic';
const UAT_SESSION_MINUTES = 180;
const UAT_SESSION_MIN_MINUTES = 60;
const UAT_SESSION_START_DELAY_MINUTES = 10;
const MINUTE_STEP = 5;
const MATERIALISE_WAIT_MS = 60_000;
const POLL_MS = 1_000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function futureOpenSlots(session: GridSession, leadMinutes: number): GridSlot[] {
  return session.slots
    .filter((s) => s.state === 'open' && minutesUntil(s.starts_at) >= leadMinutes)
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
}

interface HoursRow {
  readonly weekday: number;
  readonly is_closed: boolean;
  readonly opens_at: string | null;
  readonly closes_at: string | null;
}

interface DateException {
  readonly id: string;
  readonly date: string;
  readonly kind: 'closed' | 'custom_sessions';
  readonly note: string | null;
  readonly version: number;
  readonly sessions: readonly {
    readonly session_code: string;
    readonly label: string;
    readonly starts_at: string;
    readonly ends_at: string;
  }[];
}

interface ScheduleChange {
  readonly dry_run: boolean;
  readonly affected_bookings: readonly unknown[];
  readonly preview_token?: string | null;
}

/**
 * Add a "UAT clinic" session for `doctor` later today with a date exception
 * (what an admin does from the doctor's Availability tab): the day's existing
 * sessions are kept exactly, so no booking is affected. Used only when no
 * doctor still has a clean session today (e.g. a run after the morning OPD).
 */
async function addUatSessionToday(
  admin: ApiClient,
  doctor: HospitalDoctor,
): Promise<string | null> {
  const today = todayIso();
  const rows = await admin.get<HoursRow[]>('/hours');
  const todayHours = rows.find((h) => h.weekday === weekdayOf(today));
  if (todayHours?.is_closed) return null;
  const opens = todayHours?.opens_at ? minutesOf(todayHours.opens_at) : 0;
  const closes = todayHours?.closes_at ? minutesOf(todayHours.closes_at) : minutesOf('23:55');

  const day = await slotDay(admin, doctor.id, today);
  const existing = (day?.sessions ?? []).map((s) => ({
    session_code: s.session_code ?? s.label.toLowerCase().replace(/\W+/g, '-'),
    label: s.label,
    starts_at: clockIn(new Date(s.starts_at)),
    ends_at: clockIn(new Date(s.ends_at)),
  }));
  const nowMinutes = minutesOf(clockIn(new Date())) + UAT_SESSION_START_DELAY_MINUTES;
  let start = Math.max(opens, Math.ceil(nowMinutes / MINUTE_STEP) * MINUTE_STEP);
  for (const s of existing) {
    const [from, to] = [minutesOf(s.starts_at), minutesOf(s.ends_at)];
    if (start < to && start + UAT_SESSION_MIN_MINUTES > from) start = to;
  }
  const end = Math.min(start + UAT_SESSION_MINUTES, closes);
  if (end - start < UAT_SESSION_MIN_MINUTES) return null;
  const sessions = [
    ...existing,
    {
      session_code: `uat-${hhmm(start).replace(':', '')}`,
      label: UAT_SESSION_LABEL,
      starts_at: hhmm(start),
      ends_at: hhmm(end),
    },
  ];

  const exceptions = await admin.all<DateException>(`/doctors/${doctor.id}/date-exceptions`);
  const current = exceptions.find((e) => e.date === today);
  if (current?.kind === 'closed') return null;
  const body = {
    date: today,
    kind: 'custom_sessions',
    note: 'UAT: extra session for the live UAT run',
    sessions,
  };
  const path = current
    ? `/doctors/${doctor.id}/date-exceptions/${current.id}`
    : `/doctors/${doctor.id}/date-exceptions`;
  const write = (confirm: boolean, previewToken?: string | null) => {
    const params = { confirm, ...(previewToken ? { preview_token: previewToken } : {}) };
    return current
      ? admin.patch<ScheduleChange>(path, body, { params, ifMatch: current.version })
      : admin.post<ScheduleChange>(path, body, { params });
  };
  const dry = await write(false);
  if (dry.affected_bookings.length > 0) return null; // never cancel bookings for setup
  await write(true, dry.preview_token);

  const deadline = Date.now() + MATERIALISE_WAIT_MS;
  while (Date.now() < deadline) {
    const fresh = await slotDay(admin, doctor.id, today);
    const added = fresh?.sessions.find((s) => s.label === UAT_SESSION_LABEL);
    if (added && added.slots.length > 0) return added.id;
    await sleep(POLL_MS);
  }
  return null;
}

/**
 * A doctor whose session today has not been opened, has nobody waiting and
 * still has `minOpenSlots` free future slots — so the step's own bookings are
 * the only tokens in it. Falls back to adding a session later today.
 */
export async function cleanSessionToday(
  admin: ApiClient,
  options: CleanSessionOptions,
): Promise<TodaySession> {
  const today = todayIso();
  const lead = options.leadMinutes ?? DEFAULT_LEAD_MINUTES;
  const excluded = new Set(options.excludeDoctorIds ?? []);
  const [doctors, departments, sessions] = await Promise.all([
    hospitalDoctors(admin),
    hospitalDepartments(admin),
    sessionsOn(admin, today),
  ]);
  const deptName = (id: string) => departments.find((d) => d.id === id)?.name ?? '';
  const candidates = doctors
    .filter((d) => d.status === 'active' && !excluded.has(d.id))
    .filter((d) => !options.bookableOnline || d.is_bookable_online)
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const doctor of candidates) {
    const clean = sessions.filter(
      (s) =>
        s.doctor_id === doctor.id &&
        s.status === 'scheduled' &&
        s.waiting_count === 0 &&
        (s.in_consultation_count ?? 0) === 0 &&
        s.current_appointment_id === null,
    );
    if (clean.length === 0) continue;
    const day = await slotDay(admin, doctor.id, today);
    for (const s of clean) {
      const grid = day?.sessions.find((g) => g.id === s.id);
      const open = grid ? futureOpenSlots(grid, lead) : [];
      if (open.length >= options.minOpenSlots) {
        return {
          doctor,
          departmentName: deptName(doctor.department_id),
          sessionId: s.id,
          label: s.label,
          openSlots: open,
        };
      }
    }
  }

  for (const doctor of candidates) {
    const sessionId = await addUatSessionToday(admin, doctor);
    if (!sessionId) continue;
    const day = await slotDay(admin, doctor.id, today);
    const grid = day?.sessions.find((g) => g.id === sessionId);
    const open = grid ? futureOpenSlots(grid, lead) : [];
    if (open.length >= options.minOpenSlots) {
      return {
        doctor,
        departmentName: deptName(doctor.department_id),
        sessionId,
        label: UAT_SESSION_LABEL,
        openSlots: open,
      };
    }
  }
  throw new Error(
    `No doctor has a free session today (${today}) with ${options.minOpenSlots} open slots, and none could be added (the hospital may be closed for the rest of the day).`,
  );
}

/** The open future slots of a doctor's session, re-read now. */
export async function openSlotsOf(
  admin: ApiClient,
  doctorId: string,
  sessionId: string,
  leadMinutes = DEFAULT_LEAD_MINUTES,
): Promise<GridSlot[]> {
  const day = await slotDay(admin, doctorId, todayIso());
  const grid = day?.sessions.find((s) => s.id === sessionId);
  return grid ? futureOpenSlots(grid, leadMinutes) : [];
}

/* ----------------------------------------------------- desk (background) */

/** A unique-enough Indian mobile that belongs to no seeded account. */
export function randomMobile(): string {
  const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join('');
  return `+917${digits}`;
}

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

/** A short letters-only tag, so names stay valid ("Uat Rqxk"). */
export function runTag(length = 4): string {
  return Array.from({ length }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)])
    .join('')
    .replace(/^./, (c) => c.toUpperCase());
}

export interface NewPatientInput {
  readonly firstName: string;
  readonly lastName: string;
  readonly phone?: string;
  readonly dateOfBirth?: string;
}

/** Register a patient at the desk (setup only). */
export async function createDeskPatient(
  staff: ApiClient,
  input: NewPatientInput,
): Promise<HospitalPatient> {
  const body = {
    first_name: input.firstName,
    last_name: input.lastName,
    phone_e164: input.phone ?? randomMobile(),
    date_of_birth: input.dateOfBirth ?? '1988-04-12',
    gender: 'female',
    confirm_new_record: true,
  };
  return staff.post<HospitalPatient>('/patients', body);
}

/** Book a desk walk-in on `slotId` for a new patient (setup only). */
export async function bookWalkIn(
  staff: ApiClient,
  doctor: { readonly id: string; readonly department_id: string },
  slotId: string,
  patient: NewPatientInput | { readonly hospitalPatientId: string },
): Promise<DeskAppointment> {
  const who =
    'hospitalPatientId' in patient
      ? { hospital_patient_id: patient.hospitalPatientId }
      : {
          new: {
            first_name: patient.firstName,
            last_name: patient.lastName,
            phone_e164: patient.phone ?? randomMobile(),
            gender: 'male',
            date_of_birth: patient.dateOfBirth ?? '1979-09-21',
            confirm_new_record: true,
          },
        };
  const out = await staff.post<{ readonly appointments: readonly DeskAppointment[] }>(
    '/appointments',
    {
      patient: who,
      consultations: [
        { department_id: doctor.department_id, doctor_id: doctor.id, slot_id: slotId },
      ],
      remark: null,
    },
  );
  const appt = out.appointments[0];
  if (!appt) throw new Error('The walk-in booking returned no appointment.');
  return appt;
}

/** Collect a walk-in's fee at the desk (setup only). */
export async function collectAtDesk(
  staff: ApiClient,
  appointment: { readonly id: string; readonly total_paise: number },
  method: 'cash' | 'upi' | 'card' = 'upi',
  reference: string | null = 'UAT-REF',
): Promise<void> {
  await staff.post(`/appointments/${appointment.id}/payments`, {
    lines: [{ method, amount_paise: appointment.total_paise, reference }],
  });
}

export function deskAppointment(staff: ApiClient, id: string): Promise<DeskAppointment> {
  return staff.get<DeskAppointment>(`/appointments/${id}`);
}

/* ---------------------------------------------------------------- dates */

export interface HolidayRow {
  readonly id: string;
  readonly name: string;
  readonly date_from: string;
  readonly date_to: string;
  readonly department_id: string | null;
  readonly version: number;
}

export function hospitalHolidays(admin: ApiClient): Promise<HolidayRow[]> {
  return admin.all<HolidayRow>('/holidays');
}

/** Is `date` inside any hospital-wide closure? */
export function isHoliday(holidays: readonly HolidayRow[], date: string): boolean {
  return holidays.some((h) => h.department_id === null && h.date_from <= date && date <= h.date_to);
}

const SATURDAY = 5;

/**
 * The first `count` weekdays (Monday–Friday) on or after `from` that are not
 * hospital closures and not in `skip` — dates later steps can use for a new
 * doctor's Monday–Friday hours.
 */
export function workingWeekdays(
  from: string,
  count: number,
  holidays: readonly HolidayRow[],
  skip: readonly string[] = [],
): string[] {
  const out: string[] = [];
  const LOOKAHEAD_DAYS = 28;
  for (let i = 0; i < LOOKAHEAD_DAYS && out.length < count; i += 1) {
    const date = addDaysIso(from, i);
    if (weekdayOf(date) >= SATURDAY || isHoliday(holidays, date) || skip.includes(date)) continue;
    out.push(date);
  }
  return out;
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, (d ?? 1) + days)).toISOString().slice(0, 10);
}

const ONLINE_SLOTS_WAIT_MS = 120_000;
const ONLINE_SLOTS_POLL_MS = 3_000;

/** Wait until the patient app offers a slot of `doctorId` on `date` (slots are generated by a job). */
export async function waitForOnlineSlots(
  doctorId: string,
  date: string,
  slotFilter: (slot: { readonly starts_at: string }) => boolean = () => true,
): Promise<void> {
  const anonymous = await ApiClient.anonymous();
  const deadline = Date.now() + ONLINE_SLOTS_WAIT_MS;
  try {
    for (;;) {
      const grid = await anonymous.get<PatientSlots>(`/patient/doctors/${doctorId}/slots`, {
        date,
      });
      const free = grid.sessions
        .flatMap((s) => s.slots)
        .some((s) => s.state === 'available' && slotFilter(s));
      if (free) return;
      if (Date.now() > deadline) {
        throw new Error(`No slot of doctor ${doctorId} on ${date} became bookable online.`);
      }
      await sleep(ONLINE_SLOTS_POLL_MS);
    }
  } finally {
    await anonymous.dispose();
  }
}

/* ------------------------------------------------- online (patient app) */

const patientClients = new Map<string, ApiClient>();
let nextPatient = 0;

async function patientClient(phone: string): Promise<ApiClient> {
  const known = patientClients.get(phone);
  if (known) return known;
  const client = await ApiClient.patient(phone);
  patientClients.set(phone, client);
  return client;
}

export interface OnlineBooking {
  readonly appointment: PatientAppointment;
  readonly order: PaymentOrder;
  readonly patient: ApiClient;
  readonly personName: string;
}

export type PaymentPath = 'checkout' | 'webhook' | 'none';

export interface OnlineBookingOptions {
  readonly doctorId: string;
  readonly date: string;
  /** How the payment is captured: the dev checkout + verify, the signed webhook, or not at all. */
  readonly pay?: PaymentPath;
  /** Slots must start at least this many minutes from now. */
  readonly leadMinutes?: number;
  /** Which of the free slots to try (default: any, earliest first). */
  readonly slotFilter?: (slot: { readonly id: string; readonly starts_at: string }) => boolean;
}

/** Codes that mean "this person or account cannot take another booking now". */
const TRY_NEXT_PERSON = new Set(['BOOKING_DAILY_LIMIT']);
const TRY_NEXT_ACCOUNT = new Set(['BOOKING_PENDING_LIMIT', 'RATE_LIMITED']);
const TRY_NEXT_SLOT = new Set(['SLOT_TAKEN', 'SLOT_IN_PAST', 'SLOT_CLOSED']);

const PAY_WAIT_MS = 90_000;

async function capture(
  client: ApiClient,
  booking: { readonly appointment: PatientAppointment; readonly order: PaymentOrder },
  pay: PaymentPath,
): Promise<PatientAppointment> {
  if (pay === 'none') return booking.appointment;
  if (pay === 'checkout') {
    const checkout = await client.post<{
      readonly razorpay_payment_id: string;
      readonly razorpay_signature: string;
    }>(`/patient/payments/orders/${booking.order.id}/dev-checkout`, {});
    await client.post(`/patient/payments/orders/${booking.order.id}/verify`, {
      razorpay_payment_id: checkout.razorpay_payment_id,
      razorpay_signature: checkout.razorpay_signature,
    });
  } else {
    await sendPaymentCaptured(client, {
      gatewayOrderId: booking.order.gateway_order_id,
      amountPaise: booking.order.amount_paise,
    });
  }
  const deadline = Date.now() + PAY_WAIT_MS;
  for (;;) {
    const fresh = await client.get<PatientAppointment>(
      `/patient/appointments/${booking.appointment.id}`,
    );
    if (fresh.payment_status === 'paid') return fresh;
    if (Date.now() > deadline) {
      throw new Error(
        `Booking ${fresh.booking_ref} is still ${fresh.payment_status} ${PAY_WAIT_MS / 1000}s after payment.`,
      );
    }
    await sleep(POLL_MS);
  }
}

/**
 * Book `doctorId` on `date` as a seeded patient through the patient API and
 * (by default) pay for it — report §3 steps 1–7. Tries the seeded accounts and
 * their family members in turn, so per-person and per-account booking limits
 * (H-08) from earlier runs never block the step.
 */
export async function bookOnline(options: OnlineBookingOptions): Promise<OnlineBooking> {
  const anonymous = await ApiClient.anonymous();
  const lead = options.leadMinutes ?? DEFAULT_LEAD_MINUTES;
  const grid = await anonymous.get<PatientSlots>(`/patient/doctors/${options.doctorId}/slots`, {
    date: options.date,
  });
  await anonymous.dispose();
  const slots = grid.sessions
    .filter((s) => s.status !== 'closed' && s.status !== 'cancelled')
    .flatMap((s) => s.slots)
    .filter((s) => s.state === 'available' && minutesUntil(s.starts_at) >= lead)
    .filter((s) => (options.slotFilter ? options.slotFilter(s) : true))
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  if (slots.length === 0) {
    throw new Error(`No slot of doctor ${options.doctorId} on ${options.date} is bookable online.`);
  }

  const patients = bookingPatients();
  const refusals: string[] = [];
  for (const slot of slots) {
    for (let tried = 0; tried < patients.length; tried += 1) {
      const account = patients[(nextPatient + tried) % patients.length];
      if (!account) continue;
      let client: ApiClient;
      try {
        client = await patientClient(account.phone);
      } catch (error) {
        refusals.push(`${account.name}: sign-in ${String(error)}`);
        continue;
      }
      const persons = await client.get<Page<PatientPerson>>('/patient/me/persons');
      let nextSlot = false;
      let nextAccount = false;
      for (const person of persons.results) {
        try {
          const booked = await client.post<{
            readonly appointment: PatientAppointment;
            readonly payment_order: PaymentOrder;
          }>('/patient/appointments', { slot_id: slot.id, person_id: person.id });
          nextPatient = (nextPatient + tried + 1) % patients.length;
          const appointment = await capture(
            client,
            { appointment: booked.appointment, order: booked.payment_order },
            options.pay ?? 'checkout',
          );
          return {
            appointment,
            order: booked.payment_order,
            patient: client,
            personName: `${person.first_name} ${person.last_name ?? ''}`.trim(),
          };
        } catch (error) {
          if (!isApiError(error)) throw error;
          refusals.push(`${account.name}/${person.first_name}: ${error.code}`);
          if (TRY_NEXT_PERSON.has(error.code)) continue;
          if (TRY_NEXT_ACCOUNT.has(error.code)) {
            nextAccount = true;
            break;
          }
          if (TRY_NEXT_SLOT.has(error.code)) {
            nextSlot = true;
            break;
          }
          throw error;
        }
      }
      if (nextSlot) break;
      if (nextAccount) continue;
    }
  }
  throw new Error(`No seeded patient could book online: ${refusals.slice(-8).join('; ')}`);
}

const SOON_DAYS_AHEAD = 7;

/**
 * Book `doctorId` online on the first of the next days (from tomorrow) that
 * still has a slot open to patients — for steps that need "an upcoming
 * booking" and do not care which day it is.
 */
export async function bookOnlineSoon(
  doctorId: string,
  pay: PaymentPath = 'checkout',
): Promise<OnlineBooking> {
  let lastError: unknown = null;
  for (let day = 1; day <= SOON_DAYS_AHEAD; day += 1) {
    try {
      return await bookOnline({ doctorId, date: addDays(todayIso(), day), pay });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('No upcoming day could be booked.');
}

/** Sign every patient session of this run out of memory (end of a spec). */
export async function disposePatients(): Promise<void> {
  await Promise.all([...patientClients.values()].map((c) => c.dispose()));
  patientClients.clear();
}
