import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { HospitalHoursDay } from '@/features/settings/domain/entities/settings.entities';
import { settingsKeys } from '@/features/settings/application/queries/settings.keys';
import { replaceHospitalHours } from '@/features/settings/application/usecases/replaceHospitalHours';
import { refreshAfterScheduleChange } from '@/features/slots/application/queries/scheduleRefresh';

/**
 * Replace the hospital's week of hours. Last write wins (no version on
 * hours). The backend re-materialises slots afterwards, so the slot grid is
 * refreshed too (07·F15, UAT-17).
 */
export function useReplaceHospitalHoursMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (days: readonly HospitalHoursDay[]) =>
      unwrap(await replaceHospitalHours(days)),
    onSuccess: (hours) => {
      queryClient.setQueryData(settingsKeys.hours(), hours);
      refreshAfterScheduleChange(queryClient, {
        cancelledBookings: 0,
        rematerialisationQueued: true,
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: settingsKeys.hours() }),
  });
}
