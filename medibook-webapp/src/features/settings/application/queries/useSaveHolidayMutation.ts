import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { HolidayInput } from '@/features/settings/domain/entities/profile.entities';
import { profileKeys } from '@/features/settings/application/queries/profile.keys';
import { saveHoliday } from '@/features/settings/application/usecases/saveHoliday';

interface SaveHolidayInput {
  /** `null` to add a closure. */
  readonly id: string | null;
  readonly input: HolidayInput;
  /** `false` = dry run: nothing is applied. */
  readonly confirm: boolean;
}

/** Add or edit a closure. Only a confirmed write changes the calendar. */
export function useSaveHolidayMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input, confirm }: SaveHolidayInput) =>
      unwrap(await saveHoliday(id, input, confirm)),
    onSuccess: (change) => {
      if (!change.dryRun) void queryClient.invalidateQueries({ queryKey: profileKeys.holidays() });
    },
  });
}
