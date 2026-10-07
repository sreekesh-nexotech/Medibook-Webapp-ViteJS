import { useState } from 'react';

import { useSeenNotifications } from '@/shared/hooks/useSeenNotifications';
import { usePermission } from '@/shared/hooks/usePermission';
import { Icon } from '@/shared/ui/Icon';
import { toast } from '@/shared/ui/toast/toast.store';

import type { HospitalRole } from '@/app/router/paths';

import { useAdminDashboardQuery } from '@/features/dashboard/application/queries/useAdminDashboardQuery';
import { useDashboardAlertsLive } from '@/features/dashboard/application/queries/useDashboardAlertsLive';
import { useSettlementPeriodsQuery } from '@/features/settlements/application/queries/useSettlementPeriodsQuery';

import type { HospitalNavView } from './hospital-nav';
import { buildHospitalNotifs, LATEST_PERIODS, type HospitalBellAccess } from './hospitalBell';
import { TopbarAccountMenu, type TopbarMenuItem } from './TopbarAccountMenu';
import { TopbarBell, type TopbarBellItem } from './TopbarBell';

interface HospitalTopbarProps {
  title: string;
  subtitle: string | null;
  onBack: (() => void) | null;
  /** URL role — admins also see patient changes and drawers to reconcile. */
  role: HospitalRole;
  /** Who the bell's read state belongs to (`<hospital id>:<user id>`). */
  readScope: string;
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
  readScope,
  userName,
  roleName,
  onAccount,
  onLogout,
  onNavigate,
  onMenu,
}: HospitalTopbarProps) {
  const [menu, setMenu] = useState(false);
  const [notif, setNotif] = useState(false);
  const { canViewModule } = usePermission();
  const access: HospitalBellAccess = {
    isAdmin: role === 'admin',
    canSeeSettlements: canViewModule('Billing & Settlements'),
  };
  // Live counts: today's dashboard alerts (H10), refreshed on every booking
  // push, and — for roles that may open Settlements — the latest periods (H11).
  useDashboardAlertsLive();
  const dashboard = useAdminDashboardQuery('today');
  const periodsQuery = useSettlementPeriodsQuery(LATEST_PERIODS, access.canSeeSettlements);
  const notifs = buildHospitalNotifs(
    access,
    dashboard.data?.alerts,
    periodsQuery.data?.items ?? [],
  );
  const isError = dashboard.isError || (access.canSeeSettlements && periodsQuery.isError);
  // Read state lives in this browser per user until the backend keeps it
  // (DASH-03): it survives reloads and every tab agrees (UAT-68).
  const { seen, markAllRead } = useSeenNotifications(readScope);
  const items: TopbarBellItem[] = notifs.map((n) => ({
    key: n.t,
    icon: n.icon,
    boxClass: n.boxClass,
    title: n.t,
    sub: n.s,
    unread: !seen.has(n.t),
  }));
  const menuItems: TopbarMenuItem[] = [
    { key: 'account', icon: 'user', label: 'My Account', onSelect: onAccount },
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
          <h1 className="text-h1 text-text-strong m-0 truncate">{title}</h1>
          {subtitle && (
            <div className="text-caption text-text-muted mt-0.25 truncate">{subtitle}</div>
          )}
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
            void dashboard.refetch();
            if (access.canSeeSettlements) void periodsQuery.refetch();
          }}
          onSelect={(item) => {
            const target = notifs.find((n) => n.t === item.key);
            setNotif(false);
            if (target) onNavigate(target.go);
          }}
          onMarkAllRead={() => {
            markAllRead(notifs.map((n) => n.t));
            toast('All caught up', 'success');
            setNotif(false);
          }}
          dotClass="bg-blue"
          panelWidthClass="w-83"
        />
        <div className="bg-border h-7 w-px" />
        <TopbarAccountMenu
          open={menu}
          onToggle={() => {
            setMenu((m) => !m);
            setNotif(false);
          }}
          onClose={() => setMenu(false)}
          userName={userName}
          roleName={roleName}
          detail={roleName}
          items={menuItems}
          panelWidthClass="w-58"
        />
      </div>
    </header>
  );
}
