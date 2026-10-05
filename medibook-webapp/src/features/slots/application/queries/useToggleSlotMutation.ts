import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { slotsKeys } from '@/features/slots/application/queries/slots.keys';
import { blockSlot } from '@/features/slots/application/usecases/blockSlot';
import { openSlot } from '@/features/slots/application/usecases/openSlot';

interface ToggleSlotInput {
  readonly slotId: string;
  /** `block` an open slot, or `open` a blocked one. */
  readonly action: 'block' | 'open';
}

/** Block or open one slot from the grid; the grid re-reads either way. */
export function useToggleSlotMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ slotId, action }: ToggleSlotInput) =>
      unwrap(
        action === 'block' ? await blockSlot(slotId, crypto.randomUUID()) : await openSlot(slotId),
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: slotsKeys.grids() }),
  });
}
