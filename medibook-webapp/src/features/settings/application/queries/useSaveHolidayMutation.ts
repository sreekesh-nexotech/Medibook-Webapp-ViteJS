import { useMutation, useQueryClient } from '@tanstack/react-query';

import { isFailure, unwrap } from '@/core/error/failure';

import type {
  HolidayInput,
  HolidayRef,
  HolidayWriteMode,
} from '@/features/settings/domain/entities/profile.entities';
import { profileKeys } from '@/features/settings/application/queries/profile.keys';
import { saveHoliday } from '@/features/settings/application/usecases/saveHoliday';
import { refreshAfterScheduleChange } from '@/features/slots/application/queries/scheduleRefresh';

interface SaveHolidayInput {
  /** `null` to add a closure; otherwise the closure at the version being edited. */
  readonly existing: HolidayRef | null;
  readonly input: HolidayInput;
  readonly mode: HolidayWriteMode;
}

/**
 * Add or edit a closure. Only a confirmed write changes the calendar — and
 * then slots close and bookings may be cancelled, so the slot grid and the
 * desk lists refresh too (07·P-F8, UAT-17). A version conflict reloads the
 * calendar so the next edit starts from the current row.
 */
export function useSaveHolidayMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ existing, input, mode }: SaveHolidayInput) =>
      unwrap(await saveHoliday(existing, input, mode)),
    onSuccess: (change) => {
      if (change.dryRun) return;
      void queryClient.invalidateQueries({ queryKey: profileKeys.holidays() });
      refreshAfterScheduleChange(queryClient, {
        cancelledBookings: change.affectedBookings.length,
        rematerialisationQueued: change.rematerialisationQueued,
      });
    },
    onError: (error) => {
      if (isFailure(error) && error.kind === 'conflict') {
        void queryClient.invalidateQueries({ queryKey: profileKeys.holidays() });
      }
    },
  });
}
