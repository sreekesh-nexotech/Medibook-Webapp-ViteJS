import { useState } from 'react';

import { usePermission } from '@/shared/hooks/usePermission';
import { cn } from '@/shared/lib/cn';
import { money } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { Avatar } from '@/shared/ui/Avatar';
import { Icon } from '@/shared/ui/Icon';
import type { IconName } from '@/shared/ui/icon-registry';

import type { HospitalRole } from '@/app/router/paths';

import { useAdminDashboardQuery } from '@/features/dashboard/application/queries/useAdminDashboardQuery';
import { useDashboardAlertsLive } from '@/features/dashboard/application/queries/useDashboardAlertsLive';
import { useReceptionDashboardQuery } from '@/features/dashboard/application/queries/useReceptionDashboardQuery';
import type {
  DashboardAlerts,
  ReceptionDashboard,
} from '@/features/dashboard/domain/entities/dashboard.types';
import { useSettlementPeriodsQuery } from '@/features/settlements/application/queries/useSettlementPeriodsQuery';
import type {
  SettlementPeriod,
  SettlementPeriodFilters,
} from '@/features/settlements/domain/entities/settlements.entities';

import type { HospitalNavView } from './hospital-nav';
import { TopbarMenuItem, TopbarPopover } from './TopbarPopover';

interface HospitalNotif {
  readonly icon: IconName;
  /** Icon-box tint (the design's per-item `c`/`bg` pair as token classes). */
  readonly boxClass: string;
  readonly t: string;
  readonly s: string;
  readonly go: HospitalNavView;
  readonly unread?: boolean;
}

/** The latest settlement periods, unfiltered by date. */
const LATEST_PERIODS: SettlementPeriodFilters = {};

const PAISE_PER_RUPEE = 100;

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** The two desk counts the bell shows non-admin roles, from the front-desk dashboard. */
function deskAlerts(reception: ReceptionDashboard | undefined): DashboardAlerts | undefined {
  if (!reception) return undefined;
  return {
    pendingApprovals: reception.pendingApprovals.count,
    unpaidWalkInsToday: reception.unpaidWalkIns.count,
    pendingPatientChanges: 0,
    cashSessionsToReconcile: 0,
  };
}

function netRupees(periods: readonly SettlementPeriod[]): number {
  return periods.reduce((sum, p) => sum + p.netPayablePaise, 0) / PAISE_PER_RUPEE;
}

/**
 * The bell's items, all from live data: desk work for every role, plus
 * patient changes, cash drawers and settlements for admins. Anything that
 * needs action is highlighted until the work is done — there is no "mark all
 * read", because reading an item does not do the work (PRD-04). An empty list
 * shows the bell's empty state.
 */
function buildNotifs(
  isAdmin: boolean,
  alerts: DashboardAlerts | undefined,
  periods: readonly SettlementPeriod[],
): HospitalNotif[] {
  const out: HospitalNotif[] = [];
  if (alerts && alerts.unpaidWalkInsToday > 0) {
    out.push({
      icon: 'indian-rupee',
      boxClass: 'bg-d-100 text-d-600',
      t: `${plural(alerts.unpaidWalkInsToday, 'walk-in payment')} pending`,
      s: 'Collect at the desk to issue tokens',
      go: 'appointments',
      unread: true,
    });
  }
  if (alerts && alerts.pendingApprovals > 0) {
    out.push({
      icon: 'calendar-check',
      boxClass: 'bg-blue-soft-bg text-blue',
      t: `${plural(alerts.pendingApprovals, 'booking')} awaiting approval`,
      s: 'Online requests the hospital has to confirm',
      go: 'appointments',
      unread: true,
    });
  }
  if (!isAdmin) return out;
  if (alerts && alerts.pendingPatientChanges > 0) {
    out.push({
      icon: 'users',
      boxClass: 'bg-p-100 text-p-500',
      t: `${plural(alerts.pendingPatientChanges, 'patient change')} to review`,
      s: 'Profile edits patients asked for',
      go: 'patients',
      unread: true,
    });
  }
  if (alerts && alerts.cashSessionsToReconcile > 0) {
    out.push({
      icon: 'scale',
      boxClass: 'bg-y-100 text-y-800',
      t: `${plural(alerts.cashSessionsToReconcile, 'cash session')} to reconcile`,
      s: 'Closed desk drawers awaiting a check',
      go: 'payments',
    });
  }
  const onHold = periods.filter((p) => p.status === 'on_hold');
  if (onHold.length) {
    out.push({
      icon: 'triangle-alert',
      boxClass: 'bg-y-100 text-y-800',
      t: `${plural(onHold.length, 'settlement')} on hold`,
      s: `${money(netRupees(onHold))} held by Medibook`,
      go: 'settlements',
      unread: true,
    });
  }
  const awaiting = periods.filter((p) => p.status === 'closed');
  if (awaiting.length) {
    out.push({
      icon: 'circle-check',
      boxClass: 'bg-g-100 text-g-800',
      t: `${plural(awaiting.length, 'settlement')} awaiting payout`,
      s: `${money(netRupees(awaiting))} expected from Medibook`,
      go: 'settlements',
    });
  }
  return out;
}

interface HospitalTopbarProps {
  title: string;
  subtitle: string | null;
  onBack: (() => void) | null;
  /** URL role — selects the shell's notification set. */
  role: HospitalRole;
  /** Signed-in user's display name and role (from `/hospital/me`). */
  userName: string;
  roleName: string;
  onAccount: () => void;
  onLogout: () => void;
  onNavigate: (view: HospitalNavView) => void;
  /**
   * Opens the off-canvas sidebar. Rendered as a hamburger below `lg` only, so
   * the desktop topbar is unchanged (audit 3.4.1).
   */
  onMenu?: () => void;
}

/**
 * Hospital shell topbar with notification bell + account menu (design
 * `Topbar`). The design's role switcher is gone: a real user has exactly one
 * role, so the menu shows who is signed in, My Account and Log Out.
 */
export function HospitalTopbar({
  title,
  subtitle,
  onBack,
  role,
  userName,
  roleName,
  onAccount,
  onLogout,
  onNavigate,
  onMenu,
}: HospitalTopbarProps) {
  const [menu, setMenu] = useState(false);
  const [notif, setNotif] = useState(false);
  const isAdmin = role === 'admin';
  // Live counts, refreshed on every booking push (H10): admins read the admin
  // dashboard and the latest settlement periods (H11); other roles read only
  // the front-desk dashboard, so a receptionist never loads the hospital's
  // figures; a role without the dashboard permission polls nothing (PERF-04).
  const { can } = usePermission();
  const mayReadDashboard = can('Dashboard.view');
  useDashboardAlertsLive();
  const adminQuery = useAdminDashboardQuery('today', isAdmin && mayReadDashboard);
  const receptionQuery = useReceptionDashboardQuery(!isAdmin && mayReadDashboard);
  const alertsQuery = isAdmin ? adminQuery : receptionQuery;
  const periodsQuery = useSettlementPeriodsQuery(LATEST_PERIODS, isAdmin);
  const alerts = isAdmin ? adminQuery.data?.alerts : deskAlerts(receptionQuery.data);
  const periods = periodsQuery.data?.items ?? [];
  const notifs = buildNotifs(isAdmin, alerts, periods);
  // A source that never loaded must not read as "all caught up" (RUN-05).
  const notifsFailed = alertsQuery.isLoadingError || (isAdmin && periodsQuery.isLoadingError);
  const retryNotifs = (): void => {
    void alertsQuery.refetch();
    if (isAdmin) void periodsQuery.refetch();
  };
  const unread = notifs.filter((n) => n.unread).length;
  return (
    <header className="min-h-topbar border-border relative z-20 flex flex-none flex-wrap items-center justify-between gap-y-2 border-b bg-white px-4 py-2 lg:px-7 lg:py-0">
      <div className="flex min-w-0 items-center gap-3.5">
        {onMenu && (
          <button
            type="button"
            onClick={onMenu}
            aria-label="Open navigation"
            title="Open navigation"
            className="text-text-strong flex cursor-pointer lg:hidden"
          >
            <Icon name="layout-grid" size={24} />
          </button>
        )}
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            title="Back"
            className="text-text-strong flex cursor-pointer"
          >
            <Icon name="arrow-left" size={24} />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="text-h1 text-text-strong m-0 truncate">{title}</h1>
          {subtitle && (
            <div className="text-caption text-text-muted mt-0.25 truncate">{subtitle}</div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          aria-label={unread > 0 ? `Notifications, ${unread} need action` : 'Notifications'}
          aria-expanded={notif}
          aria-haspopup="dialog"
          onClick={() => {
            setNotif((n) => !n);
            setMenu(false);
          }}
          className={cn(
            'relative flex cursor-pointer',
            notif ? 'text-text-navy' : 'text-text-muted',
          )}
        >
          <Icon name="bell" size={21} />
          {unread > 0 && (
            <span className="bg-d-600 absolute -top-1.25 -right-1.5 flex h-3.75 min-w-3.75 items-center justify-center rounded-full border-[1.5px] border-white px-1 text-[10px] font-semibold text-white">
              {unread}
            </span>
          )}
        </button>
        <TopbarPopover
          open={notif}
          onClose={() => setNotif(false)}
          label="Notifications"
          className="w-83 lg:right-18.5"
        >
          <div className="border-border-soft flex items-center justify-between border-b px-4 py-3.5">
            <span className="text-text-strong text-[15px] font-semibold">Notifications</span>
          </div>
          <div className="max-h-90 overflow-y-auto">
            {notifs.length === 0 && notifsFailed ? (
              <div className="text-body text-text-muted flex flex-col items-center gap-2 py-7 text-center">
                {"Notifications couldn't load."}
                <Button size="sm" variant="secondary" onClick={retryNotifs}>
                  Retry
                </Button>
              </div>
            ) : notifs.length === 0 ? (
              <div className="text-text-muted text-body py-7 text-center">
                {"You're all caught up."}
              </div>
            ) : (
              notifs.map((n, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => {
                    onNavigate(n.go);
                    setNotif(false);
                  }}
                  className={cn(
                    'hover:bg-grey-200 flex w-full cursor-pointer items-start gap-3 px-4 py-3.25 text-left transition-colors duration-150',
                    i < notifs.length - 1 && 'border-border-soft border-b',
                    n.unread ? 'bg-bg-app' : 'bg-white',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-8.5 flex-none items-center justify-center rounded-md',
                      n.boxClass,
                    )}
                  >
                    <Icon name={n.icon} size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-body text-text-strong block font-medium">{n.t}</span>
                    <span className="text-caption text-text-muted block">{n.s}</span>
                  </span>
                  {n.unread && (
                    <>
                      <span className="bg-blue mt-1.5 size-1.75 flex-none rounded-full" />
                      <span className="sr-only">Needs action</span>
                    </>
                  )}
                </button>
              ))
            )}
          </div>
        </TopbarPopover>
        <div className="bg-border h-7 w-px" />
        <button
          type="button"
          onClick={() => setMenu((m) => !m)}
          aria-expanded={menu}
          aria-haspopup="dialog"
          className="flex cursor-pointer items-center gap-2.5"
        >
          <span aria-hidden="true">
            <Avatar name={userName} size={38} />
          </span>
          {/* The name stays readable to screen readers on narrow screens too. */}
          <span className="sr-only flex-col items-start sm:not-sr-only sm:flex">
            <span className="text-body text-text-strong font-medium">{userName}</span>
            <span className="text-caption text-text-muted">{roleName}</span>
          </span>
          <Icon name="chevron-down" size={16} className="text-text-muted" />
        </button>
        <TopbarPopover
          open={menu}
          onClose={() => setMenu(false)}
          label="Account"
          className="w-58 p-2 lg:right-7"
        >
          <div className="flex items-center gap-2.5 px-2.5 py-2.25">
            <Avatar name={userName} size={32} />
            <div className="min-w-0">
              <div className="text-body text-text-strong font-medium">{userName}</div>
              <div className="text-caption text-text-muted">{roleName}</div>
            </div>
          </div>
          <div className="bg-border-soft mx-1 my-1.5 h-px" />
          <TopbarMenuItem
            icon={<Icon name="user" size={18} />}
            onClick={() => {
              setMenu(false);
              onAccount();
            }}
          >
            My Account
          </TopbarMenuItem>
          <TopbarMenuItem
            danger
            icon={<Icon name="log-out" size={18} />}
            onClick={() => {
              setMenu(false);
              onLogout();
            }}
          >
            Log Out
          </TopbarMenuItem>
        </TopbarPopover>
      </div>
    </header>
  );
}
