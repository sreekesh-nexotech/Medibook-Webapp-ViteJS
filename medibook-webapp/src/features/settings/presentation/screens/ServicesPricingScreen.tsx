import { useMemo, useState } from 'react';

import { DEMO_TODAY_ISO } from '@/core/config/demo';

import { usePermission } from '@/shared/hooks/usePermission';
import { useSort } from '@/shared/hooks/useSort';
import { cn } from '@/shared/lib/cn';
import { downloadCsv } from '@/shared/lib/download';
import { fmtDate, money } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Can } from '@/shared/ui/Can';
import { Card } from '@/shared/ui/Card';
import { ConfirmModal } from '@/shared/ui/ConfirmModal';
import { EmptyState } from '@/shared/ui/EmptyState';
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

import { useCatalogStore } from '@/features/doctors/application/store/catalog.store';
import {
  couponDiscount,
  couponRemaining,
  couponScopeCopy,
  couponStateOn,
  priceWithTaxes,
} from '@/features/settings/application/store/services.logic';
import { useServicesStore } from '@/features/settings/application/store/services.store';
import type {
  Coupon,
  HospitalService,
  TaxRate,
} from '@/features/settings/application/store/services.types';
import { CouponModal } from '@/features/settings/presentation/components/CouponModal';
import { ServiceModal } from '@/features/settings/presentation/components/ServiceModal';
import { TaxModal } from '@/features/settings/presentation/components/TaxModal';

type PricingTab = 'Services' | 'Taxes' | 'Coupons';

const TABS: readonly PricingTab[] = ['Services', 'Taxes', 'Coupons'];

const SERVICE_PAGE_SIZE = 8;
const COUPON_PAGE_SIZE = 6;
const REFRESH_MS = 420;

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
  readonly label: string;
}

/**
 * Services & Pricing — audit HA-04 (§2.4): "A department carries one base fee.
 * Services, per-service pricing, taxes and coupons have no screen."
 *
 * Three tabs over one store: the service catalogue with its own prices, the
 * tax rates receipts print as separate lines, and the coupons the desk may
 * apply. Every price shown here is a whole-rupee integer run through
 * `priceWithTaxes`, so what the table says is what a receipt would total.
 */
export function ServicesPricingScreen() {
  const services = useServicesStore((s) => s.services);
  const taxes = useServicesStore((s) => s.taxes);
  const coupons = useServicesStore((s) => s.coupons);
  const saveService = useServicesStore((s) => s.saveService);
  const deleteService = useServicesStore((s) => s.deleteService);
  const toggleService = useServicesStore((s) => s.toggleService);
  const saveTax = useServicesStore((s) => s.saveTax);
  const deleteTax = useServicesStore((s) => s.deleteTax);
  const toggleTax = useServicesStore((s) => s.toggleTax);
  const saveCoupon = useServicesStore((s) => s.saveCoupon);
  const deleteCoupon = useServicesStore((s) => s.deleteCoupon);
  const toggleCoupon = useServicesStore((s) => s.toggleCoupon);

  const depts = useCatalogStore((s) => s.depts);
  const { can } = usePermission();
  const mayEdit = can('Hospital Settings.edit');

  const [tab, setTab] = useState<PricingTab>('Services');
  const [q, setQ] = useState('');
  const [dept, setDept] = useState(ANY_DEPT);
  const [state, setState] = useState(ANY_STATE);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);

  const [serviceEdit, setServiceEdit] = useState<{ service: HospitalService | null } | null>(null);
  const [taxEdit, setTaxEdit] = useState<{ tax: TaxRate | null } | null>(null);
  const [couponEdit, setCouponEdit] = useState<{ coupon: Coupon | null } | null>(null);
  const [toDelete, setToDelete] = useState<DeleteTarget | null>(null);

  const departmentNames = useMemo(() => depts.map((d) => d.name), [depts]);
  const activeTaxes = useMemo(() => taxes.filter((t) => t.active), [taxes]);

  const serviceSort = useSort<HospitalService>({ key: 'name', dir: 'asc' });
  const couponSort = useSort<Coupon>({ key: 'from', dir: 'desc' });

  const ql = q.trim().toLowerCase();
  const hasFilters = ql !== '' || dept !== ANY_DEPT || state !== ANY_STATE;

  const filteredServices = useMemo(
    () =>
      services.filter(
        (s) =>
          (ql === '' ||
            s.name.toLowerCase().includes(ql) ||
            s.dept.toLowerCase().includes(ql) ||
            s.description.toLowerCase().includes(ql)) &&
          (dept === ANY_DEPT || s.dept === dept) &&
          (state === ANY_STATE ||
            (state === 'Bookable' ? s.active : state === 'Retired' ? !s.active : true)),
      ),
    [services, ql, dept, state],
  );

  const filteredCoupons = useMemo(
    () =>
      coupons.filter(
        (c) =>
          (ql === '' ||
            c.code.toLowerCase().includes(ql) ||
            c.departments.join(' ').toLowerCase().includes(ql)) &&
          (dept === ANY_DEPT || c.departments.length === 0 || c.departments.includes(dept)) &&
          (state === ANY_STATE || couponStateOn(c, DEMO_TODAY_ISO) === state),
      ),
    [coupons, ql, dept, state],
  );

  const orderedServices = serviceSort.sorted([...filteredServices], {
    name: (s) => s.name,
    dept: (s) => s.dept,
    duration: (s) => s.durationMinutes,
    price: (s) => s.price,
  });

  const orderedCoupons = couponSort.sorted([...filteredCoupons], {
    code: (c) => c.code,
    value: (c) => (c.type === 'Percent' ? c.value : c.value),
    from: (c) => c.from,
    used: (c) => c.used,
    minOrder: (c) => c.minOrder,
    state: (c) => couponStateOn(c, DEMO_TODAY_ISO),
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

  const refresh = async (): Promise<void> => {
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, REFRESH_MS));
    setLoading(false);
  };

  const kpis: readonly StatCardData[] = useMemo(() => {
    const bookable = services.filter((s) => s.active);
    const averagePrice =
      bookable.length === 0
        ? 0
        : Math.round(bookable.reduce((sum, s) => sum + s.price, 0) / bookable.length);
    const liveCoupons = coupons.filter((c) => couponStateOn(c, DEMO_TODAY_ISO) === 'Active');
    const taxCopy =
      activeTaxes.length === 0
        ? 'none applied'
        : activeTaxes.map((t) => `${t.name} ${t.percent}%`).join(' + ');
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
        label: 'Tax on Receipts',
        value: `${activeTaxes.reduce((sum, t) => sum + t.percent, 0)}%`,
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
  }, [services, coupons, activeTaxes]);

  const exportServicesCsv = (): void => {
    downloadCsv('medibook-services-pricing.csv', [
      ['Service', 'Department', 'Duration (min)', 'Price', 'With tax', 'Bookable', 'Description'],
      ...orderedServices.map((s) => [
        s.name,
        s.dept,
        s.durationMinutes,
        s.price,
        priceWithTaxes(s.price, activeTaxes).total,
        s.active ? 'Yes' : 'No',
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
        c.type,
        c.value,
        c.from,
        c.to,
        c.usageCap === 0 ? 'Unlimited' : c.usageCap,
        c.used,
        c.minOrder,
        c.departments.join(' | '),
        c.serviceIds.join(' | '),
        couponStateOn(c, DEMO_TODAY_ISO),
      ]),
    ]);
    toast(`Exported ${orderedCoupons.length} coupons as CSV`, 'success');
  };

  const confirmDelete = (): void => {
    if (!toDelete) return;
    if (toDelete.kind === 'Services') deleteService(toDelete.id);
    if (toDelete.kind === 'Taxes') deleteTax(toDelete.id);
    if (toDelete.kind === 'Coupons') deleteCoupon(toDelete.id);
    setToDelete(null);
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

  const serviceTableState: TableStateSpec | undefined = loading
    ? { kind: 'loading', rows: SERVICE_PAGE_SIZE }
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

  const couponTableState: TableStateSpec | undefined = loading
    ? { kind: 'loading', rows: COUPON_PAGE_SIZE }
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
      {loading ? <SkeletonKpiStrip /> : <KpiStrip items={kpis} />}

      <Card pad={16} className="flex flex-wrap items-center gap-3">
        <SegTabs tabs={TABS} value={tab} onChange={(t) => switchTab(t as PricingTab)} />
        <span className="text-caption text-text-muted">
          Prices are per service and independent of a department&apos;s base consultation fee.
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
                  const priced = priceWithTaxes(s.price, activeTaxes);
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
                      <td className={tdClass}>{s.dept}</td>
                      <td className={tdClass}>{s.durationMinutes} min</td>
                      <td className={cn(tdClass, 'text-right tabular-nums')}>{money(s.price)}</td>
                      <td className={cn(tdClass, 'text-right tabular-nums')}>
                        <span className="text-text-strong font-medium">{money(priced.total)}</span>
                        <span className="text-caption text-text-muted block">
                          incl. {money(priced.taxTotal)} tax
                        </span>
                      </td>
                      <td className={tdClass}>
                        <Can
                          perm="Hospital Settings.edit"
                          disableInstead
                          disabledTitle="Your role cannot change services"
                        >
                          <Toggle
                            value={s.active}
                            onChange={() => toggleService(s.id)}
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
                                setToDelete({ kind: 'Services', id: s.id, label: s.name })
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
                  const remaining = couponRemaining(c);
                  const cState = couponStateOn(c, DEMO_TODAY_ISO);
                  return (
                    <tr key={c.id}>
                      <td className={tdClass}>
                        <span className="text-text-strong font-semibold tracking-wide">
                          {c.code}
                        </span>
                      </td>
                      <td className={cn(tdClass, 'text-right tabular-nums')}>
                        {c.type === 'Percent' ? `${c.value}%` : money(c.value)}
                        <span className="text-caption text-text-muted block">
                          {c.type === 'Percent'
                            ? `${money(couponDiscount(c, 2000))} on a ${money(2000)} order`
                            : 'flat'}
                        </span>
                      </td>
                      <td className={cn(tdClass, 'max-w-60')}>{couponScopeCopy(c, services)}</td>
                      <td className={cn(tdClass, 'whitespace-nowrap tabular-nums')}>
                        {fmtDate(c.from)} – {fmtDate(c.to)}
                      </td>
                      <td className={tdClass}>
                        {c.used} used
                        <span className="text-caption text-text-muted block">
                          {remaining == null ? 'unlimited' : `${remaining} left`}
                        </span>
                      </td>
                      <td className={cn(tdClass, 'text-right tabular-nums')}>
                        {c.minOrder === 0 ? '—' : money(c.minOrder)}
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
                              name={c.active ? 'pause' : 'play'}
                              label={c.active ? 'Pause coupon' : 'Resume coupon'}
                              title={`${c.active ? 'Pause' : 'Resume'} ${c.code}`}
                              box={36}
                              size={15}
                              onClick={() => toggleCoupon(c.id)}
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
                                setToDelete({ kind: 'Coupons', id: c.id, label: c.code })
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
              <InfoDot text="Receipts print tax as its own line, never baked into the fee — so an exclusive rate is added on top of the service price, and an inclusive rate is broken back out of it." />
              <div className="flex-1" />
              <RefreshBtn onRefresh={refresh} title="Refresh tax rates" />
            </div>
            {loading ? (
              <SkeletonTable rows={2} cols={4} card={false} />
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
                        t.active ? 'bg-y-100 text-y-600' : 'bg-grey-300 text-text-muted',
                      )}
                    >
                      <Icon name="percent" size={18} />
                    </div>
                    <div className="min-w-45">
                      <div className="text-body text-text-strong font-medium">
                        {t.name} · {t.percent}%
                      </div>
                      <div className="text-caption text-text-muted">
                        {t.mode === 'Exclusive'
                          ? 'Added on top of the service price'
                          : 'Already inside the service price'}
                      </div>
                    </div>
                    <div className="text-caption text-text-muted">
                      A {money(1000)} service becomes{' '}
                      <span className="text-text-strong font-medium tabular-nums">
                        {money(priceWithTaxes(1000, [{ ...t, active: true }]).total)}
                      </span>
                    </div>
                    <div className="flex-1" />
                    <Badge status={t.active ? 'Enabled' : 'Inactive'}>
                      {t.active ? 'On receipts' : 'Not applied'}
                    </Badge>
                    <Can
                      perm="Hospital Settings.edit"
                      disableInstead
                      disabledTitle="Your role cannot change tax rates"
                    >
                      <Toggle
                        value={t.active}
                        onChange={() => toggleTax(t.id)}
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
                        onClick={() => setToDelete({ kind: 'Taxes', id: t.id, label: t.name })}
                      />
                    </Can>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <SectionTitle className="mb-3">What a receipt will show</SectionTitle>
            <div className="text-caption text-text-muted mb-3">
              Derived from the rates above and the three most expensive bookable services — change a
              rate and these totals move.
            </div>
            <TableShell
              columns={[
                'Service',
                'Price',
                ...activeTaxes.map((t) => `${t.name} ${t.percent}%`),
                'Patient pays',
              ]}
              rightCols={[
                'Price',
                ...activeTaxes.map((t) => `${t.name} ${t.percent}%`),
                'Patient pays',
              ]}
              scrollLabel="Receipt preview"
            >
              {[...services]
                .filter((s) => s.active)
                .sort((a, b) => b.price - a.price)
                .slice(0, 3)
                .map((s) => {
                  const priced = priceWithTaxes(s.price, activeTaxes);
                  return (
                    <tr key={s.id}>
                      <td className={tdClass}>{s.name}</td>
                      <td className={cn(tdClass, 'text-right tabular-nums')}>{money(s.price)}</td>
                      {activeTaxes.map((t) => (
                        <td key={t.id} className={cn(tdClass, 'text-right tabular-nums')}>
                          {money(priced.taxes.find((l) => l.name === t.name)?.amount ?? 0)}
                        </td>
                      ))}
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
          departments={departmentNames}
          onClose={() => setServiceEdit(null)}
          onSave={saveService}
        />
      )}
      {taxEdit && (
        <TaxModal
          key={taxEdit.tax?.id ?? 'new-tax'}
          open
          tax={taxEdit.tax}
          onClose={() => setTaxEdit(null)}
          onSave={saveTax}
        />
      )}
      {couponEdit && (
        <CouponModal
          key={couponEdit.coupon?.id ?? 'new-coupon'}
          open
          coupon={couponEdit.coupon}
          services={services}
          departments={departmentNames}
          onClose={() => setCouponEdit(null)}
          onSave={saveCoupon}
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
