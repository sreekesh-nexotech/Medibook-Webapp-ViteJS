import { useCallback, useEffect, useRef } from 'react';

import { createCoalescer, type Coalescer } from '@/shared/lib/coalesce';

/**
 * A stable callback that runs the latest `task` at most once per `windowMs`
 * (`createCoalescer`): the first call at once, the rest of a burst once when
 * the window ends. A pending run is dropped on unmount.
 */
export function useCoalescedCallback(task: () => void, windowMs: number): () => void {
  const taskRef = useRef(task);
  const coalescerRef = useRef<Coalescer | null>(null);

  useEffect(() => {
    taskRef.current = task;
  }, [task]);

  useEffect(() => {
    const coalescer = createCoalescer(() => taskRef.current(), windowMs);
    coalescerRef.current = coalescer;
    return () => {
      coalescer.cancel();
      coalescerRef.current = null;
    };
  }, [windowMs]);

  return useCallback(() => coalescerRef.current?.run(), []);
}
