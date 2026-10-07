import { formatIsoDayLabel, minutesToTimeLabel } from '@/features/doctors/domain/calendar';
import type {
  SlotCellView,
  SlotGridView,
  SlotRowView,
} from '@/features/slots/presentation/components/slotsGridView';
import { Icon } from '@/shared/ui/Icon';
import { IconBtn } from '@/shared/ui/IconBtn';

import { SlotCell } from './SlotCell';

interface SlotGridProps {
  grid: SlotGridView;
  /** Open / block one slot. Omit for a read-only grid (no edit permission). */
  onToggleSlot?: (row: SlotRowView, slot: SlotCellView) => void;
  /** The slot whose change is in flight, if any. */
  busySlotId?: string | null;
  /** Start a bulk update already scoped to one doctor. */
  onBulkForDoctor?: (doctorId: string) => void;
  /** Jump to the doctor's Availability tab to fix their hours. */
  onOpenDoctor?: (doctorId: string) => void;
}

/**
 * The doctor × time-of-day slot grid (audit HA-08).
 *
 * Not a `<table>`: the global "Comfy" 22px `td`/`th` padding rule is right for
 * data tables and wrong for a dense grid of 40px cells, and the shared
 * contract forbids overriding it per cell. It is instead a labelled,
 * keyboard-focusable horizontal scroll region (contract §8) whose cells are
 * real buttons carrying their own accessible names, so a screen-reader user
 * hears "Dr. Anya Sharma, 10:30 am — Available. Block this slot."
 */
export function SlotGrid({
  grid,
  onToggleSlot,
  busySlotId = null,
  onBulkForDoctor,
  onOpenDoctor,
}: SlotGridProps) {
  return (
    <div
      role="region"
      aria-label={`Slot grid for ${formatIsoDayLabel(grid.date)}`}
      tabIndex={0}
      className="border-border-soft w-full overflow-x-auto overscroll-x-contain rounded-md border"
    >
      <div className="min-w-max">
        <div className="bg-bg-tint flex items-stretch">
          <div className="text-body text-text-navy border-border-soft sticky left-0 z-10 w-56 flex-none border-r bg-white px-3.5 py-3 font-semibold">
            Doctor
          </div>
          {grid.columns.map((minutes) => (
            <div
              key={minutes}
              className="text-caption text-text-navy w-22 flex-none px-1 py-3 text-center font-semibold tabular-nums"
            >
              {minutesToTimeLabel(minutes)}
            </div>
          ))}
        </div>

        {grid.rows.map((row) => (
          <div key={row.doctorId} className="border-border-soft flex items-stretch border-t">
            <div className="border-border-soft sticky left-0 z-10 flex w-56 flex-none items-center gap-2 border-r bg-white px-3.5 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="text-body text-text-strong truncate font-medium">
                  {row.doctorName}
                </div>
                <div className="text-caption text-text-muted truncate">
                  {row.dept}
                  {row.room ? ` · Room ${row.room}` : ''}
                </div>
                {row.sessions.map((session) => (
                  <div
                    key={session.id}
                    className="text-caption text-text-muted flex items-center gap-1.5"
                    title={session.label}
                  >
                    <span className="truncate">{session.label}</span>
                    {session.statusLabel && (
                      <span className="text-d-700 bg-d-100 flex-none rounded-full px-1.5">
                        {session.statusLabel}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {onBulkForDoctor && (
                <IconBtn
                  name="sliders-horizontal"
                  label="Bulk update this doctor"
                  title={`Bulk update ${row.doctorName}`}
                  box={30}
                  size={14}
                  onClick={() => onBulkForDoctor(row.doctorId)}
                />
              )}
            </div>

            {row.closedReason ? (
              <div className="text-body text-text-muted flex flex-1 items-center gap-2 px-3.5 py-3">
                <Icon name="calendar-x" size={15} /> {row.closedReason}
                {onOpenDoctor && (
                  <button
                    type="button"
                    onClick={() => onOpenDoctor(row.doctorId)}
                    className="text-body text-blue cursor-pointer underline"
                  >
                    Edit availability
                  </button>
                )}
              </div>
            ) : (
              grid.columns.map((minutes) => {
                const slot = row.slots.find((s) => s.startMinutes === minutes);
                return (
                  <div key={minutes} className="w-22 flex-none p-1">
                    {slot ? (
                      <SlotCell
                        slot={slot}
                        doctorName={row.doctorName}
                        busy={slot.id === busySlotId}
                        onToggle={onToggleSlot ? (s) => onToggleSlot(row, s) : undefined}
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="bg-grey-200 border-border-soft block h-11 rounded-md border border-dashed"
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
