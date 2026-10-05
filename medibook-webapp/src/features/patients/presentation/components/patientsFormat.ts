import { isFailure } from '@/core/error/failure';

import type {
  AppointmentPaymentStatus,
  AppointmentSource,
  AppointmentStatus,
  PatientDemographics,
  PatientGender,
  PatientRecord,
  PatientSource,
} from '@/features/patients/domain/entities/patients.entities';

/**
 * Display and form helpers for the patients screens: the API speaks E.164,
 * ISO dates, paise and enum codes; the desk sees 10-digit numbers, ages,
 * rupees and labels.
 */

/** The desk enters Indian mobiles; the API stores E.164. */
const PHONE_COUNTRY_CODE = '+91';

const PAISE_PER_RUPEE = 100;

/** A badge: which palette entry to use (`status-map.ts`) and what it says. */
export interface BadgeSpec {
  readonly status: string;
  readonly label: string;
}

export function toE164(national: string): string | null {
  const digits = national.trim();
  return digits === '' ? null : `${PHONE_COUNTRY_CODE}${digits}`;
}

/** `+919876543210` → `9876543210`; any other country code is shown in full. */
export function displayPhone(e164: string | null): string {
  if (!e164) return '';
  return e164.startsWith(PHONE_COUNTRY_CODE) ? e164.slice(PHONE_COUNTRY_CODE.length) : e164;
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

/** "Ravi Kumar Rao" → first `Ravi`, last `Kumar Rao`; one word → no last name. */
export function splitFullName(
  fullName: string,
): Pick<PatientDemographics, 'firstName' | 'lastName'> {
  const name = fullName.trim().replace(/\s+/g, ' ');
  const space = name.indexOf(' ');
  if (space < 0) return { firstName: name, lastName: null };
  return { firstName: name.slice(0, space), lastName: name.slice(space + 1) };
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

export const GENDER_OPTIONS: readonly string[] = Object.values(GENDER_LABELS);

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
};

export function paymentBadge(status: AppointmentPaymentStatus): BadgeSpec {
  return PAYMENT_BADGES[status];
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
  address_line1: 'address',
  address_line2: 'address',
  address_line3: 'address',
  city: 'city',
  state: 'state',
  pincode: 'pincode',
  notes: 'notes',
  legacy_mrn: 'legacy MR number',
};

/** API field names → a readable, de-duplicated list ("phone, email"). */
export function changedFieldsText(fields: readonly string[]): string {
  const labels = new Set(fields.map((f) => FIELD_LABELS[f] ?? f.replace(/_/g, ' ')));
  return [...labels].join(', ');
}

/** Only the demographics that differ from the record — an edit sends nothing else. */
export function diffDemographics(
  before: PatientRecord,
  next: PatientDemographics,
): Partial<PatientDemographics> {
  const changes: { -readonly [K in keyof PatientDemographics]?: PatientDemographics[K] } = {};
  if (next.firstName !== before.firstName) changes.firstName = next.firstName;
  if (next.lastName !== before.lastName) changes.lastName = next.lastName;
  if (next.phone !== before.phone) changes.phone = next.phone;
  if (next.email !== before.email) changes.email = next.email;
  if (next.dateOfBirth !== before.dateOfBirth) changes.dateOfBirth = next.dateOfBirth;
  if (next.gender !== before.gender) changes.gender = next.gender;
  if (next.addressLine1 !== before.addressLine1) changes.addressLine1 = next.addressLine1;
  return changes;
}

/** A user-safe sentence for a failed save: the first field message, else the failure's own. */
export function saveErrorMessage(error: unknown, fallback: string): string {
  if (!isFailure(error)) return fallback;
  const first = Object.values(error.fieldErrors)[0]?.[0];
  return first ?? error.message;
}
