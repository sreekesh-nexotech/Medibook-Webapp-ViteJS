import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useOpsPermission } from '@/shared/hooks/useOpsPermission';
import { money } from '@/shared/lib/format';
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
import { TopbarAccountMenu, type TopbarMenuItem } from './TopbarAccountMenu';
import { TopbarBell, type TopbarBellItem } from './TopbarBell';

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
  const { can } = useOpsPermission();
  const m = OPS_META[view] ?? ['Operations', ''];
  // Each bell source is read only by roles allowed to read it, so finance,
  // support, compliance and read-only fire no refused requests (UAT-35).
  const canDashboard = can('dashboard.view');
  const canPlanChanges = can('billing.view');
  const canSettlements = can('settlements.view');
  const dashboard = useOpsDashboardQuery(canDashboard);
  const planChanges = usePlanChangesQuery(OPEN_PLAN_CHANGES, canPlanChanges);
  const payable = useSettlementPeriodsQuery(PAYABLE_PERIODS, canSettlements);
  const notifs = buildNotifs(
    dashboard.data?.alerts ?? [],
    planChanges.data?.total ?? 0,
    payable.data ?? [],
  );
  const isError =
    (canDashboard && dashboard.isError) ||
    (canPlanChanges && planChanges.isError) ||
    (canSettlements && payable.isError);
  const items: TopbarBellItem[] = notifs.map((n) => ({
    key: n.key,
    icon: n.icon,
    boxClass: n.boxClass,
    title: n.t,
    sub: n.s,
    unread: n.unread === true,
  }));
  const menuItems: TopbarMenuItem[] = [
    { key: 'account', icon: 'user', label: 'My Account', onSelect: onAccount },
    ...(can('settings.view')
      ? [
          {
            key: 'settings',
            icon: 'settings' as const,
            label: 'Platform Settings',
            onSelect: () => onNavigate('settings'),
          },
        ]
      : []),
    { key: 'logout', icon: 'log-out', label: 'Log Out', isDanger: true, onSelect: onLogout },
  ];
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
            aria-label="Go back"
            title="Go back"
            className="text-text-strong flex cursor-pointer"
          >
            <Icon name="arrow-left" size={24} />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="text-h1 text-text-strong m-0 truncate">{m[0]}</h1>
          {m[1] && <div className="text-caption text-text-muted mt-0.25 truncate">{m[1]}</div>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <TopbarBell
          open={notif}
          onToggle={() => {
            setNotif((n) => !n);
            setMenu(false);
          }}
          onClose={() => setNotif(false)}
          items={items}
          isError={isError}
          onRetry={() => {
            if (canDashboard) void dashboard.refetch();
            if (canPlanChanges) void planChanges.refetch();
            if (canSettlements) void payable.refetch();
          }}
          onSelect={(item) => {
            const target = notifs.find((n) => n.key === item.key);
            setNotif(false);
            if (target) navigate(target.to);
          }}
          dotClass="bg-d-500"
          panelWidthClass="w-85"
        />
        <div className="bg-border h-7 w-px" />
        <TopbarAccountMenu
          open={menu}
          onToggle={() => {
            setMenu((v) => !v);
            setNotif(false);
          }}
          onClose={() => setMenu(false)}
          userName={userName}
          roleName={roleName}
          detail={userEmail}
          items={menuItems}
          panelWidthClass="w-60"
        />
      </div>
    </header>
  );
}
