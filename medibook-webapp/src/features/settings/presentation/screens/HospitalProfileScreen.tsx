import { useMemo, useState } from 'react';

import { DEMO_TODAY_ISO } from '@/core/config/demo';

import { usePermission } from '@/shared/hooks/usePermission';
import { useSort } from '@/shared/hooks/useSort';
import { cn } from '@/shared/lib/cn';
import { downloadCsv } from '@/shared/lib/download';
import { fmtDate } from '@/shared/lib/format';
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
import { RefreshBtn } from '@/shared/ui/RefreshBtn';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { SegTabs } from '@/shared/ui/SegTabs';
import { SkeletonCards } from '@/shared/ui/Skeleton';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';
import { toast } from '@/shared/ui/toast/toast.store';

import { shiftIsoDays } from '@/features/audit/application/store/audit.clock';
import { useCatalogStore } from '@/features/doctors/application/store/catalog.store';
import {
  bannerAudienceCopy,
  bannerStateOn,
  holidayDayCount,
  holidayScopeCopy,
} from '@/features/settings/application/store/profile.logic';
import { useHospitalProfileStore } from '@/features/settings/application/store/profile.store';
import type {
  HospitalBranch,
  HospitalHoliday,
  PatientBanner,
} from '@/features/settings/application/store/profile.types';
import { BranchModal } from '@/features/settings/presentation/components/BranchModal';
import { HolidayModal } from '@/features/settings/presentation/components/HolidayModal';
import { PatientBannerModal } from '@/features/settings/presentation/components/PatientBannerModal';
import { PatientBannerThumb } from '@/features/settings/presentation/components/PatientBannerThumb';

type ProfileTab = 'Branches' | 'Holiday Calendar' | 'Patient App Banners';

const TABS: readonly ProfileTab[] = ['Branches', 'Holiday Calendar', 'Patient App Banners'];

/** Window the "closures ahead" summary counts over. */
const HORIZON_DAYS = 90;

const REFRESH_MS = 420;

const ANY_SCOPE = 'Applies to: All';
const ANY_WHEN = 'When: All';

const BRANCH_COLUMNS = ['Branch', 'City', 'Phone', 'Departments', 'Primary', ''] as const;

const BRANCH_SORT_KEYS: Readonly<Record<string, string>> = {
  Branch: 'name',
  City: 'city',
  Departments: 'deptCount',
};

const HOLIDAY_COLUMNS = ['Closure', 'Dates', 'Days', 'Applies to', 'Note', ''] as const;

const HOLIDAY_SORT_KEYS: Readonly<Record<string, string>> = {
  Closure: 'name',
  Dates: 'from',
  Days: 'days',
  'Applies to': 'scope',
};

/** Which record a destructive confirm is about. */
interface DeleteTarget {
  readonly kind: 'branch' | 'holiday' | 'banner';
  readonly id: string;
  readonly label: string;
  readonly body: string;
}

/**
 * Hospital Profile — audit HA-03 (§2.4): "Branches and holiday calendar have
 * no screen. Hospital-published banners for the patient app have no screen."
 *
 * Three tabs over the hospital-profile store: where the hospital operates,
 * when it is closed (the calendar slot generation reads), and what it
 * publishes to the Medibook patient app. Banner authoring deliberately
 * follows the operations console's established banner pattern rather than
 * inventing a second one.
 */
export function HospitalProfileScreen() {
  const branches = useHospitalProfileStore((s) => s.branches);
  const holidays = useHospitalProfileStore((s) => s.holidays);
  const banners = useHospitalProfileStore((s) => s.banners);
  const saveBranch = useHospitalProfileStore((s) => s.saveBranch);
  const deleteBranch = useHospitalProfileStore((s) => s.deleteBranch);
  const setPrimaryBranch = useHospitalProfileStore((s) => s.setPrimaryBranch);
  const saveHoliday = useHospitalProfileStore((s) => s.saveHoliday);
  const deleteHoliday = useHospitalProfileStore((s) => s.deleteHoliday);
  const saveBanner = useHospitalProfileStore((s) => s.saveBanner);
  const deleteBanner = useHospitalProfileStore((s) => s.deleteBanner);
  const toggleBanner = useHospitalProfileStore((s) => s.toggleBanner);
  const moveBanner = useHospitalProfileStore((s) => s.moveBanner);

  const depts = useCatalogStore((s) => s.depts);
  const { can } = usePermission();
  const mayAdd = can('Hospital Settings.add');

  const [tab, setTab] = useState<ProfileTab>('Branches');
  const [scopeFilter, setScopeFilter] = useState(ANY_SCOPE);
  const [whenFilter, setWhenFilter] = useState(ANY_WHEN);
  const [loading, setLoading] = useState(false);

  const [branchEdit, setBranchEdit] = useState<{ branch: HospitalBranch | null } | null>(null);
  const [holidayEdit, setHolidayEdit] = useState<{ holiday: HospitalHoliday | null } | null>(null);
  const [bannerEdit, setBannerEdit] = useState<{ banner: PatientBanner | null } | null>(null);
  const [toDelete, setToDelete] = useState<DeleteTarget | null>(null);

  const departmentNames = useMemo(() => depts.map((d) => d.name), [depts]);

  const branchSort = useSort<HospitalBranch>({ key: 'name', dir: 'asc' });
  const holidaySort = useSort<HospitalHoliday>({ key: 'from', dir: 'asc' });

  const primary = branches.find((b) => b.primary) ?? branches[0] ?? null;

  const horizonEnd = shiftIsoDays(DEMO_TODAY_ISO, HORIZON_DAYS);
  const upcoming = holidays.filter((h) => h.to >= DEMO_TODAY_ISO && h.from <= horizonEnd);
  const closedDaysAhead = upcoming.reduce((sum, h) => sum + holidayDayCount(h), 0);
  const nextClosure = [...upcoming].sort((a, b) => a.from.localeCompare(b.from))[0] ?? null;

  const liveBanner = banners.find((b) => bannerStateOn(b, DEMO_TODAY_ISO) === 'Live') ?? null;

  const hasHolidayFilters = scopeFilter !== ANY_SCOPE || whenFilter !== ANY_WHEN;

  const filteredHolidays = useMemo(
    () =>
      holidays.filter(
        (h) =>
          (scopeFilter === ANY_SCOPE || h.scope === scopeFilter.replace('Applies to: ', '')) &&
          (whenFilter === ANY_WHEN ||
            (whenFilter === 'Upcoming' ? h.to >= DEMO_TODAY_ISO : h.to < DEMO_TODAY_ISO)),
      ),
    [holidays, scopeFilter, whenFilter],
  );

  const orderedBranches = branchSort.sorted([...branches], {
    name: (b) => b.name,
    city: (b) => b.city,
    deptCount: (b) => b.departments.length,
  });

  const orderedHolidays = holidaySort.sorted([...filteredHolidays], {
    name: (h) => h.name,
    from: (h) => h.from,
    days: (h) => holidayDayCount(h),
    scope: (h) => h.scope,
  });

  const clearHolidayFilters = (): void => {
    setScopeFilter(ANY_SCOPE);
    setWhenFilter(ANY_WHEN);
  };

  const refresh = async (): Promise<void> => {
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, REFRESH_MS));
    setLoading(false);
  };

  const exportHolidaysCsv = (): void => {
    downloadCsv('medibook-holiday-calendar.csv', [
      ['Closure', 'From', 'To', 'Days', 'Applies to', 'Scope', 'Note'],
      ...orderedHolidays.map((h) => [
        h.name,
        h.from,
        h.to,
        holidayDayCount(h),
        h.scope,
        holidayScopeCopy(h, branches),
        h.note,
      ]),
    ]);
    toast(`Exported ${orderedHolidays.length} closures as CSV`, 'success');
  };

  const confirmDelete = (): void => {
    if (!toDelete) return;
    if (toDelete.kind === 'branch') deleteBranch(toDelete.id);
    if (toDelete.kind === 'holiday') deleteHoliday(toDelete.id);
    if (toDelete.kind === 'banner') deleteBanner(toDelete.id);
    setToDelete(null);
  };

  if (!can('Hospital Settings.view')) {
    return (
      <Card>
        <EmptyState
          icon="lock"
          title="You do not have access to the hospital profile"
          message="Branches, closures and published banners are limited to roles with the Hospital Settings view permission. Ask an administrator to grant it under Users & Roles."
        />
      </Card>
    );
  }

  const branchTableState: TableStateSpec | undefined = loading
    ? { kind: 'loading', rows: 3 }
    : orderedBranches.length === 0
      ? {
          kind: 'empty',
          icon: 'building',
          title: 'No branches yet.',
          message:
            'Add the locations patients can visit. The primary branch is the address the patient app shows first.',
          actionLabel: mayAdd ? 'Add a branch' : undefined,
          onAction: mayAdd ? () => setBranchEdit({ branch: null }) : undefined,
        }
      : undefined;

  const holidayTableState: TableStateSpec | undefined = loading
    ? { kind: 'loading', rows: 4 }
    : orderedHolidays.length === 0
      ? {
          kind: 'empty',
          icon: hasHolidayFilters ? 'search' : 'calendar-x',
          title: hasHolidayFilters
            ? 'No closures match your filters.'
            : 'No closures on the calendar.',
          message: hasHolidayFilters
            ? 'Clear the filters to see the whole calendar.'
            : 'Add the days the hospital, a branch or a department is closed — slot generation skips them.',
          actionLabel: hasHolidayFilters ? 'Clear filters' : mayAdd ? 'Add a closure' : undefined,
          onAction: hasHolidayFilters
            ? clearHolidayFilters
            : mayAdd
              ? () => setHolidayEdit({ holiday: null })
              : undefined,
        }
      : undefined;

  return (
    <div className="flex flex-col gap-5">
      <Card pad={16} className="flex flex-wrap items-center gap-3.5">
        <div className="bg-blue-soft-bg text-blue flex size-11 flex-none items-center justify-center rounded-lg">
          <Icon name="building-2" size={22} />
        </div>
        <div className="min-w-60 flex-1">
          <div className="text-body text-text-strong font-medium">
            {primary ? primary.name : 'No primary branch set'}
          </div>
          <div className="text-caption text-text-muted">
            {primary
              ? `${primary.address} · ${primary.departments.length} departments · primary address in the patient app`
              : 'Add a branch and mark it primary so patients see an address.'}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex flex-col">
            <span className="text-caption text-text-muted">Branches</span>
            <span className="text-body text-text-strong font-semibold tabular-nums">
              {branches.length}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-caption text-text-muted">Closed days (next {HORIZON_DAYS})</span>
            <span className="text-body text-text-strong font-semibold tabular-nums">
              {closedDaysAhead}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-caption text-text-muted">Live banners</span>
            <span className="text-body text-text-strong font-semibold tabular-nums">
              {banners.filter((b) => bannerStateOn(b, DEMO_TODAY_ISO) === 'Live').length}
            </span>
          </div>
        </div>
      </Card>

      <Card pad={16} className="flex flex-wrap items-center gap-3">
        <SegTabs tabs={TABS} value={tab} onChange={(t) => setTab(t as ProfileTab)} />
        <div className="flex-1" />
        {tab === 'Branches' && (
          <Can perm="Hospital Settings.add">
            <Button icon="plus" onClick={() => setBranchEdit({ branch: null })}>
              Add Branch
            </Button>
          </Can>
        )}
        {tab === 'Holiday Calendar' && (
          <Can perm="Hospital Settings.add">
            <Button icon="plus" onClick={() => setHolidayEdit({ holiday: null })}>
              Add Closure
            </Button>
          </Can>
        )}
        {tab === 'Patient App Banners' && (
          <Can perm="Hospital Settings.add">
            <Button icon="plus" onClick={() => setBannerEdit({ banner: null })}>
              Publish Banner
            </Button>
          </Can>
        )}
      </Card>

      {tab === 'Branches' && (
        <Card>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <SectionTitle>Branches</SectionTitle>
            <InfoDot text="Patients pick a branch when booking, and only the departments listed for that branch are offered there. The primary branch is the address and phone the patient app shows by default." />
            <div className="flex-1" />
            <RefreshBtn onRefresh={refresh} title="Refresh branches" />
          </div>
          <TableShell
            columns={BRANCH_COLUMNS}
            sortKeys={BRANCH_SORT_KEYS}
            sort={branchSort.sort}
            onSort={branchSort.onSort}
            state={branchTableState}
            scrollLabel="Branches"
          >
            {orderedBranches.map((b) => (
              <tr key={b.id}>
                <td className={cn(tdClass, 'max-w-80')}>
                  <div className="flex flex-col">
                    <span className="text-text-strong font-medium">{b.name}</span>
                    <span className="text-caption text-text-muted">{b.address}</span>
                  </div>
                </td>
                <td className={tdClass}>{b.city}</td>
                <td className={cn(tdClass, 'tabular-nums')}>{b.phone}</td>
                <td className={cn(tdClass, 'max-w-70')}>
                  <span className="text-text-strong font-medium">{b.departments.length}</span>
                  <span className="text-caption text-text-muted block truncate">
                    {b.departments.join(', ') || 'None assigned'}
                  </span>
                </td>
                <td className={tdClass}>
                  {b.primary ? (
                    <Badge status="Active">Primary</Badge>
                  ) : (
                    <Can
                      perm="Hospital Settings.edit"
                      disableInstead
                      disabledTitle="Your role cannot change the primary branch"
                    >
                      <Button size="sm" variant="secondary" onClick={() => setPrimaryBranch(b.id)}>
                        Make primary
                      </Button>
                    </Can>
                  )}
                </td>
                <td className={tdClass}>
                  <div className="flex items-center gap-2">
                    <Can
                      perm="Hospital Settings.edit"
                      disableInstead
                      disabledTitle="Your role cannot edit branches"
                    >
                      <IconBtn
                        name="pencil"
                        label="Edit branch"
                        title={`Edit ${b.name}`}
                        box={36}
                        size={15}
                        onClick={() => setBranchEdit({ branch: b })}
                      />
                    </Can>
                    <Can perm="Hospital Settings.del">
                      <IconBtn
                        name="trash-2"
                        label="Remove branch"
                        title={
                          b.primary
                            ? 'The primary branch cannot be removed — make another branch primary first'
                            : `Remove ${b.name}`
                        }
                        box={36}
                        size={15}
                        color="var(--color-d-500)"
                        disabled={b.primary}
                        onClick={() =>
                          setToDelete({
                            kind: 'branch',
                            id: b.id,
                            label: b.name,
                            body: `“${b.name}” is removed from the patient app immediately. Appointments already booked there keep their record, but nothing new can be booked at this branch. This cannot be undone.`,
                          })
                        }
                      />
                    </Can>
                  </div>
                </td>
              </tr>
            ))}
          </TableShell>
        </Card>
      )}

      {tab === 'Holiday Calendar' && (
        <Card>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <SectionTitle>Holiday Calendar</SectionTitle>
            <InfoDot text="This calendar is what slot generation reads: no slots are created for a closed day, and the patient app shows the day as unavailable. A closure can cover the whole hospital, one branch or one department." />
            <div className="flex-1" />
            <Button variant="secondary" icon="download" onClick={exportHolidaysCsv}>
              Export CSV
            </Button>
          </div>

          <div
            className={cn(
              'text-body mb-4 flex items-start gap-2 rounded-md px-3.5 py-3',
              nextClosure ? 'bg-y-100 text-y-800' : 'bg-g-100 text-g-700',
            )}
          >
            <Icon
              name={nextClosure ? 'calendar-x' : 'calendar-check'}
              size={16}
              className="mt-0.5 flex-none"
            />
            <span>
              {nextClosure
                ? `Next closure: ${nextClosure.name} on ${fmtDate(nextClosure.from)}${
                    nextClosure.to !== nextClosure.from ? ` – ${fmtDate(nextClosure.to)}` : ''
                  } (${holidayScopeCopy(nextClosure, branches)}). ${closedDaysAhead} booking ${
                    closedDaysAhead === 1 ? 'day' : 'days'
                  } removed over the next ${HORIZON_DAYS} days.`
                : `Nothing closed in the next ${HORIZON_DAYS} days — every working day generates slots.`}
            </span>
          </div>

          <div className="mb-4.5 flex flex-wrap items-center gap-3">
            <RefreshBtn onRefresh={refresh} title="Refresh the holiday calendar" />
            <FilterSelect
              value={scopeFilter}
              options={[ANY_SCOPE, 'Whole hospital', 'Branch', 'Department']}
              onChange={setScopeFilter}
              aria-label="Filter by what the closure applies to"
            />
            <FilterSelect
              value={whenFilter}
              options={[ANY_WHEN, 'Upcoming', 'Past']}
              onChange={setWhenFilter}
              aria-label="Filter by upcoming or past closures"
            />
            {hasHolidayFilters && (
              <button
                type="button"
                onClick={clearHolidayFilters}
                className="text-body text-blue cursor-pointer border-none bg-transparent p-0"
              >
                Clear all
              </button>
            )}
          </div>

          <TableShell
            columns={HOLIDAY_COLUMNS}
            rightCols={['Days']}
            sortKeys={HOLIDAY_SORT_KEYS}
            sort={holidaySort.sort}
            onSort={holidaySort.onSort}
            state={holidayTableState}
            scrollLabel="Holiday calendar"
          >
            {orderedHolidays.map((h) => {
              const past = h.to < DEMO_TODAY_ISO;
              return (
                <tr key={h.id}>
                  <td className={tdClass}>
                    <div className="flex items-center gap-2.5">
                      <span className="text-text-strong font-medium">{h.name}</span>
                      {past && <Badge status="Expired">Past</Badge>}
                    </div>
                  </td>
                  <td className={cn(tdClass, 'whitespace-nowrap tabular-nums')}>
                    {h.from === h.to ? fmtDate(h.from) : `${fmtDate(h.from)} – ${fmtDate(h.to)}`}
                  </td>
                  <td className={cn(tdClass, 'text-right tabular-nums')}>{holidayDayCount(h)}</td>
                  <td className={tdClass}>
                    <div className="flex flex-col">
                      <span className="text-text-strong font-medium">
                        {holidayScopeCopy(h, branches)}
                      </span>
                      <span className="text-caption text-text-muted">{h.scope}</span>
                    </div>
                  </td>
                  <td className={cn(tdClass, 'max-w-80')}>
                    <span className="text-text-muted">{h.note || '—'}</span>
                  </td>
                  <td className={tdClass}>
                    <div className="flex items-center gap-2">
                      <Can
                        perm="Hospital Settings.edit"
                        disableInstead
                        disabledTitle="Your role cannot change the holiday calendar"
                      >
                        <IconBtn
                          name="pencil"
                          label="Edit closure"
                          title={`Edit ${h.name}`}
                          box={36}
                          size={15}
                          onClick={() => setHolidayEdit({ holiday: h })}
                        />
                      </Can>
                      <Can perm="Hospital Settings.del">
                        <IconBtn
                          name="trash-2"
                          label="Remove closure"
                          title={`Remove ${h.name}`}
                          box={36}
                          size={15}
                          color="var(--color-d-500)"
                          onClick={() =>
                            setToDelete({
                              kind: 'holiday',
                              id: h.id,
                              label: h.name,
                              body: `Removing “${h.name}” makes ${holidayDayCount(h)} ${
                                holidayDayCount(h) === 1 ? 'day' : 'days'
                              } bookable again, and slots will be generated for ${holidayScopeCopy(
                                h,
                                branches,
                              ).toLowerCase()}.`,
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
        </Card>
      )}

      {tab === 'Patient App Banners' && (
        <>
          <Card pad={16} className="flex items-center gap-3">
            <div className="bg-g-100 text-g-600 flex size-9.5 flex-none items-center justify-center rounded-md">
              <Icon name="smartphone" size={18} />
            </div>
            <div className="min-w-0">
              <div className="text-body text-text-strong font-medium">
                {liveBanner
                  ? `Showing in the patient app right now: “${liveBanner.title}”`
                  : 'Nothing is live in the patient app right now'}
              </div>
              <div className="text-caption text-text-muted">
                Live banners rotate on the hospital&apos;s page in the order below. Medibook&apos;s
                own campaign banners are managed by Operations and are not affected by these.
              </div>
            </div>
          </Card>

          <Card>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <SectionTitle>Published Banners</SectionTitle>
              <InfoDot text="Order sets rotation priority in the app — use the arrows. Pause takes a banner out of rotation without losing its schedule. Expired banners stay here for reference until deleted." />
              <div className="flex-1" />
              <RefreshBtn onRefresh={refresh} title="Refresh banners" />
            </div>
            {loading ? (
              <SkeletonCards count={2} lines={3} />
            ) : banners.length === 0 ? (
              <EmptyState
                icon="image"
                title="No banners published yet."
                message="Publish an offer, a camp or a notice to the hospital's page in the Medibook patient app."
                actionLabel={mayAdd ? 'Publish a banner' : undefined}
                onAction={mayAdd ? () => setBannerEdit({ banner: null }) : undefined}
                actionVariant="button"
              />
            ) : (
              <div className="flex flex-col">
                {banners.map((b, i) => {
                  const state = bannerStateOn(b, DEMO_TODAY_ISO);
                  return (
                    <div
                      key={b.id}
                      className={cn(
                        'flex flex-wrap items-center gap-3.5 px-1 py-3.5',
                        i < banners.length - 1 && 'border-border-soft border-b',
                      )}
                    >
                      <div className="flex flex-none flex-col gap-0.5">
                        <IconBtn
                          name="chevron-up"
                          label="Move banner up"
                          title={`Move “${b.title}” up`}
                          box={26}
                          size={15}
                          disabled={i === 0}
                          onClick={() => moveBanner(i, -1)}
                        />
                        <IconBtn
                          name="chevron-down"
                          label="Move banner down"
                          title={`Move “${b.title}” down`}
                          box={26}
                          size={15}
                          disabled={i === banners.length - 1}
                          onClick={() => moveBanner(i, 1)}
                        />
                      </div>
                      <span className="text-body text-text-muted w-4.5 flex-none text-center font-medium tabular-nums">
                        {i + 1}
                      </span>
                      <PatientBannerThumb img={b.img} title={b.title} />
                      <div className="min-w-50 flex-1">
                        <div className="text-body text-text-strong font-medium">{b.title}</div>
                        <div className="text-caption text-text-muted line-clamp-2">{b.body}</div>
                        <div className="text-caption text-text-muted mt-0.5 tabular-nums">
                          {fmtDate(b.from)} – {fmtDate(b.to)} · {bannerAudienceCopy(b)}
                        </div>
                      </div>
                      <Badge status={state} />
                      {state !== 'Expired' && (
                        <Can
                          perm="Hospital Settings.edit"
                          disableInstead
                          disabledTitle="Your role cannot change banners"
                        >
                          <Button size="sm" variant="secondary" onClick={() => toggleBanner(b.id)}>
                            {b.active ? 'Pause' : 'Resume'}
                          </Button>
                        </Can>
                      )}
                      <Can
                        perm="Hospital Settings.edit"
                        disableInstead
                        disabledTitle="Your role cannot change banners"
                      >
                        <IconBtn
                          name="pencil"
                          label="Edit banner"
                          title={`Edit “${b.title}”`}
                          box={36}
                          size={15}
                          onClick={() => setBannerEdit({ banner: b })}
                        />
                      </Can>
                      <Can perm="Hospital Settings.del">
                        <IconBtn
                          name="trash-2"
                          label="Delete banner"
                          title={`Delete “${b.title}”`}
                          box={36}
                          size={15}
                          color="var(--color-d-500)"
                          onClick={() =>
                            setToDelete({
                              kind: 'banner',
                              id: b.id,
                              label: b.title,
                              body: `“${b.title}” is removed from the patient app immediately. This cannot be undone.`,
                            })
                          }
                        />
                      </Can>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}

      {branchEdit && (
        <BranchModal
          key={branchEdit.branch?.id ?? 'new-branch'}
          open
          branch={branchEdit.branch}
          departments={departmentNames}
          onClose={() => setBranchEdit(null)}
          onSave={saveBranch}
        />
      )}
      {holidayEdit && (
        <HolidayModal
          key={holidayEdit.holiday?.id ?? 'new-holiday'}
          open
          holiday={holidayEdit.holiday}
          branches={branches}
          departments={departmentNames}
          onClose={() => setHolidayEdit(null)}
          onSave={saveHoliday}
        />
      )}
      {bannerEdit && (
        <PatientBannerModal
          key={bannerEdit.banner?.id ?? 'new-banner'}
          open
          banner={bannerEdit.banner}
          departments={departmentNames}
          onClose={() => setBannerEdit(null)}
          onSave={saveBanner}
        />
      )}

      <ConfirmModal
        open={toDelete != null}
        title={
          toDelete?.kind === 'branch'
            ? 'Remove this branch?'
            : toDelete?.kind === 'holiday'
              ? 'Remove this closure?'
              : 'Delete this banner?'
        }
        body={toDelete?.body ?? ''}
        confirmLabel={toDelete?.kind === 'holiday' ? 'Remove Closure' : 'Delete'}
        danger
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
