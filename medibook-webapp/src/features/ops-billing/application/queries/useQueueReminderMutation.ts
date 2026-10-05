import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { billingKeys } from '@/features/ops-billing/application/queries/billing.keys';
import { queueInvoiceReminder } from '@/features/ops-billing/application/usecases/queueInvoiceReminder';

/** Queue a manual payment reminder; the backend delivers it. */
export function useQueueReminderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await queueInvoiceReminder(id)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: billingKeys.all }),
  });
}
