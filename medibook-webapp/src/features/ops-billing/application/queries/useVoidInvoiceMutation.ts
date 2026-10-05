import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { billingKeys } from '@/features/ops-billing/application/queries/billing.keys';
import { voidInvoice } from '@/features/ops-billing/application/usecases/voidInvoice';

/** Void an unpaid invoice that has no payments recorded against it. */
export function useVoidInvoiceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { readonly id: string; readonly reason: string }) =>
      unwrap(await voidInvoice(id, reason)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: billingKeys.all }),
  });
}
