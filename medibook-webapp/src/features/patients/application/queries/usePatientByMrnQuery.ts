import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { PATIENTS_STALE_TIME_MS } from '@/features/patients/application/queries/patients.config';
import { patientsKeys } from '@/features/patients/application/queries/patients.keys';
import { fetchPatientByMrn } from '@/features/patients/application/usecases/fetchPatientByMrn';

/** The full record (incl. any pending change request) for the MRN in the route. */
export function usePatientByMrnQuery(mrn: string | undefined) {
  return useQuery({
    queryKey: patientsKeys.byMrn(mrn ?? ''),
    queryFn: async () => unwrap(await fetchPatientByMrn(mrn ?? '')),
    enabled: Boolean(mrn),
    staleTime: PATIENTS_STALE_TIME_MS,
  });
}
