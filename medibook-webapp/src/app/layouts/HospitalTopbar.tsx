import { useState } from 'react';

import { cn } from '@/shared/lib/cn';
import { money } from '@/shared/lib/format';
import { Avatar } from '@/shared/ui/Avatar';
import { Icon } from '@/shared/ui/Icon';
import type { IconName } from '@/shared/ui/icon-registry';
import { toast } from '@/shared/ui/toast/toast.store';

import { HOSPITAL_ROLES, type HospitalRole } from '@/app/router/paths';

import { useAppointmentsStore } from '@/features/appointments/application/store/appointments.store';
import { useSettlementsStore } from '@/features/settlements/application/store/settlements.store';

import { ROLE_USERS, type HospitalNavView } from './hospital-nav';

interface HospitalNotif {
  readonly icon: IconName;
  /** Icon-box tint (the design's per-item `c`/`bg` pair as token classes). */
  readonly boxClass: string;
  readonly t: string;
  readonly s: string;
  readonly go: HospitalNavView;
  readonly unread?: boolean;
}

interface HospitalTopbarProps {
  title: string;
  subtitle: string | null;
  onBack: (() => void) | null;
  role: HospitalRole;
  onRoleChange: (role: HospitalRole | '__logout') => void;
  onNavigate: (view: HospitalNavView) => void;
  /**
   * Opens the off-canvas sidebar. Rendered as a hamburger below `lg` only, so
   * the desktop topbar is unchanged (audit 3.4.1).
   */
  onMenu?: () => void;
}

/** Hospital shell topbar with notification bell + role-switch menu (design `Topbar`). */
export function HospitalTopbar({
  title,
  subtitle,
  onBack,
  role,
  onRoleChange,
  onNavigate,
  onMenu,
}: HospitalTopbarProps) {
  const [menu, setMenu] = useState(false);
  const [notif, setNotif] = useState(false);
  const appts = useAppointmentsStore((s) => s.appts);
  const settlements = useSettlementsStore((s) => s.settlements);
  const u = ROLE_USERS[role];
  const pendingPay = appts.filter((a) => a.payment === 'Pending').length;
  const overdue = settlements.filter((r) => r.status === 'Overdue');
  const notifs: HospitalNotif[] =
    role === 'admin'
      ? [
          ...(overdue.length
            ? [
                {
                  icon: 'triangle-alert',
                  boxClass: 'bg-d-100 text-d-500',
                  t: `${overdue.length} settlement${overdue.length === 1 ? '' : 's'} overdue`,
                  s: `${money(overdue.reduce((s, r) => s + r.net, 0))} due from Medibook`,
                  go: 'settlements',
                  unread: true,
                } as const,
              ]
            : []),
          {
            icon: 'circle-check',
            boxClass: 'bg-g-100 text-g-600',
            t: 'Settlement released — MB-ST-2404',
            s: '₹ 97,380 sent · mark received once credited',
            go: 'settlements',
            unread: true,
          } as const,
          {
            icon: 'gauge',
            boxClass: 'bg-y-100 text-y-600',
            t: 'Plan quota at 62%',
            s: '3,120 of 5,000 bookings this month',
            go: 'settlements',
          } as const,
          ...(pendingPay
            ? [
                {
                  icon: 'indian-rupee',
                  boxClass: 'bg-blue-soft-bg text-blue',
                  t: `${pendingPay} walk-in payment${pendingPay === 1 ? '' : 's'} pending`,
                  s: 'Awaiting collection at the desk',
                  go: 'appointments',
                } as const,
              ]
            : []),
        ]
      : [
          ...(pendingPay
            ? [
                {
                  icon: 'indian-rupee',
                  boxClass: 'bg-d-100 text-d-500',
                  t: `${pendingPay} walk-in payment${pendingPay === 1 ? '' : 's'} pending`,
                  s: 'Collect at the desk to issue tokens',
                  go: 'appointments',
                  unread: true,
                } as const,
              ]
            : []),
          {
            icon: 'ticket',
            boxClass: 'bg-blue-soft-bg text-blue',
            t: 'Token queue active',
            s: 'Patients waiting across departments',
            go: 'token',
          } as const,
        ];
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
          <h1 className="text-h1 text-text-strong m-0 truncate">{title}</h1>
          {subtitle && (
            <div className="text-caption text-text-muted mt-0.25 truncate">{subtitle}</div>
          )}
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
            <div className="border-border shadow-pop absolute top-18 right-2 z-40 w-83 max-w-full overflow-hidden rounded-lg border bg-white lg:right-18.5">
              <div className="border-border-soft flex items-center justify-between border-b px-4 py-3.5">
                <span className="text-text-strong text-[15px] font-semibold">Notifications</span>
                {unread > 0 && (
                  <span
                    className="text-caption text-blue cursor-pointer"
                    onClick={() => {
                      toast('All caught up', 'success');
                      setNotif(false);
                    }}
                  >
                    Mark all read
                  </span>
                )}
              </div>
              <div className="max-h-90 overflow-y-auto">
                {notifs.length === 0 ? (
                  <div className="text-text-faint text-body py-7 text-center">
                    {"You're all caught up."}
                  </div>
                ) : (
                  notifs.map((n, i) => (
                    <div
                      key={i}
                      onClick={() => {
                        onNavigate(n.go);
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
                        <span className="bg-blue mt-1.5 size-1.75 flex-none rounded-full" />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
        <div className="bg-border h-7 w-px" />
        <button
          type="button"
          onClick={() => setMenu((m) => !m)}
          className="flex cursor-pointer items-center gap-2.5"
        >
          <Avatar name={u.name} size={38} />
          <div className="hidden flex-col items-start sm:flex">
            <span className="text-body text-text-strong font-medium">{u.name}</span>
            <span className="text-caption text-text-muted">{u.role}</span>
          </div>
          <Icon name="chevron-down" size={16} className="text-text-muted" />
        </button>
        {menu && (
          <>
            <div onClick={() => setMenu(false)} className="fixed inset-0 z-30" />
            <div className="border-border shadow-pop absolute top-18 right-2 z-40 w-58 max-w-full overflow-hidden rounded-lg border bg-white p-2 lg:right-7">
              <div className="text-tiny text-text-faint px-2.5 pt-2 pb-1.5 font-semibold tracking-[.06em] uppercase">
                Switch Role
              </div>
              {HOSPITAL_ROLES.map((rk) => {
                const ru = ROLE_USERS[rk];
                return (
                  <div
                    key={rk}
                    onClick={() => {
                      onRoleChange(rk);
                      setMenu(false);
                    }}
                    className={cn(
                      'hover:bg-grey-200 flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2.25 transition-colors duration-150',
                      rk === role && 'bg-blue-soft-bg',
                    )}
                  >
                    <Avatar name={ru.name} size={30} />
                    <div className="flex-1">
                      <div className="text-body text-text-strong font-medium">{ru.role}</div>
                    </div>
                    {rk === role && <Icon name="check" size={16} className="text-blue" />}
                  </div>
                );
              })}
              <div className="bg-border-soft mx-1 my-1.5 h-px" />
              <div
                onClick={() => {
                  setMenu(false);
                  onRoleChange('__logout');
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
