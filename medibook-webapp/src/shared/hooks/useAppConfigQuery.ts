import { useQuery } from '@tanstack/react-query';

import { fetchAppConfig } from '@/core/api/appConfig.api';
import { appConfigKeys } from '@/core/api/appConfig.keys';
import { APP_CONFIG_STALE_TIME_MS } from '@/core/config/api';
import { unwrap } from '@/core/error/failure';

/**
 * Public app config (feature flags, OTP length, support phone, legal
 * versions). Readable before login; changes rarely.
 */
export function useAppConfigQuery() {
  return useQuery({
    queryKey: appConfigKeys.all,
    queryFn: async () => unwrap(await fetchAppConfig()),
    staleTime: APP_CONFIG_STALE_TIME_MS,
  });
}
