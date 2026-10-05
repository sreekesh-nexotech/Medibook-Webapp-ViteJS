import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { slotsKeys } from '@/features/slots/application/queries/slots.keys';
import { regenerateSlots } from '@/features/slots/application/usecases/regenerateSlots';

/** Re-materialise slots for one doctor, or the whole hospital, over the booking window. */
export function useRegenerateSlotsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (doctorId: string | null) => unwrap(await regenerateSlots(doctorId)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: slotsKeys.all }),
  });
}
