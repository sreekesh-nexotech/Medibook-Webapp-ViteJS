import { useState } from 'react';

import type {
  AffectedBooking,
  ScheduleChange,
} from '@/features/doctors/domain/entities/doctors.types';

/** One write that may need confirming. `attempt(false)` is the dry run. */
export interface ScheduleWriteRequest<T> {
  readonly attempt: (confirm: boolean) => Promise<ScheduleChange<T>>;
  readonly onApplied: (change: ScheduleChange<T>) => void;
  readonly onError: (error: unknown) => void;
}

interface Pending {
  readonly affected: readonly AffectedBooking[];
  readonly confirm: () => Promise<void>;
}

/**
 * The dry-run → confirm flow every booking-affecting write uses (Q32, Q73):
 * 1. dry run;
 * 2. applied already (an edit that touches no schedule) or nothing affected →
 *    apply straight away;
 * 3. otherwise hold it and let `ScheduleChangeModal` ask the user, naming the
 *    bookings that confirming cancels (with a full refund).
 */
export function useScheduleConfirm() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const run = async <T>(request: ScheduleWriteRequest<T>): Promise<void> => {
    const apply = async () => {
      setIsApplying(true);
      try {
        request.onApplied(await request.attempt(true));
      } catch (error) {
        request.onError(error);
      } finally {
        setIsApplying(false);
        setPending(null);
      }
    };
    try {
      const dry = await request.attempt(false);
      if (!dry.dryRun) {
        request.onApplied(dry);
        return;
      }
      if (dry.affectedBookings.length === 0) {
        await apply();
        return;
      }
      setPending({ affected: dry.affectedBookings, confirm: apply });
    } catch (error) {
      request.onError(error);
    }
  };

  return {
    run,
    modal: {
      affected: pending?.affected ?? null,
      isApplying,
      onConfirm: () => void pending?.confirm(),
      onCancel: () => setPending(null),
    },
  };
}
