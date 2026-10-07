/** Display helpers for the audit trail screen. Pure functions, no React. */

import type { OpsTint } from '@/shared/ui/OpsConfirm';

import { localDateIso, localTimeHm } from '@/features/audit/application/store/audit.clock';
import type { AuditLogEntry } from '@/features/audit/domain/entities/audit.log';

/**
 * The generic actions the backend writes for every successful mutation
 * (`core/api.py` `_audit_mutation`), with the label the Action filter shows.
 * Domain actions (`doctor.created`, …) have no fixed list, so they are found
 * through the exact-match search instead.
 */
export const AUDIT_ACTION_OPTIONS = [
  { code: 'http.post', label: 'Create' },
  { code: 'http.patch', label: 'Update' },
  { code: 'http.put', label: 'Replace' },
  { code: 'http.delete', label: 'Delete' },
] as const;

export type AuditActionLabel = (typeof AUDIT_ACTION_OPTIONS)[number]['label'];

/** Filter label → action code. */
export function actionCodeFor(label: string): string | undefined {
  return AUDIT_ACTION_OPTIONS.find((o) => o.label === label)?.code;
}

/** `http.patch` → "Update"; a domain action stays as the backend wrote it. */
export function actionLabel(action: string): string {
  return AUDIT_ACTION_OPTIONS.find((o) => o.code === action)?.label ?? action;
}

/** Glyph tint by HTTP method: removals stand out, edits warn, the rest is neutral. */
export function methodTint(method: string): OpsTint {
  if (method === 'DELETE') return 'danger';
  if (method === 'PATCH' || method === 'PUT') return 'warning';
  return 'info';
}

const PRINCIPAL_LABELS: Readonly<Record<string, string>> = {
  hospital: 'Hospital staff',
  platform: 'Medibook Operations',
  patient: 'Patient',
  display: 'Display device',
  system: 'System',
};

/** Characters of a UUID shown when the actor cannot be named. */
const SHORT_ID_LENGTH = 8;

/** "a1b2c3d4-…" → "a1b2c3d4…". */
export function shortId(id: string): string {
  return id.length > SHORT_ID_LENGTH ? `${id.slice(0, SHORT_ID_LENGTH)}…` : id;
}

export interface AuditActorLabel {
  readonly name: string;
  readonly sub: string;
}

/**
 * Who acted. The log carries only `actor_user_id`: the signed-in user's own
 * rows read "You", staff are named from the staff directory (`names`, user id
 * → name), and anyone else (a patient, a removed account) shows a short id.
 */
export function actorLabel(
  entry: AuditLogEntry,
  myUserId: string | null,
  names: ReadonlyMap<string, string>,
): AuditActorLabel {
  const kind = PRINCIPAL_LABELS[entry.principal] ?? entry.principal;
  if (entry.actorUserId === null) return { name: kind, sub: '—' };
  if (entry.actorUserId === myUserId) return { name: 'You', sub: kind };
  const name = names.get(entry.actorUserId);
  if (name) return { name, sub: kind };
  return { name: kind, sub: shortId(entry.actorUserId) };
}

/** Local calendar date + 24h time of an ISO date-time; `null` when unparsable. */
export function localStamp(iso: string): { date: string; time: string } | null {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  return { date: localDateIso(at), time: localTimeHm(at) };
}

/**
 * The entities the Entity filter offers: the hospital-side resource types the
 * backend's domain audit rows use (`audit/services/record.py` callers, B6's
 * patient master rows included). Generic `http.*` rows name a view class
 * instead; those are found through the exact search.
 */
export const AUDIT_ENTITY_OPTIONS = [
  { code: 'hospital_patient', label: 'Patient record' },
  { code: 'patient_change_request', label: 'Patient change request' },
  { code: 'hospital_staff', label: 'Staff member' },
  { code: 'hospital_role', label: 'Role' },
  { code: 'doctor', label: 'Doctor' },
  { code: 'department', label: 'Department' },
  { code: 'doctor_leave', label: 'Doctor leave' },
  { code: 'doctor_date_exception', label: 'Doctor date exception' },
  { code: 'service', label: 'Service' },
  { code: 'doctor_service', label: 'Doctor service' },
  { code: 'tax_rate', label: 'Tax rate' },
  { code: 'coupon', label: 'Coupon' },
  { code: 'holiday', label: 'Holiday' },
  { code: 'slot', label: 'Slot' },
  { code: 'hospital_counter', label: 'Counter' },
  { code: 'hospital_banner', label: 'Banner' },
  { code: 'hospital_bank_account', label: 'Bank account' },
  { code: 'display_device', label: 'Display device' },
  { code: 'print_template', label: 'Print template' },
  { code: 'plan_change_request', label: 'Plan change request' },
] as const;

/** Entity filter label → resource type. */
export function entityCodeFor(label: string): string | undefined {
  return AUDIT_ENTITY_OPTIONS.find((o) => o.label === label)?.code;
}

const VIEW_CLASS_SUFFIX = /View$/;
const HOSPITAL_PREFIX = /^Hospital(?=[A-Z])/;
const CAMEL_BOUNDARY = /([a-z0-9])([A-Z])/g;

/**
 * A readable entity name (appendix 05 F19): a known resource type gets its
 * label; a generic row's DRF view class (`HospitalAppointmentRefundsView`)
 * reads as words ("Appointment refunds"); anything else as written.
 */
export function entityLabel(resourceType: string): string {
  const known = AUDIT_ENTITY_OPTIONS.find((o) => o.code === resourceType);
  if (known) return known.label;
  if (VIEW_CLASS_SUFFIX.test(resourceType)) {
    const words = resourceType
      .replace(VIEW_CLASS_SUFFIX, '')
      .replace(HOSPITAL_PREFIX, '')
      .replace(CAMEL_BOUNDARY, '$1 $2')
      .toLowerCase();
    return words.charAt(0).toUpperCase() + words.slice(1);
  }
  return resourceType.replace(/_/g, ' ');
}
