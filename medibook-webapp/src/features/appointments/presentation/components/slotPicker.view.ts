import { formatTimeIn, isInstantOver } from '@/shared/lib/hospitalTime';

import type { DoctorSlotDay } from '@/features/slots/domain/entities/slots.entities';

/** Sessions that still take patients; closed and cancelled ones never do (UAT-18). */
const BOOKABLE_SESSIONS: ReadonlySet<string> = new Set(['scheduled', 'open', 'paused']);

export interface SlotOption {
  readonly id: string;
  readonly label: string;
}

/** Why a doctor's day offers no slot, so the picker can say so. */
export type NoSlotReason = 'no-session' | 'sessions-closed' | 'all-taken';

export interface SlotChoice {
  readonly options: readonly SlotOption[];
  readonly emptyReason: NoSlotReason | null;
}

/**
 * The slots a walk-in can take for one doctor and day (Q74): open slots of
 * sessions that still take patients, not yet ended (the desk may take a slot
 * until its end, the backend's walk-in rule), and not already picked by
 * another consultation of this visit. Times are the hospital's (UAT-47).
 */
export function bookableSlots(
  days: readonly DoctorSlotDay[],
  doctorId: string,
  excluded: readonly string[],
  now: number,
  timeZone: string,
): SlotChoice {
  const sessions = days.filter((d) => d.doctorId === doctorId).flatMap((d) => d.sessions);
  const live = sessions.filter((s) => BOOKABLE_SESSIONS.has(s.status));
  const options = live.flatMap((s) =>
    s.slots
      .filter(
        (slot) =>
          slot.state === 'open' && !isInstantOver(slot.endsAt, now) && !excluded.includes(slot.id),
      )
      .map((slot) => ({
        id: slot.id,
        label: `${formatTimeIn(slot.startsAt, timeZone)} · ${s.label}`,
      })),
  );
  const emptyReason: NoSlotReason | null =
    options.length > 0
      ? null
      : sessions.length === 0
        ? 'no-session'
        : live.length === 0
          ? 'sessions-closed'
          : 'all-taken';
  return { options, emptyReason };
}

export const NO_SLOT_COPY: Readonly<Record<NoSlotReason, string>> = {
  'no-session': 'The doctor has no session on this day',
  'sessions-closed': 'The doctor’s sessions this day are closed',
  'all-taken': 'No open slots left this day',
};
