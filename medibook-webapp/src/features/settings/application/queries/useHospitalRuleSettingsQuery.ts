import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import {
  SETTINGS_STALE_TIME_MS,
  settingsKeys,
} from '@/features/settings/application/queries/settings.keys';
import { fetchHospitalRuleSettings } from '@/features/settings/application/usecases/fetchHospitalRuleSettings';

/**
 * The hospital rulebook (`GET /hospital/settings`) — booking window, hold
 * timeout, cancellation cut-off, follow-up window, plus the server's derived
 * hints. Other features (slots, settlements) should read rules from here.
 */
export function useHospitalRuleSettingsQuery(enabled = true) {
  return useQuery({
    queryKey: settingsKeys.rules(),
    queryFn: async () => unwrap(await fetchHospitalRuleSettings()),
    staleTime: SETTINGS_STALE_TIME_MS,
    enabled,
  });
}
