import { useState } from 'react';

import { cn } from '@/shared/lib/cn';
import { Avatar } from '@/shared/ui/Avatar';
import { Icon } from '@/shared/ui/Icon';
import type { IconName } from '@/shared/ui/icon-registry';

import type { OpsStaticView, OpsView } from '@/app/router/paths';

import { useInboxStore } from '@/features/ops-dashboard/application/store/inbox.store';
import { hospName } from '@/features/ops-hospitals/application/store/hospitals.store';
import { useOpsSettlementsStore } from '@/features/ops-settlements/application/store/opsSettlements.store';

import { OPS_META, OPS_USER } from './ops-nav';

/** A bell target: a static ops view, or one hospital's profile (`hospital:<id>`). */
type OpsNotifTarget = OpsStaticView | `hospital:${number}`;

interface OpsNotif {
  readonly icon: IconName;
  /** Icon-box tint (the design's per-item `c`/`bg` pair as token classes). */
  readonly boxClass: string;
  readonly t: string;
  readonly s: string;
  readonly go: OpsNotifTarget;
  readonly unread?: boolean;
}

function isHospitalTarget(go: OpsNotifTarget): go is `hospital:${number}` {
  return go.startsWith('hospital:');
}

interface OpsTopbarProps {
  view: OpsView;
  onNavigate: (view: OpsStaticView) => void;
  /** `hospital:<id>` bell targets open that hospital's profile (URL param port of `OpsSel.hosp`). */
  onOpenHospital: (id: number) => void;
  onLogout: () => void;
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
  onOpenHospital,
  onLogout,
  onBack,
  onMenu,
}: OpsTopbarProps) {
  const [menu, setMenu] = useState(false);
  const [notif, setNotif] = useState(false);
  const requests = useInboxStore((s) => s.requests);
  const alerts = useInboxStore((s) => s.alerts);
  const opsSettlements = useOpsSettlementsStore((s) => s.settlements);
  const m = OPS_META[view] ?? ['Operations', ''];
  const pendingSettle = opsSettlements.filter((s) => s.status === 'Pending').length;
  const notifs: OpsNotif[] = [
    ...requests
      .filter((r) => r.status === 'Open')
      .map((r): OpsNotif => ({
        icon: r.type === 'Support' ? 'life-buoy' : r.type === 'Plan' ? 'layers' : 'landmark',
        boxClass: 'bg-blue-soft-bg text-blue',
        t: r.subject,
        s: `${hospName(r)} · ${r.on}`,
        go: r.type === 'Plan' ? 'plans' : r.type === 'Settlement' ? 'settlements' : 'dashboard',
        unread: true,
      })),
    ...alerts.map((a): OpsNotif => ({
      icon: a.sev === 'danger' ? 'triangle-alert' : 'gauge',
      boxClass: a.sev === 'danger' ? 'bg-d-100 text-d-500' : 'bg-y-100 text-y-600',
      t: a.title,
      s: a.sub,
      go: a.go || 'dashboard',
      unread: a.sev === 'danger',
    })),
    ...(pendingSettle
      ? [
          {
            icon: 'landmark',
            boxClass: 'bg-blue-soft-bg text-blue',
            t: `${pendingSettle} settlements awaiting release`,
            s: 'Next payout run: 20 Jun 2026',
            go: 'settlements',
          } as const,
        ]
      : []),
  ];
  const unread = notifs.filter((n) => n.unread).length;
  const openTarget = (go: OpsNotifTarget) => {
    if (isHospitalTarget(go)) onOpenHospital(Number.parseInt(go.split(':')[1], 10));
    else onNavigate(go);
  };
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
                {notifs.map((n, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      openTarget(n.go);
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
          <Avatar name={OPS_USER.name} src={OPS_USER.av} size={38} />
          <div className="hidden flex-col items-start sm:flex">
            <span className="text-body text-text-strong font-medium">{OPS_USER.name}</span>
            <span className="text-caption text-text-muted">{OPS_USER.role}</span>
          </div>
          <Icon name="chevron-down" size={16} className="text-text-muted" />
        </button>
        {menu && (
          <>
            <div onClick={() => setMenu(false)} className="fixed inset-0 z-30" />
            <div className="border-border shadow-pop absolute top-18 right-2 z-40 w-60 max-w-full overflow-hidden rounded-lg border bg-white p-2 lg:right-7">
              <div className="flex items-center gap-2.5 px-2.5 py-2.25">
                <Avatar name={OPS_USER.name} src={OPS_USER.av} size={32} />
                <div className="min-w-0">
                  <div className="text-body text-text-strong font-medium">{OPS_USER.name}</div>
                  <div className="text-caption text-text-muted">riya.sharma@medibook.in</div>
                </div>
              </div>
              <div className="bg-border-soft mx-1 my-1.5 h-px" />
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
