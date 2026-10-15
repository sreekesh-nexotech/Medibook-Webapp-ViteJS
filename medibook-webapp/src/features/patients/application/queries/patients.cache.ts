import type { QueryClient } from '@tanstack/react-query';

import { dashboardKeys } from '@/features/dashboard/application/queries/dashboard.keys';
import { patientsKeys } from '@/features/patients/application/queries/patients.keys';

/**
 * After an approve or reject: re-read the patients and the admin dashboard's
 * pending count. Deliberately not awaited by the mutation — awaiting it let
 * the refreshed list unmount the request's row (and its Approve button) before
 * the caller's success callback ran, so "Change approved" never showed
 * (UAT A-12).
 */
export function refreshAfterPatientDecision(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: patientsKeys.all });
  void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
}
