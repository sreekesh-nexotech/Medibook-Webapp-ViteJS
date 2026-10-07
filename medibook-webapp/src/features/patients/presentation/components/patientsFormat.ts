import { isFailure } from '@/core/error/failure';
import { fmtDate } from '@/shared/lib/format';

import type {
  AppointmentPaymentStatus,
  AppointmentSource,
  AppointmentStatus,
  PatientChangeStatus,
  PatientDemographics,
  PatientFieldChange,
  PatientGender,
  PatientRecord,
  PatientSource,
} from '@/features/patients/domain/entities/patients.entities';

/**
 * Display and form helpers for the patients screens: the API speaks E.164,
 * ISO dates, paise and enum codes; the desk sees 10-digit numbers, ages,
 * rupees and labels.
 */

/** Indian numbers typed without a country code get this one; the API stores E.164. */
const PHONE_COUNTRY_CODE = '+91';

const PAISE_PER_RUPEE = 100;

/** A badge: which palette entry to use (`status-map.ts`) and what it says. */
export interface BadgeSpec {
  readonly status: string;
  readonly label: string;
}

/** Separators people type into phone numbers. */
const PHONE_SEPARATORS = /[\s\-().]/g;

/** A 10-digit Indian mobile (starts 6–9), as typed without the country code. */
const INDIAN_MOBILE = /^[6-9]\d{9}$/;

/** The same mobile with a trunk `0` or the `91` country code in front. */
const INDIAN_MOBILE_PREFIXED = /^(?:0|91)([6-9]\d{9})$/;

/** Any E.164 number — the backend's own rule (`core/phone.py` `_E164`). */
const E164 = /^\+[1-9]\d{7,14}$/;

/** Longest thing worth typing: `+` and 15 digits, plus a few separators. */
export const PHONE_INPUT_MAX_LENGTH = 20;

/**
 * What the desk typed → E.164, or `null` when blank. A bare Indian mobile
 * (with or without a leading `0` or `91`) gets `+91`; a number typed with `+`
 * keeps its own country code. Anything else is returned with separators
 * stripped, for the validator to reject.
 */
export function toE164(input: string): string | null {
  const compact = input.trim().replace(PHONE_SEPARATORS, '');
  if (compact === '') return null;
  if (compact.startsWith('+')) return compact;
  if (INDIAN_MOBILE.test(compact)) return `${PHONE_COUNTRY_CODE}${compact}`;
  const prefixed = INDIAN_MOBILE_PREFIXED.exec(compact);
  if (prefixed?.[1]) return `${PHONE_COUNTRY_CODE}${prefixed[1]}`;
  return compact;
}

/**
 * The phone field's error. Typed without a country code it must be a 10-digit
 * Indian mobile; typed with `+` it may be any E.164 number — exactly what the
 * backend accepts for a patient. `required` makes a blank field an error.
 */
export function phoneError(input: string, required: boolean): string | undefined {
  const e164 = toE164(input);
  if (e164 === null) return required ? 'Phone number is required.' : undefined;
  if (E164.test(e164)) return undefined;
  return 'Enter a 10-digit mobile number, or an international number starting with + and the country code.';
}

/** `+919876543210` → `9876543210`; any other country code is shown in full. */
export function displayPhone(e164: string | null): string {
  if (!e164) return '';
  return e164.startsWith(PHONE_COUNTRY_CODE) ? e164.slice(PHONE_COUNTRY_CODE.length) : e164;
}

/** Six digits (backend `pincode` rule `^\d{6}$`). */
const PINCODE = /^\d{6}$/;

/** The PIN field's error; blank is allowed. */
export function pincodeError(input: string): string | undefined {
  const value = input.trim();
  if (value === '') return undefined;
  return PINCODE.test(value) ? undefined : 'Enter the 6-digit PIN code.';
}

/** Whole years from an ISO date of birth to today, or `null` when unknown. */
export function ageFromDob(dob: string | null, today: Date = new Date()): number | null {
  if (!dob) return null;
  const born = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(born.getTime())) return null;
  let age = today.getFullYear() - born.getFullYear();
  const hadBirthday =
    today.getMonth() > born.getMonth() ||
    (today.getMonth() === born.getMonth() && today.getDate() >= born.getDate());
  if (!hadBirthday) age -= 1;
  return age;
}

/** Every structured address part, joined for display. */
export function formatAddress(p: PatientRecord): string {
  return [p.addressLine1, p.addressLine2, p.addressLine3, p.city, p.state, p.pincode]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(', ');
}

export const GENDER_LABELS: Readonly<Record<PatientGender, string>> = {
  male: 'Male',
  female: 'Female',
  other: 'Other',
  undisclosed: 'Undisclosed',
};

/** The form's "no answer" option — saved as no gender, never as a guess. */
export const GENDER_NOT_SPECIFIED = 'Not specified';

export const GENDER_OPTIONS: readonly string[] = [
  GENDER_NOT_SPECIFIED,
  ...Object.values(GENDER_LABELS),
];

export function genderFromLabel(label: string): PatientGender | null {
  const hit = (Object.keys(GENDER_LABELS) as PatientGender[]).find(
    (g) => GENDER_LABELS[g] === label,
  );
  return hit ?? null;
}

export function genderLabel(gender: PatientGender | null): string {
  return gender ? GENDER_LABELS[gender] : '';
}

export const SOURCE_LABELS: Readonly<Record<PatientSource, string>> = {
  desk: 'Desk',
  online: 'Online',
};

export function sourceFromLabel(label: string): PatientSource | null {
  const hit = (Object.keys(SOURCE_LABELS) as PatientSource[]).find(
    (s) => SOURCE_LABELS[s] === label,
  );
  return hit ?? null;
}

export function patientSourceBadge(source: PatientSource): BadgeSpec {
  return source === 'online'
    ? { status: 'Medibook', label: SOURCE_LABELS.online }
    : { status: 'Walk-in', label: SOURCE_LABELS.desk };
}

const APPOINTMENT_SOURCE_BADGES: Readonly<Record<AppointmentSource, BadgeSpec>> = {
  online: { status: 'Medibook', label: 'Medibook' },
  walk_in: { status: 'Walk-in', label: 'Walk-in' },
};

export function appointmentSourceBadge(source: AppointmentSource): BadgeSpec {
  return APPOINTMENT_SOURCE_BADGES[source];
}

const APPOINTMENT_STATUS_BADGES: Readonly<Record<AppointmentStatus, BadgeSpec>> = {
  pending_payment: { status: 'Pending', label: 'Pending payment' },
  pending_approval: { status: 'Pending', label: 'Pending approval' },
  scheduled: { status: 'Scheduled', label: 'Scheduled' },
  checked_in: { status: 'Checked-in', label: 'Checked-in' },
  in_consultation: { status: 'In Queue', label: 'In consultation' },
  completed: { status: 'Completed', label: 'Completed' },
  cancelled: { status: 'Cancelled', label: 'Cancelled' },
  no_show: { status: 'No-show', label: 'No-show' },
};

export function appointmentStatusBadge(status: AppointmentStatus): BadgeSpec {
  return APPOINTMENT_STATUS_BADGES[status];
}

const PAYMENT_BADGES: Readonly<Record<AppointmentPaymentStatus, BadgeSpec>> = {
  unpaid: { status: 'Pending', label: 'Unpaid' },
  pending: { status: 'Pending', label: 'Pending' },
  paid: { status: 'Paid', label: 'Paid' },
  refunded: { status: 'Refunded', label: 'Refunded' },
  failed: { status: 'Failed', label: 'Failed' },
  not_required: { status: 'Inactive', label: 'No charge' },
  cancelled: { status: 'Inactive', label: 'Not paid' },
};

/**
 * A booking cancelled (or missed) before anyone paid keeps `pending`/`unpaid`
 * on the backend (BACKEND_BLOCKERS APPT-02); "Pending" there reads as money
 * still owed, so it says "Not paid".
 */
export function paymentBadge(
  status: AppointmentPaymentStatus,
  appointmentStatus: AppointmentStatus,
): BadgeSpec {
  const unpaid = status === 'unpaid' || status === 'pending';
  if (unpaid && (appointmentStatus === 'cancelled' || appointmentStatus === 'no_show')) {
    return { status: 'Inactive', label: 'Not paid' };
  }
  return PAYMENT_BADGES[status];
}

export const APPROVAL_STATUS_BADGES: Readonly<Record<PatientChangeStatus, BadgeSpec>> = {
  pending: { status: 'Pending', label: 'Pending' },
  approved: { status: 'Completed', label: 'Approved' },
  rejected: { status: 'Rejected', label: 'Rejected' },
};

/** "34 yrs", or "—" when the date of birth is unknown. */
export function ageText(age: number | null): string {
  return age === null ? '—' : `${age} yrs`;
}

export function paiseToRupees(paise: number): number {
  return paise / PAISE_PER_RUPEE;
}

/** Start time in the desk's locale, e.g. "10:30 am". */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

const FIELD_LABELS: Readonly<Record<string, string>> = {
  first_name: 'first name',
  last_name: 'last name',
  phone_e164: 'phone',
  alternate_phone_e164: 'alternate phone',
  email: 'email',
  date_of_birth: 'date of birth',
  gender: 'gender',
  blood_group: 'blood group',
  address_line1: 'address line 1',
  address_line2: 'address line 2',
  address_line3: 'address line 3',
  city: 'city',
  state: 'state',
  pincode: 'PIN code',
  notes: 'notes',
  legacy_mrn: 'legacy MR number',
};

/** `phone_e164` → "phone"; an unknown field reads as its words. */
export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field.replace(/_/g, ' ');
}

/** API field names → a readable, de-duplicated list ("phone, email"). */
export function changedFieldsText(fields: readonly string[]): string {
  const labels = new Set(fields.map(fieldLabel));
  return [...labels].join(', ');
}

/** One side of a proposed change as the desk reads it: labels for codes, dates formatted. */
export function changeValueText(field: string, value: string | null): string {
  if (value === null) return 'not set';
  if (field === 'gender') return genderLabel(genderFromCode(value)) || value;
  if (field === 'date_of_birth') return fmtDate(value);
  return value;
}

function genderFromCode(code: string): PatientGender | null {
  return (Object.keys(GENDER_LABELS) as PatientGender[]).find((g) => g === code) ?? null;
}

/** "phone: 98… → 99…" for each change, for a one-line summary. */
export function changeSummary(changes: readonly PatientFieldChange[]): string {
  return changes
    .map(
      (c) =>
        `${fieldLabel(c.field)}: ${changeValueText(c.field, c.before)} → ${changeValueText(c.field, c.after)}`,
    )
    .join('; ');
}

/** Every demographic the desk can edit, in form order. */
const DEMOGRAPHIC_KEYS: readonly (keyof PatientDemographics)[] = [
  'firstName',
  'lastName',
  'phone',
  'email',
  'dateOfBirth',
  'gender',
  'addressLine1',
  'addressLine2',
  'addressLine3',
  'city',
  'state',
  'pincode',
  'legacyMrn',
];

/** The record's current demographics, in the shape the form edits. */
export function demographicsOf(p: PatientRecord): PatientDemographics {
  return {
    firstName: p.firstName,
    lastName: p.lastName,
    phone: p.phone,
    email: p.email,
    dateOfBirth: p.dateOfBirth,
    gender: p.gender,
    addressLine1: p.addressLine1,
    addressLine2: p.addressLine2,
    addressLine3: p.addressLine3,
    city: p.city,
    state: p.state,
    pincode: p.pincode,
    legacyMrn: p.legacyMrn,
  };
}

/**
 * Only the demographics that differ from the record — an edit sends nothing
 * else, so a phone-only edit is a phone-only request (UAT-07).
 */
export function diffDemographics(
  before: PatientRecord,
  next: PatientDemographics,
): Partial<PatientDemographics> {
  const current = demographicsOf(before);
  const changes: Record<string, unknown> = {};
  for (const key of DEMOGRAPHIC_KEYS) {
    if (next[key] !== current[key]) changes[key] = next[key];
  }
  return changes as Partial<PatientDemographics>;
}

/**
 * Whether the signed-in user asked for this change: by id when the server
 * sends it (the record's pending request, B6), else by name (the queue's rows
 * carry only the requester's name).
 */
export function isOwnChangeRequest(
  requestedByUserId: string | null,
  requestedByName: string | null,
  me: { readonly id: string; readonly firstName: string; readonly lastName: string | null } | null,
): boolean {
  if (!me) return false;
  if (requestedByUserId !== null) return requestedByUserId === me.id;
  const myName = [me.firstName, me.lastName].filter(Boolean).join(' ').trim();
  return requestedByName !== null && myName !== '' && requestedByName.trim() === myName;
}

/** A user-safe sentence for a failed save: the first field message, else the failure's own. */
export function saveErrorMessage(error: unknown, fallback: string): string {
  if (!isFailure(error)) return fallback;
  const first = Object.values(error.fieldErrors)[0]?.[0];
  return first ?? error.message;
}
