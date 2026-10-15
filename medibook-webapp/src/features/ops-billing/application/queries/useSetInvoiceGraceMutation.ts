import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { invalidateAfterBillingChange } from '@/features/ops-billing/application/queries/billing.keys';
import { setInvoiceGrace } from '@/features/ops-billing/application/usecases/setInvoiceGrace';

/** Move the date an unpaid invoice's grace window closes. */
export function useSetInvoiceGraceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      graceEndsAt,
    }: {
      readonly id: string;
      readonly graceEndsAt: string;
    }) => unwrap(await setInvoiceGrace(id, graceEndsAt)),
    onSettled: () => invalidateAfterBillingChange(queryClient),
  });
}
