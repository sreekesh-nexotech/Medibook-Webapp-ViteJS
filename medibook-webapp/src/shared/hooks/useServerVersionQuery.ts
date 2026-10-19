import { useQuery } from '@tanstack/react-query';

import { fetchServerVersion } from '@/core/api/serverVersion.api';
import { serverVersionKeys } from '@/core/api/serverVersion.keys';
import { unwrap } from '@/core/error/failure';

/**
 * The deployed backend's version and commit, shown beside the web build for
 * support (UB-07). Informational only: read once, never retried, and a
 * failure stays silent — callers simply leave the API part out.
 */
export function useServerVersionQuery() {
  return useQuery({
    queryKey: serverVersionKeys.all,
    queryFn: async () => unwrap(await fetchServerVersion()),
    staleTime: Infinity,
    retry: false,
  });
}
