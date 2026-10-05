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
 * Who acted. The log carries only `actor_user_id`, so the signed-in user's own
 * rows read "You" and everyone else shows a short id — naming them needs the
 * staff directory (H12), deferred to module Z.
 */
export function actorLabel(entry: AuditLogEntry, myUserId: string | null): AuditActorLabel {
  const kind = PRINCIPAL_LABELS[entry.principal] ?? entry.principal;
  if (entry.actorUserId === null) return { name: kind, sub: '—' };
  if (entry.actorUserId === myUserId) return { name: 'You', sub: kind };
  return { name: kind, sub: shortId(entry.actorUserId) };
}

/** Local calendar date + 24h time of an ISO date-time; `null` when unparsable. */
export function localStamp(iso: string): { date: string; time: string } | null {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  return { date: localDateIso(at), time: localTimeHm(at) };
}
