import { Select } from '@/shared/ui/Select';

import { timeOf } from '@/features/appointments/presentation/components/appointments.view';
import { useSlotGridQuery } from '@/features/slots/application/queries/useSlotGridQuery';

interface AppointmentSlotSelectProps {
  /** Hospital-local `yyyy-mm-dd`. */
  date: string;
  doctorId: string;
  /** The chosen slot id, or `''`. */
  value: string;
  onChange: (slotId: string) => void;
  /** Slots already taken by other consultations of this visit. */
  excluded: readonly string[];
  ariaLabel: string;
}

/**
 * The open slots of one doctor on one date (H5's slot grid) — a walk-in
 * consultation must name one (Q74). Loading, error and "no open slots" are
 * said in the select itself so the row keeps its layout.
 */
export function AppointmentSlotSelect({
  date,
  doctorId,
  value,
  onChange,
  excluded,
  ariaLabel,
}: AppointmentSlotSelectProps) {
  const grid = useSlotGridQuery({ date, departmentId: null, doctorId });
  const open =
    grid.data?.days
      .filter((d) => d.doctorId === doctorId)
      .flatMap((d) =>
        d.sessions.flatMap((s) =>
          s.slots
            .filter((slot) => slot.state === 'open' && !excluded.includes(slot.id))
            .map((slot) => ({ id: slot.id, label: `${timeOf(slot.startsAt)} · ${s.label}` })),
        ),
      ) ?? [];

  const placeholder = grid.isPending
    ? 'Loading slots…'
    : grid.isError
      ? 'Could not load slots — reselect the doctor to retry'
      : open.length === 0
        ? 'No open slots this day'
        : 'Select a time';

  const current = open.find((o) => o.id === value)?.label ?? '';

  return (
    <Select
      value={current}
      placeholder={placeholder}
      options={open.map((o) => o.label)}
      onChange={(label) => onChange(open.find((o) => o.label === label)?.id ?? '')}
      aria-label={ariaLabel}
    />
  );
}
