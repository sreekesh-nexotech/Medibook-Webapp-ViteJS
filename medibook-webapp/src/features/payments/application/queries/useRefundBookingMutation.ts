import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { refreshAfterRefund } from '@/features/payments/application/queries/payments.cache';
import { refundBooking } from '@/features/payments/application/usecases/refundBooking';

interface RefundBookingInput {
  readonly appointmentId: string;
  readonly reason: string;
  /** Minted when the refund dialog opened; reused if the user retries (D-21). */
  readonly idempotencyKey: string;
}

/**
 * Refund a booking in full — every captured line of its order, each to its
 * own method. Lines, refunds, the drawer's expected cash, the booking and the
 * dashboards all move, so they are all re-read (`refreshAfterRefund`).
 */
export function useRefundBookingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ appointmentId, reason, idempotencyKey }: RefundBookingInput) =>
      unwrap(await refundBooking(appointmentId, reason, idempotencyKey)),
    onSettled: () => refreshAfterRefund(queryClient),
  });
}
