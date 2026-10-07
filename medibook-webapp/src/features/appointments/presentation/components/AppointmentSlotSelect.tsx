import { useEffect } from 'react';

import { useNow } from '@/shared/hooks/useNow';
import { Select } from '@/shared/ui/Select';

import { useSlotGridQuery } from '@/features/slots/application/queries/useSlotGridQuery';

import { bookableSlots, NO_SLOT_COPY } from './slotPicker.view';

/** Slots end while the form is open; re-check every minute. */
const CLOCK_TICK_MS = 60_000;

interface AppointmentSlotSelectProps {
  /** Hospital-local `yyyy-mm-dd`. */
  date: string;
  doctorId: string;
  timeZone: string;
  /** The chosen slot id, or `''`. */
  value: string;
  onChange: (slotId: string) => void;
  /** Slots already taken by other consultations of this visit. */
  excluded: readonly string[];
  ariaLabel: string;
}

/**
 * The bookable slots of one doctor on one date (H5's slot grid) — a walk-in
 * consultation must name one (Q74). Slots of closed sessions and slots that
 * have ended are never offered; while another date or doctor loads, nothing
 * from the previous one is offered; a chosen slot that disappears (taken,
 * blocked, session closed) is cleared (UAT-18). Loading, error and the reason
 * a day has no slot are said in the select itself so the row keeps its layout.
 */
export function AppointmentSlotSelect({
  date,
  doctorId,
  timeZone,
  value,
  onChange,
  excluded,
  ariaLabel,
}: AppointmentSlotSelectProps) {
  const grid = useSlotGridQuery({ date, departmentId: null, doctorId });
  const now = useNow(CLOCK_TICK_MS);
  // Placeholder data is the previous date's or doctor's grid: never offer it.
  const isLoading = grid.isPending || grid.isPlaceholderData;
  const choice =
    !isLoading && grid.data
      ? bookableSlots(grid.data.days, doctorId, excluded, now, timeZone)
      : { options: [], emptyReason: null };
  const isGone = value !== '' && !isLoading && !choice.options.some((o) => o.id === value);

  // The picked slot left the list (taken, ended, blocked): drop it so the
  // booking never sends a slot the screen no longer shows.
  useEffect(() => {
    if (isGone) onChange('');
  }, [isGone, onChange]);

  const placeholder = isLoading
    ? 'Loading slots…'
    : grid.isError
      ? 'Could not load slots — reselect the doctor to retry'
      : choice.emptyReason
        ? NO_SLOT_COPY[choice.emptyReason]
        : 'Select a time';

  const current = choice.options.find((o) => o.id === value)?.label ?? '';

  return (
    <Select
      value={current}
      placeholder={placeholder}
      options={choice.options.map((o) => o.label)}
      onChange={(label) => onChange(choice.options.find((o) => o.label === label)?.id ?? '')}
      aria-label={ariaLabel}
    />
  );
}
