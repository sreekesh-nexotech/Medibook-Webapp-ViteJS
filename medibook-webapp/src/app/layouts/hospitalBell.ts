import { money } from '@/shared/lib/format';
import type { IconName } from '@/shared/ui/icon-registry';

import type { DashboardAlerts } from '@/features/dashboard/domain/entities/dashboard.types';
import type { HospitalAlertFeed } from '@/features/notifications/domain/entities/notifications.types';
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

/** How each server bell item looks and where it leads (DASH-03 keys). */
const ALERT_PRESENTATION: Readonly<
  Record<string, { icon: IconName; boxClass: string; sub: string; go: HospitalNavView }>
> = {
  pending_approvals: {
    icon: 'calendar-check',
    boxClass: 'bg-blue-soft-bg text-blue',
    sub: 'Online requests the hospital has to confirm',
    go: 'appointments',
  },
  pending_patient_changes: {
    icon: 'users',
    boxClass: 'bg-p-100 text-p-500',
    sub: 'Profile edits patients asked for',
    go: 'patients',
  },
  unpaid_walk_ins_today: {
    icon: 'indian-rupee',
    boxClass: 'bg-d-100 text-d-500',
    sub: 'Collect at the desk to issue tokens',
    go: 'appointments',
  },
  cash_sessions_to_reconcile: {
    icon: 'scale',
    boxClass: 'bg-y-100 text-y-600',
    sub: 'Closed desk drawers awaiting a check',
    go: 'payments',
  },
  settlements_on_hold: {
    icon: 'triangle-alert',
    boxClass: 'bg-y-100 text-y-600',
    sub: 'Held by Medibook',
    go: 'settlements',
  },
  settlements_awaiting_payout: {
    icon: 'circle-check',
    boxClass: 'bg-g-100 text-g-600',
    sub: 'Expected from Medibook',
    go: 'settlements',
  },
};

/** A bell item a newer backend added: shown by its own label, leading home. */
const UNKNOWN_ALERT = {
  icon: 'bell' as IconName,
  boxClass: 'bg-grey-300 text-grey-900',
  sub: '',
  go: 'dashboard' as HospitalNavView,
};

/** One row of the bell, whichever source built it. */
export interface HospitalBellEntry {
  /** Server item key (DASH-03), or the row's text in the browser-built bell. */
  readonly key: string;
  readonly icon: IconName;
  readonly boxClass: string;
  readonly title: string;
  readonly sub: string;
  readonly go: HospitalNavView;
  /** Read state the server keeps; `null` when the browser keeps it. */
  readonly serverRead: boolean | null;
  /** Newest row of a server item (a newer one makes a local "read" stale). */
  readonly latestAt: string | null;
}

/** The server's bell (DASH-03): it already holds only what the role can act on. */
export function serverBellEntries(feed: HospitalAlertFeed): HospitalBellEntry[] {
  return feed.items.map((item) => {
    const look = ALERT_PRESENTATION[item.key] ?? UNKNOWN_ALERT;
    const amount = item.amountPaise === null ? null : money(item.amountPaise / PAISE_PER_RUPEE);
    return {
      key: item.key,
      icon: look.icon,
      boxClass: look.boxClass,
      title: `${item.label} (${item.count})`,
      sub: amount === null ? look.sub : `${amount} · ${look.sub.toLowerCase()}`,
      go: look.go,
      serverRead: item.read,
      latestAt: item.latestAt,
    };
  });
}

/** The browser-built bell (backend without DASH-03), read state kept locally. */
export function localBellEntries(notifs: readonly HospitalNotif[]): HospitalBellEntry[] {
  return notifs.map((n) => ({
    key: n.t,
    icon: n.icon,
    boxClass: n.boxClass,
    title: n.t,
    sub: n.s,
    go: n.go,
    serverRead: null,
    latestAt: null,
  }));
}

/**
 * The key a locally kept "read" is stored under: the row text in the
 * browser-built bell (it carries the count), the item key plus its newest
 * row for a server item the server could not mark (a read-only hospital
 * refuses the write) — so a newer arrival is unread again.
 */
export function localReadKey(entry: HospitalBellEntry): string {
  return entry.serverRead === null ? entry.key : `${entry.key}@${entry.latestAt ?? ''}`;
}

/** Unread unless the server or this browser has it marked read. */
export function isBellEntryUnread(entry: HospitalBellEntry, seen: ReadonlySet<string>): boolean {
  return entry.serverRead !== true && !seen.has(localReadKey(entry));
}
