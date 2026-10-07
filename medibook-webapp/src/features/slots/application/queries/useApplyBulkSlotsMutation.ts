import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { BulkSlotRequest } from '@/features/slots/domain/entities/slots.entities';
import { slotsKeys } from '@/features/slots/application/queries/slots.keys';
import { applyBulkSlots } from '@/features/slots/application/usecases/applyBulkSlots';
import { refreshAfterScheduleChange } from '@/features/slots/application/queries/scheduleRefresh';

interface ApplyBulkSlotsInput {
  readonly request: BulkSlotRequest;
  /** One key per confirmation, so a retried submit is not applied twice. */
  readonly idempotencyKey: string;
  /** The dry run's preview token (BE-33). */
  readonly previewToken: string | null;
}

/**
 * Execute a bulk open / block. A block cancels affected bookings with a full
 * refund, so the desk lists refresh with the grid (UAT-17).
 */
export function useApplyBulkSlotsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ request, idempotencyKey, previewToken }: ApplyBulkSlotsInput) =>
      unwrap(await applyBulkSlots(request, idempotencyKey, previewToken)),
    onSuccess: (done) =>
      refreshAfterScheduleChange(queryClient, {
        cancelledBookings: done.affectedBookings.length,
        rematerialisationQueued: false,
      }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: slotsKeys.all }),
  });
}
