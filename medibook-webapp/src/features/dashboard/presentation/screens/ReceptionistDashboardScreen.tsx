import { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { hospitalPath, isHospitalRole, type HospitalStaticView } from '@/app/router/paths';
import { cn } from '@/shared/lib/cn';
import { money } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Icon } from '@/shared/ui/Icon';
import { KpiStrip } from '@/shared/ui/KpiStrip';
import { RefreshBtn } from '@/shared/ui/RefreshBtn';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { SkeletonKpiStrip } from '@/shared/ui/Skeleton';
import type { StatCardData } from '@/shared/ui/StatCard';

import { useAppointmentsStore } from '@/features/appointments/application/store/appointments.store';
import { useCatalogStore } from '@/features/doctors/application/store/catalog.store';
import {
  selectDoctorNames,
  useCatalogDepartments,
} from '@/features/doctors/application/store/catalog.selectors';

/** Text-link action (design's clickable `<span>` with `font: var(--body-md)`, blue). */
const LINK_CLASS = 'text-body text-blue cursor-pointer border-0 bg-transparent p-0 font-medium';

/** A KPI tile carrying the view it navigates to (design `k.go`). */
interface ReceptionKpi extends StatCardData {
  readonly go: HospitalStaticView;
}

/** Receptionist (front desk) dashboard — design `Dashboard.jsx` `ReceptionistDashboard`. */
export function ReceptionistDashboardScreen() {
  const navigate = useNavigate();
  const { role } = useParams();
  const activeRole = isHospitalRole(role) ? role : 'receptionist';
  const go = (view: HospitalStaticView): void => {
    navigate(hospitalPath(activeRole, view));
  };
  // Department strip follows the hospital's own catalogue (audit 2.6.3).
  const departments = useCatalogDepartments();

  const appts = useAppointmentsStore((s) => s.appts);
  const serving = useAppointmentsStore((s) => s.serving);
  const setDept = useAppointmentsStore((s) => s.setDept);
  const [loading, setLoading] = useState(false);

  /**
   * Re-derive the desk view from the appointments ledger. No API yet, so the
   * refresh re-emits the store — queue counts, collection totals and the
   * appointment list are all rebuilt from it — and this is where the refetch
   * goes when one lands.
   */
  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    useAppointmentsStore.setState((s) => ({ appts: [...s.appts] }));
    setLoading(false);
  }, []);

  const today = appts.filter((a) => a.date === 'Today');
  const inQueue = appts.filter((a) => a.status === 'In Queue');
  const pendingPay = appts.filter((a) => a.payment === 'Pending');
  const walkins = today.filter((a) => a.source === 'Walk-in');
  const deskPaid = today.filter((a) => a.payment === 'Paid' && a.source === 'Walk-in');
  const deskCash = deskPaid
    .filter((a) => (a.payMode || 'Cash') === 'Cash')
    .reduce((s, a) => s + a.amount, 0);
  const deskOther = deskPaid.reduce((s, a) => s + a.amount, 0) - deskCash;
  const onlinePrepaid = today
    .filter((a) => a.payment === 'Paid' && a.source === 'Online')
    .reduce((s, a) => s + a.amount, 0);
  const waitingTotal = today.filter(
    (a) =>
      a.token &&
      !['Completed', 'Cancelled', 'No-show'].includes(a.status) &&
      a.token !== serving[a.doctor],
  ).length;
  const servingNow = Object.values(serving).filter(Boolean).length;

  const KPIS: readonly ReceptionKpi[] = [
    {
      icon: 'calendar-check',
      label: 'Appointments Today',
      value: today.length,
      sub: 'Across all departments',
      iconClass: 'bg-g-100 text-g-600',
      valueClass: 'text-g-600',
      go: 'appointments',
    },
    {
      icon: 'ticket',
      label: 'In Queue',
      value: inQueue.length,
      sub: 'Currently waiting / serving',
      iconClass: 'bg-blue-soft-bg text-blue',
      valueClass: 'text-blue',
      go: 'token',
    },
    {
      icon: 'indian-rupee',
      label: 'Pending Payment',
      value: pendingPay.length,
      sub: 'Walk-ins to collect',
      iconClass: 'bg-d-100 text-d-500',
      valueClass: 'text-d-500',
      go: 'appointments',
    },
    {
      icon: 'footprints',
      label: 'Walk-ins Today',
      value: walkins.length,
      sub: 'Booked at the desk',
      iconClass: 'bg-badge-noshow-bg text-orange',
      valueClass: 'text-orange',
      go: 'appointments',
    },
  ];

  const collections: readonly { label: string; value: number; cls: string }[] = [
    { label: 'Desk Cash', value: deskCash, cls: 'text-blue' },
    { label: 'Desk UPI / Card', value: deskOther, cls: 'text-y-600' },
    { label: 'Collected at Desk', value: deskCash + deskOther, cls: 'text-g-600' },
  ];

  return (
    <div className="flex flex-col gap-5">
      {loading ? (
        <SkeletonKpiStrip count={KPIS.length} />
      ) : (
        <KpiStrip items={KPIS} onItem={(k) => go(k.go)} />
      )}

      <div>
        <div className="mb-3.5 flex items-center justify-between gap-3">
          <SectionTitle>Quick Actions</SectionTitle>
          <RefreshBtn onRefresh={refresh} title="Refresh the front desk view" />
        </div>
        <div className="flex gap-4">
          <Button icon="plus" className="flex-1 !p-4.5" onClick={() => go('create')}>
            New Appointment
          </Button>
          <Button
            variant="secondary"
            icon="ticket"
            className="flex-1 !p-4.5"
            onClick={() => go('token')}
          >
            Department Queue
          </Button>
          <Button
            variant="secondary"
            icon="search"
            className="flex-1 !p-4.5"
            onClick={() => go('patients')}
          >
            Find Patient
          </Button>
        </div>
      </div>

      <div className="flex gap-5">
        <Card className="flex-1">
          <div className="mb-3.5 flex items-center justify-between">
            <SectionTitle size={16}>Live Queue Snapshot</SectionTitle>
            <button type="button" onClick={() => go('token')} className={LINK_CLASS}>
              Open Queue
            </button>
          </div>
          <div className="mb-3.5 flex gap-3.5">
            <div className="bg-blue-soft-bg flex-1 rounded-lg p-4.5 text-center">
              <div className="text-blue text-[30px] font-extrabold">{waitingTotal}</div>
              <div className="text-caption text-text-muted">Waiting across depts</div>
            </div>
            <div className="bg-grey-200 flex-1 rounded-lg p-4.5 text-center">
              <div className="text-text-strong text-[30px] font-extrabold">{servingNow}</div>
              <div className="text-caption text-text-muted">Now serving</div>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            {departments.map((d) => {
              const w = today.filter(
                (a) =>
                  a.dept === d &&
                  a.token &&
                  !['Completed', 'Cancelled', 'No-show'].includes(a.status) &&
                  a.token !== serving[a.doctor],
              ).length;
              const servingDoc = Object.keys(serving).find(
                (doc) =>
                  serving[doc] && selectDoctorNames(useCatalogStore.getState(), d).includes(doc),
              );
              const servTok = servingDoc ? serving[servingDoc] : null;
              return (
                <button
                  type="button"
                  key={d}
                  onClick={() => {
                    setDept(d);
                    go('token');
                  }}
                  className="text-body hover:bg-grey-200 flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors duration-150"
                >
                  <span className="text-text-body flex-1">{d}</span>
                  {servTok ? (
                    <span className="text-caption text-g-600">
                      serving <b className="text-blue">{servTok}</b>
                    </span>
                  ) : (
                    <span className="text-caption text-text-muted">idle</span>
                  )}
                  <span
                    className={cn(
                      'text-caption inline-flex w-17.5 items-center justify-end gap-1',
                      w ? 'text-text-strong' : 'text-text-muted',
                    )}
                  >
                    <Icon name="users" size={13} /> {w} waiting
                  </span>
                  <Icon name="chevron-right" size={16} className="text-text-faint" />
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="flex-[1.4]">
          <div className="mb-3.5 flex items-center justify-between">
            <SectionTitle size={16}>Today's Appointments</SectionTitle>
            <button type="button" onClick={() => go('appointments')} className={LINK_CLASS}>
              View All
            </button>
          </div>
          {today.length === 0 ? (
            <EmptyState
              compact
              icon="calendar-days"
              title="Nothing booked for today yet."
              message="Book a walk-in or register an online arrival to start the queue."
              actionLabel="New Appointment"
              actionIcon="plus"
              actionVariant="button"
              onAction={() => go('create')}
            />
          ) : (
            <div className="flex flex-col gap-2.5">
              {today.slice(0, 5).map((a) => (
                <button
                  type="button"
                  key={a.id}
                  onClick={() => go('appointments')}
                  className="bg-blue-soft-bg flex w-full cursor-pointer items-center gap-3.5 rounded-md px-4 py-2.75 text-left"
                >
                  <div className="text-caption text-text-body w-14">{a.time}</div>
                  <div className="flex-1">
                    <div className="text-body text-text-strong font-medium">{a.name}</div>
                    <div className="text-caption text-text-muted">
                      {a.doctor} · {a.dept}
                    </div>
                  </div>
                  <Badge status={a.source} />
                  <Badge status={a.status} />
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <SectionTitle>Today's Collection</SectionTitle>
          <button type="button" onClick={() => go('payments')} className={LINK_CLASS}>
            Open Payments
          </button>
        </div>
        <div className="flex gap-4">
          {collections.map((c) => (
            <div key={c.label} className="bg-blue-soft-bg flex-1 rounded-lg p-4.5 text-center">
              <div className="text-body text-text-body">{c.label}</div>
              <div className={cn('text-h2 mt-1.5 tabular-nums', c.cls)}>{money(c.value)}</div>
            </div>
          ))}
        </div>
        <div className="bg-grey-200 text-caption text-text-muted mt-3.5 flex items-center gap-2 rounded-md px-3.5 py-2.5">
          <Icon name="smartphone" size={15} className="text-blue flex-none" /> Online prepaid today
          (collected by Medibook):{' '}
          <b className="text-text-strong tabular-nums">{money(onlinePrepaid)}</b> — settled to the
          hospital later, not handled at the desk.
        </div>
      </Card>
    </div>
  );
}
