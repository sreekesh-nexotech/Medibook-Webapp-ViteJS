import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';
import { useReplayKeys } from '@/shared/hooks/useReplayKeys';

import { profileKeys } from '@/features/settings/application/queries/profile.keys';
import { removeHoliday } from '@/features/settings/application/usecases/removeHoliday';
import type { HolidayTarget } from '@/features/settings/domain/entities/profile.entities';

interface RemoveHolidayInput {
  /** The closure at the version shown. */
  readonly target: HolidayTarget;
  /** `false` = dry run: nothing is applied. */
  readonly confirm: boolean;
}

function intentOf({ target, confirm }: RemoveHolidayInput): string {
  return `${target.id}:${confirm ? 'apply' : 'preview'}`;
}

/** Remove a closure. Only a confirmed write changes the calendar. */
export function useRemoveHolidayMutation() {
  const queryClient = useQueryClient();
  const replay = useReplayKeys();
  return useMutation({
    mutationFn: async (variables: RemoveHolidayInput) =>
      unwrap(
        await removeHoliday(
          variables.target,
          variables.confirm,
          replay.keyFor(intentOf(variables)),
        ),
      ),
    onSuccess: (change, variables) => {
      replay.done(intentOf(variables));
      if (!change.dryRun) void queryClient.invalidateQueries({ queryKey: profileKeys.holidays() });
    },
  });
}
