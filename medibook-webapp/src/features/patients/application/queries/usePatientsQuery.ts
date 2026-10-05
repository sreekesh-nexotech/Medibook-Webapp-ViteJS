import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { PatientListParams } from '@/features/patients/domain/entities/patients.entities';
import { PATIENTS_STALE_TIME_MS } from '@/features/patients/application/queries/patients.config';
import { patientsKeys } from '@/features/patients/application/queries/patients.keys';
import { fetchPatients } from '@/features/patients/application/usecases/fetchPatients';

/** One server-side page of patient records; the previous page stays on screen while the next loads. */
export function usePatientsQuery(params: PatientListParams) {
  return useQuery({
    queryKey: patientsKeys.list(params),
    queryFn: async () => unwrap(await fetchPatients(params)),
    placeholderData: keepPreviousData,
    staleTime: PATIENTS_STALE_TIME_MS,
  });
}
