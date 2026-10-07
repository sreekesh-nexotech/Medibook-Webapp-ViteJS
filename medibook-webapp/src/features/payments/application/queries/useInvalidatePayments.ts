import { useQueryClient } from '@tanstack/react-query';

import { paymentsKeys } from '@/features/payments/application/queries/payments.keys';

/**
 * Re-read every payment query — lines, totals, refunds and the cash drawer
 * cards (F10). The desk actions this screen borrows from the appointments
 * feature (collect) refresh that feature's caches, not these, so the screen
 * calls this after each one succeeds, and its Refresh button does too.
 */
export function useInvalidatePayments(): () => Promise<void> {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: paymentsKeys.all });
}
