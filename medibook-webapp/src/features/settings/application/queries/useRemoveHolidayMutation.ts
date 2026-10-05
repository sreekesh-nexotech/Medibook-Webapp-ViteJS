import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { profileKeys } from '@/features/settings/application/queries/profile.keys';
import { removeHoliday } from '@/features/settings/application/usecases/removeHoliday';

interface RemoveHolidayInput {
  readonly id: string;
  /** `false` = dry run: nothing is applied. */
  readonly confirm: boolean;
}

/** Remove a closure. Only a confirmed write changes the calendar. */
export function useRemoveHolidayMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, confirm }: RemoveHolidayInput) =>
      unwrap(await removeHoliday(id, confirm)),
    onSuccess: (change) => {
      if (!change.dryRun) void queryClient.invalidateQueries({ queryKey: profileKeys.holidays() });
    },
  });
}
