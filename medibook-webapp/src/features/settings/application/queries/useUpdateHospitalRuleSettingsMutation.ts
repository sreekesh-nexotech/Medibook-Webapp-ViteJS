import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { HospitalRuleChanges } from '@/features/settings/domain/entities/settings.entities';
import { settingsKeys } from '@/features/settings/application/queries/settings.keys';
import { updateHospitalRuleSettings } from '@/features/settings/application/usecases/updateHospitalRuleSettings';
import { refreshAfterScheduleChange } from '@/features/slots/application/queries/scheduleRefresh';

interface UpdateRulesInput {
  readonly changes: HospitalRuleChanges;
  readonly version: number;
}

/**
 * Update the hospital rulebook (`If-Match` on the version that was edited).
 * A booking-window change re-materialises slots, so the grid refreshes too
 * (07·F15).
 */
export function useUpdateHospitalRuleSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ changes, version }: UpdateRulesInput) =>
      unwrap(await updateHospitalRuleSettings(changes, version)),
    onSuccess: (rules, { changes }) => {
      queryClient.setQueryData(settingsKeys.rules(), rules);
      if (changes.bookingWindowDays !== undefined) {
        refreshAfterScheduleChange(queryClient, {
          cancelledBookings: 0,
          rematerialisationQueued: true,
        });
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: settingsKeys.rules() }),
  });
}
