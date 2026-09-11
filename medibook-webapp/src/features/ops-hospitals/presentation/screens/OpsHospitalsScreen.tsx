import { useCallback, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { opsHospitalDetailPath, opsOnboardingPath } from '@/app/router/paths';
import { useSort } from '@/shared/hooks/useSort';
import { cn } from '@/shared/lib/cn';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { ClearChip } from '@/shared/ui/ClearChip';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import { IconBtn } from '@/shared/ui/IconBtn';
import { OpsEntity } from '@/shared/ui/OpsEntity';
import type { OpsTint } from '@/shared/ui/OpsConfirm';
import { Pager } from '@/shared/ui/Pager';
import { RefreshBtn } from '@/shared/ui/RefreshBtn';
import { SearchField } from '@/shared/ui/SearchField';
import { StatCard, type StatCardData } from '@/shared/ui/StatCard';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';
import { Tabs } from '@/shared/ui/Tabs';

import { usePlansStore } from '@/features/ops-plans/application/store/plans.store';
import {
  hospName,
  useHospitalsStore,
} from '@/features/ops-hospitals/application/store/hospitals.store';
import { longDateFromIso } from '@/features/ops-hospitals/application/store/opsDates';

import { OnboardHospitalModal } from '@/features/ops-hospitals/presentation/components/OnboardHospitalModal';

/** Ops entity-cell tint cycle (design `opsTintOf`). */
const OPS_TINT_CYCLE: readonly OpsTint[] = ['primary', 'info', 'success', 'warning', 'neutral'];
const opsTintOf = (i: number): OpsTint => OPS_TINT_CYCLE[i % OPS_TINT_CYCLE.length];

const OPS_HOSP_PAGE = 6;

const COLUMNS = [
  'Hospital',
  'Plan',
  'Location',
  'Bookings / Mo',
  'Onboarded',
  'Status',
  'Action',
] as const;

/**
 * Hospital registry (design `Ops.jsx` `OpsHospitals`): KPI row, All / Pending
 * tabs, search + plan and status filters, sortable columns and pagination.
 *
 * Refresh now re-reads the registry and holds the table's loading rows while
 * it does (audit 3.1.1 — the button did nothing), the row action is named for
 * what it opens (3.3.2), the empty state is the shared one, and a suspended
 * instance says *why* it is suspended, so a suspension for non-payment is
 * visible from the list (SA-03).
 */
export function OpsHospitalsScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const hospitals = useHospitalsStore((s) => s.hospitals);
  const syncedAt = useHospitalsStore((s) => s.syncedAt);
  const resync = useHospitalsStore((s) => s.resync);
  const plans = usePlansStore((s) => s.plans);

  const [tab, setTab] = useState<'All' | 'Pending'>('All');
  const [q, setQ] = useState('');
  const [planF, setPlanF] = useState<string>(searchParams.get('plan') ?? 'All');
  const [statusF, setStatusF] = useState('All');
  const [page, setPage] = useState(0);
  const [onboard, setOnboard] = useState(false);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      await resync();
    } finally {
      setLoading(false);
    }
  }, [resync]);

  const pendingCt = hospitals.filter((h) => h.status === 'Pending verification').length;
  const suspended = hospitals.filter((h) => h.status === 'Suspended');
  const nonPayment = suspended.filter((h) => h.suspension?.reason === 'Non-payment').length;
  const ql = q.trim().toLowerCase();
  const filtered = hospitals.filter(
    (h) =>
      (tab !== 'Pending' || h.status === 'Pending verification') &&
      (!ql || h.name.toLowerCase().includes(ql) || h.city.toLowerCase().includes(ql)) &&
      (planF === 'All' || h.plan === planF) &&
      (tab === 'Pending' || statusF === 'All' || h.status === statusF),
  );
  const pg = Math.min(page, Math.max(0, Math.ceil(filtered.length / OPS_HOSP_PAGE) - 1));
  const { sort, onSort, sorted } = useSort<(typeof hospitals)[number]>();
  const ordered = sorted([...filtered], {
    name: (x) => x.name,
    plan: (x) => x.plan,
    bookings: (x) => x.bookings,
    onboarded: (x) => Date.parse(x.onboarded) || 0,
    status: (x) => x.status,
  });
  const rows = ordered.slice(pg * OPS_HOSP_PAGE, pg * OPS_HOSP_PAGE + OPS_HOSP_PAGE);

  const KPIS: readonly StatCardData[] = [
    {
      icon: 'building-2',
      label: 'Total Hospitals',
      value: hospitals.length,
      sub: 'All instances on the platform',
      iconClass: 'bg-blue-soft-bg text-text-navy',
      valueClass: 'text-text-navy',
    },
    {
      icon: 'circle-check',
      label: 'Active Instances',
      value: hospitals.filter((h) => h.status === 'Active').length,
      sub: 'Live and serving bookings',
      iconClass: 'bg-g-100 text-g-600',
      valueClass: 'text-g-600',
    },
    {
      icon: 'clock',
      label: 'Pending Verification',
      value: pendingCt,
      sub: 'Awaiting document review',
      iconClass: 'bg-y-100 text-y-600',
      valueClass: 'text-y-600',
    },
    {
      icon: 'ban',
      label: 'Suspended',
      value: suspended.length,
      sub:
        nonPayment > 0
          ? `${nonPayment} for non-payment · ${suspended.length - nonPayment} other`
          : 'Access paused by platform',
      iconClass: 'bg-badge-noshow-bg text-orange',
      valueClass: 'text-orange',
      subClass: 'text-text-muted',
    },
  ];

  const hasFilters = Boolean(ql) || planF !== 'All' || statusF !== 'All';
  const reset =
    (fn: (v: string) => void) =>
    (v: string): void => {
      fn(v);
      setPage(0);
    };
  const clearAll = () => {
    setQ('');
    setPlanF('All');
    setStatusF('All');
    setPage(0);
  };

  const tableState: TableStateSpec | undefined = loading
    ? { kind: 'loading', rows: OPS_HOSP_PAGE }
    : rows.length > 0
      ? undefined
      : hasFilters
        ? {
            kind: 'empty',
            icon: 'building-2',
            title: 'No results match your filters.',
            message: 'No hospital matches the current search, plan and status.',
            actionLabel: 'Clear filters',
            onAction: clearAll,
          }
        : {
            kind: 'empty',
            icon: 'building-2',
            title:
              tab === 'Pending'
                ? 'No hospitals are awaiting verification.'
                : 'No hospitals on the platform yet.',
            message:
              tab === 'Pending'
                ? 'Every application has been reviewed. New ones arrive through the onboarding pipeline.'
                : 'Onboard the first hospital to start the network.',
            actionLabel: tab === 'Pending' ? 'Open onboarding pipeline' : 'Onboard a hospital',
            onAction:
              tab === 'Pending' ? () => navigate(opsOnboardingPath()) : () => setOnboard(true),
          };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KPIS.map((k) => (
          <StatCard key={k.label} k={k} />
        ))}
      </div>
      <Card pad={14} className="flex flex-wrap items-center justify-between gap-4">
        <Tabs
          tabs={['All Hospitals', `Pending verification (${pendingCt})`]}
          value={tab === 'All' ? 'All Hospitals' : `Pending verification (${pendingCt})`}
          onChange={(v) => {
            setTab(v.startsWith('All') ? 'All' : 'Pending');
            setPage(0);
          }}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" icon="rocket" onClick={() => navigate(opsOnboardingPath())}>
            Onboarding Pipeline
          </Button>
          <Button icon="plus" onClick={() => setOnboard(true)}>
            Onboard Hospital
          </Button>
        </div>
      </Card>
      <Card>
        <div className="mb-4">
          <SearchField value={q} onChange={reset(setQ)} placeholder="Search hospital or city" />
        </div>
        <div className="mb-4.5 flex flex-wrap items-center gap-3">
          <RefreshBtn onRefresh={refresh} title="Refresh the hospital registry" />
          <FilterSelect
            value={planF}
            aria-label="Filter by subscription plan"
            options={['Plan: All', ...plans.map((p) => p.name)]}
            onChange={(v) => reset(setPlanF)(v === 'Plan: All' ? 'All' : v)}
          />
          {tab === 'All' && (
            <FilterSelect
              value={statusF}
              aria-label="Filter by instance status"
              options={['All', 'Active', 'Pending verification', 'Suspended', 'Rejected'].map((s) =>
                s === 'All' ? 'Status: All' : s,
              )}
              onChange={(v) => reset(setStatusF)(v === 'Status: All' ? 'All' : v)}
            />
          )}
          {hasFilters && <ClearChip onClick={clearAll} />}
          <div className="flex-1"></div>
          <span className="text-caption text-text-muted">Updated {syncedAt}</span>
        </div>
        <TableShell
          columns={COLUMNS}
          rightCols={['Bookings / Mo']}
          scrollLabel="Hospital registry"
          sortKeys={{
            Hospital: 'name',
            Plan: 'plan',
            'Bookings / Mo': 'bookings',
            Onboarded: 'onboarded',
            Status: 'status',
          }}
          sort={sort}
          onSort={onSort}
          state={tableState}
        >
          {rows.map((h) => (
            <tr
              key={h.id}
              onClick={() => navigate(opsHospitalDetailPath(h.id))}
              className="hover:bg-grey-200 cursor-pointer transition-colors duration-150"
            >
              <td className={tdClass}>
                <OpsEntity
                  icon="building-2"
                  tint={opsTintOf(h.id)}
                  title={hospName(h.id)}
                  sub={h.email}
                />
              </td>
              <td className={tdClass}>{h.plan}</td>
              <td className={tdClass}>
                {h.city}
                {h.st ? `, ${h.st}` : ''}
              </td>
              <td className={cn(tdClass, 'text-right tabular-nums')}>
                {h.bookings.toLocaleString('en-IN')}
              </td>
              <td className={tdClass}>{h.onboarded}</td>
              <td className={tdClass}>
                <Badge status={h.status} />
                {h.suspension && (
                  <div className="text-caption text-text-muted mt-1">
                    {h.suspension.reason} · since {longDateFromIso(h.suspension.since)}
                  </div>
                )}
              </td>
              <td className={tdClass} onClick={(e) => e.stopPropagation()}>
                <IconBtn
                  name="eye"
                  label="View hospital"
                  box={36}
                  size={16}
                  title={`Open ${h.name}`}
                  onClick={() => navigate(opsHospitalDetailPath(h.id))}
                />
              </td>
            </tr>
          ))}
        </TableShell>
        {rows.length > 0 && (
          <Pager
            total={filtered.length}
            page={pg}
            pageSize={OPS_HOSP_PAGE}
            onPage={setPage}
            noun="hospitals"
          />
        )}
      </Card>
      {onboard && (
        <OnboardHospitalModal
          open
          onClose={() => setOnboard(false)}
          onDone={() => {
            setOnboard(false);
            setTab('All');
            setQ('');
            setPlanF('All');
            setStatusF('All');
            setPage(0);
          }}
        />
      )}
    </div>
  );
}
