import { useEffect, useRef, useState } from 'react';

import { openSocket } from '@/core/api/socket';
import type { SocketFrame, SocketStatus } from '@/core/api/socket';
import type { ApiSurface } from '@/core/api/surface';

interface UseSocketOptions {
  /** Channel path below `/ws`, e.g. `/hospital/queue`. */
  readonly path: string;
  readonly surface: ApiSurface;
  /** Called for every server push; may change between renders. */
  readonly onFrame: (frame: SocketFrame) => void;
  /** Hold the socket closed (e.g. until the user is signed in). Defaults to true. */
  readonly enabled?: boolean;
}

/**
 * Keep a live socket open while the component is mounted and return its
 * status. Typical use is invalidating query keys when a push arrives, so the
 * query cache stays the single source of server data:
 *
 * ```ts
 * useSocket({
 *   path: '/hospital/queue',
 *   surface: 'hospital',
 *   onFrame: () => queryClient.invalidateQueries({ queryKey: queueKeys.all }),
 * });
 * ```
 */
export function useSocket({ path, surface, onFrame, enabled = true }: UseSocketOptions) {
  const [status, setStatus] = useState<SocketStatus>('closed');
  const onFrameRef = useRef(onFrame);

  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  useEffect(() => {
    if (!enabled) return undefined;
    const handle = openSocket({
      path,
      surface,
      onFrame: (frame) => onFrameRef.current(frame),
      onStatus: setStatus,
    });
    return () => handle.close();
  }, [path, surface, enabled]);

  return enabled ? status : 'closed';
}
