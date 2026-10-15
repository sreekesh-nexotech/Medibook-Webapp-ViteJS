import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { GENERATION_RUN_STALE_TIME_MS } from '@/features/slots/application/queries/slots.config';
import { slotsKeys } from '@/features/slots/application/queries/slots.keys';
import { fetchGenerationRuns } from '@/features/slots/application/usecases/fetchGenerationRuns';

/** Generation runs, newest first (`GET /slots/generation-runs`), for the runs drawer. */
export function useGenerationRunsQuery(doctorId: string | null, page: number, enabled: boolean) {
  return useQuery({
    queryKey: slotsKeys.runPage(doctorId, page),
    queryFn: async () => unwrap(await fetchGenerationRuns(doctorId, page)),
    enabled,
    staleTime: GENERATION_RUN_STALE_TIME_MS,
    placeholderData: keepPreviousData,
  });
}
