import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import type { SocketFrame } from '@/core/api/socket';
import { useSocket } from '@/shared/hooks/useSocket';

import { refreshTodayAppointmentLists } from '@/features/appointments/application/queries/appointments.refresh';
import { applySession } from '@/features/token-queue/application/queries/tokenQueue.cache';
import { tokenQueueKeys } from '@/features/token-queue/application/queries/tokenQueue.keys';
import { readPushedSession } from '@/features/token-queue/application/usecases/tokenQueue.readPushedSession';

/** WebSocket channel of the hospital's live queue (`routing.py`). */
const QUEUE_SOCKET_PATH = '/hospital/queue';

/**
 * Keep the queue live over `ws/hospital/queue`: a `session.updated` push is
 * a full session snapshot and goes straight into the cache; a new booking
 * (`appointment.created`) refreshes the sessions and the appointment lists.
 * Returns the socket status for the screen's "Live" indicator.
 */
export function useQueueLive() {
  const queryClient = useQueryClient();
  const onFrame = useCallback(
    (frame: SocketFrame) => {
      if (frame.type === 'session.updated') {
        const session = readPushedSession(frame.data);
        if (session) applySession(queryClient, session);
        return;
      }
      if (frame.type === 'appointment.created') {
        void queryClient.invalidateQueries({ queryKey: tokenQueueKeys.sessions() });
        refreshTodayAppointmentLists(queryClient);
      }
    },
    [queryClient],
  );
  return useSocket({ path: QUEUE_SOCKET_PATH, surface: 'hospital', onFrame });
}
