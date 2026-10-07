import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type {
  NumberingChanges,
  NumberingKind,
  NumberingSeries,
} from '@/features/settings/domain/entities/settings.entities';
import { settingsKeys } from '@/features/settings/application/queries/settings.keys';
import { updateNumbering } from '@/features/settings/application/usecases/updateNumbering';

interface UpdateNumberingInput {
  readonly kind: NumberingKind;
  readonly changes: NumberingChanges;
  readonly version: number;
}

/** Change one number series (`If-Match` on the version that was edited). */
export function useUpdateNumberingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ kind, changes, version }: UpdateNumberingInput) =>
      unwrap(await updateNumbering(kind, changes, version)),
    onSuccess: (series) => {
      queryClient.setQueryData<readonly NumberingSeries[]>(settingsKeys.numbering(), (list) =>
        list?.map((s) => (s.kind === series.kind ? series : s)),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: settingsKeys.numbering() }),
  });
}
