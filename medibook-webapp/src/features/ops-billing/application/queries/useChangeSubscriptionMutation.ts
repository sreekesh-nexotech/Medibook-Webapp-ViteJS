import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { SubscriptionChange } from '@/features/ops-billing/domain/entities/billing.entities';
import { invalidateAfterBillingChange } from '@/features/ops-billing/application/queries/billing.keys';
import { changeSubscription } from '@/features/ops-billing/application/usecases/changeSubscription';

interface ChangeSubscriptionInput {
  readonly id: string;
  readonly change: SubscriptionChange;
  readonly version: number | null;
}

/**
 * Change a hospital's plan or billing period (immediate, with proration) or
 * its grace override. Billing, plan subscriber counts and the hospital page
 * are re-read.
 */
export function useChangeSubscriptionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, change, version }: ChangeSubscriptionInput) =>
      unwrap(await changeSubscription(id, change, version)),
    onSettled: () => invalidateAfterBillingChange(queryClient),
  });
}
