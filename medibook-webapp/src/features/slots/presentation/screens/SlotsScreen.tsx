import { useMemo, useState, useTransition } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { hospitalPath, isHospitalRole } from '@/app/router/paths';
import { useCatalogStore } from '@/features/doctors/application/store/catalog.store';
import {
  addIsoDays,
  daysBetweenIso,
  formatIsoDayLabel,
  isoWeekdayLabel,
  todayIso,
} from '@/features/doctors/domain/calendar';
import {
  selectSchedulingHorizonDays,
  useSettingsStore,
} from '@/features/settings/application/store/settings.store';
import {
  durationCopy,
  parseDurationMinutes,
} from '@/features/settings/application/store/settings.rules';
import { useSlotGrid } from '@/features/slots/application/store/slots.selectors';
import { useSlotsStore } from '@/features/slots/application/store/slots.store';
import type { DoctorSlotRow, Slot } from '@/features/slots/domain/slot';
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

/** Slots & Availability — the hospital's slot grid, open/block and bulk update (HA-08). */
export function SlotsScreen() {
  const { role: roleParam } = useParams();
  const navigate = useNavigate();
  const role = isHospitalRole(roleParam) ? roleParam : 'admin';
  const docs = useCatalogStore((s) => s.docs);
  const depts = useCatalogStore((s) => s.depts);
  const settings = useSettingsStore((s) => s.settings);
  const blockSlot = useSlotsStore((s) => s.blockSlot);
  const openSlot = useSlotsStore((s) => s.openSlot);
  const canEdit = useCan('Doctors & Departments.edit');

  const [date, setDate] = useState(todayIso);
  const [deptF, setDeptF] = useState(ALL_DEPTS);
  const [doctorF, setDoctorF] = useState(ALL_DOCTORS);
  const [bulk, setBulk] = useState<{ doctorId: string | null } | null>(null);

  /**
   * Regenerating the grid is real work (every doctor × every slot of the day),
   * so date changes and refreshes run in a transition: `isPending` is React's
   * own report that the new grid is not on screen yet, which is what the
   * skeleton stands for — no artificial delay anywhere.
   */
  const [nonce, setNonce] = useState(0);
  const [isPending, startTransition] = useTransition();
  const goToDate = (next: string): void => {
    startTransition(() => setDate(next));
  };
  const refresh = (): void => {
    startTransition(() => setNonce((n) => n + 1));
  };

  const dept = deptF === ALL_DEPTS ? null : deptF;
  // The filter shows doctor names; the grid is keyed on canonical doctor ids.
  const doctorId =
    doctorF === ALL_DOCTORS ? null : (docs.find((d) => d.name === doctorF)?.id ?? null);
  const result = useSlotGrid({ date, dept, doctorId, nonce });

  const doctorOptions = useMemo(
    () =>
      docs.filter((d) => d.status !== 'Inactive').filter((d) => !dept || d.depts.includes(dept)),
    [docs, dept],
  );
  // Booking is open `horizonDays` calendar days ahead, counting today, so the
  // last bookable date is today + (horizon - 1).
  const horizonDays = selectSchedulingHorizonDays({ settings });
  const lastBookableIso = addIsoDays(todayIso(), Math.max(0, horizonDays - 1));
  const atHorizon = daysBetweenIso(date, lastBookableIso) <= 0;
  const slotMinutes = parseDurationMinutes(settings.rules.duration, 0);
  const bufferMinutes = parseDurationMinutes(settings.rules.buffer, 0);
  const hasFilters = deptF !== ALL_DEPTS || doctorF !== ALL_DOCTORS || date !== todayIso();
  const clearFilters = (): void => {
    setDeptF(ALL_DEPTS);
    setDoctorF(ALL_DOCTORS);
    goToDate(todayIso());
  };

  const toggleSlot = (row: DoctorSlotRow, slot: Slot): void => {
    const ref = { doctorId: row.doctorId, date, startMinutes: slot.startMinutes };
    if (slot.state === 'blocked') {
      openSlot(ref);
      toast(`${row.doctorName} · ${slot.label} opened`, 'success');
    } else {
      blockSlot(ref);
      toast(`${row.doctorName} · ${slot.label} blocked`, 'info');
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Card pad={16} className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <IconBtn
            name="chevron-left"
            label="Previous day"
            box={40}
            size={18}
            onClick={() => goToDate(addIsoDays(date, -1))}
          />
          <div className="w-44">
            <TextInput
              value={date}
              max={lastBookableIso}
              type="date"
              height={40}
              aria-label="Slot grid date"
              onChange={(v) => goToDate(v || todayIso())}
            />
          </div>
          <IconBtn
            name="chevron-right"
            label="Next day"
            box={40}
            size={18}
            disabled={atHorizon}
            onClick={() => goToDate(addIsoDays(date, 1))}
          />
          <Button size="sm" variant="secondary" onClick={() => goToDate(todayIso())}>
            Today
          </Button>
        </div>
        <FilterSelect
          value={deptF}
          options={[ALL_DEPTS, ...depts.map((d) => d.name)]}
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
        <RefreshBtn onRefresh={refresh} title="Regenerate the slot grid" />
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
            <Icon name="clock" size={13} /> {durationCopy(slotMinutes)} consultations
            {bufferMinutes > 0
              ? ` + ${durationCopy(bufferMinutes)} buffer`
              : ' back-to-back'} · {settings.hoursOpen}–{settings.hoursClose}
            <InfoDot text="Slot length, buffer and opening hours come from Hospital Settings. Each doctor's own hours, shift patterns, leave and date exceptions narrow them." />
          </div>
        </div>
        <span className="flex-1" />
        {result?.ok && <SlotLegend counts={result.grid.counts} />}
      </Card>

      {!settings.rules.onlineBooking && (
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

      {isPending || !result ? (
        <SkeletonTable rows={7} cols={8} />
      ) : !result.ok ? (
        <ErrorState
          title="The slot grid could not be generated"
          message={result.reason}
          onRetry={refresh}
        >
          <Button
            variant="ghost"
            icon="settings"
            onClick={() => navigate(hospitalPath(role, 'settings'))}
          >
            Open Hospital Settings
          </Button>
        </ErrorState>
      ) : result.grid.beyondHorizon ? (
        <Card>
          <EmptyState
            icon="calendar-clock"
            title="Booking is not open this far ahead yet"
            message={`The hospital takes bookings ${horizonDays} days ahead, to ${formatIsoDayLabel(lastBookableIso)}. No slots are generated past that, so none can be opened or blocked here. Change the scheduling horizon in Hospital Settings, or pick an earlier date.`}
            actionLabel="Go to the last bookable date"
            actionIcon="calendar-check"
            onAction={() => goToDate(lastBookableIso)}
          />
        </Card>
      ) : result.grid.hospitalClosed ? (
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
      ) : result.grid.rows.length === 0 ? (
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
        <SlotGrid
          grid={result.grid}
          onToggleSlot={canEdit ? toggleSlot : undefined}
          onBulkForDoctor={canEdit ? (id) => setBulk({ doctorId: id }) : undefined}
          onOpenDoctor={(id) => navigate(`${hospitalPath(role, 'doctors')}/${id}`)}
        />
      )}

      {bulk && (
        <BulkSlotModal
          date={date}
          dept={dept}
          initialDoctorId={bulk.doctorId}
          doctors={doctorOptions.map((d) => ({ id: d.id, name: d.name }))}
          onClose={() => setBulk(null)}
        />
      )}
    </div>
  );
}
