import { useQueryClient } from '@tanstack/react-query';

import { paymentsKeys } from '@/features/payments/application/queries/payments.keys';

/**
 * Re-read every payment query. The desk actions this screen borrows from the
 * appointments feature (collect, refund) refresh that feature's caches, not
 * these, so the screen calls this after each one succeeds.
 */
export function useInvalidatePayments(): () => void {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: paymentsKeys.all });
  };
}
