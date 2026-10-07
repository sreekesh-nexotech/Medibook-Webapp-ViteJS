import type { QueryClient } from '@tanstack/react-query';

import { appointmentsKeys } from '@/features/appointments/application/queries/appointments.keys';
import { dashboardKeys } from '@/features/dashboard/application/queries/dashboard.keys';
import { paymentsKeys } from '@/features/payments/application/queries/payments.keys';
import { slotsKeys } from '@/features/slots/application/queries/slots.keys';
import { tokenQueueKeys } from '@/features/token-queue/application/queries/tokenQueue.keys';

/**
 * After the background re-generation is queued, re-read the slot grid again
 * this long after the write — the debounced task usually lands within it.
 */
export const REMATERIALISE_REFRESH_MS = 8_000;

/** What an applied schedule-affecting write did, as far as other screens care. */
export interface ScheduleRefreshInput {
  /** Bookings the write cancelled (refunded in full). */
  readonly cancelledBookings: number;
  /** The server queued a re-materialisation of slots (they change shortly after). */
  readonly rematerialisationQueued: boolean;
}

/**
 * Refresh every screen a confirmed schedule change touches (UAT-17): the slot
 * grid always — weekly hours, leave, exceptions, slot length, hospital hours,
 * the booking window and holidays all change the inventory — and, when
 * bookings were cancelled, the appointment lists, the live queue, the
 * dashboards and the payments/refunds lists. When the server only queued
 * the re-generation, the grid is read once more after it has had time to run.
 */
export function refreshAfterScheduleChange(
  queryClient: QueryClient,
  { cancelledBookings, rematerialisationQueued }: ScheduleRefreshInput,
): void {
  void queryClient.invalidateQueries({ queryKey: slotsKeys.all });
  if (cancelledBookings > 0) {
    void queryClient.invalidateQueries({ queryKey: appointmentsKeys.all });
    void queryClient.invalidateQueries({ queryKey: tokenQueueKeys.all });
    void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    void queryClient.invalidateQueries({ queryKey: paymentsKeys.all });
  }
  if (rematerialisationQueued) {
    setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: slotsKeys.all });
    }, REMATERIALISE_REFRESH_MS);
  }
}
