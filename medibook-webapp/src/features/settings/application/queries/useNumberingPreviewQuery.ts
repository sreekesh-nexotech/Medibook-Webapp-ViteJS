import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { settingsKeys } from '@/features/settings/application/queries/settings.keys';
import { fetchNumberingPreview } from '@/features/settings/application/usecases/fetchNumberingPreview';

/** Allocation moves the counter, so the preview is re-read whenever it is shown. */
const PREVIEW_STALE_TIME_MS = 0;

/** The next number the saved series would issue (`GET …/{kind}/preview`); allocates nothing. */
export function useNumberingPreviewQuery(kind: string, version: number, enabled: boolean) {
  return useQuery({
    queryKey: settingsKeys.numberingPreview(kind, version),
    queryFn: async () => unwrap(await fetchNumberingPreview(kind)),
    staleTime: PREVIEW_STALE_TIME_MS,
    enabled,
  });
}
