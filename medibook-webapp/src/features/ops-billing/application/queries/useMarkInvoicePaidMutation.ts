import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { MarkPaidInput } from '@/features/ops-billing/domain/entities/billing.entities';
import { invalidateAfterBillingChange } from '@/features/ops-billing/application/queries/billing.keys';
import { markInvoicePaid } from '@/features/ops-billing/application/usecases/markInvoicePaid';

/** Record a payment received outside the gateway (full or partial). */
export function useMarkInvoicePaidMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
      idempotencyKey,
    }: {
      readonly id: string;
      readonly input: MarkPaidInput;
      /** One key per submit intent (set when the modal opens). */
      readonly idempotencyKey: string;
    }) => unwrap(await markInvoicePaid(id, input, idempotencyKey)),
    onSettled: () => invalidateAfterBillingChange(queryClient),
  });
}
