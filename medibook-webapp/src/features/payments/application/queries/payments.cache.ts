import type { QueryClient } from '@tanstack/react-query';

import { appointmentsKeys } from '@/features/appointments/application/queries/appointments.keys';
import { dashboardKeys } from '@/features/dashboard/application/queries/dashboard.keys';
import { paymentsKeys } from '@/features/payments/application/queries/payments.keys';

/**
 * After a refund: re-read the payment lines, refunds and drawer, the booking
 * and the dashboards. Payment reads still in flight are cancelled first: one
 * sent just before the refund (a search that fired as Refund was clicked) can
 * be answered from the pre-refund rows, and a query with no data of its own
 * yet is not cancelled by `invalidateQueries` — the re-read joins that fetch
 * and keeps its stale answer, so the line kept showing "Paid" (live UAT C-4).
 */
export async function refreshAfterRefund(queryClient: QueryClient): Promise<void> {
  await queryClient.cancelQueries({ queryKey: paymentsKeys.all });
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: paymentsKeys.all }),
    queryClient.invalidateQueries({ queryKey: appointmentsKeys.all }),
    queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
  ]);
}
