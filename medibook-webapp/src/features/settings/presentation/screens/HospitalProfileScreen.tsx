import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { PROFILE_TAB_BANNERS, PROFILE_TAB_HOLIDAYS, PROFILE_TAB_PARAM } from '@/app/router/paths';

import { usePermission } from '@/shared/hooks/usePermission';
import { useSort } from '@/shared/hooks/useSort';
import { cn } from '@/shared/lib/cn';
import { downloadCsv } from '@/shared/lib/download';
import { addDaysISO, fmtDate, todayISO } from '@/shared/lib/format';
import { describeFailure } from '@/shared/lib/serverErrors';
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
import { RefreshBtn } from '@/shared/ui/RefreshBtn';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { SegTabs } from '@/shared/ui/SegTabs';
import { SkeletonCards } from '@/shared/ui/Skeleton';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';
import { toast } from '@/shared/ui/toast/toast.store';

import { useDepartmentsQuery } from '@/features/doctors/application/queries/useDepartmentsQuery';
import { ScheduleChangeModal } from '@/features/doctors/presentation/components/ScheduleChangeModal';
import { useScheduleConfirm } from '@/features/doctors/presentation/components/useScheduleConfirm';
import type {
  BannerInput,
  Holiday,
  HolidayInput,
  HolidayRef,
  HospitalBanner,
} from '@/features/settings/domain/entities/profile.entities';
import { useBannerImageUrlsQuery } from '@/features/settings/application/queries/useBannerImageUrlsQuery';
import { useBannersQuery } from '@/features/settings/application/queries/useBannersQuery';
import { useCreateBannerMutation } from '@/features/settings/application/queries/useCreateBannerMutation';
import { useDeleteBannerMutation } from '@/features/settings/application/queries/useDeleteBannerMutation';
import { useHolidaysQuery } from '@/features/settings/application/queries/useHolidaysQuery';
import { useRemoveHolidayMutation } from '@/features/settings/application/queries/useRemoveHolidayMutation';
import { useReorderBannersMutation } from '@/features/settings/application/queries/useReorderBannersMutation';
import { useSaveHolidayMutation } from '@/features/settings/application/queries/useSaveHolidayMutation';
import { useUpdateBannerMutation } from '@/features/settings/application/queries/useUpdateBannerMutation';
import {
  BANNER_AUDIENCE_LABEL,
  HOLIDAY_SCOPE_OPTIONS,
  bannerStatusAt,
  bannerWindow,
  closedDaysWithin,
  holidayAppliesTo,
  holidayDayCount,
  holidayScopeOf,
  moved,
} from '@/features/settings/application/store/profile.form';
import {
  HolidayModal,
  type HolidaySaveOutcome,
} from '@/features/settings/presentation/components/HolidayModal';
import { PatientBannerModal } from '@/features/settings/presentation/components/PatientBannerModal';
import { PatientBannerThumb } from '@/features/settings/presentation/components/PatientBannerThumb';

// Branches are a removed concept (D-02, CLAUDE.md §12): one hospital = one location.
type ProfileTab = 'Holiday Calendar' | 'Patient App Banners';

const TABS: readonly ProfileTab[] = ['Holiday Calendar', 'Patient App Banners'];

/** `?tab=` values → tab (`hospitalHolidaysPath` links here from Slots, UAT-73). */
const TAB_FROM_PARAM: Readonly<Record<string, ProfileTab>> = {
  [PROFILE_TAB_HOLIDAYS]: 'Holiday Calendar',
  [PROFILE_TAB_BANNERS]: 'Patient App Banners',
};

/** Window the "closures ahead" summary counts over. */
const HORIZON_DAYS = 90;

const ANY_SCOPE = 'Applies to: All';
const ANY_WHEN = 'When: All';

const HOLIDAY_COLUMNS = ['Closure', 'Dates', 'Days', 'Applies to', 'Note', ''] as const;

const HOLIDAY_SORT_KEYS: Readonly<Record<string, string>> = {
  Closure: 'name',
  Dates: 'from',
  Days: 'days',
  'Applies to': 'scope',
};

const FALLBACK_ERROR = 'Something went wrong. Please try again.';

/** Which record a destructive confirm is about. */
interface DeleteTarget {
  readonly kind: 'holiday' | 'banner';
  readonly id: string;
  /** Row version for `If-Match` (holidays and banners both have one). */
  readonly version: number;
  readonly label: string;
  readonly body: string;
}

/** A calendar write, replayable as a dry run and then for real. */
type HolidayOp =
  | { readonly kind: 'save'; readonly existing: HolidayRef | null; readonly input: HolidayInput }
  | { readonly kind: 'remove'; readonly holiday: HolidayRef; readonly name: string };

function errorCopy(error: unknown): string {
  return describeFailure(error, FALLBACK_ERROR);
}

/** What the applied write did, including the bookings it cancelled (07·P-F7). */
function holidayOpSuccessCopy(op: HolidayOp, cancelled: number): string {
  const done =
    op.kind === 'remove'
      ? 'Holiday removed — the day is bookable again'
      : op.existing === null
        ? 'Holiday added — slots will not be generated'
        : 'Holiday saved';
  return cancelled === 0
    ? done
    : `${done} — ${cancelled} ${cancelled === 1 ? 'booking' : 'bookings'} cancelled with a full refund`;
}

/**
 * Hospital Profile (module H4) — the holiday calendar and the banners the
 * hospital publishes to the patient app, both on the hospital API.
 *
 * Every closure write is checked with a dry run first: if it would cancel
 * booked appointments, nothing is applied until the user confirms the list.
 * There is no Branches tab: one hospital is one location (D-02, UAT-52).
 */
export function HospitalProfileScreen() {
  const { can } = usePermission();
  const canView = can('Hospital Settings.view');
  const mayAdd = can('Hospital Settings.add');

  const holidaysQuery = useHolidaysQuery(canView);
  const bannersQuery = useBannersQuery(canView);
  const departmentsQuery = useDepartmentsQuery();

  const saveHoliday = useSaveHolidayMutation();
  const removeHoliday = useRemoveHolidayMutation();
  const createBanner = useCreateBannerMutation();
  const updateBanner = useUpdateBannerMutation();
  const deleteBanner = useDeleteBannerMutation();
  const reorderBanners = useReorderBannersMutation();
  const holidayConfirm = useScheduleConfirm();
  const [searchParams] = useSearchParams();

  const [tab, setTab] = useState<ProfileTab>(
    () => TAB_FROM_PARAM[searchParams.get(PROFILE_TAB_PARAM) ?? ''] ?? 'Holiday Calendar',
  );
  const [scopeFilter, setScopeFilter] = useState(ANY_SCOPE);
  const [whenFilter, setWhenFilter] = useState(ANY_WHEN);

  const [holidayEdit, setHolidayEdit] = useState<{ holiday: Holiday | null } | null>(null);
  const [bannerEdit, setBannerEdit] = useState<{ banner: HospitalBanner | null } | null>(null);
  const [toDelete, setToDelete] = useState<DeleteTarget | null>(null);

  const holidays = holidaysQuery.data ?? [];
  const banners = bannersQuery.data ?? [];
  const departments = (departmentsQuery.data ?? []).map((d) => ({ id: d.id, name: d.name }));
  const departmentNames = new Map(departments.map((d) => [d.id, d.name]));
  const imageUrls = useBannerImageUrlsQuery(
    banners.flatMap((b) => (b.imageFileId ? [b.imageFileId] : [])),
  );

  const holidaySort = useSort<Holiday>({ key: 'from', dir: 'asc' });

  const today = todayISO();
  const now = new Date();
  const horizonEnd = addDaysISO(today, HORIZON_DAYS);
  const upcoming = holidays.filter((h) => h.to >= today && h.from <= horizonEnd);
  // Distinct whole-hospital days; department closures are counted apart (07·P-F3).
  const closedDaysAhead = closedDaysWithin(
    upcoming.filter((h) => h.departmentId === null),
    today,
    horizonEnd,
  );
  const departmentClosuresAhead = upcoming.filter((h) => h.departmentId !== null).length;
  const nextClosure = [...upcoming].sort((a, b) => a.from.localeCompare(b.from))[0] ?? null;

  const statuses = new Map(banners.map((b) => [b.id, bannerStatusAt(b, now)]));
  const liveBanners = banners.filter((b) => statuses.get(b.id) === 'Live');
  const hiddenCount = banners.filter((b) => statuses.get(b.id) === 'Hidden').length;
  const liveBanner = liveBanners[0] ?? null;

  const hasHolidayFilters = scopeFilter !== ANY_SCOPE || whenFilter !== ANY_WHEN;

  const filteredHolidays = holidays.filter(
    (h) =>
      (scopeFilter === ANY_SCOPE ||
        holidayScopeOf(h) === scopeFilter.replace('Applies to: ', '')) &&
      (whenFilter === ANY_WHEN || (whenFilter === 'Upcoming' ? h.to >= today : h.to < today)),
  );

  const orderedHolidays = holidaySort.sorted([...filteredHolidays], {
    name: (h) => h.name,
    from: (h) => h.from,
    days: (h) => holidayDayCount(h.from, h.to),
    scope: (h) => holidayAppliesTo(h, departmentNames),
  });

  const clearHolidayFilters = (): void => {
    setScopeFilter(ANY_SCOPE);
    setWhenFilter(ANY_WHEN);
  };

  const exportHolidaysCsv = (): void => {
    downloadCsv('medibook-holiday-calendar.csv', [
      ['Closure', 'From', 'To', 'Days', 'Applies to', 'Scope', 'Note'],
      ...orderedHolidays.map((h) => [
        h.name,
        h.from,
        h.to,
        holidayDayCount(h.from, h.to),
        holidayScopeOf(h),
        holidayAppliesTo(h, departmentNames),
        h.note ?? '',
      ]),
    ]);
    toast(`Exported ${orderedHolidays.length} closures as CSV`, 'success');
  };

  /* ---- holiday writes: dry run first; bookings it would cancel are confirmed ---- */

  /**
   * Dry run, then confirm — straight away when nothing is affected, else
   * after the user approves the named bookings. The confirm carries one
   * `Idempotency-Key` per action (07·P-F9) and the preview token (BE-33).
   * Resolves `failed` only for an error before any confirmation was asked
   * (the modal then shows it on its fields); later errors are toasted.
   */
  const startHolidayOp = async (op: HolidayOp): Promise<HolidaySaveOutcome> => {
    // Filled from the callbacks below (a holder object, so TypeScript keeps its type).
    const state: { asking: boolean; early: HolidaySaveOutcome | null } = {
      asking: false,
      early: null,
    };
    await holidayConfirm.run({
      attempt: (mode) => {
        state.asking = state.asking || mode.confirm;
        return op.kind === 'save'
          ? saveHoliday.mutateAsync({ existing: op.existing, input: op.input, mode })
          : removeHoliday.mutateAsync({ holiday: op.holiday, mode });
      },
      onApplied: (change) =>
        toast(holidayOpSuccessCopy(op, change.affectedBookings.length), 'success'),
      onError: (error) => {
        if (!state.asking && state.early === null) state.early = { status: 'failed', error };
        else toast(errorCopy(error), 'error');
      },
    });
    return state.early ?? { status: 'done' };
  };

  /* ---- banners ---- */

  const saveBannerInput = async (input: BannerInput): Promise<boolean> => {
    const editing = bannerEdit?.banner ?? null;
    try {
      if (editing) {
        await updateBanner.mutateAsync({
          id: editing.id,
          changes: input,
          version: editing.version,
        });
        toast('Banner saved', 'success');
      } else {
        const nextOrder = banners.reduce((max, b) => Math.max(max, b.sortOrder + 1), 0);
        await createBanner.mutateAsync({ input, sortOrder: nextOrder });
        toast('Banner scheduled — it goes live on its start date', 'success');
      }
      return true;
    } catch (error) {
      toast(errorCopy(error), 'error');
      return false;
    }
  };

  const toggleBanner = (b: HospitalBanner): void => {
    const nowEnabled = !b.isEnabled;
    updateBanner.mutate(
      { id: b.id, changes: { isEnabled: nowEnabled }, version: b.version },
      {
        onSuccess: () => toast(nowEnabled ? 'Banner resumed' : 'Banner paused', 'info'),
        onError: (error) => toast(errorCopy(error), 'error'),
      },
    );
  };

  const moveBanner = (index: number, dir: -1 | 1): void => {
    reorderBanners.mutate(moved(banners, index, dir), {
      onError: (error) => toast(`Order not fully saved — ${errorCopy(error)}`, 'error'),
    });
  };

  const confirmDelete = (): void => {
    if (!toDelete) return;
    const target = toDelete;
    setToDelete(null);
    if (target.kind === 'holiday') {
      void startHolidayOp({
        kind: 'remove',
        holiday: { id: target.id, version: target.version },
        name: target.label,
      }).then((outcome) => {
        if (outcome.status === 'failed') toast(errorCopy(outcome.error), 'error');
      });
      return;
    }
    deleteBanner.mutate(
      { id: target.id, version: target.version },
      {
        onSuccess: () => toast('Banner deleted — it is off the patient app', 'info'),
        onError: (error) => toast(errorCopy(error), 'error'),
      },
    );
  };

  if (!canView) {
    return (
      <Card>
        <EmptyState
          icon="lock"
          title="You do not have access to the hospital profile"
          message="Closures and published banners are limited to roles with the Hospital Settings view permission. Ask an administrator to grant it under Users & Roles."
        />
      </Card>
    );
  }

  const holidayTableState: TableStateSpec | undefined = holidaysQuery.isPending
    ? { kind: 'loading', rows: 4 }
    : holidaysQuery.isError
      ? {
          kind: 'error',
          title: 'The holiday calendar did not load',
          message: 'Nothing has changed. Retry to load it again.',
          onRetry: () => void holidaysQuery.refetch(),
        }
      : orderedHolidays.length === 0
        ? {
            kind: 'empty',
            icon: hasHolidayFilters ? 'search' : 'calendar-x',
            title: hasHolidayFilters
              ? 'No closures match your filters.'
              : 'No closures on the calendar.',
            message: hasHolidayFilters
              ? 'Clear the filters to see the whole calendar.'
              : 'Add the days the hospital or a department is closed — slot generation skips them.',
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
            Holiday calendar &amp; patient-app banners
          </div>
          <div className="text-caption text-text-muted">
            Closures stop slot generation; banners show on the hospital&apos;s page in the patient
            app. The hospital&apos;s name, address and logo are edited in Hospital Settings ›
            General.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex flex-col">
            <span className="text-caption text-text-muted">
              Hospital closed days (next {HORIZON_DAYS})
            </span>
            <span className="text-body text-text-strong font-semibold tabular-nums">
              {holidaysQuery.data ? closedDaysAhead : '—'}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-caption text-text-muted">Department closures</span>
            <span className="text-body text-text-strong font-semibold tabular-nums">
              {holidaysQuery.data ? departmentClosuresAhead : '—'}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-caption text-text-muted">Live banners</span>
            <span className="text-body text-text-strong font-semibold tabular-nums">
              {bannersQuery.data ? liveBanners.length : '—'}
            </span>
          </div>
        </div>
      </Card>

      <Card pad={16} className="flex flex-wrap items-center gap-3">
        <SegTabs tabs={TABS} value={tab} onChange={(t) => setTab(t as ProfileTab)} />
        <div className="flex-1" />
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

      {tab === 'Holiday Calendar' && (
        <Card>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <SectionTitle>Holiday Calendar</SectionTitle>
            <InfoDot text="This calendar is what slot generation reads: no slots are created for a closed day, and the patient app shows the day as unavailable. A closure covers the whole hospital or one department, and blocks walk-ins too." />
            <div className="flex-1" />
            <Button
              variant="secondary"
              icon="download"
              onClick={exportHolidaysCsv}
              disabled={!holidaysQuery.data}
            >
              Export CSV
            </Button>
          </div>

          {holidaysQuery.data && (
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
                    } (${holidayAppliesTo(nextClosure, departmentNames)}). The whole hospital is closed on ${closedDaysAhead} ${
                      closedDaysAhead === 1 ? 'day' : 'days'
                    } over the next ${HORIZON_DAYS} days${
                      departmentClosuresAhead > 0
                        ? `, plus ${departmentClosuresAhead} department ${departmentClosuresAhead === 1 ? 'closure' : 'closures'}`
                        : ''
                    }.`
                  : `Nothing closed in the next ${HORIZON_DAYS} days — every working day generates slots.`}
              </span>
            </div>
          )}

          <div className="mb-4.5 flex flex-wrap items-center gap-3">
            <RefreshBtn
              onRefresh={async () => {
                await holidaysQuery.refetch();
              }}
              title="Refresh the holiday calendar"
            />
            <FilterSelect
              value={scopeFilter}
              options={[ANY_SCOPE, ...HOLIDAY_SCOPE_OPTIONS]}
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
              const past = h.to < today;
              const days = holidayDayCount(h.from, h.to);
              const appliesTo = holidayAppliesTo(h, departmentNames);
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
                  <td className={cn(tdClass, 'text-right tabular-nums')}>{days}</td>
                  <td className={tdClass}>
                    <div className="flex flex-col">
                      <span className="text-text-strong font-medium">{appliesTo}</span>
                      <span className="text-caption text-text-muted">{holidayScopeOf(h)}</span>
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
                              version: h.version,
                              label: h.name,
                              body: `Removing “${h.name}” makes ${days} ${
                                days === 1 ? 'day' : 'days'
                              } bookable again, and slots will be generated for ${appliesTo.toLowerCase()}.`,
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
                {hiddenCount > 0
                  ? `${hiddenCount} scheduled-for-now ${
                      hiddenCount === 1 ? 'banner is' : 'banners are'
                    } held back because the hospital is not visible in the patient app. `
                  : ''}
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
              <RefreshBtn
                onRefresh={async () => {
                  await bannersQuery.refetch();
                }}
                title="Refresh banners"
              />
            </div>
            {bannersQuery.isPending ? (
              <SkeletonCards count={2} lines={3} />
            ) : bannersQuery.isError ? (
              <ErrorState
                inline
                title="Banners did not load"
                message="Nothing has changed. Retry to load them again."
                onRetry={() => void bannersQuery.refetch()}
              />
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
                  const state = statuses.get(b.id) ?? 'Scheduled';
                  const span = bannerWindow(b);
                  return (
                    <div
                      key={b.id}
                      className={cn(
                        'flex flex-wrap items-center gap-3.5 px-1 py-3.5',
                        i < banners.length - 1 && 'border-border-soft border-b',
                      )}
                    >
                      <Can
                        perm="Hospital Settings.edit"
                        disableInstead
                        disabledTitle="Your role cannot change banners"
                      >
                        <div className="flex flex-none flex-col gap-0.5">
                          <IconBtn
                            name="chevron-up"
                            label="Move banner up"
                            title={`Move “${b.title}” up`}
                            box={26}
                            size={15}
                            disabled={i === 0 || reorderBanners.isPending}
                            onClick={() => moveBanner(i, -1)}
                          />
                          <IconBtn
                            name="chevron-down"
                            label="Move banner down"
                            title={`Move “${b.title}” down`}
                            box={26}
                            size={15}
                            disabled={i === banners.length - 1 || reorderBanners.isPending}
                            onClick={() => moveBanner(i, 1)}
                          />
                        </div>
                      </Can>
                      <span className="text-body text-text-muted w-4.5 flex-none text-center font-medium tabular-nums">
                        {i + 1}
                      </span>
                      <PatientBannerThumb
                        img={b.imageFileId ? (imageUrls[b.imageFileId] ?? null) : null}
                        title={b.title}
                      />
                      <div className="min-w-50 flex-1">
                        <div className="text-body text-text-strong font-medium">{b.title}</div>
                        <div className="text-caption text-text-muted line-clamp-2">
                          {b.body ?? ''}
                        </div>
                        <div className="text-caption text-text-muted mt-0.5 tabular-nums">
                          {span.from ? fmtDate(span.from) : 'Now'} –{' '}
                          {span.to ? fmtDate(span.to) : 'No end date'} ·{' '}
                          {BANNER_AUDIENCE_LABEL[b.audience]}
                        </div>
                      </div>
                      <Badge status={state} />
                      {state !== 'Expired' && (
                        <Can
                          perm="Hospital Settings.edit"
                          disableInstead
                          disabledTitle="Your role cannot change banners"
                        >
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={updateBanner.isPending}
                            onClick={() => toggleBanner(b)}
                          >
                            {b.isEnabled ? 'Pause' : 'Resume'}
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
                              version: b.version,
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

      {holidayEdit && (
        <HolidayModal
          key={holidayEdit.holiday?.id ?? 'new-holiday'}
          open
          holiday={holidayEdit.holiday}
          departments={departments}
          onClose={() => setHolidayEdit(null)}
          onSave={(input) =>
            startHolidayOp({
              kind: 'save',
              existing: holidayEdit.holiday
                ? { id: holidayEdit.holiday.id, version: holidayEdit.holiday.version }
                : null,
              input,
            })
          }
        />
      )}
      {bannerEdit && (
        <PatientBannerModal
          key={bannerEdit.banner?.id ?? 'new-banner'}
          open
          banner={bannerEdit.banner}
          imageUrl={
            bannerEdit.banner?.imageFileId
              ? (imageUrls[bannerEdit.banner.imageFileId] ?? null)
              : null
          }
          onClose={() => setBannerEdit(null)}
          onSave={saveBannerInput}
        />
      )}

      <ConfirmModal
        open={toDelete != null}
        title={toDelete?.kind === 'holiday' ? 'Remove this closure?' : 'Delete this banner?'}
        body={toDelete?.body ?? ''}
        confirmLabel={toDelete?.kind === 'holiday' ? 'Remove Closure' : 'Delete'}
        danger
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
      />

      <ScheduleChangeModal {...holidayConfirm.modal} />
    </div>
  );
}
