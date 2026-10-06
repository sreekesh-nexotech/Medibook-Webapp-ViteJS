import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { PATIENTS_STALE_TIME_MS } from '@/features/patients/application/queries/patients.config';
import { patientsKeys } from '@/features/patients/application/queries/patients.keys';
import { fetchPatient } from '@/features/patients/application/usecases/fetchPatient';

/** The full record (incl. any pending change request) for the record id in the route. */
export function usePatientQuery(id: string | undefined) {
  return useQuery({
    queryKey: patientsKeys.detail(id ?? ''),
    queryFn: async () => unwrap(await fetchPatient(id ?? '')),
    enabled: Boolean(id),
    staleTime: PATIENTS_STALE_TIME_MS,
  });
}
