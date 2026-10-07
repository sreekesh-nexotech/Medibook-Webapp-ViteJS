import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { hospitalPath, isHospitalRole, type HospitalStaticView } from '@/app/router/paths';
import { cn } from '@/shared/lib/cn';
import { money, moneyShort } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { BarChart, type BarChartDatum } from '@/shared/ui/BarChart';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Icon } from '@/shared/ui/Icon';
import type { IconName } from '@/shared/ui/icon-registry';
import { KpiStrip } from '@/shared/ui/KpiStrip';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { SkeletonKpiStrip, SkeletonTable } from '@/shared/ui/Skeleton';
import type { StatCardData } from '@/shared/ui/StatCard';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';

import { isFailure } from '@/core/error/failure';

import { useDepartmentsQuery } from '@/features/doctors/application/queries/useDepartmentsQuery';
import { useDoctorsQuery } from '@/features/doctors/application/queries/useDoctorsQuery';
import { usePatientsQuery } from '@/features/patients/application/queries/usePatientsQuery';
import type { PatientListParams } from '@/features/patients/domain/entities/patients.entities';
import { useSettlementPeriodsQuery } from '@/features/settlements/application/queries/useSettlementPeriodsQuery';
import type {
  SettlementPeriod,
  SettlementPeriodFilters,
} from '@/features/settlements/domain/entities/settlements.entities';

import { useAdminDashboardQuery } from '@/features/dashboard/application/queries/useAdminDashboardQuery';
import {
  DOCTOR_STATUS_BADGE,
  statusBars,
} from '@/features/dashboard/presentation/components/dashboard.viewModel';
import { OverviewHeader } from '@/features/dashboard/presentation/components/OverviewHeader';
import { PERIOD_CODE, type Period } from '@/features/dashboard/presentation/components/period';

/** Bar colours cycled across the department chart (design `AD_DEPT` palette). */
const DEPT_BAR_COLORS: readonly string[] = [
  'var(--color-blue)',
  'var(--color-p-400)',
  'var(--color-g-500)',
  'var(--color-y-500)',
  'var(--color-blue-strong)',
  'var(--color-p-300)',
];

/** Short chart labels for common departments; anything else keeps its name. */
const DEPT_SHORT: Readonly<Record<string, string>> = {
  'General Medicine': 'Gen Med',
  Cardiology: 'Cardio',
  Orthopedics: 'Ortho',
  Pediatrics: 'Pedia',
  Neurology: 'Neuro',
  ENT: 'ENT',
  Dermatology: 'Derma',
};

/** The backend's top-doctors list is the five busiest. */
const PERF_ROWS = 5;

const PERF_COLUMNS = ['Doctor', 'Department', 'Appointments', 'Rating', 'Status'] as const;

/** A "Requires Attention" row (design's `ALERTS` items). */
interface Alert {
  readonly icon: IconName;
  readonly iconClass: string;
  readonly t: string;
  readonly s: string;
  readonly go: HospitalStaticView;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** Only the patient total is read, so one row per page is enough. */
const PATIENT_COUNT_PARAMS: PatientListParams = {
  page: 1,
  pageSize: 1,
  q: '',
  source: null,
  sortField: 'created_at',
  sortDirection: 'desc',
};

/** The latest settlement periods, unfiltered by date. */
const ALL_PERIODS: SettlementPeriodFilters = {};

const PAISE_PER_RUPEE = 100;

/** Sum of the periods' net payable, in rupees. */
function netRupees(periods: readonly SettlementPeriod[]): number {
  return periods.reduce((sum, p) => sum + p.netPayablePaise, 0) / PAISE_PER_RUPEE;
}

/**
 * Admin (hospital) dashboard — design `Dashboard.jsx` `AdminDashboard`.
 *
 * Figures come from `GET /hospital/dashboard/admin?period=…` (appointments,
 * revenue, department load, the five busiest doctors and the alert counts);
 * the doctor roster (H1) supplies active-doctor count, department, rating and
 * status. The patient register count comes from the patients list (H6) and
 * the settlement alerts from the latest settlement periods (H11).
 */
export function AdminDashboardScreen() {
  const navigate = useNavigate();
  const { role } = useParams();
  const activeRole = isHospitalRole(role) ? role : 'admin';
  const go = (view: HospitalStaticView): void => {
    navigate(hospitalPath(activeRole, view));
  };

  const [period, setPeriod] = useState<Period>('Today');
  const dashboard = useAdminDashboardQuery(PERIOD_CODE[period]);
  const doctors = useDoctorsQuery();
  const departments = useDepartmentsQuery();
  // Patient total from H6's list (one row is enough — only `total` is read);
  // settlement alerts from H11's latest periods.
  const patientsQuery = usePatientsQuery(PATIENT_COUNT_PARAMS);
  const periodsQuery = useSettlementPeriodsQuery(ALL_PERIODS);
  const periods = periodsQuery.data?.items ?? [];

  const refresh = async (): Promise<void> => {
    await Promise.all([dashboard.refetch(), doctors.refetch(), departments.refetch()]);
  };

  const loading = dashboard.isLoading;
  const data = dashboard.data;
  const periodWord = period === 'Today' ? 'today' : period.toLowerCase();

  const roster = doctors.data ?? [];
  const doctorById = new Map(roster.map((d) => [d.id, d] as const));
  const deptNameById = new Map((departments.data ?? []).map((d) => [d.id, d.name] as const));
  const activeDocs = roster.filter((d) => d.status === 'active').length;

  const deptData: readonly BarChartDatum[] = (data?.departments ?? []).map((d, i) => ({
    l: DEPT_SHORT[d.name] ?? d.name,
    v: d.appointments,
    color: DEPT_BAR_COLORS[i % DEPT_BAR_COLORS.length],
  }));

  const perfDocs = (data?.topDoctors ?? []).slice(0, PERF_ROWS).map((t) => {
    const doc = doctorById.get(t.doctorId);
    return {
      key: t.doctorId,
      name: t.name,
      dept: doc ? (deptNameById.get(doc.departmentId) ?? '—') : '—',
      appts: t.appointments,
      completed: t.completed,
      rating: doc?.ratingAvg != null ? doc.ratingAvg.toFixed(1) : null,
      status: doc ? DOCTOR_STATUS_BADGE[doc.status] : null,
    };
  });

  const KPIS: readonly StatCardData[] = [
    {
      icon: 'calendar-check',
      label: period === 'Today' ? 'Appointments Today' : 'Appointments',
      value: data?.appointmentsTotal ?? 0,
      sub: 'Online + walk-in',
      iconClass: 'bg-g-100 text-g-800',
      valueClass: 'text-g-800',
    },
    {
      icon: 'stethoscope',
      label: 'Active Doctors',
      value: doctors.isLoadingError ? '—' : String(activeDocs),
      sub: doctors.isLoadingError ? 'Doctor roster unavailable' : `of ${roster.length} on roster`,
      iconClass: 'bg-blue-soft-bg text-blue',
      valueClass: 'text-blue',
    },
    {
      icon: 'users',
      label: 'Total Patients',
      value: patientsQuery.data ? patientsQuery.data.total.toLocaleString('en-IN') : '—',
      sub: patientsQuery.isLoadingError
        ? 'Patient records unavailable'
        : 'Registered patient records',
      iconClass: 'bg-p-100 text-p-500',
      valueClass: 'text-p-500',
    },
    {
      icon: 'indian-rupee',
      label: period === 'Today' ? 'Revenue Today' : 'Revenue',
      value: moneyShort(data?.netRupees ?? 0),
      sub:
        data && data.refundedRupees > 0
          ? `Collected less ${money(data.refundedRupees)} refunded`
          : 'Desk + online prepaid, collected',
      iconClass: 'bg-y-100 text-y-800',
      valueClass: 'text-y-800',
    },
  ];

  const alerts = data?.alerts;
  const onHold = periods.filter((p) => p.status === 'on_hold');
  const awaitingPayout = periods.filter((p) => p.status === 'closed');
  const ALERTS: Alert[] = [];
  if (alerts && alerts.unpaidWalkInsToday > 0) {
    ALERTS.push({
      icon: 'indian-rupee',
      iconClass: 'bg-d-100 text-d-600',
      t: `${plural(alerts.unpaidWalkInsToday, 'walk-in payment')} pending`,
      s: 'Awaiting collection at the desk today',
      go: 'appointments',
    });
  }
  if (alerts && alerts.pendingApprovals > 0) {
    ALERTS.push({
      icon: 'calendar-check',
      iconClass: 'bg-blue-soft-bg text-blue',
      t: `${plural(alerts.pendingApprovals, 'booking')} awaiting approval`,
      s: 'Online requests the hospital has to confirm',
      go: 'appointments',
    });
  }
  if (alerts && alerts.pendingPatientChanges > 0) {
    ALERTS.push({
      icon: 'users',
      iconClass: 'bg-p-100 text-p-500',
      t: `${plural(alerts.pendingPatientChanges, 'patient change')} to review`,
      s: 'Profile edits patients asked for',
      go: 'patients',
    });
  }
  if (alerts && alerts.cashSessionsToReconcile > 0) {
    ALERTS.push({
      icon: 'scale',
      iconClass: 'bg-y-100 text-y-800',
      t: `${plural(alerts.cashSessionsToReconcile, 'cash session')} to reconcile`,
      s: 'Closed desk drawers awaiting a check',
      go: 'payments',
    });
  }
  if (onHold.length) {
    ALERTS.push({
      icon: 'triangle-alert',
      iconClass: 'bg-y-100 text-y-800',
      t: `${plural(onHold.length, 'settlement')} on hold`,
      s: `${money(netRupees(onHold))} held by Medibook`,
      go: 'settlements',
    });
  }
  if (awaitingPayout.length) {
    ALERTS.push({
      icon: 'scale',
      iconClass: 'bg-blue-soft-bg text-blue',
      t: `${plural(awaitingPayout.length, 'settlement')} awaiting payout`,
      s: `${money(netRupees(awaitingPayout))} expected from Medibook`,
      go: 'settlements',
    });
  }

  let perfState: TableStateSpec | undefined;
  if (loading) perfState = { kind: 'loading', rows: PERF_ROWS };
  else if (perfDocs.length === 0)
    perfState = {
      kind: 'empty',
      icon: 'stethoscope',
      title: `No consultations ${periodWord}.`,
      message: 'Doctors appear here once appointments are booked with them.',
      actionLabel: 'Manage staff',
      onAction: () => go('doctors'),
    };

  if (dashboard.isLoadingError && !data) {
    return (
      <ErrorState
        error={dashboard.error}
        title="The dashboard could not load"
        message={
          isFailure(dashboard.error)
            ? dashboard.error.message
            : 'Retrying usually fixes it — nothing has been lost.'
        }
        onRetry={() => void dashboard.refetch()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <OverviewHeader
        title="Hospital Overview"
        period={period}
        setPeriod={setPeriod}
        onRefresh={refresh}
      />
      {loading ? <SkeletonKpiStrip count={KPIS.length} /> : <KpiStrip items={KPIS} />}
      {/* Side by side on wide screens; stacked on tablets and small laptops (PERF-05). */}
      <div className="flex flex-col gap-5 xl:flex-row">
        <Card className="min-w-0 xl:flex-3">
          <SectionTitle size={16} className="mb-4.5">
            Appointments by Department — {period}
          </SectionTitle>
          {loading ? (
            <SkeletonTable rows={3} cols={3} card={false} />
          ) : deptData.length === 0 ? (
            <EmptyState
              compact
              icon="calendar-days"
              title={`No appointments ${periodWord}.`}
              message="Department load appears once bookings come in."
            />
          ) : (
            <BarChart data={deptData} height={210} />
          )}
          <div className="text-caption text-text-muted mt-3">
            Appointments per department {periodWord}, cancellations and no-shows excluded.
          </div>
        </Card>
        <Card className="min-w-0 xl:flex-2">
          <SectionTitle size={16} className="mb-4">
            Requires Attention
          </SectionTitle>
          {ALERTS.length === 0 ? (
            <EmptyState
              compact
              icon="circle-check"
              title="Nothing needs attention."
              message="No unpaid walk-ins, approvals, patient changes or cash sessions waiting."
              actionLabel="Open appointments"
              onAction={() => go('appointments')}
            />
          ) : (
            <div className="flex flex-col gap-3">
              {ALERTS.map((a) => (
                <button
                  type="button"
                  key={a.t}
                  onClick={() => go(a.go)}
                  className="border-border-soft hover:bg-grey-200 flex w-full cursor-pointer items-center gap-3 rounded-md border p-3 text-left transition-colors duration-150"
                >
                  <div
                    className={cn(
                      'flex size-9.5 flex-none items-center justify-center rounded-md',
                      a.iconClass,
                    )}
                  >
                    <Icon name={a.icon} size={19} />
                  </div>
                  <div className="flex-1">
                    <div className="text-body text-text-strong font-medium">{a.t}</div>
                    <div className="text-caption text-text-muted">{a.s}</div>
                  </div>
                  <Icon name="chevron-right" size={18} className="text-text-faint" />
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>
      <div className="flex flex-col gap-5 xl:flex-row">
        <Card className="min-w-0 xl:flex-2">
          <div className="mb-4 flex items-center justify-between">
            <SectionTitle size={16}>Doctor Performance</SectionTitle>
            <button
              type="button"
              onClick={() => go('doctors')}
              className="text-body text-blue cursor-pointer border-0 bg-transparent p-0 font-medium"
            >
              Manage Staff
            </button>
          </div>
          <TableShell
            columns={PERF_COLUMNS}
            rightCols={['Appointments']}
            state={perfState}
            scrollLabel="Doctor performance"
          >
            {perfDocs.map((r) => (
              <tr key={r.key}>
                <td className={cn(tdClass, 'text-text-strong font-medium')}>{r.name}</td>
                <td className={tdClass}>{r.dept}</td>
                <td className={cn(tdClass, 'text-right tabular-nums')}>{r.appts}</td>
                <td className={tdClass}>
                  {r.rating === null ? (
                    <span className="text-text-muted">—</span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <Icon name="star" size={14} color="var(--color-y-500)" /> {r.rating}
                    </span>
                  )}
                </td>
                <td className={tdClass}>
                  {r.status === null ? (
                    <span className="text-text-muted">Not on roster</span>
                  ) : (
                    <Badge status={r.status} />
                  )}
                </td>
              </tr>
            ))}
          </TableShell>
          <div className="text-caption text-text-muted mt-3">
            The five busiest doctors {periodWord}
            {perfDocs.length > 0 &&
              ` (${perfDocs.reduce((n, r) => n + r.completed, 0)} consultations completed)`}
            ; ratings and availability from the doctor roster.
          </div>
        </Card>
        <Card className="min-w-0 xl:flex-1">
          <SectionTitle size={16} className="mb-4">
            Appointments by Status — {period}
          </SectionTitle>
          {loading ? (
            <SkeletonTable rows={3} cols={3} card={false} />
          ) : (
            <BarChart data={statusBars(data?.appointmentsByStatus ?? {})} height={200} />
          )}
          <div className="text-caption text-text-muted mt-3">
            Every booking {periodWord} by where it stands now.
          </div>
        </Card>
      </div>
    </div>
  );
}
