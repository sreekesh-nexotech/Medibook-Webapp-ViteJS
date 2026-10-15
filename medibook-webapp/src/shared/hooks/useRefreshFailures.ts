import { useCallback, useSyncExternalStore } from 'react';

import { useQueryClient, type Query } from '@tanstack/react-query';

/** Data on screen whose latest refresh failed: the rows stay, but they may be out of date. */
function isStaleOnScreen(query: Query): boolean {
  return (
    query.state.status === 'error' &&
    query.state.data !== undefined &&
    query.getObserversCount() > 0
  );
}

export interface RefreshFailures {
  /** When the oldest such data last loaded; `null` when everything on screen is current. */
  readonly since: number | null;
  /** Refetch every query whose refresh failed. */
  readonly retry: () => void;
}

/**
 * Whether anything on screen failed to refresh after its retries ran out
 * (RUN-04, RUN-05). Screens keep showing the data they have; the shell says
 * it is stale and offers a retry, instead of each screen blanking its rows.
 */
export function useRefreshFailures(): RefreshFailures {
  const queryClient = useQueryClient();
  const cache = queryClient.getQueryCache();
  const subscribe = useCallback((onChange: () => void) => cache.subscribe(onChange), [cache]);
  const getSnapshot = useCallback((): number | null => {
    let oldest: number | null = null;
    for (const query of cache.getAll()) {
      if (!isStaleOnScreen(query)) continue;
      const at = query.state.dataUpdatedAt;
      oldest = oldest === null ? at : Math.min(oldest, at);
    }
    return oldest;
  }, [cache]);
  const since = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const retry = useCallback(() => {
    void queryClient.refetchQueries({ predicate: isStaleOnScreen });
  }, [queryClient]);
  return { since, retry };
}
