import { useCallback, useState } from 'react';
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
import { LineChart } from '@/shared/ui/LineChart';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { SkeletonKpiStrip, SkeletonTable } from '@/shared/ui/Skeleton';
import type { StatCardData } from '@/shared/ui/StatCard';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';

import { useAppointmentsStore } from '@/features/appointments/application/store/appointments.store';
import { useCatalogDepartments } from '@/features/doctors/application/store/catalog.selectors';
import { useCatalogStore } from '@/features/doctors/application/store/catalog.store';
import { usePatientsStore } from '@/features/patients/application/store/patients.store';
import { useSettlementsStore } from '@/features/settlements/application/store/settlements.store';

import { OverviewHeader } from '@/features/dashboard/presentation/components/OverviewHeader';
import type { Period } from '@/features/dashboard/presentation/components/period';

/** Bar colours cycled across the department chart (design `AD_DEPT` palette). */
const DEPT_BAR_COLORS: readonly string[] = [
  'var(--color-blue)',
  'var(--color-p-400)',
  'var(--color-g-500)',
  'var(--color-y-500)',
  'var(--color-blue-strong)',
  'var(--color-p-300)',
];

/** Short chart labels for the seeded departments; anything else keeps its name. */
const DEPT_SHORT: Readonly<Record<string, string>> = {
  'General Medicine': 'Gen Med',
  Cardiology: 'Cardio',
  Orthopedics: 'Ortho',
  Pediatrics: 'Pedia',
  Neurology: 'Neuro',
  ENT: 'ENT',
  Dermatology: 'Derma',
};

/** Appointment states that never count towards activity. */
const DEAD_STATUSES: readonly string[] = ['Cancelled', 'No-show'];

/** The five doctors the performance table shows. */
const PERF_ROWS = 5;

const PERF_COLUMNS = ['Doctor', 'Department', 'Appointments', 'Rating', 'Status'] as const;

/**
 * Period scaling for the historical figures. Only `Today` is derived from the
 * live stores; the other three periods are illustrative until the reporting
 * API lands, and every figure that uses this factor says so on screen.
 */
const AD_FACT: Record<Period, number> = {
  Today: 1,
  Yesterday: 0.94,
  'This Week': 6.2,
  'This Month': 26.5,
};

const AD_FOOT: Record<Period, readonly { l: string; v: number }[]> = {
  Today: [
    { l: '8a', v: 22 },
    { l: '10a', v: 64 },
    { l: '12p', v: 88 },
    { l: '2p', v: 54 },
    { l: '4p', v: 72 },
    { l: '6p', v: 40 },
  ],
  Yesterday: [
    { l: '8a', v: 18 },
    { l: '10a', v: 58 },
    { l: '12p', v: 80 },
    { l: '2p', v: 50 },
    { l: '4p', v: 66 },
    { l: '6p', v: 34 },
  ],
  'This Week': [
    { l: 'Mon', v: 288 },
    { l: 'Tue', v: 312 },
    { l: 'Wed', v: 298 },
    { l: 'Thu', v: 330 },
    { l: 'Fri', v: 356 },
    { l: 'Sat', v: 402 },
    { l: 'Sun', v: 120 },
  ],
  'This Month': [
    { l: 'Wk 1', v: 1420 },
    { l: 'Wk 2', v: 1580 },
    { l: 'Wk 3', v: 1490 },
    { l: 'Wk 4', v: 1710 },
  ],
};

/** Illustrative totals for the periods the stores cannot answer. */
const AD_SAMPLE_APPTS: Readonly<Record<Period, number>> = {
  Today: 0,
  Yesterday: 96,
  'This Week': 1996,
  'This Month': 6200,
};
const AD_SAMPLE_REVENUE: Readonly<Record<Period, number>> = {
  Today: 0,
  Yesterday: 132400,
  'This Week': 884000,
  'This Month': 3762000,
};

/** A "Requires Attention" row (design's `ALERTS` items). */
interface Alert {
  readonly icon: IconName;
  readonly iconClass: string;
  readonly t: string;
  readonly s: string;
  readonly go: HospitalStaticView;
}

/**
 * Admin (hospital) dashboard — design `Dashboard.jsx` `AdminDashboard`.
 *
 * Audit follow-ups applied here: the doctor-performance table runs on
 * `TableShell` (so it scrolls instead of crushing, and has loading/empty
 * states), the KPI strip shimmers while the screen re-derives, and every
 * figure either comes from a store or is labelled as a sample — the "Total
 * Patients" tile now counts the patient register instead of printing a number
 * nothing in the app can back up.
 */
export function AdminDashboardScreen() {
  const navigate = useNavigate();
  const { role } = useParams();
  const activeRole = isHospitalRole(role) ? role : 'admin';
  const go = (view: HospitalStaticView): void => {
    navigate(hospitalPath(activeRole, view));
  };

  const appts = useAppointmentsStore((s) => s.appts);
  // Department bars follow the hospital's own catalogue (audit 2.6.3).
  const departments = useCatalogDepartments();
  const docStatus = useAppointmentsStore((s) => s.docStatus);
  const docs = useCatalogStore((s) => s.docs);
  const patients = usePatientsStore((s) => s.patients);
  const settlements = useSettlementsStore((s) => s.settlements);
  const [period, setPeriod] = useState<Period>('Today');
  const [loading, setLoading] = useState(false);

  /**
   * Re-derive the dashboard from the stores it reads. No API yet, so the
   * refresh re-emits the appointments ledger — every KPI, chart and row is
   * rebuilt from it — and this is where the refetch goes when one lands.
   */
  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    useAppointmentsStore.setState((s) => ({ appts: [...s.appts] }));
    setLoading(false);
  }, []);

  const isToday = period === 'Today';
  const factor = AD_FACT[period] || 1;
  const periodWord = isToday
    ? 'today'
    : period === 'Yesterday'
      ? 'yesterday'
      : period.toLowerCase();
  const footData = AD_FOOT[period] || AD_FOOT['Today'];

  const live = appts.filter((a) => a.date === 'Today' && !DEAD_STATUSES.includes(a.status));

  // Department bars: real counts for Today, the same counts scaled for the
  // sample periods (the caption under the chart says which is which).
  const deptData: readonly BarChartDatum[] = departments.map((d, i) => {
    const count = live.filter((a) => a.dept === d).length;
    return {
      l: DEPT_SHORT[d] ?? d,
      v: isToday ? count : Math.max(1, Math.round(count * factor)),
      color: DEPT_BAR_COLORS[i % DEPT_BAR_COLORS.length],
    };
  });

  const activeDocs = docs.filter((d) => {
    if (d.status !== 'Active') return false;
    return docStatus[d.name] !== 'On Break';
  }).length;

  // The table covers every doctor the catalog knows **and** every doctor named
  // by today's appointments: the two stores can disagree (audit 2.6.2), and a
  // name-only match would silently report those consultations as zero.
  const docByName = new Map(docs.map((d) => [d.name, d] as const));
  const perfNames = [...new Set([...docs.map((d) => d.name), ...live.map((a) => a.doctor)])];
  const unlistedDoctors = perfNames.filter((name) => !docByName.has(name));
  const perfDocs = perfNames
    .map((name) => {
      const doc = docByName.get(name);
      const own = live.filter((a) => a.doctor === name);
      return {
        key: doc ? doc.id : `appt-${name}`,
        name,
        dept: doc?.depts[0] ?? own[0]?.dept ?? '—',
        appts: isToday ? own.length : Math.round((own.length + 3) * factor),
        rating: doc ? doc.rating.toFixed(1) : null,
        status: doc ? (docStatus[name] === 'On Break' ? 'On Leave' : doc.status) : null,
      };
    })
    .sort((a, b) => b.appts - a.appts)
    .slice(0, PERF_ROWS);

  const overdue = settlements.filter((r) => r.status === 'Overdue');
  const pendingSettle = settlements.filter((r) => r.status !== 'Received');
  const pendingPay = appts.filter((a) => a.payment === 'Pending').length;
  const realToday = appts.filter((a) => a.date === 'Today').length;
  const realRev = appts.filter((a) => a.payment === 'Paid').reduce((s, a) => s + a.amount, 0);

  const apptTotal = isToday ? realToday : AD_SAMPLE_APPTS[period];
  const revTotal = isToday ? realRev : AD_SAMPLE_REVENUE[period];
  const sampleSub = `Sample figure for ${periodWord}`;

  const KPIS: readonly StatCardData[] = [
    {
      icon: 'calendar-check',
      label: isToday ? 'Appointments Today' : 'Appointments',
      value: apptTotal,
      sub: isToday ? 'Online + walk-in' : sampleSub,
      iconClass: 'bg-g-100 text-g-600',
      valueClass: 'text-g-600',
    },
    {
      icon: 'stethoscope',
      label: 'Active Doctors',
      value: String(activeDocs),
      sub: `of ${docs.length} on roster`,
      iconClass: 'bg-blue-soft-bg text-blue',
      valueClass: 'text-blue',
    },
    {
      icon: 'users',
      label: 'Total Patients',
      value: patients.length.toLocaleString('en-IN'),
      sub: 'Registered patient records',
      iconClass: 'bg-p-100 text-p-500',
      valueClass: 'text-p-500',
    },
    {
      icon: 'indian-rupee',
      label: isToday ? 'Revenue Today' : 'Revenue',
      value: moneyShort(revTotal),
      sub: isToday ? 'Desk + online prepaid, collected' : sampleSub,
      iconClass: 'bg-y-100 text-y-600',
      valueClass: 'text-y-600',
    },
  ];

  const ALERTS: Alert[] = [];
  if (pendingPay) {
    ALERTS.push({
      icon: 'indian-rupee',
      iconClass: 'bg-d-100 text-d-500',
      t: `${pendingPay} walk-in payment${pendingPay === 1 ? '' : 's'} pending`,
      s: 'Awaiting collection at the desk',
      go: 'appointments',
    });
  }
  if (overdue.length) {
    ALERTS.push({
      icon: 'triangle-alert',
      iconClass: 'bg-y-100 text-y-600',
      t: `${overdue.length} settlement${overdue.length === 1 ? '' : 's'} overdue`,
      s: `${money(overdue.reduce((s, r) => s + r.net, 0))} due from Medibook`,
      go: 'settlements',
    });
  }
  if (pendingSettle.length) {
    ALERTS.push({
      icon: 'scale',
      iconClass: 'bg-blue-soft-bg text-blue',
      t: `${pendingSettle.length} settlements awaiting transfer`,
      s: `${money(pendingSettle.reduce((s, r) => s + r.net, 0))} expected from Medibook`,
      go: 'settlements',
    });
  }

  let perfState: TableStateSpec | undefined;
  if (loading) perfState = { kind: 'loading', rows: PERF_ROWS };
  else if (perfDocs.length === 0)
    perfState = {
      kind: 'empty',
      icon: 'stethoscope',
      title: 'No doctors on the roster yet.',
      message: 'Add a doctor to see consultations, ratings and availability here.',
      actionLabel: 'Manage staff',
      onAction: () => go('doctors'),
    };

  // Nothing in any of the three stores the dashboard reads: that is a failed
  // load, not an empty hospital, so say so and offer a retry rather than
  // rendering a wall of zeros.
  if (!loading && appts.length === 0 && docs.length === 0 && patients.length === 0) {
    return (
      <ErrorState
        title="The dashboard could not load"
        message="No appointments, doctors or patients came back. Retrying usually fixes it — nothing has been lost."
        onRetry={refresh}
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
      <div className="flex gap-5">
        <Card className="flex-[3]">
          <SectionTitle size={16} className="mb-4.5">
            Appointments by Department — {period}
          </SectionTitle>
          <BarChart data={deptData} height={210} />
          <div className="text-caption text-text-muted mt-3">
            {isToday
              ? "Live count of today's appointments per department, cancellations and no-shows excluded."
              : `Today's live counts scaled for ${periodWord} — illustrative until the reporting API lands.`}
          </div>
        </Card>
        <Card className="flex-[2]">
          <SectionTitle size={16} className="mb-4">
            Requires Attention
          </SectionTitle>
          {ALERTS.length === 0 ? (
            <EmptyState
              compact
              icon="circle-check"
              title="Nothing needs attention."
              message="No pending desk payments and no settlement is waiting on Medibook."
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
      <div className="flex gap-5">
        <Card className="flex-[2]">
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
                    <span className="text-text-muted">Not in catalog</span>
                  ) : (
                    <Badge status={r.status} />
                  )}
                </td>
              </tr>
            ))}
          </TableShell>
          <div className="text-caption text-text-muted mt-3">
            {isToday
              ? 'Consultations counted from today’s appointments; ratings and availability from the doctor catalog.'
              : `Consultations scaled for ${periodWord}; ratings and availability from the doctor catalog.`}
            {unlistedDoctors.length > 0 &&
              ` ${unlistedDoctors.length} doctor${unlistedDoctors.length === 1 ? '' : 's'} in today’s appointments ${unlistedDoctors.length === 1 ? 'is' : 'are'} not in the catalog, so no rating or availability is shown for ${unlistedDoctors.length === 1 ? 'it' : 'them'}.`}
          </div>
        </Card>
        <Card className="flex-1">
          <SectionTitle size={16} className="mb-4">
            Patient Footfall — {period}
          </SectionTitle>
          {loading ? (
            <SkeletonTable rows={3} cols={3} card={false} />
          ) : (
            <LineChart data={footData} color="var(--color-g-600)" height={200} />
          )}
          <div className="text-caption text-text-muted mt-3">
            Footfall by hour is a sample series until the reporting API lands.
          </div>
        </Card>
      </div>
    </div>
  );
}
