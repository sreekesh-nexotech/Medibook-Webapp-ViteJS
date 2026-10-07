/**
 * Display helpers for the live compliance records: result / status labels
 * with the shared badge token that already carries their meaning, a short
 * device line from a user agent, and before / after values as text.
 */
import { fmtDate, toLocalISO } from '@/shared/lib/format';

import type {
  DataRequest,
  DataRequestKind,
  DataRequestStatus,
  DataSubjectKind,
  LoginEvent,
  LoginResult,
  PhiAccessEntry,
  PhiSubjectKind,
  StaffDirectoryEntry,
} from '@/features/ops-compliance/domain/entities/compliance.entities';

/** A label plus the `Badge` status token whose tint means the same thing. */
export interface StatusLook {
  readonly label: string;
  readonly token: string;
}

export const LOGIN_RESULT_LOOK: Readonly<Record<LoginResult, StatusLook>> = {
  success: { label: 'Success', token: 'Success' },
  failed: { label: 'Failed', token: 'Failed' },
  locked: { label: 'Locked out', token: 'On Hold' },
  mfa_required: { label: 'MFA required', token: 'Requested' },
  mfa_failed: { label: 'MFA failed', token: 'Failed' },
  otp_failed: { label: 'OTP failed', token: 'Failed' },
  blocked: { label: 'Blocked', token: 'Suspended' },
};

export const DATA_REQUEST_LOOK: Readonly<Record<DataRequestStatus, StatusLook>> = {
  requested: { label: 'Requested', token: 'Requested' },
  cooling_off: { label: 'Cooling off', token: 'Pending' },
  verifying: { label: 'Verifying', token: 'Pending' },
  processing: { label: 'Processing', token: 'Queued' },
  completed: { label: 'Completed', token: 'Completed' },
  rejected: { label: 'Rejected', token: 'Rejected' },
  no_data: { label: 'No data', token: 'Inactive' },
  withdrawn: { label: 'Withdrawn', token: 'Inactive' },
};

/**
 * Requests still open to processing or rejection — exactly the backend's
 * `OPEN_STATES` (`audit/services/dsr.py`). `cooling_off` is not one of them:
 * a D-24 deletion completes on its own when the cooling-off ends (UAT-54).
 */
export const OPEN_DATA_REQUEST_STATUSES: ReadonlySet<DataRequestStatus> = new Set([
  'requested',
  'verifying',
  'processing',
]);

/** What the console may do to one request, mirroring the backend's refusals (UAT-54, 12·F15). */
export interface DataRequestActions {
  /** Prepare an export now (`process` on an open export). */
  readonly canPrepare: boolean;
  /** Mark a rectification done with notes (`process` on an open rectification). */
  readonly canRectify: boolean;
  /** Reject with a reason — never a deletion, which follows the account-deletion flow (D-24). */
  readonly canReject: boolean;
}

export function dataRequestActions(r: DataRequest, canEdit: boolean): DataRequestActions {
  const open = canEdit && OPEN_DATA_REQUEST_STATUSES.has(r.status);
  // B6 says what it accepts; without it, deletions are never reviewed (v2 §5.11).
  const process = r.allowedActions ? r.allowedActions.includes('process') : true;
  const reject = r.allowedActions ? r.allowedActions.includes('reject') : r.kind !== 'deletion';
  return {
    canPrepare: open && process && r.kind === 'export',
    canRectify: open && process && r.kind === 'rectification',
    canReject: open && reject,
  };
}

export const DATA_REQUEST_KIND_LABEL: Readonly<Record<DataRequestKind, string>> = {
  export: 'Export',
  deletion: 'Deletion',
  rectification: 'Rectification',
};

export const DATA_SUBJECT_LABEL: Readonly<Record<DataSubjectKind, string>> = {
  patient: 'Patient account',
  hospital_staff: 'Hospital staff account',
  hospital: 'Hospital',
};

/** The next step a request is waiting on, in one line under its status. */
export function dataRequestNote(r: DataRequest): string {
  if (r.status === 'completed') return r.exportFileId ? 'File ready to download' : 'Closed';
  if (r.status === 'no_data') return 'No records held — nothing was written';
  if (r.status === 'rejected') return r.notes ?? 'Rejected';
  if (r.status === 'withdrawn') return 'Withdrawn by the account holder';
  if (r.status === 'cooling_off') {
    return r.coolingOffEndsAt
      ? `Deletes automatically on ${fmtComplianceDate(r.coolingOffEndsAt)} unless the patient signs in`
      : 'Deletes automatically when the cooling-off ends unless the patient signs in';
  }
  if (!OPEN_DATA_REQUEST_STATUSES.has(r.status)) return '';
  if (r.kind === 'rectification') return 'Correct the record, then mark it rectified';
  if (r.kind === 'deletion') return 'Handled by the account-deletion flow';
  return 'The nightly run prepares it if not now';
}

const PRINCIPAL_LABELS: Readonly<Record<string, string>> = {
  platform: 'Ops staff',
  hospital: 'Hospital staff',
  patient: 'Patient',
  display: 'Display device',
};

/**
 * Where a sign-in was made (12·F16): a hospital by name, the console for ops
 * staff, the patient app for patients. A failed hospital-staff attempt
 * carries no hospital until the backend records one (B6).
 */
export function loginInstanceLabel(
  event: Pick<LoginEvent, 'principal' | 'hospitalId' | 'hospitalName'>,
  nameOf: (hospitalId: string) => string | null,
): string {
  if (event.hospitalId)
    return event.hospitalName ?? nameOf(event.hospitalId) ?? 'Hospital instance';
  if (event.principal === 'platform') return 'Ops console';
  if (event.principal === 'patient') return 'Patient app';
  if (event.principal === 'display') return 'Display screen';
  return 'Hospital (not recorded)';
}

/** "Ops staff", "Hospital staff", … for a login principal or change scope. */
export function principalLabel(principal: string): string {
  return PRINCIPAL_LABELS[principal] ?? principal;
}

/** Known setting-key prefixes, as the backend writes them, with a readable area name. */
export const CONFIG_AREAS: readonly { readonly prefix: string; readonly label: string }[] = [
  { prefix: 'platform_settings.', label: 'Platform settings' },
  { prefix: 'feature_flags.', label: 'Feature flags' },
  { prefix: 'legal_documents.', label: 'Legal documents' },
  { prefix: 'platform_role_permissions.', label: 'Ops roles' },
  { prefix: 'plan.', label: 'Plans' },
  { prefix: 'subscription.', label: 'Subscriptions' },
  { prefix: 'commission_history', label: 'Commission' },
  { prefix: 'role_permissions.', label: 'Hospital roles' },
  { prefix: 'token_policies.', label: 'Token policy' },
  { prefix: 'hospital_settings.', label: 'Hospital settings' },
  { prefix: 'tax_rates.', label: 'Tax rates' },
  { prefix: 'hospital_banners.', label: 'Banners' },
  { prefix: 'message_templates.', label: 'Message templates' },
  { prefix: 'faq_entries.', label: 'FAQs' },
  { prefix: 'locations.', label: 'Locations' },
  { prefix: 'ambulance_providers.', label: 'Ambulance providers' },
  { prefix: 'onboarding_document_requirements.', label: 'Onboarding documents' },
];

/** The area a setting key belongs to, or its first segment when unmapped. */
export function configAreaOf(settingKey: string): string {
  const area = CONFIG_AREAS.find((a) => settingKey.startsWith(a.prefix));
  return area ? area.label : (settingKey.split('.')[0] ?? settingKey);
}

/** Before / after JSON as one readable line; unset reads as an em dash. */
export function fmtConfigValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

const BROWSERS: readonly (readonly [RegExp, string])[] = [
  [/Edg\//, 'Edge'],
  [/OPR\//, 'Opera'],
  [/Chrome\//, 'Chrome'],
  [/Firefox\//, 'Firefox'],
  [/Safari\//, 'Safari'],
];

const SYSTEMS: readonly (readonly [RegExp, string])[] = [
  [/Windows/, 'Windows'],
  [/iPhone|iPad/, 'iOS'],
  [/Android/, 'Android'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/Linux/, 'Linux'],
];

/** Characters of an unrecognised user agent shown before it is cut. */
const USER_AGENT_PREVIEW_CHARS = 40;

/** "Chrome · Windows" from a user agent; the raw string, shortened, when unrecognised. */
export function deviceLabel(userAgent: string | null): string {
  if (!userAgent) return '—';
  const browser = BROWSERS.find(([re]) => re.test(userAgent))?.[1];
  const system = SYSTEMS.find(([re]) => re.test(userAgent))?.[1];
  if (browser || system) return [browser, system].filter(Boolean).join(' · ');
  return userAgent.length > USER_AGENT_PREVIEW_CHARS
    ? `${userAgent.slice(0, USER_AGENT_PREVIEW_CHARS)}…`
    : userAgent;
}

/** Local 24-hour `HH:mm` of an ISO date-time. */
function localHm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "20 Jun 2026 · 14:05" in the viewer's local time. */
export function fmtComplianceWhen(iso: string): string {
  const d = new Date(iso);
  return `${fmtDate(toLocalISO(d))} · ${localHm(d)}`;
}

/** "20 Jun 2026" for an ISO date-time, in local time. */
export function fmtComplianceDate(iso: string): string {
  return fmtDate(toLocalISO(new Date(iso)));
}

/** The one-line toast after a capped CSV export. */
export function exportedMessage(count: number, noun: string, truncated: boolean): string {
  return truncated
    ? `Exported the newest ${count.toLocaleString('en-IN')} ${noun} as CSV — narrow the dates to export the rest.`
    : `Exported ${count.toLocaleString('en-IN')} ${noun} as CSV.`;
}

/* -------------------------------------------------- PHI read audit (B6, H-07) */

export const PHI_SUBJECT_LABEL: Readonly<Record<PhiSubjectKind, string>> = {
  hospital_patient: 'Patient records',
  appointment: 'Appointments',
  user: 'Patient accounts',
};

/** Logged routes (B6 `audit_reads` views) in plain words; the route's tail decides. */
const PHI_READS: readonly (readonly [RegExp, string])[] = [
  [/patients\/<[^>]+>\/appointments\/?$/, 'Viewed a patient’s appointments'],
  [/patients\/<[^>]+>\/?$/, 'Opened a patient record'],
  [/patients\/?$/, 'Listed patient records'],
  [/appointments\/<[^>]+>\/token-slip\/?$/, 'Opened a token slip'],
  [/appointments\/<[^>]+>\/?$/, 'Opened an appointment'],
  [/appointments\/?$/, 'Searched appointments'],
  [/visits\/<[^>]+>\/?$/, 'Opened a visit'],
  [/users\/<[^>]+>\/?$/, 'Opened a patient account'],
  [/users\/?$/, 'Listed patient accounts'],
];

/** What a logged read did, e.g. "Searched patient records"; the raw route when unknown. */
export function phiReadLabel(
  entry: Pick<PhiAccessEntry, 'endpoint' | 'method' | 'searchParam'>,
): string {
  const match = PHI_READS.find(([pattern]) => pattern.test(entry.endpoint));
  if (!match) return `${entry.method} ${entry.endpoint}`;
  const label = match[1];
  return entry.searchParam && label.startsWith('Listed')
    ? label.replace('Listed', 'Searched')
    : label;
}

/** "3 records" / "1 record" / "No records". */
export function phiResultLabel(count: number): string {
  if (count === 0) return 'No records';
  return `${count.toLocaleString('en-IN')} ${count === 1 ? 'record' : 'records'}`;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The id filters take a full UUID only (the server refuses anything else). */
export function isFullUuid(value: string): boolean {
  return UUID_PATTERN.test(value.trim());
}

/** "Anita Menon · Lakeshore Hospital · Admin · a***@lakeshore…" for the account picker. */
export function staffOptionLabel(entry: StaffDirectoryEntry): string {
  const parts = [
    entry.fullName,
    entry.hospitalName,
    entry.roleName,
    entry.email ?? entry.phone ?? entry.employeeCode,
  ].filter(Boolean);
  const label = parts.join(' · ');
  return entry.status === 'active' ? label : `${label} (${entry.status})`;
}
