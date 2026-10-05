import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { BulkSlotRequest } from '@/features/slots/domain/entities/slots.entities';
import { slotsKeys } from '@/features/slots/application/queries/slots.keys';
import { applyBulkSlots } from '@/features/slots/application/usecases/applyBulkSlots';

interface ApplyBulkSlotsInput {
  readonly request: BulkSlotRequest;
  /** One key per confirmation, so a retried submit is not applied twice. */
  readonly idempotencyKey: string;
}

/** Execute a bulk open / block. A block cancels affected bookings with a full refund. */
export function useApplyBulkSlotsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ request, idempotencyKey }: ApplyBulkSlotsInput) =>
      unwrap(await applyBulkSlots(request, idempotencyKey)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: slotsKeys.all }),
  });
}
