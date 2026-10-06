import { useQueries } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { PATIENTS_STALE_TIME_MS } from '@/features/patients/application/queries/patients.config';
import { patientsKeys } from '@/features/patients/application/queries/patients.keys';
import { fetchCompletedVisitCount } from '@/features/patients/application/usecases/fetchCompletedVisitCount';

/**
 * Visit counts for the rows on screen: completed consultations only. The
 * list endpoint carries no count (BACKEND_BLOCKERS PAT-01), so each row reads
 * it separately. Returns
 * id → count; ids still loading (or failed) are absent.
 */
export function usePatientVisitCountsQuery(ids: readonly string[]): ReadonlyMap<string, number> {
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: patientsKeys.visitCount(id),
      queryFn: async () => unwrap(await fetchCompletedVisitCount(id)),
      staleTime: PATIENTS_STALE_TIME_MS,
    })),
    combine: (results) => {
      const counts = new Map<string, number>();
      results.forEach((result, i) => {
        const id = ids[i];
        if (id !== undefined && result.data !== undefined) counts.set(id, result.data);
      });
      return counts;
    },
  });
}
