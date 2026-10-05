/**
 * Display helpers for the live compliance records: result / status labels
 * with the shared badge token that already carries their meaning, a short
 * device line from a user agent, and before / after values as text.
 */
import { fmtDate, toLocalISO } from '@/shared/lib/format';

import type {
  DataRequestStatus,
  LoginResult,
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

/** Requests still open to processing or rejection (backend `OPEN_STATES`). */
export const OPEN_DATA_REQUEST_STATUSES: ReadonlySet<DataRequestStatus> = new Set([
  'requested',
  'cooling_off',
  'verifying',
  'processing',
]);

const PRINCIPAL_LABELS: Readonly<Record<string, string>> = {
  platform: 'Ops staff',
  hospital: 'Hospital staff',
  patient: 'Patient',
  display: 'Display device',
};

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
