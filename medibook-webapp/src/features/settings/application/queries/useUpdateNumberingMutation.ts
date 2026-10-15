import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';
import type {
  NumberingChanges,
  NumberingSeries,
} from '@/features/settings/domain/entities/settings.entities';
import { settingsKeys } from '@/features/settings/application/queries/settings.keys';
import { updateNumberingSeries } from '@/features/settings/application/usecases/updateNumberingSeries';

interface UpdateNumberingInput {
  readonly kind: string;
  readonly changes: NumberingChanges;
  readonly version: number;
}

/** Change a series' format (never rewrites issued numbers, D-26). */
export function useUpdateNumberingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ kind, changes, version }: UpdateNumberingInput) =>
      unwrap(await updateNumberingSeries(kind, changes, version)),
    onSuccess: (series) => {
      queryClient.setQueryData<readonly NumberingSeries[]>(settingsKeys.numbering(), (list) =>
        list?.map((s) => (s.kind === series.kind ? series : s)),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: settingsKeys.numbering() }),
  });
}
