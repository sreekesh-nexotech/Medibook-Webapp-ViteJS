import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { appointmentsKeys } from '@/features/appointments/application/queries/appointments.keys';
import { dashboardKeys } from '@/features/dashboard/application/queries/dashboard.keys';
import { paymentsKeys } from '@/features/payments/application/queries/payments.keys';
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
 * dashboards all move, so they are all re-read.
 */
export function useRefundBookingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ appointmentId, reason, idempotencyKey }: RefundBookingInput) =>
      unwrap(await refundBooking(appointmentId, reason, idempotencyKey)),
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: paymentsKeys.all }),
        queryClient.invalidateQueries({ queryKey: appointmentsKeys.all }),
        queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
      ]);
    },
  });
}
