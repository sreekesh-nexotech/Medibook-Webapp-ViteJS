import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { displayKeys } from '@/features/display/application/queries/display.keys';
import { signInDisplay } from '@/features/display/application/usecases/signInDisplay';

/** Renew the token this long before the server's expiry. */
const RENEW_EARLY_MS = 60_000;
/** Never renew more often than this, whatever the server says. */
const MIN_RENEW_MS = 30_000;

/**
 * Signs the screen in with its device key and keeps the short-lived display
 * token fresh: the query re-runs just before the token expires.
 */
export function useDisplayGrantQuery(deviceKey: string | null) {
  return useQuery({
    queryKey: displayKeys.grant(deviceKey ?? ''),
    queryFn: async () => unwrap(await signInDisplay(deviceKey ?? '')),
    enabled: Boolean(deviceKey),
    staleTime: Infinity,
    retry: false,
    refetchInterval: (query) => {
      const expiresAt = query.state.data?.expiresAt;
      if (!expiresAt) return false;
      return Math.max(MIN_RENEW_MS, Date.parse(expiresAt) - Date.now() - RENEW_EARLY_MS);
    },
  });
}
