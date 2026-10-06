import { useMemo, useRef } from 'react';

export interface ReplayKeys {
  /** The key for one user intent; the same intent keeps its key until it succeeds. */
  keyFor(intent: string): string;
  /** Forget an intent once its write succeeded, so the next one is a new action. */
  done(intent: string): void;
}

/**
 * One `Idempotency-Key` per user intent — this action on this record — not per
 * HTTP call (DATA-04, `core/api/headers.ts`). A retry after a timeout or a
 * dropped connection reuses the key, so the backend replays the original result
 * instead of booking, charging or refunding twice. The backend keeps only
 * successful responses, so after an error the same key is free for a
 * corrected retry (`core/idempotency.py`).
 */
export function useReplayKeys(): ReplayKeys {
  const keys = useRef(new Map<string, string>());
  return useMemo(
    () => ({
      keyFor(intent: string): string {
        const existing = keys.current.get(intent);
        if (existing) return existing;
        const key = crypto.randomUUID();
        keys.current.set(intent, key);
        return key;
      },
      done(intent: string): void {
        keys.current.delete(intent);
      },
    }),
    [],
  );
}
