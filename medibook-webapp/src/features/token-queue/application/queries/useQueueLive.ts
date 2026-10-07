import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import type { SocketFrame } from '@/core/api/socket';
import { useSocket } from '@/shared/hooks/useSocket';

import {
  applySession,
  refreshQueue,
} from '@/features/token-queue/application/queries/tokenQueue.cache';
import { readPushedSession } from '@/features/token-queue/application/usecases/tokenQueue.readPushedSession';

/** WebSocket channel of the hospital's live queue (`routing.py`). */
const QUEUE_SOCKET_PATH = '/hospital/queue';

/** Pushes that change who is booked without carrying a session snapshot. */
const BOOKING_FRAMES: ReadonlySet<string> = new Set([
  'appointment.created',
  'appointment.cancelled',
]);

/**
 * Keep the queue live over `ws/hospital/queue`: a `session.updated` push is
 * a full session snapshot and goes straight into the cache; a new booking or
 * a cancellation (`appointment.created` / `appointment.cancelled`, BE-20)
 * refreshes the sessions and the appointment lists, so a cancelled token
 * leaves "Up next". Returns the socket status for the "Live" indicator.
 *
 * `enabled` lets screens open it only for roles the channel admits
 * (`token_management.view`).
 */
export function useQueueLive(enabled = true) {
  const queryClient = useQueryClient();
  const onFrame = useCallback(
    (frame: SocketFrame) => {
      if (frame.type === 'session.updated') {
        const session = readPushedSession(frame.data);
        if (session) applySession(queryClient, session);
        else refreshQueue(queryClient);
        return;
      }
      if (BOOKING_FRAMES.has(frame.type)) refreshQueue(queryClient);
    },
    [queryClient],
  );
  return useSocket({ path: QUEUE_SOCKET_PATH, surface: 'hospital', onFrame, enabled });
}
