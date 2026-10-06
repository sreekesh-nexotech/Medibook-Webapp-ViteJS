import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';
import { useReplayKeys } from '@/shared/hooks/useReplayKeys';

import type {
  HolidayInput,
  HolidayTarget,
} from '@/features/settings/domain/entities/profile.entities';
import { profileKeys } from '@/features/settings/application/queries/profile.keys';
import { saveHoliday } from '@/features/settings/application/usecases/saveHoliday';

interface SaveHolidayInput {
  /** `null` to add a closure; otherwise the closure at the version shown. */
  readonly target: HolidayTarget | null;
  readonly input: HolidayInput;
  /** `false` = dry run: nothing is applied. */
  readonly confirm: boolean;
}

/** One replay key per closure and step: the dry run and the confirm are different requests. */
function intentOf({ target, confirm }: SaveHolidayInput): string {
  return `${target?.id ?? 'new'}:${confirm ? 'apply' : 'preview'}`;
}

/**
 * Add or edit a closure. Only a confirmed write changes the calendar. A retry
 * of the same step reuses its idempotency key (DATA-04).
 */
export function useSaveHolidayMutation() {
  const queryClient = useQueryClient();
  const replay = useReplayKeys();
  return useMutation({
    mutationFn: async (variables: SaveHolidayInput) =>
      unwrap(
        await saveHoliday(
          variables.target,
          variables.input,
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
