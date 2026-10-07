import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import {
  SETTINGS_STALE_TIME_MS,
  settingsKeys,
} from '@/features/settings/application/queries/settings.keys';
import { fetchPrintTemplates } from '@/features/settings/application/usecases/fetchPrintTemplates';

/** Receipt and token-slip templates. */
export function usePrintTemplatesQuery(enabled = true) {
  return useQuery({
    queryKey: settingsKeys.printTemplates(),
    queryFn: async () => unwrap(await fetchPrintTemplates()),
    staleTime: SETTINGS_STALE_TIME_MS,
    enabled,
  });
}
