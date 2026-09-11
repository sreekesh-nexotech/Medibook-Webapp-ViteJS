/**
 * Gathers the rows a data-subject / regulatory export is made of (audit 2.5 /
 * SA-06, "export on request").
 *
 * One long-format table rather than several shapes glued together, so the file
 * opens cleanly in any spreadsheet: a `Record type` column says what each row
 * is, and the columns that do not apply to that type are simply empty.
 *
 * Pure functions over data passed in. Hospital display names come from the
 * live registry resolver, so an export can never name a hospital differently
 * from the console. Dates are compared as ISO strings and any display date is
 * converted through local calendar parts — never `Date.toISOString()` on a
 * local midnight.
 */
import type { CsvCell } from '@/shared/lib/download';

import { hospName } from '@/features/ops-hospitals/application/store/hospitals.store';
import type { PlatformUser } from '@/features/ops-platform-users/application/store/platformUsers.types';

import type { ConfigChange, ExportSubjectKind, StaffLogin } from './compliance.types';

/** Header row of every export. */
export const EXPORT_COLUMNS: readonly string[] = [
  'Record type',
  'Date',
  'Time',
  'Subject',
  'Actor / user',
  'Detail',
  'Before',
  'After',
  'Scope',
  'Result / status',
  'IP address',
  'Device',
];

/** Subject-key prefixes, so the screen and this module cannot disagree. */
export const SUBJECT_PREFIX = {
  hospital: 'hospital:',
  staff: 'staff:',
  patient: 'patient:',
} as const;

/** Everything the gatherer reads. */
export interface ExportSources {
  readonly logins: readonly StaffLogin[];
  readonly changes: readonly ConfigChange[];
  readonly patients: readonly PlatformUser[];
}

export interface ExportQuery {
  readonly kind: ExportSubjectKind;
  readonly subjectKey: string;
  readonly subject: string;
  /** Inclusive ISO range. */
  readonly from: string;
  readonly to: string;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** "June 14, 2026" → "2026-06-14", via local parts only. */
function displayDateToIso(display: string): string {
  const t = Date.parse(display);
  if (Number.isNaN(t)) return '';
  const d = new Date(t);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function inRange(date: string, from: string, to: string): boolean {
  if (!date) return false;
  return (!from || date >= from) && (!to || date <= to);
}

/** Where a sign-in happened. */
function instanceLabel(hid: number | null): string {
  return hid == null ? 'Ops console' : hospName(hid);
}

function scopeLabel(c: ConfigChange): string {
  return c.scope === 'Hospital' && c.hid != null ? hospName(c.hid) : 'Platform';
}

function loginRow(l: StaffLogin, subject: string): readonly CsvCell[] {
  return [
    'Staff login',
    l.date,
    l.time,
    subject,
    `${l.user} (${l.name})`,
    l.role,
    '',
    '',
    instanceLabel(l.hid),
    l.reason ? `${l.result} — ${l.reason}` : l.result,
    l.ip,
    l.device,
  ];
}

function changeRow(c: ConfigChange, subject: string): readonly CsvCell[] {
  return [
    'Configuration change',
    c.date,
    c.time,
    subject,
    c.actor,
    `${c.area} · ${c.setting}`,
    c.before,
    c.after,
    scopeLabel(c),
    '',
    '',
    '',
  ];
}

/** The rows held about one hospital instance in the window. */
function hospitalRows(
  hid: number,
  q: ExportQuery,
  src: ExportSources,
): readonly (readonly CsvCell[])[] {
  const logins = src.logins
    .filter((l) => l.hid === hid && inRange(l.date, q.from, q.to))
    .map((l) => loginRow(l, q.subject));
  const changes = src.changes
    .filter((c) => c.hid === hid && inRange(c.date, q.from, q.to))
    .map((c) => changeRow(c, q.subject));
  return [...logins, ...changes];
}

/** The rows held about one staff account in the window. */
function staffRows(
  email: string,
  q: ExportQuery,
  src: ExportSources,
): readonly (readonly CsvCell[])[] {
  const logins = src.logins
    .filter((l) => l.user === email && inRange(l.date, q.from, q.to))
    .map((l) => loginRow(l, q.subject));
  const changes = src.changes
    .filter((c) => c.actor === email && inRange(c.date, q.from, q.to))
    .map((c) => changeRow(c, q.subject));
  return [...logins, ...changes];
}

/**
 * The rows held about one patient account.
 *
 * The account and its linked family members are the record itself, not events,
 * so they are always included; bookings are filtered to the window. No
 * clinical data exists in this console and none is invented here.
 */
function patientRows(
  email: string,
  q: ExportQuery,
  src: ExportSources,
): readonly (readonly CsvCell[])[] {
  const u = src.patients.find((p) => p.email === email);
  if (!u) return [];
  const account: readonly CsvCell[] = [
    'Patient account',
    displayDateToIso(u.joined),
    '',
    q.subject,
    u.email,
    `${u.phone} · ${u.city} · ${u.bookings} bookings`,
    '',
    '',
    'Platform',
    u.status,
    '',
    '',
  ];
  const family: readonly (readonly CsvCell[])[] = u.family.map((f) => [
    'Family member',
    '',
    '',
    q.subject,
    u.email,
    `${f.name} · ${f.rel} · ${f.age} · ${f.gender}`,
    '',
    '',
    'Platform',
    '',
    '',
    '',
  ]);
  const bookings: readonly (readonly CsvCell[])[] = u.history
    .filter((b) => inRange(displayDateToIso(b.date), q.from, q.to))
    .map((b) => [
      'Booking',
      displayDateToIso(b.date),
      '',
      q.subject,
      u.email,
      `${b.hospital} · ${b.department}`,
      '',
      '',
      b.hospital,
      b.status,
      '',
      '',
    ]);
  return [account, ...family, ...bookings];
}

/** Every row the export contains, body only — the caller prepends the header. */
export function buildExportRows(
  q: ExportQuery,
  src: ExportSources,
): readonly (readonly CsvCell[])[] {
  if (q.subjectKey.startsWith(SUBJECT_PREFIX.hospital)) {
    const hid = Number(q.subjectKey.slice(SUBJECT_PREFIX.hospital.length));
    return Number.isFinite(hid) ? hospitalRows(hid, q, src) : [];
  }
  if (q.subjectKey.startsWith(SUBJECT_PREFIX.staff)) {
    return staffRows(q.subjectKey.slice(SUBJECT_PREFIX.staff.length), q, src);
  }
  if (q.subjectKey.startsWith(SUBJECT_PREFIX.patient)) {
    return patientRows(q.subjectKey.slice(SUBJECT_PREFIX.patient.length), q, src);
  }
  return [];
}
