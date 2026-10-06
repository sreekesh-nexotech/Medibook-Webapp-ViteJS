import type { PatientListParams } from '@/features/patients/domain/entities/patients.entities';

/** Query keys for the patients feature (standards §4 — no inline key arrays). */
export const patientsKeys = {
  all: ['patients'] as const,
  lists: () => [...patientsKeys.all, 'list'] as const,
  list: (params: PatientListParams) => [...patientsKeys.lists(), params] as const,
  byMrn: (mrn: string) => [...patientsKeys.all, 'mrn', mrn] as const,
  visitCount: (id: string) => [...patientsKeys.all, 'visit-count', id] as const,
  appointments: (id: string, limit: number) =>
    [...patientsKeys.all, 'appointments', id, limit] as const,
};
