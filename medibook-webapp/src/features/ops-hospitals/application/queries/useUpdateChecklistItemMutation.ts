import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { ChecklistUpdate } from '@/features/ops-hospitals/domain/entities/onboarding.entity';
import { invalidateOnboarding } from '@/features/ops-hospitals/application/queries/onboarding.keys';
import { updateChecklistItem } from '@/features/ops-hospitals/application/usecases/updateChecklistItem';

interface UpdateChecklistInput {
  readonly caseId: string;
  readonly code: string;
  readonly update: ChecklistUpdate;
  /** The item version (`If-Match`). */
  readonly version: number | null;
}

/** Mark a document received, verified, waived or sent back, or detach its scan. */
export function useUpdateChecklistItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ caseId, code, update, version }: UpdateChecklistInput) =>
      unwrap(await updateChecklistItem(caseId, code, update, version)),
    onSettled: () => invalidateOnboarding(queryClient),
  });
}
