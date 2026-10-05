import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { GENERATION_RUN_STALE_TIME_MS } from '@/features/slots/application/queries/slots.config';
import { slotsKeys } from '@/features/slots/application/queries/slots.keys';
import { fetchLatestGenerationRun } from '@/features/slots/application/usecases/fetchLatestGenerationRun';

/** The most recent slot generation run (scheduled or manual), or `null`. */
export function useLatestGenerationRunQuery() {
  return useQuery({
    queryKey: slotsKeys.latestRun(),
    queryFn: async () => unwrap(await fetchLatestGenerationRun()),
    staleTime: GENERATION_RUN_STALE_TIME_MS,
  });
}
