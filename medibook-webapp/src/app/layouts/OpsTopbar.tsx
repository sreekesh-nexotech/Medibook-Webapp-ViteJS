import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { cn } from '@/shared/lib/cn';
import { money } from '@/shared/lib/format';
import { Avatar } from '@/shared/ui/Avatar';
import { Icon } from '@/shared/ui/Icon';
import type { IconName } from '@/shared/ui/icon-registry';

import { opsPath, type OpsStaticView, type OpsView } from '@/app/router/paths';

import { usePlanChangesQuery } from '@/features/ops-billing/application/queries/usePlanChangesQuery';
import type { PlanChangeListParams } from '@/features/ops-billing/domain/entities/billing.entities';
import { useOpsDashboardQuery } from '@/features/ops-dashboard/application/queries/useOpsDashboardQuery';
import type { OpsDashboardAlert } from '@/features/ops-dashboard/domain/entities/opsDashboard.entities';
import {
  ALERT_SEV_TINT,
  hospitalHref,
  toAlertView,
} from '@/features/ops-dashboard/presentation/components/opsDashboardFormat';
import { useSettlementPeriodsQuery } from '@/features/ops-settlements/application/queries/useSettlementPeriodsQuery';
import type {
  PeriodFilter,
  SettlementPeriod,
} from '@/features/ops-settlements/domain/entities/opsSettlements.entities';

import { OPS_META } from './ops-nav';

interface OpsNotif {
  readonly key: string;
  readonly icon: IconName;
  /** Icon-box tint as token classes. */
  readonly boxClass: string;
  readonly t: string;
  readonly s: string;
  /** Where the item leads. */
  readonly to: string;
  readonly unread?: boolean;
}

/** Only the count of open plan-change requests is read. */
const OPEN_PLAN_CHANGES: PlanChangeListParams = { page: 1, pageSize: 1, statuses: ['requested'] };

/** Closed settlement periods: payable, waiting for a payout run. */
const PAYABLE_PERIODS: PeriodFilter = { statuses: ['closed'], dateFrom: null, dateTo: null };

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/**
 * The bell's items, all from live data: the platform's computed alerts
 * (`/platform/dashboard`), open plan-change requests and payable settlement
 * periods. Danger alerts and requests awaiting a decision are unread.
 */
function buildNotifs(
  alerts: readonly OpsDashboardAlert[],
  planChanges: number,
  payable: readonly SettlementPeriod[],
): OpsNotif[] {
  const out: OpsNotif[] = alerts.map((alert) => {
    const view = toAlertView(alert);
    const [bg, fg, icon] = ALERT_SEV_TINT[view.sev];
    const only = view.hospitals.length === 1 ? view.hospitals[0] : undefined;
    return {
      key: view.key,
      icon,
      boxClass: `${bg} ${fg}`,
      t: view.title,
      s: view.sub,
      to: view.action?.to ?? (only ? hospitalHref(only.id) : opsPath('dashboard')),
      unread: view.sev === 'danger',
    };
  });
  if (planChanges > 0) {
    out.push({
      key: 'plan-changes',
      icon: 'layers',
      boxClass: 'bg-blue-soft-bg text-blue',
      t: `${plural(planChanges, 'plan change request')} to review`,
      s: 'Hospitals asking to move plan',
      to: opsPath('plans'),
      unread: true,
    });
  }
  if (payable.length > 0) {
    const net = payable.reduce((sum, p) => sum + p.netPayableRupees, 0);
    out.push({
      key: 'payable',
      icon: 'landmark',
      boxClass: 'bg-blue-soft-bg text-blue',
      t: `${plural(payable.length, 'settlement')} awaiting a payout run`,
      s: `${money(net)} payable to hospitals`,
      to: opsPath('settlements'),
    });
  }
  return out;
}

interface OpsTopbarProps {
  view: OpsView;
  onNavigate: (view: OpsStaticView) => void;
  onLogout: () => void;
  onAccount: () => void;
  /** Signed-in user (from `/platform/me`). */
  userName: string;
  userEmail: string;
  roleName: string;
  onBack: (() => void) | null;
  /**
   * Opens the off-canvas sidebar. Rendered as a hamburger below `lg` only, so
   * the desktop topbar is unchanged (audit 3.4.1).
   */
  onMenu?: () => void;
}

/** Ops console topbar with notification bell + account menu (design `OpsTopbar`). */
export function OpsTopbar({
  view,
  onNavigate,
  onLogout,
  onAccount,
  userName,
  userEmail,
  roleName,
  onBack,
  onMenu,
}: OpsTopbarProps) {
  const [menu, setMenu] = useState(false);
  const [notif, setNotif] = useState(false);
  const navigate = useNavigate();
  const m = OPS_META[view] ?? ['Operations', ''];
  const dashboard = useOpsDashboardQuery();
  const planChanges = usePlanChangesQuery(OPEN_PLAN_CHANGES);
  const payable = useSettlementPeriodsQuery(PAYABLE_PERIODS);
  const notifs = buildNotifs(
    dashboard.data?.alerts ?? [],
    planChanges.data?.total ?? 0,
    payable.data ?? [],
  );
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
          <button type="button" onClick={onBack} className="text-text-strong flex cursor-pointer">
            <Icon name="arrow-left" size={24} />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="text-h1 text-text-strong m-0 truncate">{m[0]}</h1>
          {m[1] && <div className="text-caption text-text-muted mt-0.25 truncate">{m[1]}</div>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
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
            <span className="bg-d-500 absolute -top-1.25 -right-1.5 flex h-3.75 min-w-3.75 items-center justify-center rounded-full border-[1.5px] border-white px-1 text-[10px] font-semibold text-white">
              {unread}
            </span>
          )}
        </button>
        {notif && (
          <>
            <div onClick={() => setNotif(false)} className="fixed inset-0 z-30" />
            <div className="border-border shadow-pop absolute top-18 right-2 z-40 w-85 max-w-full overflow-hidden rounded-lg border bg-white lg:right-18.5">
              <div className="border-border-soft text-text-strong border-b px-4 py-3.5 text-[15px] font-semibold">
                Notifications
              </div>
              <div className="max-h-90 overflow-y-auto">
                {notifs.length === 0 && (
                  <div className="text-text-faint text-body py-7 text-center">
                    {"You're all caught up."}
                  </div>
                )}
                {notifs.map((n, i) => (
                  <div
                    key={n.key}
                    onClick={() => {
                      navigate(n.to);
                      setNotif(false);
                    }}
                    className={cn(
                      'hover:bg-grey-200 flex cursor-pointer items-start gap-3 px-4 py-3.25 transition-colors duration-150',
                      i < notifs.length - 1 && 'border-border-soft border-b',
                      n.unread ? 'bg-bg-app' : 'bg-white',
                    )}
                  >
                    <div
                      className={cn(
                        'flex size-8.5 flex-none items-center justify-center rounded-md',
                        n.boxClass,
                      )}
                    >
                      <Icon name={n.icon} size={17} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-body text-text-strong font-medium">{n.t}</div>
                      <div className="text-caption text-text-muted">{n.s}</div>
                    </div>
                    {n.unread && (
                      <span className="bg-d-500 mt-1.5 size-1.75 flex-none rounded-full" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
        <div className="bg-border h-7 w-px" />
        <button
          type="button"
          onClick={() => setMenu((v) => !v)}
          className="flex cursor-pointer items-center gap-2.5"
        >
          <Avatar name={userName} size={38} />
          <div className="hidden flex-col items-start sm:flex">
            <span className="text-body text-text-strong font-medium">{userName}</span>
            <span className="text-caption text-text-muted">{roleName}</span>
          </div>
          <Icon name="chevron-down" size={16} className="text-text-muted" />
        </button>
        {menu && (
          <>
            <div onClick={() => setMenu(false)} className="fixed inset-0 z-30" />
            <div className="border-border shadow-pop absolute top-18 right-2 z-40 w-60 max-w-full overflow-hidden rounded-lg border bg-white p-2 lg:right-7">
              <div className="flex items-center gap-2.5 px-2.5 py-2.25">
                <Avatar name={userName} size={32} />
                <div className="min-w-0">
                  <div className="text-body text-text-strong font-medium">{userName}</div>
                  <div className="text-caption text-text-muted">{userEmail}</div>
                </div>
              </div>
              <div className="bg-border-soft mx-1 my-1.5 h-px" />
              <div
                onClick={() => {
                  setMenu(false);
                  onAccount();
                }}
                className="text-text-body hover:bg-grey-200 flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2.25 transition-colors duration-150"
              >
                <Icon name="user" size={18} />{' '}
                <span className="text-body font-medium">My Account</span>
              </div>
              <div
                onClick={() => {
                  setMenu(false);
                  onNavigate('settings');
                }}
                className="text-text-body hover:bg-grey-200 flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2.25 transition-colors duration-150"
              >
                <Icon name="settings" size={18} />{' '}
                <span className="text-body font-medium">Platform Settings</span>
              </div>
              <div
                onClick={() => {
                  setMenu(false);
                  onLogout();
                }}
                className="text-d-500 hover:bg-grey-200 flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2.25 transition-colors duration-150"
              >
                <Icon name="log-out" size={18} />{' '}
                <span className="text-body font-medium">Log Out</span>
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
