import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import {
  SETTINGS_STALE_TIME_MS,
  settingsKeys,
} from '@/features/settings/application/queries/settings.keys';
import { fetchNumbering } from '@/features/settings/application/usecases/fetchNumbering';

/** The MRN, booking and receipt number series, with each one's next number. */
export function useNumberingQuery(enabled = true) {
  return useQuery({
    queryKey: settingsKeys.numbering(),
    queryFn: async () => unwrap(await fetchNumbering()),
    staleTime: SETTINGS_STALE_TIME_MS,
    enabled,
  });
}
