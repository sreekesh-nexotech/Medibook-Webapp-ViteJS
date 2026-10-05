import { useQueries } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import {
  PATIENT_VISIT_COUNT_LIMIT,
  PATIENTS_STALE_TIME_MS,
} from '@/features/patients/application/queries/patients.config';
import { patientsKeys } from '@/features/patients/application/queries/patients.keys';
import { fetchPatientAppointments } from '@/features/patients/application/usecases/fetchPatientAppointments';

/**
 * Visit counts for the rows on screen. The list endpoint carries no count, so
 * each row reads its appointments' `total` from a one-row page. Returns
 * id → count; ids still loading (or failed) are absent.
 */
export function usePatientVisitCountsQuery(ids: readonly string[]): ReadonlyMap<string, number> {
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: patientsKeys.appointments(id, PATIENT_VISIT_COUNT_LIMIT),
      queryFn: async () =>
        unwrap(await fetchPatientAppointments(id, PATIENT_VISIT_COUNT_LIMIT)).total,
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
