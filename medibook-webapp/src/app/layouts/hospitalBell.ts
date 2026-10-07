import { money } from '@/shared/lib/format';
import type { IconName } from '@/shared/ui/icon-registry';

import type { DashboardAlerts } from '@/features/dashboard/domain/entities/dashboard.types';
import type {
  SettlementPeriod,
  SettlementPeriodFilters,
} from '@/features/settlements/domain/entities/settlements.entities';

import type { HospitalNavView } from './hospital-nav';

/** One hospital bell item and the screen it leads to. */
export interface HospitalNotif {
  readonly icon: IconName;
  /** Icon-box tint (the design's per-item `c`/`bg` pair as token classes). */
  readonly boxClass: string;
  readonly t: string;
  readonly s: string;
  readonly go: HospitalNavView;
}

/** The latest settlement periods, unfiltered by date. */
export const LATEST_PERIODS: SettlementPeriodFilters = {};

const PAISE_PER_RUPEE = 100;

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function netRupees(periods: readonly SettlementPeriod[]): number {
  return periods.reduce((sum, p) => sum + p.netPayablePaise, 0) / PAISE_PER_RUPEE;
}

/** Which bell sources the signed-in role may read and act on. */
export interface HospitalBellAccess {
  /** Admins review patient change requests and reconcile closed drawers. */
  readonly isAdmin: boolean;
  /** `Billing & Settlements.view`: settlement alerts (accountants too, UAT-68). */
  readonly canSeeSettlements: boolean;
}

/**
 * The bell's items, all from live data: desk work for every role, patient
 * changes and cash drawers for admins, and settlements for every role that
 * may open Settlements. Anything that needs action starts unread; an empty
 * list shows the bell's empty state.
 */
export function buildHospitalNotifs(
  access: HospitalBellAccess,
  alerts: DashboardAlerts | undefined,
  periods: readonly SettlementPeriod[],
): HospitalNotif[] {
  const out: HospitalNotif[] = [];
  if (alerts && alerts.unpaidWalkInsToday > 0) {
    out.push({
      icon: 'indian-rupee',
      boxClass: 'bg-d-100 text-d-500',
      t: `${plural(alerts.unpaidWalkInsToday, 'walk-in payment')} pending`,
      s: 'Collect at the desk to issue tokens',
      go: 'appointments',
    });
  }
  if (alerts && alerts.pendingApprovals > 0) {
    out.push({
      icon: 'calendar-check',
      boxClass: 'bg-blue-soft-bg text-blue',
      t: `${plural(alerts.pendingApprovals, 'booking')} awaiting approval`,
      s: 'Online requests the hospital has to confirm',
      go: 'appointments',
    });
  }
  if (access.isAdmin && alerts && alerts.pendingPatientChanges > 0) {
    out.push({
      icon: 'users',
      boxClass: 'bg-p-100 text-p-500',
      t: `${plural(alerts.pendingPatientChanges, 'patient change')} to review`,
      s: 'Profile edits patients asked for',
      go: 'patients',
    });
  }
  if (access.isAdmin && alerts && alerts.cashSessionsToReconcile > 0) {
    out.push({
      icon: 'scale',
      boxClass: 'bg-y-100 text-y-600',
      t: `${plural(alerts.cashSessionsToReconcile, 'cash session')} to reconcile`,
      s: 'Closed desk drawers awaiting a check',
      go: 'payments',
    });
  }
  if (!access.canSeeSettlements) return out;
  const onHold = periods.filter((p) => p.status === 'on_hold');
  if (onHold.length) {
    out.push({
      icon: 'triangle-alert',
      boxClass: 'bg-y-100 text-y-600',
      t: `${plural(onHold.length, 'settlement')} on hold`,
      s: `${money(netRupees(onHold))} held by Medibook`,
      go: 'settlements',
    });
  }
  const awaiting = periods.filter((p) => p.status === 'closed');
  if (awaiting.length) {
    out.push({
      icon: 'circle-check',
      boxClass: 'bg-g-100 text-g-600',
      t: `${plural(awaiting.length, 'settlement')} awaiting payout`,
      s: `${money(netRupees(awaiting))} expected from Medibook`,
      go: 'settlements',
    });
  }
  return out;
}
