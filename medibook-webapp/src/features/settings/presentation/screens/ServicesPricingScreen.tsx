import { useMemo, useState } from 'react';

import { isFailure } from '@/core/error/failure';

import { usePermission } from '@/shared/hooks/usePermission';
import { useSort } from '@/shared/hooks/useSort';
import { cn } from '@/shared/lib/cn';
import { downloadCsv } from '@/shared/lib/download';
import { fmtDate, money, rupeesFixed, todayISO } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Can } from '@/shared/ui/Can';
import { Card } from '@/shared/ui/Card';
import { ConfirmModal } from '@/shared/ui/ConfirmModal';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import { Icon } from '@/shared/ui/Icon';
import { IconBtn } from '@/shared/ui/IconBtn';
import { InfoDot } from '@/shared/ui/InfoDot';
import { KpiStrip } from '@/shared/ui/KpiStrip';
import { Pager } from '@/shared/ui/Pager';
import { RefreshBtn } from '@/shared/ui/RefreshBtn';
import { SearchField } from '@/shared/ui/SearchField';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { SegTabs } from '@/shared/ui/SegTabs';
import { SkeletonKpiStrip, SkeletonTable } from '@/shared/ui/Skeleton';
import type { StatCardData } from '@/shared/ui/StatCard';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';
import { toast } from '@/shared/ui/toast/toast.store';
import { Toggle } from '@/shared/ui/Toggle';

import { useDepartmentsQuery } from '@/features/doctors/application/queries/useDepartmentsQuery';
import {
  useDeleteCouponMutation,
  useDeleteServiceMutation,
  useDeleteTaxRateMutation,
  useSaveCouponMutation,
  useSaveServiceMutation,
  useSaveTaxRateMutation,
} from '@/features/settings/application/queries/services.mutations';
import {
  useCouponsQuery,
  useServicesQuery,
  useTaxRatesQuery,
} from '@/features/settings/application/queries/services.queries';
import type {
  CouponInput,
  HospitalCoupon,
  PricedService,
  ServiceInput,
  ServiceTaxRate,
  TaxRateInput,
} from '@/features/settings/domain/entities/services.entities';
import {
  couponDiscount,
  couponState,
  lastValidDay,
  localDay,
  priceService,
  serviceTaxOptions,
} from '@/features/settings/domain/services.pricing';
import { CouponModal } from '@/features/settings/presentation/components/CouponModal';
import { ServiceModal } from '@/features/settings/presentation/components/ServiceModal';
import {
  appliesToLabel,
  taxLabel,
} from '@/features/settings/presentation/components/services.labels';
import { TaxModal } from '@/features/settings/presentation/components/TaxModal';

type PricingTab = 'Services' | 'Taxes' | 'Coupons';

const TABS: readonly PricingTab[] = ['Services', 'Taxes', 'Coupons'];

const SERVICE_PAGE_SIZE = 8;
const COUPON_PAGE_SIZE = 6;

/** A sample order the coupon table prices a percent discount against. */
const SAMPLE_ORDER = 2000;

/** The amount the tax list previews each rate on. */
const TAX_PREVIEW_AMOUNT = 1000;

/** How many services the receipt preview shows. */
const RECEIPT_PREVIEW_ROWS = 3;

function failureText(error: unknown, fallback: string): string {
  return isFailure(error) ? error.message : fallback;
}

/** The input that re-saves a service unchanged except for `isActive`. */
function serviceInputOf(s: PricedService, isActive: boolean): ServiceInput {
  return {
    name: s.name,
    departmentId: s.departmentId,
    description: s.description,
    durationMinutes: s.durationMinutes,
    priceRupees: s.priceRupees,
    taxRateId: s.taxRateId,
    isActive,
  };
}

function taxInputOf(t: ServiceTaxRate, isActive: boolean): TaxRateInput {
  return {
    name: t.name,
    percent: t.percent,
    isInclusive: t.isInclusive,
    appliesTo: t.appliesTo,
    isActive,
  };
}

function couponInputOf(c: HospitalCoupon, isActive: boolean): CouponInput {
  return {
    code: c.code,
    kind: c.kind,
    value: c.value,
    validFrom: c.validFrom,
    validTo: c.validTo,
    usageCap: c.usageCap,
    minOrderRupees: c.minOrderRupees,
    departmentIds: c.departmentIds,
    serviceIds: c.serviceIds,
    isActive,
  };
}

const ANY_DEPT = 'Department: All';
const ANY_STATE = 'Status: All';

const SERVICE_COLUMNS = [
  'Service',
  'Department',
  'Duration',
  'Price',
  'With tax',
  'Bookable',
  '',
] as const;

const SERVICE_SORT_KEYS: Readonly<Record<string, string>> = {
  Service: 'name',
  Department: 'dept',
  Duration: 'duration',
  Price: 'price',
  'With tax': 'price',
};

const COUPON_COLUMNS = [
  'Code',
  'Discount',
  'Applies to',
  'Validity',
  'Usage',
  'Min order',
  'Status',
  '',
] as const;

const COUPON_SORT_KEYS: Readonly<Record<string, string>> = {
  Code: 'code',
  Discount: 'value',
  Validity: 'from',
  Usage: 'used',
  'Min order': 'minOrder',
  Status: 'state',
};

/** Which record a destructive confirm is about. */
interface DeleteTarget {
  readonly kind: PricingTab;
  readonly id: string;
  /** Row version for `If-Match` on tax-rate and coupon deletes (services take none). */
  readonly version: number;
  readonly label: string;
}

/**
 * Services & Pricing — audit HA-04 (§2.4): "A department carries one base fee.
 * Services, per-service pricing, taxes and coupons have no screen."
 *
 * Three tabs over the hospital API: the service catalogue with its own prices
 * and tax rate, the tax rates (the hospital's own plus read-only platform
 * defaults), and the coupons the desk may apply. Every price shown is run
 * through `priceService` — the backend's per-service tax rule — so what the
 * table says is what a receipt would total.
 */
export function ServicesPricingScreen() {
  const servicesQuery = useServicesQuery();
  const taxRatesQuery = useTaxRatesQuery();
  const couponsQuery = useCouponsQuery();
  const departmentsQuery = useDepartmentsQuery();
  const saveService = useSaveServiceMutation();
  const deleteService = useDeleteServiceMutation();
  const saveTax = useSaveTaxRateMutation();
  const deleteTax = useDeleteTaxRateMutation();
  const saveCoupon = useSaveCouponMutation();
  const deleteCoupon = useDeleteCouponMutation();

  const services = useMemo(() => servicesQuery.data ?? [], [servicesQuery.data]);
  const taxes = useMemo(() => taxRatesQuery.data ?? [], [taxRatesQuery.data]);
  const coupons = useMemo(() => couponsQuery.data ?? [], [couponsQuery.data]);
  const departments = useMemo(() => departmentsQuery.data ?? [], [departmentsQuery.data]);
  const today = todayISO();

  const { can } = usePermission();
  const mayEdit = can('Hospital Settings.edit');

  const [tab, setTab] = useState<PricingTab>('Services');
  const [q, setQ] = useState('');
  const [dept, setDept] = useState(ANY_DEPT);
  const [state, setState] = useState(ANY_STATE);
  const [page, setPage] = useState(0);

  const [serviceEdit, setServiceEdit] = useState<{ service: PricedService | null } | null>(null);
  const [taxEdit, setTaxEdit] = useState<{ tax: ServiceTaxRate | null } | null>(null);
  const [couponEdit, setCouponEdit] = useState<{ coupon: HospitalCoupon | null } | null>(null);
  const [toDelete, setToDelete] = useState<DeleteTarget | null>(null);

  const departmentNames = useMemo(() => departments.map((d) => d.name), [departments]);
  const deptNameById = useMemo(
    () => new Map(departments.map((d) => [d.id, d.name])),
    [departments],
  );
  const deptName = (id: string | null): string => (id ? (deptNameById.get(id) ?? '—') : 'All');
  const selectedDeptId = departments.find((d) => d.name === dept)?.id ?? null;
  const taxById = useMemo(() => new Map(taxes.map((t) => [t.id, t])), [taxes]);
  const taxOf = (s: PricedService): ServiceTaxRate | null =>
    s.taxRateId ? (taxById.get(s.taxRateId) ?? null) : null;
  const activeTaxes = useMemo(() => taxes.filter((t) => t.isActive), [taxes]);
  const taxOptions = useMemo(() => serviceTaxOptions(taxes), [taxes]);

  /** "All services" / "Cardiology · 2 services" — any scope may match. */
  const scopeCopy = (c: HospitalCoupon): string => {
    const parts: string[] = [];
    if (c.departmentIds.length > 0)
      parts.push(c.departmentIds.map((id) => deptName(id)).join(', '));
    if (c.serviceIds.length > 0) {
      const names = c.serviceIds
        .map((id) => services.find((x) => x.id === id)?.name)
        .filter((n): n is string => Boolean(n));
      parts.push(names.length <= 2 ? names.join(', ') : `${names.length} services`);
    }
    return parts.length === 0 ? 'All services' : parts.join(' or ');
  };

  const serviceSort = useSort<PricedService>({ key: 'name', dir: 'asc' });
  const couponSort = useSort<HospitalCoupon>({ key: 'from', dir: 'desc' });

  const ql = q.trim().toLowerCase();
  const hasFilters = ql !== '' || dept !== ANY_DEPT || state !== ANY_STATE;

  const filteredServices = useMemo(
    () =>
      services.filter(
        (s) =>
          (ql === '' ||
            s.name.toLowerCase().includes(ql) ||
            (deptNameById.get(s.departmentId ?? '') ?? '').toLowerCase().includes(ql) ||
            s.description.toLowerCase().includes(ql)) &&
          (dept === ANY_DEPT || s.departmentId === selectedDeptId) &&
          (state === ANY_STATE ||
            (state === 'Bookable' ? s.isActive : state === 'Retired' ? !s.isActive : true)),
      ),
    [services, deptNameById, ql, dept, selectedDeptId, state],
  );

  const filteredCoupons = useMemo(
    () =>
      coupons.filter(
        (c) =>
          (ql === '' ||
            c.code.toLowerCase().includes(ql) ||
            c.departmentIds
              .map((id) => deptNameById.get(id) ?? '')
              .join(' ')
              .toLowerCase()
              .includes(ql)) &&
          (dept === ANY_DEPT ||
            c.departmentIds.length === 0 ||
            (selectedDeptId !== null && c.departmentIds.includes(selectedDeptId))) &&
          (state === ANY_STATE || couponState(c, today) === state),
      ),
    [coupons, deptNameById, ql, dept, selectedDeptId, state, today],
  );

  const orderedServices = serviceSort.sorted([...filteredServices], {
    name: (s) => s.name,
    dept: (s) => deptName(s.departmentId),
    duration: (s) => s.durationMinutes,
    price: (s) => s.priceRupees,
  });

  const orderedCoupons = couponSort.sorted([...filteredCoupons], {
    code: (c) => c.code,
    value: (c) => c.value,
    from: (c) => c.validFrom,
    used: (c) => c.usedCount,
    minOrder: (c) => c.minOrderRupees,
    state: (c) => couponState(c, today),
  });

  const servicePage = Math.min(
    page,
    Math.max(0, Math.ceil(orderedServices.length / SERVICE_PAGE_SIZE) - 1),
  );
  const serviceRows = orderedServices.slice(
    servicePage * SERVICE_PAGE_SIZE,
    (servicePage + 1) * SERVICE_PAGE_SIZE,
  );

  const couponPage = Math.min(
    page,
    Math.max(0, Math.ceil(orderedCoupons.length / COUPON_PAGE_SIZE) - 1),
  );
  const couponRows = orderedCoupons.slice(
    couponPage * COUPON_PAGE_SIZE,
    (couponPage + 1) * COUPON_PAGE_SIZE,
  );

  const clearFilters = (): void => {
    setQ('');
    setDept(ANY_DEPT);
    setState(ANY_STATE);
    setPage(0);
  };

  const switchTab = (next: PricingTab): void => {
    setTab(next);
    clearFilters();
  };

  /** Re-read everything this screen shows from the server. */
  const refresh = async (): Promise<void> => {
    await Promise.all([
      servicesQuery.refetch(),
      taxRatesQuery.refetch(),
      couponsQuery.refetch(),
      departmentsQuery.refetch(),
    ]);
  };

  /** Run a save; toast the failure and resolve `false` so the modal stays open. */
  const persist = async (run: () => Promise<unknown>, done: string): Promise<boolean> => {
    try {
      await run();
      toast(done, 'success');
      return true;
    } catch (error) {
      toast(failureText(error, 'Could not save. Please try again.'), 'error');
      return false;
    }
  };

  const toggleService = (s: PricedService): void => {
    saveService.mutate(
      { input: serviceInputOf(s, !s.isActive), existing: { id: s.id, version: s.version } },
      { onError: (error) => toast(failureText(error, 'Could not update the service.'), 'error') },
    );
  };

  const toggleTax = (t: ServiceTaxRate): void => {
    saveTax.mutate(
      { input: taxInputOf(t, !t.isActive), existing: { id: t.id, version: t.version } },
      { onError: (error) => toast(failureText(error, 'Could not update the tax rate.'), 'error') },
    );
  };

  const toggleCoupon = (c: HospitalCoupon): void => {
    saveCoupon.mutate(
      { input: couponInputOf(c, !c.isActive), existing: { id: c.id, version: c.version } },
      { onError: (error) => toast(failureText(error, 'Could not update the coupon.'), 'error') },
    );
  };

  const kpis: readonly StatCardData[] = useMemo(() => {
    const bookable = services.filter((s) => s.isActive);
    const averagePrice =
      bookable.length === 0
        ? 0
        : Math.round(bookable.reduce((sum, s) => sum + s.priceRupees, 0) / bookable.length);
    const liveCoupons = coupons.filter((c) => couponState(c, today) === 'Active');
    const taxed = bookable.filter((s) => s.taxRateId !== null).length;
    const taxCopy =
      activeTaxes.length === 0 ? 'none active' : activeTaxes.map((t) => taxLabel(t)).join(', ');
    return [
      {
        icon: 'layers',
        label: 'Bookable Services',
        value: String(bookable.length),
        sub: `${services.length} in the catalogue`,
        iconClass: 'bg-blue-soft-bg text-blue',
        valueClass: 'text-blue',
        subClass: 'text-text-muted',
      },
      {
        icon: 'indian-rupee',
        label: 'Average Price',
        value: money(averagePrice),
        sub: 'before tax, bookable only',
        iconClass: 'bg-g-100 text-g-600',
        valueClass: 'text-g-600',
        subClass: 'text-text-muted',
      },
      {
        icon: 'percent',
        label: 'Taxed Services',
        value: `${taxed} of ${bookable.length}`,
        sub: taxCopy,
        iconClass: 'bg-y-100 text-y-600',
        valueClass: 'text-y-600',
        subClass: 'text-text-muted',
      },
      {
        icon: 'ticket',
        label: 'Live Coupons',
        value: String(liveCoupons.length),
        sub: `${coupons.length} configured`,
        iconClass: 'bg-p-100 text-p-500',
        valueClass: 'text-p-500',
        subClass: 'text-text-muted',
      },
    ];
  }, [services, coupons, activeTaxes, today]);

  const exportServicesCsv = (): void => {
    downloadCsv('medibook-services-pricing.csv', [
      ['Service', 'Department', 'Duration (min)', 'Price', 'With tax', 'Bookable', 'Description'],
      ...orderedServices.map((s) => [
        s.name,
        deptName(s.departmentId),
        s.durationMinutes,
        rupeesFixed(s.priceRupees),
        rupeesFixed(priceService(s.priceRupees, taxOf(s)).total),
        s.isActive ? 'Yes' : 'No',
        s.description,
      ]),
    ]);
    toast(`Exported ${orderedServices.length} services as CSV`, 'success');
  };

  const exportCouponsCsv = (): void => {
    downloadCsv('medibook-coupons.csv', [
      [
        'Code',
        'Type',
        'Value',
        'Valid from',
        'Valid until',
        'Usage cap',
        'Used',
        'Min order',
        'Departments',
        'Services',
        'Status',
      ],
      ...orderedCoupons.map((c) => [
        c.code,
        c.kind === 'percent' ? 'Percent' : 'Flat',
        c.kind === 'percent' ? c.value : rupeesFixed(c.value),
        localDay(c.validFrom),
        lastValidDay(c.validTo),
        c.usageCap ?? 'Unlimited',
        c.usedCount,
        rupeesFixed(c.minOrderRupees),
        c.departmentIds.map((id) => deptName(id)).join(' | '),
        c.serviceIds.map((id) => services.find((x) => x.id === id)?.name ?? id).join(' | '),
        couponState(c, today),
      ]),
    ]);
    toast(`Exported ${orderedCoupons.length} coupons as CSV`, 'success');
  };

  const confirmDelete = (): void => {
    if (!toDelete) return;
    const target = toDelete;
    setToDelete(null);
    const row = { id: target.id, version: target.version };
    const run =
      target.kind === 'Services'
        ? deleteService.mutateAsync(target.id)
        : target.kind === 'Taxes'
          ? deleteTax.mutateAsync(row)
          : deleteCoupon.mutateAsync(row);
    run
      .then(() => toast(`“${target.label}” deleted`, 'info'))
      .catch((error: unknown) => toast(failureText(error, 'Could not delete it.'), 'error'));
  };

  if (!can('Hospital Settings.view')) {
    return (
      <Card>
        <EmptyState
          icon="lock"
          title="You do not have access to services & pricing"
          message="Prices, taxes and coupons are limited to roles with the Hospital Settings view permission. Ask an administrator to grant it under Users & Roles."
        />
      </Card>
    );
  }

  const serviceTableState: TableStateSpec | undefined = servicesQuery.isPending
    ? { kind: 'loading', rows: SERVICE_PAGE_SIZE }
    : servicesQuery.isLoadingError
      ? {
          kind: 'error',
          title: 'Could not load services',
          message: failureText(servicesQuery.error, 'Please try again.'),
          onRetry: () => void servicesQuery.refetch(),
        }
      : serviceRows.length === 0
        ? {
            kind: 'empty',
            icon: hasFilters ? 'search' : 'layers',
            title: hasFilters ? 'No services match your filters.' : 'No services yet.',
            message: hasFilters
              ? 'Clear the filters to see the whole catalogue.'
              : 'Add the procedures and tests patients can book, each with its own price.',
            actionLabel: hasFilters ? 'Clear filters' : mayEdit ? 'Add a service' : undefined,
            onAction: hasFilters
              ? clearFilters
              : mayEdit
                ? () => setServiceEdit({ service: null })
                : undefined,
          }
        : undefined;

  const couponTableState: TableStateSpec | undefined = couponsQuery.isPending
    ? { kind: 'loading', rows: COUPON_PAGE_SIZE }
    : couponsQuery.isLoadingError
      ? {
          kind: 'error',
          title: 'Could not load coupons',
          message: failureText(couponsQuery.error, 'Please try again.'),
          onRetry: () => void couponsQuery.refetch(),
        }
      : couponRows.length === 0
        ? {
            kind: 'empty',
            icon: hasFilters ? 'search' : 'ticket',
            title: hasFilters ? 'No coupons match your filters.' : 'No coupons yet.',
            message: hasFilters
              ? 'Clear the filters to see every code.'
              : 'Create a code the desk or the patient app can apply at checkout.',
            actionLabel: hasFilters ? 'Clear filters' : mayEdit ? 'Create a coupon' : undefined,
            onAction: hasFilters
              ? clearFilters
              : mayEdit
                ? () => setCouponEdit({ coupon: null })
                : undefined,
          }
        : undefined;

  return (
    <div className="flex flex-col gap-5">
      {servicesQuery.isPending || taxRatesQuery.isPending || couponsQuery.isPending ? (
        <SkeletonKpiStrip />
      ) : (
        <KpiStrip items={kpis} />
      )}

      <Card pad={16} className="flex flex-wrap items-center gap-3">
        <SegTabs tabs={TABS} value={tab} onChange={(t) => switchTab(t as PricingTab)} />
        <span className="text-caption text-text-muted">
          Prices are per service, each billed with its own tax rate.
        </span>
        <div className="flex-1" />
        {tab === 'Services' && (
          <Can perm="Hospital Settings.add">
            <Button icon="plus" onClick={() => setServiceEdit({ service: null })}>
              Add Service
            </Button>
          </Can>
        )}
        {tab === 'Taxes' && (
          <Can perm="Hospital Settings.add">
            <Button icon="plus" onClick={() => setTaxEdit({ tax: null })}>
              Add Tax Rate
            </Button>
          </Can>
        )}
        {tab === 'Coupons' && (
          <Can perm="Hospital Settings.add">
            <Button icon="plus" onClick={() => setCouponEdit({ coupon: null })}>
              Create Coupon
            </Button>
          </Can>
        )}
      </Card>

      {tab !== 'Taxes' && (
        <Card>
          <div className="mb-4">
            <SearchField
              value={q}
              onChange={(v) => {
                setQ(v);
                setPage(0);
              }}
              placeholder={tab === 'Services' ? 'Search services' : 'Search coupon codes'}
              aria-label={tab === 'Services' ? 'Search services' : 'Search coupon codes'}
            />
          </div>
          <div className="mb-4.5 flex flex-wrap items-center gap-3">
            <RefreshBtn onRefresh={refresh} title={`Refresh ${tab.toLowerCase()}`} />
            <FilterSelect
              value={dept}
              options={[ANY_DEPT, ...departmentNames]}
              onChange={(v) => {
                setDept(v);
                setPage(0);
              }}
              aria-label="Filter by department"
            />
            <FilterSelect
              value={state}
              options={
                tab === 'Services'
                  ? [ANY_STATE, 'Bookable', 'Retired']
                  : [ANY_STATE, 'Active', 'Scheduled', 'Expired', 'Exhausted', 'Paused']
              }
              onChange={(v) => {
                setState(v);
                setPage(0);
              }}
              aria-label="Filter by status"
            />
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-body text-blue cursor-pointer border-none bg-transparent p-0"
              >
                Clear all
              </button>
            )}
            <div className="flex-1" />
            <Button
              variant="secondary"
              icon="download"
              onClick={tab === 'Services' ? exportServicesCsv : exportCouponsCsv}
            >
              Export CSV
            </Button>
          </div>

          {tab === 'Services' ? (
            <>
              <TableShell
                columns={SERVICE_COLUMNS}
                rightCols={['Price', 'With tax']}
                sortKeys={SERVICE_SORT_KEYS}
                sort={serviceSort.sort}
                onSort={serviceSort.onSort}
                state={serviceTableState}
                scrollLabel="Services catalogue"
              >
                {serviceRows.map((s) => {
                  const priced = priceService(s.priceRupees, taxOf(s));
                  return (
                    <tr key={s.id}>
                      <td className={cn(tdClass, 'max-w-90')}>
                        <div className="flex flex-col">
                          <span className="text-text-strong font-medium">{s.name}</span>
                          <span className="text-caption text-text-muted truncate">
                            {s.description || 'No description yet'}
                          </span>
                        </div>
                      </td>
                      <td className={tdClass}>{deptName(s.departmentId)}</td>
                      <td className={tdClass}>{s.durationMinutes} min</td>
                      <td className={cn(tdClass, 'text-right tabular-nums')}>
                        {money(s.priceRupees)}
                      </td>
                      <td className={cn(tdClass, 'text-right tabular-nums')}>
                        <span className="text-text-strong font-medium">{money(priced.total)}</span>
                        <span className="text-caption text-text-muted block">
                          {priced.tax === 0
                            ? 'tax exempt'
                            : `${priced.isInclusive ? 'incl.' : '+'} ${money(priced.tax)} tax`}
                        </span>
                      </td>
                      <td className={tdClass}>
                        <Can
                          perm="Hospital Settings.edit"
                          disableInstead
                          disabledTitle="Your role cannot change services"
                        >
                          <Toggle
                            value={s.isActive}
                            onChange={() => toggleService(s)}
                            label={`Make ${s.name} bookable`}
                          />
                        </Can>
                      </td>
                      <td className={tdClass}>
                        <div className="flex items-center gap-2">
                          <Can
                            perm="Hospital Settings.edit"
                            disableInstead
                            disabledTitle="Your role cannot change services"
                          >
                            <IconBtn
                              name="pencil"
                              label="Edit service"
                              title={`Edit ${s.name}`}
                              box={36}
                              size={15}
                              onClick={() => setServiceEdit({ service: s })}
                            />
                          </Can>
                          <Can perm="Hospital Settings.del">
                            <IconBtn
                              name="trash-2"
                              label="Delete service"
                              title={`Delete ${s.name}`}
                              box={36}
                              size={15}
                              color="var(--color-d-500)"
                              onClick={() =>
                                setToDelete({
                                  kind: 'Services',
                                  id: s.id,
                                  version: s.version,
                                  label: s.name,
                                })
                              }
                            />
                          </Can>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </TableShell>
              <Pager
                total={orderedServices.length}
                page={servicePage}
                pageSize={SERVICE_PAGE_SIZE}
                onPage={setPage}
                noun="services"
              />
            </>
          ) : (
            <>
              <TableShell
                columns={COUPON_COLUMNS}
                rightCols={['Discount', 'Min order']}
                sortKeys={COUPON_SORT_KEYS}
                sort={couponSort.sort}
                onSort={couponSort.onSort}
                state={couponTableState}
                scrollLabel="Coupons"
              >
                {couponRows.map((c) => {
                  const remaining =
                    c.usageCap === null ? null : Math.max(0, c.usageCap - c.usedCount);
                  const cState = couponState(c, today);
                  return (
                    <tr key={c.id}>
                      <td className={tdClass}>
                        <span className="text-text-strong font-semibold tracking-wide">
                          {c.code}
                        </span>
                      </td>
                      <td className={cn(tdClass, 'text-right tabular-nums')}>
                        {c.kind === 'percent' ? `${c.value}%` : money(c.value)}
                        <span className="text-caption text-text-muted block">
                          {c.kind === 'percent'
                            ? `${money(couponDiscount(c, SAMPLE_ORDER))} on a ${money(SAMPLE_ORDER)} order`
                            : 'flat'}
                        </span>
                      </td>
                      <td className={cn(tdClass, 'max-w-60')}>{scopeCopy(c)}</td>
                      <td className={cn(tdClass, 'whitespace-nowrap tabular-nums')}>
                        {fmtDate(localDay(c.validFrom))} – {fmtDate(lastValidDay(c.validTo))}
                      </td>
                      <td className={tdClass}>
                        {c.usedCount} used
                        <span className="text-caption text-text-muted block">
                          {remaining == null ? 'unlimited' : `${remaining} left`}
                        </span>
                      </td>
                      <td className={cn(tdClass, 'text-right tabular-nums')}>
                        {c.minOrderRupees === 0 ? '—' : money(c.minOrderRupees)}
                      </td>
                      <td className={tdClass}>
                        <Badge status={cState === 'Exhausted' ? 'Blocked' : cState}>{cState}</Badge>
                      </td>
                      <td className={tdClass}>
                        <div className="flex items-center gap-2">
                          <Can
                            perm="Hospital Settings.edit"
                            disableInstead
                            disabledTitle="Your role cannot change coupons"
                          >
                            <IconBtn
                              name={c.isActive ? 'pause' : 'play'}
                              label={c.isActive ? 'Pause coupon' : 'Resume coupon'}
                              title={`${c.isActive ? 'Pause' : 'Resume'} ${c.code}`}
                              box={36}
                              size={15}
                              onClick={() => toggleCoupon(c)}
                            />
                          </Can>
                          <Can
                            perm="Hospital Settings.edit"
                            disableInstead
                            disabledTitle="Your role cannot change coupons"
                          >
                            <IconBtn
                              name="pencil"
                              label="Edit coupon"
                              title={`Edit ${c.code}`}
                              box={36}
                              size={15}
                              onClick={() => setCouponEdit({ coupon: c })}
                            />
                          </Can>
                          <Can perm="Hospital Settings.del">
                            <IconBtn
                              name="trash-2"
                              label="Delete coupon"
                              title={`Delete ${c.code}`}
                              box={36}
                              size={15}
                              color="var(--color-d-500)"
                              onClick={() =>
                                setToDelete({
                                  kind: 'Coupons',
                                  id: c.id,
                                  version: c.version,
                                  label: c.code,
                                })
                              }
                            />
                          </Can>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </TableShell>
              <Pager
                total={orderedCoupons.length}
                page={couponPage}
                pageSize={COUPON_PAGE_SIZE}
                onPage={setPage}
                noun="coupons"
              />
            </>
          )}
        </Card>
      )}

      {tab === 'Taxes' && (
        <>
          <Card>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <SectionTitle>Tax Rates</SectionTitle>
              <InfoDot text="Each service is billed with the one rate picked on it; consultations use the best matching rate. An exclusive rate is added on top of the price, an inclusive one is broken back out of it. Platform defaults are set by Medibook." />
              <div className="flex-1" />
              <RefreshBtn onRefresh={refresh} title="Refresh tax rates" />
            </div>
            {taxRatesQuery.isPending ? (
              <SkeletonTable rows={2} cols={4} card={false} />
            ) : taxRatesQuery.isLoadingError ? (
              <ErrorState
                inline
                title="Could not load tax rates"
                message={failureText(taxRatesQuery.error, 'Please try again.')}
                onRetry={() => void taxRatesQuery.refetch()}
              />
            ) : taxes.length === 0 ? (
              <EmptyState
                icon="percent"
                title="No tax rates configured."
                message="Add the rate your receipts must show — 18% GST is the usual starting point."
                actionLabel={mayEdit ? 'Add tax rate' : undefined}
                onAction={mayEdit ? () => setTaxEdit({ tax: null }) : undefined}
                actionVariant="button"
              />
            ) : (
              <div className="flex flex-col">
                {taxes.map((t, i) => (
                  <div
                    key={t.id}
                    className={cn(
                      'flex flex-wrap items-center gap-3.5 px-1 py-3.5',
                      i < taxes.length - 1 && 'border-border-soft border-b',
                    )}
                  >
                    <div
                      className={cn(
                        'flex size-9.5 flex-none items-center justify-center rounded-md',
                        t.isActive ? 'bg-y-100 text-y-600' : 'bg-grey-300 text-text-muted',
                      )}
                    >
                      <Icon name="percent" size={18} />
                    </div>
                    <div className="min-w-45">
                      <div className="text-body text-text-strong font-medium">
                        {t.name} · {t.percent}%
                      </div>
                      <div className="text-caption text-text-muted">
                        {appliesToLabel(t.appliesTo)} ·{' '}
                        {t.isInclusive ? 'already inside the price' : 'added on top of the price'}
                      </div>
                    </div>
                    <div className="text-caption text-text-muted">
                      A {money(TAX_PREVIEW_AMOUNT)} service becomes{' '}
                      <span className="text-text-strong font-medium tabular-nums">
                        {money(priceService(TAX_PREVIEW_AMOUNT, { ...t, isActive: true }).total)}
                      </span>
                    </div>
                    <div className="flex-1" />
                    <Badge status={t.isActive ? 'Enabled' : 'Inactive'}>
                      {t.isActive ? 'On receipts' : 'Not applied'}
                    </Badge>
                    {t.isPlatformDefault ? (
                      <span className="text-caption text-text-muted inline-flex items-center gap-1.5">
                        <Icon name="lock" size={13} /> Platform default
                      </span>
                    ) : (
                      <>
                        <Can
                          perm="Hospital Settings.edit"
                          disableInstead
                          disabledTitle="Your role cannot change tax rates"
                        >
                          <Toggle
                            value={t.isActive}
                            onChange={() => toggleTax(t)}
                            label={`Apply ${t.name} to receipts`}
                          />
                        </Can>
                        <Can
                          perm="Hospital Settings.edit"
                          disableInstead
                          disabledTitle="Your role cannot change tax rates"
                        >
                          <IconBtn
                            name="pencil"
                            label="Edit tax rate"
                            title={`Edit ${t.name}`}
                            box={36}
                            size={15}
                            onClick={() => setTaxEdit({ tax: t })}
                          />
                        </Can>
                        <Can perm="Hospital Settings.del">
                          <IconBtn
                            name="trash-2"
                            label="Delete tax rate"
                            title={`Delete ${t.name}`}
                            box={36}
                            size={15}
                            color="var(--color-d-500)"
                            onClick={() =>
                              setToDelete({
                                kind: 'Taxes',
                                id: t.id,
                                version: t.version,
                                label: t.name,
                              })
                            }
                          />
                        </Can>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <SectionTitle className="mb-3">What a receipt will show</SectionTitle>
            <div className="text-caption text-text-muted mb-3">
              The three most expensive bookable services, each with its own tax rate — change a rate
              or a service and these totals move.
            </div>
            <TableShell
              columns={['Service', 'Price', 'Tax', 'Patient pays']}
              rightCols={['Price', 'Tax', 'Patient pays']}
              scrollLabel="Receipt preview"
            >
              {[...services]
                .filter((s) => s.isActive)
                .sort((a, b) => b.priceRupees - a.priceRupees)
                .slice(0, RECEIPT_PREVIEW_ROWS)
                .map((s) => {
                  const tax = taxOf(s);
                  const priced = priceService(s.priceRupees, tax);
                  return (
                    <tr key={s.id}>
                      <td className={tdClass}>{s.name}</td>
                      <td className={cn(tdClass, 'text-right tabular-nums')}>
                        {money(s.priceRupees)}
                      </td>
                      <td className={cn(tdClass, 'text-right tabular-nums')}>
                        {tax ? `${money(priced.tax)} · ${taxLabel(tax)}` : 'Exempt'}
                      </td>
                      <td
                        className={cn(
                          tdClass,
                          'text-text-strong text-right font-semibold tabular-nums',
                        )}
                      >
                        {money(priced.total)}
                      </td>
                    </tr>
                  );
                })}
            </TableShell>
          </Card>
        </>
      )}

      {serviceEdit && (
        <ServiceModal
          key={serviceEdit.service?.id ?? 'new-service'}
          open
          service={serviceEdit.service}
          departments={departments}
          taxOptions={taxOptions}
          onClose={() => setServiceEdit(null)}
          onSave={(input) => {
            const existing = serviceEdit.service;
            return persist(
              () =>
                saveService.mutateAsync({
                  input,
                  existing: existing ? { id: existing.id, version: existing.version } : undefined,
                }),
              existing ? 'Service saved' : 'Service added',
            );
          }}
        />
      )}
      {taxEdit && (
        <TaxModal
          key={taxEdit.tax?.id ?? 'new-tax'}
          open
          tax={taxEdit.tax}
          onClose={() => setTaxEdit(null)}
          onSave={(input) => {
            const existing = taxEdit.tax;
            return persist(
              () =>
                saveTax.mutateAsync({
                  input,
                  existing: existing ? { id: existing.id, version: existing.version } : undefined,
                }),
              existing ? 'Tax rate saved' : 'Tax rate added',
            );
          }}
        />
      )}
      {couponEdit && (
        <CouponModal
          key={couponEdit.coupon?.id ?? 'new-coupon'}
          open
          coupon={couponEdit.coupon}
          services={services}
          departments={departments}
          onClose={() => setCouponEdit(null)}
          onSave={(input) => {
            const existing = couponEdit.coupon;
            return persist(
              () =>
                saveCoupon.mutateAsync({
                  input,
                  existing: existing ? { id: existing.id, version: existing.version } : undefined,
                }),
              existing ? 'Coupon saved' : 'Coupon created',
            );
          }}
        />
      )}

      <ConfirmModal
        open={toDelete != null}
        title={
          toDelete?.kind === 'Coupons'
            ? 'Delete this coupon?'
            : toDelete?.kind === 'Taxes'
              ? 'Delete this tax rate?'
              : 'Delete this service?'
        }
        body={
          toDelete
            ? `“${toDelete.label}” is removed immediately. Past receipts keep the amounts they were issued with, but nothing new can be billed against it. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        danger
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
