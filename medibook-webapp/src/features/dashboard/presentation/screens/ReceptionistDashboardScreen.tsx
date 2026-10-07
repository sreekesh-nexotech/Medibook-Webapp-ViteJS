import { useNavigate, useParams } from 'react-router-dom';

import {
  hospitalAppointmentsPath,
  hospitalPath,
  hospitalTokenForDeptPath,
  isHospitalRole,
  type HospitalStaticView,
} from '@/app/router/paths';
import { isFailure } from '@/core/error/failure';
import { useHospitalToday } from '@/shared/hooks/useHospitalTime';
import { usePermission, type PermissionKey } from '@/shared/hooks/usePermission';
import { cn } from '@/shared/lib/cn';
import { money } from '@/shared/lib/format';
import { formatTimeIn } from '@/shared/lib/hospitalTime';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Icon } from '@/shared/ui/Icon';
import { RefreshBtn } from '@/shared/ui/RefreshBtn';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { SkeletonKpiStrip, SkeletonTable } from '@/shared/ui/Skeleton';
import { StatCard, type StatCardData } from '@/shared/ui/StatCard';

import { useDepartmentsQuery } from '@/features/doctors/application/queries/useDepartmentsQuery';
import { useDoctorsQuery } from '@/features/doctors/application/queries/useDoctorsQuery';

import { useAdminDashboardQuery } from '@/features/dashboard/application/queries/useAdminDashboardQuery';
import { useReceptionDashboardQuery } from '@/features/dashboard/application/queries/useReceptionDashboardQuery';
import {
  actionItems,
  actionWhen,
  departmentQueueRows,
  isSessionServing,
  sourceBadge,
} from '@/features/dashboard/presentation/components/dashboard.viewModel';
import { StaleDataBanner } from '@/features/dashboard/presentation/components/StaleDataBanner';

/** Text-link action (design's clickable `<span>` with `font: var(--body-md)`, blue). */
const LINK_CLASS = 'text-body text-blue cursor-pointer border-0 bg-transparent p-0 font-medium';

/** A KPI tile and where it leads, with the permission that place needs (UAT-60). */
interface ReceptionKpi extends StatCardData {
  readonly to: string;
  readonly perm: PermissionKey;
}

/** Rows the needs-action card shows before "View All". */
const ACTION_ROWS = 5;

/**
 * Receptionist (front desk) dashboard — design `Dashboard.jsx`
 * `ReceptionistDashboard`.
 *
 * Today's queue and to-dos come from `GET /hospital/dashboard/reception`
 * (doctor sessions, queue counts, unpaid walk-ins, the day's approvals, the
 * caller's open cash drawer); walk-in count and desk collections from
 * `GET /hospital/dashboard/admin?period=today`. Every tile, button and link
 * is shown only to roles that may open where it leads (UAT-60); "serving"
 * is read from `current_appointment_id` with the hospital's own token labels
 * (UAT-61); times are the hospital's (UAT-47).
 */
export function ReceptionistDashboardScreen() {
  const navigate = useNavigate();
  const { role } = useParams();
  const activeRole = isHospitalRole(role) ? role : 'receptionist';
  const { can } = usePermission();
  const { today, timeZone } = useHospitalToday();
  const go = (view: HospitalStaticView): void => {
    navigate(hospitalPath(activeRole, view));
  };

  const reception = useReceptionDashboardQuery();
  const todayFiguresQuery = useAdminDashboardQuery('today');
  const doctors = useDoctorsQuery();
  const departments = useDepartmentsQuery();

  const canQueue = can('Token Management.view');
  const canAppointments = can('Appointments.view');
  const canPayments = can('Payments.view');

  const refresh = async (): Promise<void> => {
    await Promise.all([
      reception.refetch(),
      todayFiguresQuery.refetch(),
      doctors.refetch(),
      departments.refetch(),
    ]);
  };

  const data = reception.data;
  const loading = reception.isLoading;

  if (reception.isError && !data) {
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
  const servingNow = sessions.filter(isSessionServing).length;

  const deptOfDoctor = new Map((doctors.data ?? []).map((d) => [d.id, d.departmentId] as const));
  const deptRows = departmentQueueRows(departments.data ?? [], sessions, deptOfDoctor);

  const actions = data ? actionItems(data) : [];
  const otherDayApprovals = data?.pendingApprovals.otherDaysCount ?? 0;
  const cash = data?.cashSession ?? null;

  const todayFigures = todayFiguresQuery.data;
  const deskCash = todayFigures?.collectedByMethod.cash ?? 0;
  const deskTotal = todayFigures?.collectedByChannel.desk ?? 0;
  const deskOther = Math.max(0, deskTotal - deskCash);
  const onlinePrepaid = todayFigures?.collectedByChannel.online ?? 0;
  const deskRefunds = todayFigures?.refundedByChannel?.desk ?? null;
  const onlineRefunds = todayFigures?.refundedByChannel?.online ?? null;

  const KPIS: readonly ReceptionKpi[] = [
    {
      icon: 'calendar-check',
      label: 'Appointments Today',
      value: summary?.total ?? 0,
      sub: 'Across all departments',
      iconClass: 'bg-g-100 text-g-600',
      valueClass: 'text-g-600',
      to: hospitalAppointmentsPath(activeRole),
      perm: 'Appointments.view',
    },
    {
      icon: 'ticket',
      label: 'In Queue',
      value: (summary?.waiting ?? 0) + (summary?.inConsultation ?? 0),
      sub: 'Currently waiting / serving',
      iconClass: 'bg-blue-soft-bg text-blue',
      valueClass: 'text-blue',
      to: hospitalPath(activeRole, 'token'),
      perm: 'Token Management.view',
    },
    {
      icon: 'indian-rupee',
      label: 'Pending Payment',
      value: data?.unpaidWalkIns.count ?? 0,
      sub: 'Walk-ins to collect',
      iconClass: 'bg-d-100 text-d-500',
      valueClass: 'text-d-500',
      to: hospitalAppointmentsPath(activeRole, { tab: 'pending-payment' }),
      perm: 'Appointments.view',
    },
    {
      icon: 'footprints',
      label: 'Walk-ins Today',
      value: todayFiguresQuery.isError ? '—' : (todayFigures?.appointmentsBySource.walk_in ?? 0),
      sub:
        todayFigures && !todayFigures.bySourceIsLive
          ? 'Booked at the desk, cancellations included'
          : 'Booked at the desk',
      iconClass: 'bg-badge-noshow-bg text-orange',
      valueClass: 'text-orange',
      to: hospitalAppointmentsPath(activeRole, { tab: 'walk-in' }),
      perm: 'Appointments.view',
    },
  ];

  const collections: readonly { label: string; value: number; cls: string; note?: string }[] = [
    { label: 'Desk Cash', value: deskCash, cls: 'text-blue' },
    { label: 'Desk UPI / Card / Other', value: deskOther, cls: 'text-y-600' },
    { label: 'Collected at Desk', value: deskTotal, cls: 'text-g-600' },
    deskRefunds === null
      ? { label: 'Refunded Today', value: todayFigures?.refundedRupees ?? 0, cls: 'text-d-500' }
      : {
          label: 'Refunded at Desk',
          value: deskRefunds,
          cls: 'text-d-500',
          note: onlineRefunds ? `${money(onlineRefunds)} online` : undefined,
        },
  ];

  const quickActions: readonly {
    readonly label: string;
    readonly icon: 'plus' | 'ticket' | 'search';
    readonly view: HospitalStaticView;
    readonly perm: PermissionKey;
    readonly primary: boolean;
  }[] = [
    {
      label: 'New Appointment',
      icon: 'plus',
      view: 'create',
      perm: 'Appointments.add',
      primary: true,
    },
    {
      label: 'Department Queue',
      icon: 'ticket',
      view: 'token',
      perm: 'Token Management.view',
      primary: false,
    },
    {
      label: 'Find Patient',
      icon: 'search',
      view: 'patients',
      perm: 'Patients.view',
      primary: false,
    },
  ];
  const allowedActions = quickActions.filter((a) => can(a.perm));

  return (
    <div className="flex flex-col gap-5">
      {reception.isError && data && (
        <StaleDataBanner
          updatedAt={reception.dataUpdatedAt}
          timeZone={timeZone}
          onRetry={() => void reception.refetch()}
        />
      )}
      {loading ? (
        <SkeletonKpiStrip count={KPIS.length} />
      ) : (
        <div className="flex gap-4">
          {KPIS.map((k) => (
            <StatCard
              key={k.label}
              k={k}
              onClick={can(k.perm) ? () => navigate(k.to) : undefined}
            />
          ))}
        </div>
      )}

      <div>
        <div className="mb-3.5 flex items-center justify-between gap-3">
          <SectionTitle>{allowedActions.length > 0 ? 'Quick Actions' : 'Today'}</SectionTitle>
          <RefreshBtn onRefresh={refresh} title="Refresh the front desk view" />
        </div>
        {allowedActions.length > 0 && (
          <div className="flex gap-4">
            {allowedActions.map((a) => (
              <Button
                key={a.label}
                variant={a.primary ? 'primary' : 'secondary'}
                icon={a.icon}
                className="flex-1 !p-4.5"
                onClick={() => go(a.view)}
              >
                {a.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {cash ? (
        <Card className="flex flex-wrap items-center gap-5">
          <div className="bg-g-100 text-g-600 flex size-10 flex-none items-center justify-center rounded-md">
            <Icon name="wallet" size={20} />
          </div>
          <div className="min-w-40 flex-1">
            <div className="text-body text-text-strong font-medium">Your cash drawer is open</div>
            <div className="text-caption text-text-muted">
              {cash.counterCode ? `Counter ${cash.counterCode} · ` : ''}opened{' '}
              {formatTimeIn(cash.openedAt, timeZone)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-caption text-text-muted">Opening float</div>
            <div className="text-h3 text-text-strong tabular-nums">
              {money(cash.openingFloatRupees)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-caption text-text-muted">Expected cash now</div>
            <div className="text-h3 text-g-600 tabular-nums">{money(cash.expectedCashRupees)}</div>
          </div>
          {canPayments && (
            <button type="button" onClick={() => go('payments')} className={LINK_CLASS}>
              Open Payments
            </button>
          )}
        </Card>
      ) : (
        !loading &&
        can('Payments.add') && (
          <Card className="flex flex-wrap items-center gap-3">
            <Icon name="wallet" size={18} className="text-text-muted" />
            <span className="text-body text-text-body flex-1">
              No cash drawer open. Open yours on Payments before taking cash.
            </span>
            {canPayments && (
              <button type="button" onClick={() => go('payments')} className={LINK_CLASS}>
                Open Payments
              </button>
            )}
          </Card>
        )
      )}

      <div className="flex gap-5">
        <Card className="flex-1">
          <div className="mb-3.5 flex items-center justify-between">
            <SectionTitle size={16}>Live Queue Snapshot</SectionTitle>
            {canQueue && (
              <button type="button" onClick={() => go('token')} className={LINK_CLASS}>
                Open Queue
              </button>
            )}
          </div>
          <div className="mb-3.5 flex gap-3.5">
            <div className="bg-blue-soft-bg flex-1 rounded-lg p-4.5 text-center">
              <div className="text-stat text-blue font-extrabold">{waitingTotal}</div>
              <div className="text-caption text-text-muted">Waiting across depts</div>
            </div>
            <div className="bg-grey-200 flex-1 rounded-lg p-4.5 text-center">
              <div className="text-stat text-text-strong font-extrabold">{servingNow}</div>
              <div className="text-caption text-text-muted">Now serving</div>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            {loading || departments.isLoading ? (
              <SkeletonTable rows={3} cols={3} card={false} />
            ) : departments.isError ? (
              <ErrorState
                inline
                title="Departments could not be loaded"
                onRetry={() => void departments.refetch()}
              />
            ) : deptRows.length === 0 ? (
              <EmptyState compact icon="ticket" title="No departments set up yet." />
            ) : (
              deptRows.map((d) => {
                const body = (
                  <>
                    <span className="text-text-body flex-1">{d.name}</span>
                    {d.isServing ? (
                      <span className="text-caption text-g-600">
                        serving{' '}
                        {d.servingLabel ? <b className="text-blue">{d.servingLabel}</b> : 'now'}
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
                  </>
                );
                return canQueue ? (
                  <button
                    type="button"
                    key={d.id}
                    onClick={() => navigate(hospitalTokenForDeptPath(activeRole, d.name))}
                    className="text-body hover:bg-grey-200 flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors duration-150"
                  >
                    {body}
                    <Icon name="chevron-right" size={16} className="text-text-faint" />
                  </button>
                ) : (
                  <div
                    key={d.id}
                    className="text-body flex w-full items-center gap-2.5 rounded-md px-2.5 py-2"
                  >
                    {body}
                  </div>
                );
              })
            )}
          </div>
        </Card>

        <Card className="flex-[1.4]">
          <div className="mb-3.5 flex items-center justify-between">
            <SectionTitle size={16}>Needs Action Today</SectionTitle>
            {canAppointments && (
              <button
                type="button"
                onClick={() => navigate(hospitalAppointmentsPath(activeRole))}
                className={LINK_CLASS}
              >
                View All
              </button>
            )}
          </div>
          {loading ? (
            <SkeletonTable rows={4} cols={3} card={false} />
          ) : actions.length === 0 ? (
            <EmptyState
              compact
              icon="calendar-days"
              title="Nothing needs action right now."
              message="No unpaid walk-ins and no bookings waiting for approval today."
              actionLabel={can('Appointments.add') ? 'New Appointment' : undefined}
              actionIcon="plus"
              actionVariant="button"
              onAction={can('Appointments.add') ? () => go('create') : undefined}
            />
          ) : (
            <div className="flex flex-col gap-2.5">
              {actions.slice(0, ACTION_ROWS).map(({ appt: a, reason }) => (
                <button
                  type="button"
                  key={a.id}
                  disabled={!canAppointments}
                  onClick={() =>
                    navigate(hospitalAppointmentsPath(activeRole, { appointmentId: a.id }))
                  }
                  className="bg-blue-soft-bg flex w-full cursor-pointer items-center gap-3.5 rounded-md px-4 py-2.75 text-left disabled:cursor-default"
                >
                  <div className="text-caption text-text-body w-24">
                    {actionWhen(a, today, timeZone)}
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
          {!loading && otherDayApprovals > 0 && (
            <div className="text-caption text-text-muted mt-3 flex items-center gap-2">
              <Icon name="calendar-clock" size={14} />
              {otherDayApprovals} more booking{otherDayApprovals === 1 ? '' : 's'} await approval on
              other days.
              {canAppointments && (
                <button
                  type="button"
                  onClick={() =>
                    navigate(hospitalAppointmentsPath(activeRole, { tab: 'needs-approval' }))
                  }
                  className="text-caption text-blue cursor-pointer border-0 bg-transparent p-0 font-medium"
                >
                  Review them
                </button>
              )}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <SectionTitle>Today's Collection</SectionTitle>
          {canPayments && (
            <button type="button" onClick={() => go('payments')} className={LINK_CLASS}>
              Open Payments
            </button>
          )}
        </div>
        {todayFiguresQuery.isError && !todayFigures ? (
          <ErrorState
            inline
            title="Today's collection could not be loaded"
            onRetry={() => void todayFiguresQuery.refetch()}
          />
        ) : (
          <div className="flex gap-4">
            {collections.map((c) => (
              <div key={c.label} className="bg-blue-soft-bg flex-1 rounded-lg p-4.5 text-center">
                <div className="text-body text-text-body">{c.label}</div>
                <div className={cn('text-h2 mt-1.5 tabular-nums', c.cls)}>
                  {todayFiguresQuery.isLoading ? '…' : money(c.value)}
                </div>
                {c.note && <div className="text-caption text-text-muted mt-0.5">{c.note}</div>}
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
        <div className="text-caption text-text-muted mt-2">
          {deskRefunds === null
            ? 'Desk figures are before refunds. Refunded Today covers every refund processed today, at the desk and online.'
            : 'Desk figures are before refunds; Refunded at Desk is what the desk handed back today.'}
        </div>
      </Card>
    </div>
  );
}
