import { useCallback, useState } from 'react';

/**
 * The hospital half of audit 3.1.1 — "the Refresh button does nothing on eight
 * screens", the single most likely control for a client to poke.
 *
 * A screen hands this hook the function that re-reads its list out of the
 * store; the hook owns the three things a refresh has to produce: a **loading
 * state** while it runs (feed it straight into `TableShell state=`), an
 * **error state** if the read fails (feed it into `ErrorState onRetry`), and a
 * **last-updated stamp** proving the list really was re-derived. No toast: the
 * screen's own data is the acknowledgement.
 *
 * The store is in memory, so the read itself is instant; `MIN_VISIBLE_MS` only
 * keeps the loading state on screen long enough to read as feedback rather
 * than a flicker. Nothing here claims work that did not happen.
 *
 * Belongs in `src/shared/hooks` once that layer reopens — it is not
 * appointments-specific, and the patients / payments / token-queue screens
 * import it from here in the meantime.
 */

/** Keep the skeleton on screen long enough to be legible. */
const MIN_VISIBLE_MS = 400;

const FALLBACK_ERROR = 'The list could not be reloaded. Try again.';

export interface ListRefreshState {
  /** True while a refresh is running — drives the loading state. */
  loading: boolean;
  /** Message from the last failed refresh, or `null`. */
  error: string | null;
  /** Epoch ms of the last successful re-derivation. */
  updatedAt: number;
  /** Re-read the store and re-derive the list. Safe to call repeatedly. */
  refresh: () => Promise<void>;
}

/**
 * @param reload Re-reads the screen's source data from its store. Must be
 *   stable (wrap it in `useCallback`) — throwing puts the screen in its error
 *   state instead of crashing the route.
 */
export function useListRefresh(reload: () => void): ListRefreshState {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number>(() => Date.now());

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      reload();
      await new Promise<void>((resolve) => setTimeout(resolve, MIN_VISIBLE_MS));
      setUpdatedAt(Date.now());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : FALLBACK_ERROR);
    } finally {
      setLoading(false);
    }
  }, [reload]);

  return { loading, error, updatedAt, refresh };
}

/** "Updated 10:42" — the caption that sits next to a wired Refresh button. */
export function formatUpdatedAt(updatedAt: number): string {
  return new Date(updatedAt).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
