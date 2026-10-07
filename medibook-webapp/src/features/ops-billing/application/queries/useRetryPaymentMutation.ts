import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { invalidateAfterBillingChange } from '@/features/ops-billing/application/queries/billing.keys';
import { retryPayment } from '@/features/ops-billing/application/usecases/retryPayment';

interface RetryPaymentInput {
  readonly id: string;
  /** One key per retry intent, so a double click retries once. */
  readonly idempotencyKey: string;
}

/** Ask the gateway to retry a failed payment (`billing.edit`; 501 until retries exist). */
export function useRetryPaymentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, idempotencyKey }: RetryPaymentInput) =>
      unwrap(await retryPayment(id, idempotencyKey)),
    onSettled: () => invalidateAfterBillingChange(queryClient),
  });
}
