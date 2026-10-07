import { useState } from 'react';

import { useSeenNotifications } from '@/shared/hooks/useSeenNotifications';
import { usePermission } from '@/shared/hooks/usePermission';
import { Icon } from '@/shared/ui/Icon';
import { toast } from '@/shared/ui/toast/toast.store';

import type { HospitalRole } from '@/app/router/paths';

import { useAdminDashboardQuery } from '@/features/dashboard/application/queries/useAdminDashboardQuery';
import { useDashboardAlertsLive } from '@/features/dashboard/application/queries/useDashboardAlertsLive';
import { useHospitalNotificationsQuery } from '@/features/notifications/application/queries/useHospitalNotificationsQuery';
import { useMarkNotificationsReadMutation } from '@/features/notifications/application/queries/useMarkNotificationsReadMutation';
import { useSettlementPeriodsQuery } from '@/features/settlements/application/queries/useSettlementPeriodsQuery';

import type { HospitalNavView } from './hospital-nav';
import {
  buildHospitalNotifs,
  isBellEntryUnread,
  LATEST_PERIODS,
  localBellEntries,
  localReadKey,
  serverBellEntries,
  type HospitalBellAccess,
  type HospitalBellEntry,
} from './hospitalBell';
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
  // Every booking push on ws/hospital/alerts invalidates the dashboard keys,
  // the bell's included, so its counts stay live.
  useDashboardAlertsLive();
  // DASH-03: the server computes the bell per role and keeps read state per
  // staff member. `null` = an older backend without it: the bell then builds
  // itself from today's dashboard alerts and — for roles that may open
  // Settlements — the latest periods (UAT-68), with read state in the browser.
  const serverQuery = useHospitalNotificationsQuery();
  const isFallback = serverQuery.data === null;
  const dashboard = useAdminDashboardQuery('today', isFallback);
  const periodsQuery = useSettlementPeriodsQuery(
    LATEST_PERIODS,
    isFallback && access.canSeeSettlements,
  );
  const entries: HospitalBellEntry[] = serverQuery.data
    ? serverBellEntries(serverQuery.data)
    : isFallback
      ? localBellEntries(
          buildHospitalNotifs(access, dashboard.data?.alerts, periodsQuery.data?.items ?? []),
        )
      : [];
  const isError = isFallback
    ? dashboard.isError || (access.canSeeSettlements && periodsQuery.isError)
    : serverQuery.isError;
  const markRead = useMarkNotificationsReadMutation();
  const { seen, markAllRead: markLocal } = useSeenNotifications(readScope);
  const items: TopbarBellItem[] = entries.map((entry) => ({
    key: entry.key,
    icon: entry.icon,
    boxClass: entry.boxClass,
    title: entry.title,
    sub: entry.sub,
    unread: isBellEntryUnread(entry, seen),
  }));

  /** Mark read on the server; where it cannot (fallback, read-only hospital), in this browser. */
  const markEntries = (targets: readonly HospitalBellEntry[], key: string | null) => {
    const keepLocally = () => markLocal([...seen, ...targets.map(localReadKey)]);
    if (isFallback) {
      keepLocally();
      return;
    }
    markRead.mutate(key, { onError: keepLocally });
  };

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
            if (!isFallback) {
              void serverQuery.refetch();
              return;
            }
            void dashboard.refetch();
            if (access.canSeeSettlements) void periodsQuery.refetch();
          }}
          onSelect={(item) => {
            const target = entries.find((entry) => entry.key === item.key);
            setNotif(false);
            if (!target) return;
            if (item.unread) markEntries([target], target.key);
            onNavigate(target.go);
          }}
          onMarkAllRead={() => {
            markEntries(entries, null);
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
