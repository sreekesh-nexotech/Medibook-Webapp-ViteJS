import { useState } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { platformUsersKeys } from '@/features/ops-platform-users/application/queries/platformUsers.keys';
import { cancelBookings } from '@/features/ops-platform-users/application/usecases/cancelBookings';

/**
 * Cancel a blocked patient's paid upcoming bookings with a full refund (UAT T10).
 * One idempotency key per user action: a retry after a lost answer replays it, and
 * it is replaced only after a success.
 */
export function useCancelPlatformUserBookingsMutation() {
  const queryClient = useQueryClient();
  const [replayKey, setReplayKey] = useState(() => crypto.randomUUID());
  return useMutation({
    mutationFn: async (id: string) => unwrap(await cancelBookings(id, replayKey)),
    onSuccess: () => setReplayKey(crypto.randomUUID()),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: platformUsersKeys.all });
    },
  });
}
