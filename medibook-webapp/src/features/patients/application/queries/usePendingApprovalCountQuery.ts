import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { PatientApprovalListParams } from '@/features/patients/domain/entities/patients.entities';
import { PATIENTS_STALE_TIME_MS } from '@/features/patients/application/queries/patients.config';
import { patientsKeys } from '@/features/patients/application/queries/patients.keys';
import { fetchPatientApprovals } from '@/features/patients/application/usecases/fetchPatientApprovals';

/** A one-row page still carries the `total` — all a badge needs. */
const PENDING_COUNT_PARAMS: PatientApprovalListParams = {
  page: 1,
  pageSize: 1,
  statuses: ['pending'],
  kind: null,
};

/** How many change requests wait for an admin — the queue's badge. */
export function usePendingApprovalCountQuery(enabled: boolean) {
  return useQuery({
    queryKey: patientsKeys.approvalPage(PENDING_COUNT_PARAMS),
    queryFn: async () => unwrap(await fetchPatientApprovals(PENDING_COUNT_PARAMS)),
    select: (page) => page.total,
    staleTime: PATIENTS_STALE_TIME_MS,
    enabled,
  });
}
