import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import {
  PATIENT_HISTORY_LIMIT,
  PATIENTS_STALE_TIME_MS,
} from '@/features/patients/application/queries/patients.config';
import { patientsKeys } from '@/features/patients/application/queries/patients.keys';
import { fetchPatientAppointments } from '@/features/patients/application/usecases/fetchPatientAppointments';

/** This hospital's appointments for the record — the latest 100, plus the total on record. */
export function usePatientAppointmentsQuery(id: string | undefined) {
  return useQuery({
    queryKey: patientsKeys.appointments(id ?? '', PATIENT_HISTORY_LIMIT),
    queryFn: async () => unwrap(await fetchPatientAppointments(id ?? '', PATIENT_HISTORY_LIMIT)),
    enabled: Boolean(id),
    staleTime: PATIENTS_STALE_TIME_MS,
  });
}
