import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import {
  SETTINGS_STALE_TIME_MS,
  settingsKeys,
} from '@/features/settings/application/queries/settings.keys';
import { fetchTokenPolicy } from '@/features/settings/application/usecases/fetchTokenPolicy';

/** The token-numbering policy, including any scope change pending from tomorrow. */
export function useTokenPolicyQuery(enabled = true) {
  return useQuery({
    queryKey: settingsKeys.tokenPolicy(),
    queryFn: async () => unwrap(await fetchTokenPolicy()),
    staleTime: SETTINGS_STALE_TIME_MS,
    enabled,
  });
}
