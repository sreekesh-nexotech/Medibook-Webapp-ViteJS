import { useNavigate, useParams } from 'react-router-dom';

import {
  hospitalPath,
  hospitalTokenForDeptPath,
  isHospitalRole,
  type HospitalStaticView,
} from '@/app/router/paths';
import { isFailure } from '@/core/error/failure';
import { cn } from '@/shared/lib/cn';
import { formatToken, money } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Icon } from '@/shared/ui/Icon';
import { KpiStrip } from '@/shared/ui/KpiStrip';
import { RefreshBtn } from '@/shared/ui/RefreshBtn';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { SkeletonKpiStrip, SkeletonTable } from '@/shared/ui/Skeleton';
import type { StatCardData } from '@/shared/ui/StatCard';

import { useDepartmentsQuery } from '@/features/doctors/application/queries/useDepartmentsQuery';
import { useDoctorsQuery } from '@/features/doctors/application/queries/useDoctorsQuery';

import { useAdminDashboardQuery } from '@/features/dashboard/application/queries/useAdminDashboardQuery';
import { useReceptionDashboardQuery } from '@/features/dashboard/application/queries/useReceptionDashboardQuery';
import {
  actionItems,
  clockTime,
  sourceBadge,
} from '@/features/dashboard/presentation/components/dashboard.viewModel';

/** Text-link action (design's clickable `<span>` with `font: var(--body-md)`, blue). */
const LINK_CLASS = 'text-body text-blue cursor-pointer border-0 bg-transparent p-0 font-medium';

/** A KPI tile carrying the view it navigates to (design `k.go`). */
interface ReceptionKpi extends StatCardData {
  readonly go: HospitalStaticView;
}

/** Rows the needs-action card shows before "View All". */
const ACTION_ROWS = 5;

/**
 * Receptionist (front desk) dashboard — design `Dashboard.jsx`
 * `ReceptionistDashboard`.
 *
 * Today's queue and to-dos come from `GET /hospital/dashboard/reception`
 * (doctor sessions, queue counts, unpaid walk-ins, bookings awaiting
 * approval); walk-in count and desk collections from
 * `GET /hospital/dashboard/admin?period=today`. Sessions carry only a doctor
 * id, so the per-department rows group them through the doctor roster (H1).
 */
export function ReceptionistDashboardScreen() {
  const navigate = useNavigate();
  const { role } = useParams();
  const activeRole = isHospitalRole(role) ? role : 'receptionist';
  const go = (view: HospitalStaticView): void => {
    navigate(hospitalPath(activeRole, view));
  };

  const reception = useReceptionDashboardQuery();
  const today = useAdminDashboardQuery('today');
  const doctors = useDoctorsQuery();
  const departments = useDepartmentsQuery();

  const refresh = async (): Promise<void> => {
    await Promise.all([
      reception.refetch(),
      today.refetch(),
      doctors.refetch(),
      departments.refetch(),
    ]);
  };

  const data = reception.data;
  const loading = reception.isLoading;

  if (reception.isLoadingError && !data) {
    return (
      <ErrorState
        title="The front desk view could not load"
        message={
          isFailure(reception.error)
            ? reception.error.message
            : 'Retrying usually fixes it — nothing has been lost.'
        }
        onRetry={() => void reception.refetch()}
      />
    );
  }

  const sessions = data?.sessions ?? [];
  const summary = data?.queueSummary;
  const waitingTotal = sessions.reduce((n, s) => n + s.waitingCount, 0);
  const servingNow = sessions.filter((s) => s.currentTokenNo !== null).length;

  const deptOfDoctor = new Map((doctors.data ?? []).map((d) => [d.id, d.departmentId] as const));
  const deptRows = (departments.data ?? [])
    .filter((d) => d.isActive)
    .map((d) => {
      const own = sessions.filter((s) => deptOfDoctor.get(s.doctorId) === d.id);
      const servingSession = own.find((s) => s.currentTokenNo !== null);
      return {
        id: d.id,
        name: d.name,
        waiting: own.reduce((n, s) => n + s.waitingCount, 0),
        servTok:
          servingSession?.currentTokenNo != null
            ? formatToken(servingSession.currentTokenNo)
            : null,
      };
    });

  const actions = data ? actionItems(data) : [];

  const todayFigures = today.data;
  const deskCash = todayFigures?.collectedByMethod.cash ?? 0;
  const deskTotal = todayFigures?.collectedByChannel.desk ?? 0;
  const deskOther = Math.max(0, deskTotal - deskCash);
  const onlinePrepaid = todayFigures?.collectedByChannel.online ?? 0;

  const KPIS: readonly ReceptionKpi[] = [
    {
      icon: 'calendar-check',
      label: 'Appointments Today',
      value: summary?.total ?? 0,
      sub: 'Across all departments',
      iconClass: 'bg-g-100 text-g-600',
      valueClass: 'text-g-600',
      go: 'appointments',
    },
    {
      icon: 'ticket',
      label: 'In Queue',
      value: (summary?.waiting ?? 0) + (summary?.inConsultation ?? 0),
      sub: 'Currently waiting / serving',
      iconClass: 'bg-blue-soft-bg text-blue',
      valueClass: 'text-blue',
      go: 'token',
    },
    {
      icon: 'indian-rupee',
      label: 'Pending Payment',
      value: data?.unpaidWalkIns.count ?? 0,
      sub: 'Walk-ins to collect',
      iconClass: 'bg-d-100 text-d-500',
      valueClass: 'text-d-500',
      go: 'appointments',
    },
    {
      icon: 'footprints',
      label: 'Walk-ins Today',
      value: today.isLoadingError ? '—' : (todayFigures?.appointmentsBySource.walk_in ?? 0),
      sub: 'Booked at the desk',
      iconClass: 'bg-badge-noshow-bg text-orange',
      valueClass: 'text-orange',
      go: 'appointments',
    },
  ];

  const collections: readonly { label: string; value: number; cls: string }[] = [
    { label: 'Desk Cash', value: deskCash, cls: 'text-blue' },
    { label: 'Desk UPI / Card', value: deskOther, cls: 'text-y-600' },
    { label: 'Collected at Desk', value: deskTotal, cls: 'text-g-600' },
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
            {loading || departments.isLoading || doctors.isLoading ? (
              <SkeletonTable rows={3} cols={3} card={false} />
            ) : departments.isLoadingError || doctors.isLoadingError ? (
              // Without the doctor list every department would read "idle, 0 waiting" (RUN-05).
              <ErrorState
                inline
                title="Departments could not be loaded"
                onRetry={() => {
                  void departments.refetch();
                  void doctors.refetch();
                }}
              />
            ) : deptRows.length === 0 ? (
              <EmptyState compact icon="ticket" title="No departments set up yet." />
            ) : (
              deptRows.map((d) => (
                <button
                  type="button"
                  key={d.id}
                  onClick={() => navigate(hospitalTokenForDeptPath(activeRole, d.name))}
                  className="text-body hover:bg-grey-200 flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors duration-150"
                >
                  <span className="text-text-body flex-1">{d.name}</span>
                  {d.servTok ? (
                    <span className="text-caption text-g-600">
                      serving <b className="text-blue">{d.servTok}</b>
                    </span>
                  ) : (
                    <span className="text-caption text-text-muted">idle</span>
                  )}
                  <span
                    className={cn(
                      'text-caption inline-flex w-17.5 items-center justify-end gap-1',
                      d.waiting ? 'text-text-strong' : 'text-text-muted',
                    )}
                  >
                    <Icon name="users" size={13} /> {d.waiting} waiting
                  </span>
                  <Icon name="chevron-right" size={16} className="text-text-faint" />
                </button>
              ))
            )}
          </div>
        </Card>

        <Card className="flex-[1.4]">
          <div className="mb-3.5 flex items-center justify-between">
            <SectionTitle size={16}>Needs Action Today</SectionTitle>
            <button type="button" onClick={() => go('appointments')} className={LINK_CLASS}>
              View All
            </button>
          </div>
          {loading ? (
            <SkeletonTable rows={4} cols={3} card={false} />
          ) : actions.length === 0 ? (
            <EmptyState
              compact
              icon="calendar-days"
              title="Nothing needs action right now."
              message="No unpaid walk-ins and no bookings waiting for approval."
              actionLabel="New Appointment"
              actionIcon="plus"
              actionVariant="button"
              onAction={() => go('create')}
            />
          ) : (
            <div className="flex flex-col gap-2.5">
              {actions.slice(0, ACTION_ROWS).map(({ appt: a, reason }) => (
                <button
                  type="button"
                  key={a.id}
                  onClick={() => go('appointments')}
                  className="bg-blue-soft-bg flex w-full cursor-pointer items-center gap-3.5 rounded-md px-4 py-2.75 text-left"
                >
                  <div className="text-caption text-text-body w-14">
                    {clockTime(a.scheduledStartAt)}
                  </div>
                  <div className="flex-1">
                    <div className="text-body text-text-strong font-medium">{a.patientName}</div>
                    <div className="text-caption text-text-muted">
                      {a.doctorName} · {a.tokenLabel ?? a.bookingRef}
                    </div>
                  </div>
                  <Badge status={sourceBadge(a.source)} />
                  {reason === 'unpaid' ? (
                    <Badge status="Pending">Unpaid {money(a.totalRupees)}</Badge>
                  ) : (
                    <Badge status="Requested">Needs approval</Badge>
                  )}
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
        {today.isLoadingError ? (
          <ErrorState
            inline
            title="Today's collection could not be loaded"
            onRetry={() => void today.refetch()}
          />
        ) : (
          <div className="flex gap-4">
            {collections.map((c) => (
              <div key={c.label} className="bg-blue-soft-bg flex-1 rounded-lg p-4.5 text-center">
                <div className="text-body text-text-body">{c.label}</div>
                <div className={cn('text-h2 mt-1.5 tabular-nums', c.cls)}>
                  {today.isLoading ? '…' : money(c.value)}
                </div>
              </div>
            ))}
          </div>
        )}
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
