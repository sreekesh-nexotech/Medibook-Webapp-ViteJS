import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { WS_PUSH_REFRESH_WINDOW_MS } from '@/core/config/api';
import type { SocketFrame } from '@/core/api/socket';
import { useCoalescedCallback } from '@/shared/hooks/useCoalescedCallback';
import { useSocket } from '@/shared/hooks/useSocket';

import {
  mergePush,
  NO_PUSHED_CHANGES,
  putSession,
  refreshPushed,
  type PushedChanges,
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
 * leaves "Up next". The re-reads a push asks for are coalesced
 * (`WS_PUSH_REFRESH_WINDOW_MS`): a lone push refreshes at once, a burst of
 * pushes refreshes once per window instead of once per push. Returns the
 * socket status for the "Live" indicator.
 *
 * `enabled` lets screens open it only for roles the channel admits
 * (`token_management.view`).
 */
export function useQueueLive(enabled = true) {
  const queryClient = useQueryClient();
  const pending = useRef<PushedChanges>(NO_PUSHED_CHANGES);
  const refresh = useCoalescedCallback(
    useCallback(() => {
      const changes = pending.current;
      pending.current = NO_PUSHED_CHANGES;
      refreshPushed(queryClient, changes);
    }, [queryClient]),
    WS_PUSH_REFRESH_WINDOW_MS,
  );
  const onFrame = useCallback(
    (frame: SocketFrame) => {
      if (frame.type === 'session.updated') {
        const session = readPushedSession(frame.data);
        if (session) putSession(queryClient, session);
        pending.current = mergePush(
          pending.current,
          session ? { sessionId: session.id } : 'bookings',
        );
        refresh();
        return;
      }
      if (BOOKING_FRAMES.has(frame.type)) {
        pending.current = mergePush(pending.current, 'bookings');
        refresh();
      }
    },
    [queryClient, refresh],
  );
  return useSocket({ path: QUEUE_SOCKET_PATH, surface: 'hospital', onFrame, enabled });
}
