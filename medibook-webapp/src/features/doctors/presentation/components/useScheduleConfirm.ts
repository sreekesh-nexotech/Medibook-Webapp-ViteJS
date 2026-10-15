import { useRef, useState } from 'react';

import { toast } from '@/shared/ui/toast/toast.store';

import type {
  AffectedBooking,
  ScheduleChange,
  ScheduleWriteMode,
} from '@/features/doctors/domain/entities/doctors.types';

import {
  isIdempotencyConflict,
  isPreviewStale,
  unpreviewedBookings,
  unpreviewedCopy,
} from './scheduleConfirm';

/** One write that may need confirming. `attempt` is called with a dry-run or confirm mode. */
export interface ScheduleWriteRequest<T> {
  readonly attempt: (mode: ScheduleWriteMode) => Promise<ScheduleChange<T>>;
  readonly onApplied: (change: ScheduleChange<T>) => void | Promise<void>;
  readonly onError: (error: unknown) => void;
}

interface Pending {
  readonly affected: readonly AffectedBooking[];
  /** Under way or done — the change keeps them (L-21). */
  readonly kept: readonly AffectedBooking[];
  /** The server refused the first confirm because the affected bookings changed. */
  readonly changed: boolean;
  readonly confirm: () => Promise<void>;
}

/** Shown when a confirm's replay key was already used with another request. */
const MAYBE_APPLIED =
  'This change may already have been saved from an earlier attempt. The schedule has been reloaded — check it before trying again.';

function newKey(): string {
  return crypto.randomUUID();
}

/**
 * The dry-run → confirm flow every booking-affecting write uses (Q32, Q73):
 * 1. dry run (its own fresh `Idempotency-Key`);
 * 2. applied already (an edit that touches no schedule) → done;
 * 3. nothing affected or kept → confirm straight away;
 * 4. otherwise hold it and let `ScheduleChangeModal` name the bookings that
 *    confirming cancels (with a full refund) and those it keeps because the
 *    patient is already in consultation or done (L-21).
 *
 * The confirm is sent with the dry run's preview token (BE-33) and one
 * `Idempotency-Key` per user action: if Apply fails (network, 5xx) the modal
 * stays open and Apply retries with the same key, so a confirm whose answer
 * was lost is replayed rather than applied twice (D-21, UAT-16). When the
 * server says the affected bookings changed since the preview, the flow
 * previews again and shows the new list instead of applying blindly.
 */
export function useScheduleConfirm() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  // The current action's replay key; kept until a confirm succeeds.
  const confirmKey = useRef<string | null>(null);

  const run = async <T>(request: ScheduleWriteRequest<T>): Promise<void> => {
    const preview = async (changed: boolean): Promise<void> => {
      const dry = await request.attempt({ confirm: false, idempotencyKey: newKey() });
      if (!dry.dryRun) {
        await request.onApplied(dry);
        return;
      }
      const apply = async (): Promise<void> => {
        confirmKey.current ??= newKey();
        setIsApplying(true);
        try {
          const done = await request.attempt({
            confirm: true,
            idempotencyKey: confirmKey.current,
            previewToken: dry.previewToken,
          });
          confirmKey.current = null;
          setPending(null);
          const extra = unpreviewedBookings(dry.affectedBookings, done.affectedBookings);
          if (extra.length > 0) toast(unpreviewedCopy(extra), 'info');
          await request.onApplied(done);
        } catch (error) {
          if (isPreviewStale(error)) {
            // A different preview token makes a different request: new key.
            confirmKey.current = null;
            setPending(null);
            try {
              await preview(true);
            } catch (again) {
              request.onError(again);
            }
            return;
          }
          if (isIdempotencyConflict(error)) {
            confirmKey.current = null;
            setPending(null);
            request.onError({ ...error, message: MAYBE_APPLIED });
            return;
          }
          // Keep the modal (if any) open: Apply retries with the same key.
          request.onError(error);
        } finally {
          setIsApplying(false);
        }
      };
      const kept = dry.notCancellableBookings;
      if (dry.affectedBookings.length === 0 && kept.length === 0 && !changed) {
        await apply();
        return;
      }
      setPending({ affected: dry.affectedBookings, kept, changed, confirm: apply });
    };
    try {
      await preview(false);
    } catch (error) {
      request.onError(error);
    }
  };

  return {
    run,
    modal: {
      affected: pending?.affected ?? null,
      kept: pending?.kept ?? [],
      changed: pending?.changed ?? false,
      isApplying,
      onConfirm: () => void pending?.confirm(),
      onCancel: () => {
        confirmKey.current = null;
        setPending(null);
      },
    },
  };
}
