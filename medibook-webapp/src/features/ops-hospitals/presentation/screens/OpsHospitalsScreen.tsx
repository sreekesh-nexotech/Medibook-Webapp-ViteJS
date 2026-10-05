import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { opsOnboardingPath, opsPath } from '@/app/router/paths';
import { isFailure } from '@/core/error/failure';
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

import { usePlansQuery } from '@/features/ops-plans/application/queries/usePlansQuery';
import { useHospitalStatusCountsQuery } from '@/features/ops-hospitals/application/queries/useHospitalStatusCountsQuery';
import { useHospitalsQuery } from '@/features/ops-hospitals/application/queries/useHospitalsQuery';
import {
  longDateFromTimestamp,
  opsStampFrom,
} from '@/features/ops-hospitals/presentation/components/hospitals.dates';
import type { HospitalListQuery } from '@/features/ops-hospitals/domain/entities/hospitals.entity';

import { OnboardHospitalModal } from '@/features/ops-hospitals/presentation/components/OnboardHospitalModal';
import {
  HOSPITAL_PENDING_STATUSES,
  HOSPITAL_STATUS_FILTER,
  HOSPITAL_STATUS_VIEW,
  hospitalDetailHref,
} from '@/features/ops-hospitals/presentation/components/hospitals.view';
import { useHospitalsDebouncedValue } from '@/features/ops-hospitals/presentation/components/useHospitalsDebouncedValue';

/** Ops entity-cell tint cycle (design `opsTintOf`). */
const OPS_TINT_CYCLE: readonly OpsTint[] = ['primary', 'info', 'success', 'warning', 'neutral'];
const opsTintOf = (i: number): OpsTint => OPS_TINT_CYCLE[i % OPS_TINT_CYCLE.length];

const OPS_HOSP_PAGE = 6;

const SEARCH_DEBOUNCE_MS = 300;

/** Shown in a cell or KPI the backend has no value for. */
const NO_VALUE = '—';

const COLUMNS = [
  'Hospital',
  'Plan',
  'Location',
  'Bookings / Mo',
  'Onboarded',
  'Status',
  'Action',
] as const;

/** Sortable column keys → backend `sort` fields (`PlatformHospitalListView.spec.sorts`). */
const SORT_FIELD: Readonly<Record<string, string>> = {
  name: 'name',
  onboarded: 'created_at',
  status: 'status',
};

/**
 * Hospital registry (design `Ops.jsx` `OpsHospitals`): KPI row, All / Pending
 * tabs, search + plan and status filters, sortable columns and pagination —
 * all served by `GET /platform/hospitals` (search, filters, sort and paging
 * run on the server).
 *
 * The registry rows carry no plan or booking volume, so those two columns
 * show a dash; the plan *filter* still works (`plan_id`).
 */
export function OpsHospitalsScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const plansQuery = usePlansQuery();
  const plans = plansQuery.data ?? [];

  const [tab, setTab] = useState<'All' | 'Pending'>('All');
  const [q, setQ] = useState('');
  const [planF, setPlanF] = useState<string>(searchParams.get('plan') ?? 'All');
  const [statusF, setStatusF] = useState('All');
  const [page, setPage] = useState(0);
  const [onboard, setOnboard] = useState(false);
  const { sort, onSort } = useSort();

  const debouncedQ = useHospitalsDebouncedValue(q.trim(), SEARCH_DEBOUNCE_MS);
  const planId = planF === 'All' ? null : (plans.find((p) => p.name === planF)?.id ?? null);
  /* A plan filter waits for the catalogue, so the list never shows unfiltered rows under it;
   * a plan name the catalogue doesn't have (a stale `?plan=` link) matches nothing. */
  const isPlanResolved = planF === 'All' || planId !== null;
  const isUnknownPlan = !isPlanResolved && plansQuery.isSuccess;
  const sortField = sort.key ? SORT_FIELD[sort.key] : undefined;

  const listQuery: HospitalListQuery = {
    page: page + 1,
    pageSize: OPS_HOSP_PAGE,
    q: debouncedQ,
    statuses:
      tab === 'Pending'
        ? HOSPITAL_PENDING_STATUSES
        : statusF === 'All'
          ? []
          : (HOSPITAL_STATUS_FILTER[statusF] ?? []),
    planId,
    sort: sortField ? `${sort.dir === 'desc' ? '-' : ''}${sortField}` : null,
  };
  const hospitals = useHospitalsQuery(listQuery, isPlanResolved);
  const counts = useHospitalStatusCountsQuery();

  const refresh = async (): Promise<void> => {
    await Promise.all([hospitals.refetch(), counts.refetch()]);
  };

  const rows = isUnknownPlan ? [] : (hospitals.data?.items ?? []);
  const total = hospitals.data?.total ?? 0;
  const pendingCt = counts.data?.pending;
  const kpi = (value: number | undefined) => (value === undefined ? NO_VALUE : value);

  const KPIS: readonly StatCardData[] = [
    {
      icon: 'building-2',
      label: 'Total Hospitals',
      value: kpi(counts.data?.total),
      sub: 'All instances on the platform',
      iconClass: 'bg-blue-soft-bg text-text-navy',
      valueClass: 'text-text-navy',
    },
    {
      icon: 'circle-check',
      label: 'Active Instances',
      value: kpi(counts.data?.active),
      sub: 'Live and serving bookings',
      iconClass: 'bg-g-100 text-g-600',
      valueClass: 'text-g-600',
    },
    {
      icon: 'clock',
      label: 'Pending Verification',
      value: kpi(pendingCt),
      sub: 'Awaiting document review',
      iconClass: 'bg-y-100 text-y-600',
      valueClass: 'text-y-600',
    },
    {
      icon: 'ban',
      label: 'Suspended',
      value: kpi(counts.data?.suspended),
      sub: 'Access paused by platform',
      iconClass: 'bg-badge-noshow-bg text-orange',
      valueClass: 'text-orange',
      subClass: 'text-text-muted',
    },
  ];

  const hasFilters = Boolean(q.trim()) || planF !== 'All' || statusF !== 'All';
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
  const pendingTabLabel = `Pending verification (${pendingCt ?? NO_VALUE})`;

  const listError = isPlanResolved ? hospitals.error : plansQuery.error;
  const tableState: TableStateSpec | undefined =
    (isPlanResolved && hospitals.isError) || (!isPlanResolved && plansQuery.isError)
      ? {
          kind: 'error',
          title: "The hospital registry didn't load",
          message: isFailure(listError) ? listError.message : undefined,
          onRetry: () => void (isPlanResolved ? hospitals.refetch() : plansQuery.refetch()),
        }
      : !isUnknownPlan &&
          (hospitals.isPending || (hospitals.isFetching && hospitals.isPlaceholderData))
        ? { kind: 'loading', rows: OPS_HOSP_PAGE }
        : !isUnknownPlan && rows.length > 0
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

  const openHospital = (id: string) => navigate(hospitalDetailHref(opsPath('hospitals'), id));

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KPIS.map((k) => (
          <StatCard key={k.label} k={k} />
        ))}
      </div>
      <Card pad={14} className="flex flex-wrap items-center justify-between gap-4">
        <Tabs
          tabs={['All Hospitals', pendingTabLabel]}
          value={tab === 'All' ? 'All Hospitals' : pendingTabLabel}
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
          <SearchField value={q} onChange={reset(setQ)} placeholder="Search hospital name" />
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
              options={['All', ...Object.keys(HOSPITAL_STATUS_FILTER)].map((s) =>
                s === 'All' ? 'Status: All' : s,
              )}
              onChange={(v) => reset(setStatusF)(v === 'Status: All' ? 'All' : v)}
            />
          )}
          {hasFilters && <ClearChip onClick={clearAll} />}
          <div className="flex-1"></div>
          {hospitals.dataUpdatedAt > 0 && (
            <span className="text-caption text-text-muted">
              Updated {opsStampFrom(hospitals.dataUpdatedAt)}
            </span>
          )}
        </div>
        <TableShell
          columns={COLUMNS}
          rightCols={['Bookings / Mo']}
          scrollLabel="Hospital registry"
          sortKeys={{
            Hospital: 'name',
            Onboarded: 'onboarded',
            Status: 'status',
          }}
          sort={sort}
          onSort={(key) => {
            onSort(key);
            setPage(0);
          }}
          state={tableState}
        >
          {rows.map((h, i) => {
            const [badge, label] = HOSPITAL_STATUS_VIEW[h.status];
            return (
              <tr
                key={h.id}
                onClick={() => openHospital(h.id)}
                className="hover:bg-grey-200 cursor-pointer transition-colors duration-150"
              >
                <td className={tdClass}>
                  <OpsEntity icon="building-2" tint={opsTintOf(i)} title={h.name} sub={h.email} />
                </td>
                <td className={tdClass}>{NO_VALUE}</td>
                <td className={tdClass}>
                  {h.city}
                  {h.state ? `, ${h.state}` : ''}
                </td>
                <td className={cn(tdClass, 'text-right tabular-nums')}>{NO_VALUE}</td>
                <td className={tdClass}>{longDateFromTimestamp(h.createdAt)}</td>
                <td className={tdClass}>
                  <Badge status={badge}>{label}</Badge>
                </td>
                <td className={tdClass} onClick={(e) => e.stopPropagation()}>
                  <IconBtn
                    name="eye"
                    label="View hospital"
                    box={36}
                    size={16}
                    title={`Open ${h.name}`}
                    onClick={() => openHospital(h.id)}
                  />
                </td>
              </tr>
            );
          })}
        </TableShell>
        {rows.length > 0 && !tableState && (
          <Pager
            total={total}
            page={page}
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
          onDone={(hospital) => {
            setOnboard(false);
            navigate(hospitalDetailHref(opsPath('hospitals'), hospital.id));
          }}
        />
      )}
    </div>
  );
}
