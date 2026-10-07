/** Display helpers for the ops dashboard. Pure functions, no React. */

import { fmtDate, moneyShort, toLocalISO } from '@/shared/lib/format';

import type { IconName } from '@/shared/ui/icon-registry';

import { opsHospitalDetailPath, opsOnboardingPath } from '@/app/router/paths';

import type {
  OpsAlertHospital,
  OpsDashboardAlert,
} from '@/features/ops-dashboard/domain/entities/opsDashboard.entities';

const PAISE_PER_RUPEE = 100;

/** Characters of a UUID shown when the backend sends no hospital name. */
const SHORT_ID_LENGTH = 8;

/** Integer paise → compact KPI figure ("₹ 3.7L"). */
export function rupeesShort(paise: number): string {
  return moneyShort(Math.round(paise / PAISE_PER_RUPEE));
}

/** ISO date-time → the viewer's local calendar date ("5 Oct 2026"). */
export function fmtDateTime(iso: string): string {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? '—' : fmtDate(toLocalISO(at));
}

/** "a1b2c3d4-…" → "a1b2c3d4…". */
export function shortId(id: string): string {
  return id.length > SHORT_ID_LENGTH ? `${id.slice(0, SHORT_ID_LENGTH)}…` : id;
}

/** Ops profile of a registry hospital by its UUID. */
export function hospitalHref(id: string): string {
  return opsHospitalDetailPath(id);
}

/** `1` → "1 hospital", `2` → "2 hospitals". */
export function plural(n: number, noun: string): string {
  return `${n.toLocaleString('en-IN')} ${noun}${n === 1 ? '' : 's'}`;
}

/** Label + shared badge palette key for an onboarding stage. */
const STAGE_VIEW: Readonly<Record<string, readonly [string, string]>> = {
  application: ['Application', 'Submitted'],
  documents_pending: ['Documents pending', 'Pending'],
  review: ['In review', 'Pending verification'],
  approved: ['Approved', 'Verified'],
  live: ['Live', 'Live'],
  rejected: ['Rejected', 'Rejected'],
};

export function stageView(stage: string): { label: string; badge: string } {
  const view = STAGE_VIEW[stage];
  return view ? { label: view[0], badge: view[1] } : { label: stage, badge: stage };
}

export type AlertSeverity = 'danger' | 'warning';

/** Severity tint: [icon-box bg, icon-box fg, glyph] (design `sevTint`). */
export const ALERT_SEV_TINT: Record<AlertSeverity, readonly [string, string, IconName]> = {
  danger: ['bg-d-100', 'text-d-600', 'circle-x'],
  warning: ['bg-y-100', 'text-y-800', 'triangle-alert'],
};

/** Hospitals an alert links to directly before the rest collapse into "+N more". */
export const MAX_ALERT_HOSPITAL_LINKS = 3;

export interface AlertView {
  readonly key: string;
  readonly sev: AlertSeverity;
  readonly title: string;
  readonly sub: string;
  /** Hospitals to open, one button each. */
  readonly hospitals: readonly OpsAlertHospital[];
  /** A single screen to open instead. */
  readonly action?: { readonly label: string; readonly to: string };
}

function namesOf(hospitals: readonly OpsAlertHospital[]): string {
  const named = hospitals.map((h) => h.name ?? shortId(h.id));
  const shown = named.slice(0, MAX_ALERT_HOSPITAL_LINKS).join(', ');
  const rest = named.length - MAX_ALERT_HOSPITAL_LINKS;
  return rest > 0 ? `${shown} +${rest} more` : shown;
}

/** What each computed alert says and where it leads. */
export function toAlertView(alert: OpsDashboardAlert): AlertView {
  switch (alert.code) {
    case 'hospitals_in_grace':
      return {
        key: alert.code,
        sev: 'warning',
        title: `${plural(alert.count, 'hospital')} past due or in grace`,
        sub: namesOf(alert.hospitals),
        hospitals: alert.hospitals,
      };
    case 'hospitals_read_only':
      return {
        key: alert.code,
        sev: 'danger',
        title: `${plural(alert.count, 'hospital')} in read-only mode`,
        sub: `Unpaid subscription · ${namesOf(alert.hospitals)}`,
        hospitals: alert.hospitals,
      };
    case 'unreconciled_cash_sessions':
      return {
        key: alert.code,
        sev: 'warning',
        title: `${plural(alert.count, 'cash session')} unreconciled for over a day`,
        sub: `Across ${plural(alert.hospitals.length, 'hospital')}`,
        hospitals: alert.hospitals,
      };
    case 'dead_outbox_rows':
      return {
        key: alert.code,
        sev: 'danger',
        title: `${plural(alert.count, 'notification')} failed permanently`,
        sub: 'Messages the outbox stopped retrying. Check the messaging provider configuration.',
        hospitals: [],
      };
    case 'pending_onboarding':
      return {
        key: alert.code,
        sev: 'warning',
        title: `${plural(alert.count, 'onboarding case')} in progress`,
        sub:
          alert.olderThan7Days > 0
            ? `${plural(alert.olderThan7Days, 'case')} open for more than 7 days`
            : 'All opened within the last 7 days',
        hospitals: [],
        action: { label: 'Open onboarding', to: opsOnboardingPath() },
      };
    case 'unknown':
      return {
        key: alert.rawCode,
        sev: 'warning',
        title: `${alert.rawCode.replaceAll('_', ' ')} (${alert.count})`,
        sub: 'Reported by the platform',
        hospitals: [],
      };
  }
}
