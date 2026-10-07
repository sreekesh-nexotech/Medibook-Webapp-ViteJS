import { useMemo, useState } from 'react';
import { formatInstant } from '@/shared/lib/format';
import { useNavigate, useParams } from 'react-router-dom';

import { hospitalPath, isHospitalRole } from '@/app/router/paths';
import { useDepartmentsQuery } from '@/features/doctors/application/queries/useDepartmentsQuery';
import { useDoctorsQuery } from '@/features/doctors/application/queries/useDoctorsQuery';
import {
  addIsoDays,
  daysBetweenIso,
  formatIsoDayLabel,
  isoWeekdayIndex,
  isoWeekdayLabel,
  minutesToTimeLabel,
  timeLabelToMinutes,
  todayIso,
} from '@/features/doctors/domain/calendar';
import { useHolidaysQuery } from '@/features/settings/application/queries/useHolidaysQuery';
import { useHospitalHoursQuery } from '@/features/settings/application/queries/useHospitalHoursQuery';
import { useHospitalProfileQuery } from '@/features/settings/application/queries/useHospitalProfileQuery';
import { useHospitalRuleSettingsQuery } from '@/features/settings/application/queries/useHospitalRuleSettingsQuery';
import { useLatestGenerationRunQuery } from '@/features/slots/application/queries/useLatestGenerationRunQuery';
import { useRegenerateSlotsMutation } from '@/features/slots/application/queries/useRegenerateSlotsMutation';
import { useSlotGridQuery } from '@/features/slots/application/queries/useSlotGridQuery';
import { useToggleSlotMutation } from '@/features/slots/application/queries/useToggleSlotMutation';
import type { SlotGenerationRun } from '@/features/slots/domain/entities/slots.entities';
import {
  toSlotGridView,
  type SlotCellView,
  type SlotRowView,
} from '@/features/slots/presentation/components/slotsGridView';
import { isFailure } from '@/core/error/failure';
import { useCan } from '@/shared/hooks/usePermission';
import { Button } from '@/shared/ui/Button';
import { Can } from '@/shared/ui/Can';
import { Card } from '@/shared/ui/Card';
import { ClearChip } from '@/shared/ui/ClearChip';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import { Icon } from '@/shared/ui/Icon';
import { IconBtn } from '@/shared/ui/IconBtn';
import { InfoDot } from '@/shared/ui/InfoDot';
import { RefreshBtn } from '@/shared/ui/RefreshBtn';
import { SkeletonTable } from '@/shared/ui/Skeleton';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import { BulkSlotModal } from '../components/BulkSlotModal';
import { SlotGrid } from '../components/SlotGrid';
import { SlotLegend } from '../components/SlotLegend';

const ALL_DEPTS = 'All Departments';
const ALL_DOCTORS = 'All Doctors';

const TOGGLE_FAILED = 'The slot could not be changed. Please try again.';
const REGENERATE_FAILED = 'Slots could not be regenerated. Please try again.';

function errorText(error: unknown, fallback: string): string {
  return isFailure(error) ? error.message : fallback;
}

function runTime(iso: string): string {
  return formatInstant(iso, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** How the last generation run is described, from the run record. */
function runCopy(run: SlotGenerationRun): string {
  const when = runTime(run.startedAt);
  if (run.error) return `Slot generation on ${when} failed: ${run.error}`;
  if (!run.finishedAt) return `Slots are being generated (started ${when})…`;
  const how = run.trigger === 'nightly' ? 'nightly run' : `${run.trigger.replace(/_/g, ' ')} run`;
  const range =
    run.horizonFrom && run.horizonTo
      ? ` · covers ${formatIsoDayLabel(run.horizonFrom)} – ${formatIsoDayLabel(run.horizonTo)}`
      : '';
  const changes = [
    `${run.createdCount} created`,
    run.updatedCount ? `${run.updatedCount} updated` : '',
    run.closedCount ? `${run.closedCount} closed` : '',
    run.preservedCount ? `${run.preservedCount} kept for bookings` : '',
  ]
    .filter(Boolean)
    .join(', ');
  return `Slots last generated ${when} (${how})${range} · ${changes}`;
}

/** Slots & Availability — the hospital's slot grid, open/block and bulk update (HA-08). */
export function SlotsScreen() {
  const { role: roleParam } = useParams();
  const navigate = useNavigate();
  const role = isHospitalRole(roleParam) ? roleParam : 'admin';
  const doctorsQuery = useDoctorsQuery();
  const departmentsQuery = useDepartmentsQuery();
  // Hospital Settings (H2): the booking horizon, opening hours and the online
  // booking switch. Slot length is per doctor session, not hospital-wide.
  const rulesQuery = useHospitalRuleSettingsQuery();
  const hoursQuery = useHospitalHoursQuery();
  const profileQuery = useHospitalProfileQuery();
  const holidaysQuery = useHolidaysQuery();
  const timeZone = profileQuery.data?.timezone ?? null;
  const canEdit = useCan('Doctors & Departments.edit');

  const [date, setDate] = useState(todayIso);
  const [deptF, setDeptF] = useState(ALL_DEPTS);
  const [doctorF, setDoctorF] = useState(ALL_DOCTORS);
  const [bulk, setBulk] = useState<{ doctorId: string | null } | null>(null);

  const docs = useMemo(() => doctorsQuery.data ?? [], [doctorsQuery.data]);
  const depts = useMemo(() => departmentsQuery.data ?? [], [departmentsQuery.data]);
  const departmentId = depts.find((d) => d.name === deptF)?.id ?? null;
  const doctorOptions = useMemo(
    () =>
      docs
        .filter((d) => d.status !== 'inactive')
        .filter((d) => !departmentId || d.departmentId === departmentId),
    [docs, departmentId],
  );
  const doctorId = doctorOptions.find((d) => d.name === doctorF)?.id ?? null;

  const gridQuery = useSlotGridQuery({ date, departmentId, doctorId });
  const latestRun = useLatestGenerationRunQuery();
  const toggle = useToggleSlotMutation();
  const regenerate = useRegenerateSlotsMutation();

  const grid = useMemo(() => {
    if (!gridQuery.data) return null;
    return toSlotGridView(date, gridQuery.data.days, {
      deptNames: new Map(depts.map((d) => [d.id, d.name])),
      rooms: new Map(docs.map((d) => [d.id, d.room])),
      timeZone,
      holidays: holidaysQuery.data ?? [],
    });
  }, [gridQuery.data, depts, docs, date, timeZone, holidaysQuery.data]);

  // The last date slots are generated for, as the backend states it
  // (`derived.booking_window_end_date`); the day-count fallback only covers
  // an older backend without it.
  const horizonDays = rulesQuery.data?.bookingWindowDays ?? null;
  const lastBookableIso =
    rulesQuery.data?.derived.bookingWindowEndDate ??
    (horizonDays === null ? null : addIsoDays(todayIso(), Math.max(0, horizonDays - 1)));
  const holiday = (holidaysQuery.data ?? []).find(
    (h) => h.departmentId === null && h.from <= date && date <= h.to,
  );
  const atHorizon = lastBookableIso !== null && daysBetweenIso(date, lastBookableIso) <= 0;
  const beyondHorizon = lastBookableIso !== null && daysBetweenIso(date, lastBookableIso) < 0;
  const dayHours = hoursQuery.data?.find((d) => d.weekday === isoWeekdayIndex(date));
  const hospitalClosed = dayHours?.isClosed === true;
  const hoursCopy = hoursLabel(dayHours?.opensAt ?? null, dayHours?.closesAt ?? null);
  const onlineBookingOff = profileQuery.data?.onlineBookingEnabled === false;
  const hasFilters = deptF !== ALL_DEPTS || doctorF !== ALL_DOCTORS || date !== todayIso();
  const clearFilters = (): void => {
    setDeptF(ALL_DEPTS);
    setDoctorF(ALL_DOCTORS);
    setDate(todayIso());
  };
  const refresh = async (): Promise<void> => {
    await Promise.all([gridQuery.refetch(), latestRun.refetch()]);
  };

  const toggleSlot = (row: SlotRowView, slot: SlotCellView): void => {
    const action = slot.state === 'blocked' ? 'open' : 'block';
    toggle.mutate(
      { slotId: slot.id, action },
      {
        onSuccess: () =>
          toast(
            `${row.doctorName} · ${slot.label} ${action === 'open' ? 'opened' : 'blocked'}`,
            action === 'open' ? 'success' : 'info',
          ),
        onError: (error) => toast(errorText(error, TOGGLE_FAILED), 'error', error),
      },
    );
  };

  const handleRegenerate = (): void => {
    regenerate.mutate(doctorId, {
      onSuccess: (res) =>
        toast(
          `Slots regenerated — ${res.createdCount} created, ${res.updatedCount} updated`,
          'success',
        ),
      onError: (error) => toast(errorText(error, REGENERATE_FAILED), 'error', error),
    });
  };

  const isCatalogLoading = doctorsQuery.isPending || departmentsQuery.isPending;
  const catalogError =
    (doctorsQuery.isLoadingError ? doctorsQuery.error : null) ??
    (departmentsQuery.isLoadingError ? departmentsQuery.error : null);
  const doctorsPage = gridQuery.data;
  const isTruncated = doctorsPage ? doctorsPage.total > doctorsPage.days.length : false;

  return (
    <div className="flex flex-col gap-5">
      <Card pad={16} className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <IconBtn
            name="chevron-left"
            label="Previous day"
            box={40}
            size={18}
            onClick={() => setDate(addIsoDays(date, -1))}
          />
          <div className="w-44">
            <TextInput
              value={date}
              max={lastBookableIso ?? undefined}
              type="date"
              height={40}
              aria-label="Slot grid date"
              onChange={(v) => setDate(v || todayIso())}
            />
          </div>
          <IconBtn
            name="chevron-right"
            label="Next day"
            box={40}
            size={18}
            disabled={atHorizon}
            onClick={() => setDate(addIsoDays(date, 1))}
          />
          <Button size="sm" variant="secondary" onClick={() => setDate(todayIso())}>
            Today
          </Button>
        </div>
        <FilterSelect
          value={deptF}
          options={[ALL_DEPTS, ...depts.filter((d) => d.isActive).map((d) => d.name)]}
          onChange={(v) => {
            setDeptF(v);
            setDoctorF(ALL_DOCTORS);
          }}
          aria-label="Filter slots by department"
        />
        <FilterSelect
          value={doctorF}
          options={[ALL_DOCTORS, ...doctorOptions.map((d) => d.name)]}
          onChange={setDoctorF}
          aria-label="Filter slots by doctor"
        />
        {hasFilters && <ClearChip onClick={clearFilters} label="Reset to today" />}
        <span className="flex-1" />
        <RefreshBtn onRefresh={refresh} title="Refresh the slot grid" />
        <Can perm={'Doctors & Departments.edit'} disableInstead>
          <Button icon="sliders-horizontal" onClick={() => setBulk({ doctorId: null })}>
            Bulk Update
          </Button>
        </Can>
      </Card>

      <Card pad={18} className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div>
          <div className="text-h3 text-text-strong">{formatIsoDayLabel(date)}</div>
          <div className="text-caption text-text-muted flex items-center gap-1.5">
            <Icon name="clock" size={13} />{' '}
            {hospitalClosed
              ? 'Hospital closed on this weekday'
              : hoursCopy
                ? `Hospital hours ${hoursCopy}`
                : 'Hospital hours not set'}
            <InfoDot text="Opening hours and holidays come from Hospital Settings. Each doctor's slot length and weekly sessions are set on their profile (Availability tab), and their leave and date exceptions narrow the slots further. Times are in the hospital's time zone." />
          </div>
          <div className="text-caption text-text-muted mt-1 flex flex-wrap items-center gap-1.5">
            <Icon name="refresh-cw" size={13} />
            {latestRun.isPending
              ? 'Checking when slots were last generated…'
              : latestRun.isLoadingError
                ? 'Could not read the last generation run.'
                : latestRun.data
                  ? runCopy(latestRun.data)
                  : 'Slots have not been generated yet.'}
            {canEdit && (
              <button
                type="button"
                onClick={handleRegenerate}
                disabled={regenerate.isPending}
                className="text-caption text-blue cursor-pointer underline disabled:cursor-default disabled:opacity-60"
              >
                {regenerate.isPending
                  ? 'Regenerating…'
                  : doctorId
                    ? `Regenerate ${doctorF}`
                    : 'Regenerate all slots'}
              </button>
            )}
          </div>
        </div>
        <span className="flex-1" />
        {grid && <SlotLegend counts={grid.counts} />}
      </Card>

      {holiday && (
        <Card pad={14} className="flex flex-wrap items-center gap-2">
          <Icon name="calendar-x" size={16} className="text-y-700" />
          <span className="text-body text-text-body">
            {holiday.name} — the hospital is closed
            {holiday.from === holiday.to
              ? ' on this date'
              : ` from ${formatIsoDayLabel(holiday.from)} to ${formatIsoDayLabel(holiday.to)}`}
            {holiday.note ? ` (${holiday.note})` : ''}. No slots are generated for it.
          </span>
          <span className="flex-1" />
          <Button
            size="sm"
            variant="ghost"
            icon="settings"
            onClick={() => navigate(hospitalPath(role, 'settings'))}
          >
            Holidays in Hospital Settings
          </Button>
        </Card>
      )}

      {onlineBookingOff && (
        <Card pad={14} className="flex flex-wrap items-center gap-2">
          <Icon name="triangle-alert" size={16} className="text-y-700" />
          <span className="text-body text-text-body">
            Online booking is switched off in Hospital Settings, so patients cannot book any of
            these slots from the app.
          </span>
          <span className="flex-1" />
          <Button
            size="sm"
            variant="ghost"
            icon="settings"
            onClick={() => navigate(hospitalPath(role, 'settings'))}
          >
            Hospital Settings
          </Button>
        </Card>
      )}

      {beyondHorizon && lastBookableIso ? (
        <Card>
          <EmptyState
            icon="calendar-clock"
            title="Booking is not open this far ahead yet"
            message={`The hospital takes bookings ${horizonDays} days ahead, to ${formatIsoDayLabel(lastBookableIso)}. No slots are generated past that, so none can be opened or blocked here. Change the scheduling horizon in Hospital Settings, or pick an earlier date.`}
            actionLabel="Go to the last bookable date"
            actionIcon="calendar-check"
            onAction={() => setDate(lastBookableIso)}
          />
        </Card>
      ) : hospitalClosed ? (
        <Card>
          <EmptyState
            icon="calendar-x"
            title={`The hospital is closed on ${isoWeekdayLabel(date)}`}
            message="No slots are generated for a day the hospital does not open. Change the weekly opening days in Hospital Settings, or pick another date."
            actionLabel="Open Hospital Settings"
            actionIcon="settings"
            onAction={() => navigate(hospitalPath(role, 'settings'))}
          />
        </Card>
      ) : catalogError ? (
        <ErrorState
          error={catalogError}
          title="Doctors and departments could not be loaded"
          message={errorText(catalogError, 'Please try again.')}
          onRetry={() => {
            void doctorsQuery.refetch();
            void departmentsQuery.refetch();
          }}
        />
      ) : gridQuery.isLoadingError && !grid ? (
        <ErrorState
          error={gridQuery.error}
          title="The slot grid could not be loaded"
          message={errorText(gridQuery.error, 'Please try again.')}
          onRetry={() => void gridQuery.refetch()}
        />
      ) : isCatalogLoading || !grid ? (
        <SkeletonTable rows={7} cols={8} />
      ) : grid.rows.length === 0 ? (
        <Card>
          <EmptyState
            icon="stethoscope"
            title={hasFilters ? 'No doctors match these filters' : 'No doctors to schedule'}
            message={
              hasFilters
                ? 'Reset the filters to see the whole roster for this date.'
                : 'Add a doctor to the catalogue and their slots appear here automatically.'
            }
            actionLabel={hasFilters ? 'Reset to today' : 'Add a doctor'}
            actionIcon={hasFilters ? undefined : 'plus'}
            onAction={
              hasFilters ? clearFilters : () => navigate(`${hospitalPath(role, 'doctors')}/new`)
            }
          />
        </Card>
      ) : (
        <>
          <SlotGrid
            grid={grid}
            busySlotId={toggle.isPending ? (toggle.variables?.slotId ?? null) : null}
            onToggleSlot={canEdit ? toggleSlot : undefined}
            onBulkForDoctor={canEdit ? (id) => setBulk({ doctorId: id }) : undefined}
            onOpenDoctor={(id) => navigate(`${hospitalPath(role, 'doctors')}/${id}`)}
          />
          {isTruncated && doctorsPage && (
            <div className="text-caption text-text-muted">
              Showing the first {doctorsPage.days.length} of {doctorsPage.total} doctors. Filter by
              department or doctor to see the rest.
            </div>
          )}
        </>
      )}

      {bulk && (
        <BulkSlotModal
          date={date}
          departmentId={departmentId}
          initialDoctorId={bulk.doctorId}
          doctors={doctorOptions.map((d) => ({ id: d.id, name: d.name }))}
          onClose={() => setBulk(null)}
        />
      )}
    </div>
  );
}

/** `"09:00"`, `"17:30"` → `"9:00 am–5:30 pm"`; `null` when either end is unset. */
function hoursLabel(opensAt: string | null, closesAt: string | null): string | null {
  const open = timeLabelToMinutes(opensAt);
  const close = timeLabelToMinutes(closesAt);
  if (open === null || close === null) return null;
  return `${minutesToTimeLabel(open)}–${minutesToTimeLabel(close)}`;
}
