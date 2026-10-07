import { useMutation, useQueryClient } from '@tanstack/react-query';

import { isFailure, unwrap } from '@/core/error/failure';

import type {
  HolidayRef,
  HolidayWriteMode,
} from '@/features/settings/domain/entities/profile.entities';
import { profileKeys } from '@/features/settings/application/queries/profile.keys';
import { removeHoliday } from '@/features/settings/application/usecases/removeHoliday';
import { refreshAfterScheduleChange } from '@/features/slots/application/queries/scheduleRefresh';

interface RemoveHolidayInput {
  readonly holiday: HolidayRef;
  readonly mode: HolidayWriteMode;
}

/** Remove a closure. A confirmed removal reopens the days, so the slot grid refreshes too. */
export function useRemoveHolidayMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ holiday, mode }: RemoveHolidayInput) =>
      unwrap(await removeHoliday(holiday, mode)),
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
