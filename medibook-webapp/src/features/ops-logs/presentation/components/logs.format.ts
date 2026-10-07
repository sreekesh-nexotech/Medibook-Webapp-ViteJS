import type {
  AuditLogEntry,
  AuditPrincipal,
  LogSeverity,
} from '@/features/ops-logs/domain/entities/logs.types';

/** Leading characters of a UUID shown when no name is available. */
const ID_PREVIEW = 8;

/** Audit timestamps read in IST, the console's timezone (backend `audit_log_spec`). */
const LOG_TIME_ZONE = 'Asia/Kolkata';

/** Indent of the JSON shown in the entry drawer. */
const JSON_INDENT = 2;

/**
 * How long the backend keeps the trail (`audit/services/retention.py`:
 * audit_log 3 years, archived to cold storage after, nothing deleted — Q122).
 */
export const LOG_RETENTION_TEXT = 'Kept 3 years, then archived — never deleted';

/**
 * What the search box really matches (`audit_log_filters._q`): the backend has
 * no fuzzy index on the trail, so `q` is an exact match.
 */
export const LOG_SEARCH_HINT =
  'Exact match: a full action code (user.blocked), resource type, request id, or a user/record UUID.';

const logDateFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: LOG_TIME_ZONE,
  month: 'long',
  day: '2-digit',
  year: 'numeric',
});

const logClockFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: LOG_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
});

const logSecondsFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: LOG_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** `June 13, 2026 · 09:42` — the trail's timestamp style. */
export function formatLogTime(iso: string): string {
  const at = new Date(iso);
  return `${logDateFormat.format(at)} · ${logClockFormat.format(at)}`;
}

/** `June 13, 2026 · 09:42:07 IST` — the drawer's exact time. */
export function formatLogTimeExact(iso: string): string {
  const at = new Date(iso);
  return `${logDateFormat.format(at)} · ${logSecondsFormat.format(at)} IST`;
}

/** `"a1b2c3d4-…"` → `"a1b2c3d4…"`. */
export function shortId(id: string): string {
  return id.length > ID_PREVIEW ? `${id.slice(0, ID_PREVIEW)}…` : id;
}

export const PRINCIPAL_LABEL: Readonly<Record<AuditPrincipal, string>> = {
  platform: 'Ops staff',
  hospital: 'Hospital staff',
  patient: 'Patient',
  display: 'Display screen',
  system: 'System',
};

/** A principal code as people read it; unknown codes pass through. */
export function principalLabel(principal: string): string {
  return PRINCIPAL_LABEL[principal as AuditPrincipal] ?? principal;
}

/** Who acted: the name (or email) the backend sends, else the principal plus a short user id. */
export function actorLabel(entry: AuditLogEntry): string {
  const who = entry.actorName ?? entry.actorEmail;
  if (who) return `${principalLabel(entry.principal)} · ${who}`;
  return entry.actorUserId
    ? `${principalLabel(entry.principal)} · ${shortId(entry.actorUserId)}`
    : principalLabel(entry.principal);
}

export const SEVERITY_LABEL: Readonly<Record<LogSeverity, string>> = {
  info: 'Info',
  warning: 'Warning',
  critical: 'Critical',
};

/**
 * Permission modules an entry can belong to (backend `core/seeds` platform
 * and hospital modules, plus `auth`), code → label, in the filter's order.
 */
export const LOG_MODULE_LABEL: Readonly<Record<string, string>> = {
  auth: 'Sign-in & accounts',
  hospitals: 'Hospitals',
  onboarding: 'Onboarding',
  plans: 'Subscription plans',
  billing: 'Billing',
  settlements: 'Settlements',
  reports: 'Reports',
  analytics: 'Analytics',
  compliance: 'Compliance',
  platform_users: 'Platform users',
  staff: 'Users & roles (ops)',
  notifications: 'Notifications',
  settings: 'Platform settings',
  support: 'Support',
  appointments: 'Appointments',
  patients: 'Patients',
  token_management: 'Token management',
  payments: 'Payments',
  cash_desk: 'Cash desk',
  doctors_departments: 'Doctors & departments',
  users_roles: 'Users & roles (hospital)',
  hospital_settings: 'Hospital settings',
  billing_settlements: 'Billing & settlements (hospital)',
};

/** A module code as people read it; unknown codes are humanised. */
export function moduleLabel(module: string | null): string {
  if (!module) return '—';
  return LOG_MODULE_LABEL[module] ?? module.replaceAll('_', ' ');
}

/** Free-form JSON for the drawer: `null` when there is nothing to show. */
export function jsonText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object' && Object.keys(value).length === 0) return null;
  return JSON.stringify(value, null, JSON_INDENT);
}

/** Every principal is the same as none: the filter is only sent when it narrows. */
export function narrowingPrincipals(
  selected: readonly AuditPrincipal[],
  all: readonly AuditPrincipal[],
): readonly AuditPrincipal[] {
  return selected.length === all.length ? [] : selected;
}

/** RFC-4122 UUID (any version) — the actor filter takes a user id. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value.trim());
}

/** File name for a server export of the trail on a given day. */
export function logsExportFileName(today: string): string {
  return `medibook-compliance-logs-${today}.csv`;
}
