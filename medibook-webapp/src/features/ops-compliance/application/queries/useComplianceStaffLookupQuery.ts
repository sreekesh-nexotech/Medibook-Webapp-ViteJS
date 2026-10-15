import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';
import { useOpsPermission } from '@/shared/hooks/useOpsPermission';

import { complianceKeys } from '@/features/ops-compliance/application/queries/compliance.keys';
import { findComplianceHospitalStaff } from '@/features/ops-compliance/application/usecases/findComplianceHospitalStaff';

/** The lookup needs at least this many characters (B9). */
export const STAFF_LOOKUP_MIN_CHARS = 2;

/** Staff accounts change rarely while a request is being filed. */
const STAFF_LOOKUP_STALE_MS = 60_000;

/**
 * Hospital staff matching `term` (B9 `GET /platform/hospital-staff`). Asked
 * only by roles that may read it (`hospitals.view`, or `compliance.add` after
 * B2's any-of permissions); a refusal or an older backend's 404 is not
 * retried — the form falls back to recent sign-ins.
 */
export function useComplianceStaffLookupQuery(term: string) {
  const { canAny } = useOpsPermission();
  const q = term.trim();
  return useQuery({
    queryKey: complianceKeys.staffLookup(q),
    queryFn: async () => unwrap(await findComplianceHospitalStaff(q)),
    enabled: q.length >= STAFF_LOOKUP_MIN_CHARS && canAny('hospitals.view', 'compliance.add'),
    staleTime: STAFF_LOOKUP_STALE_MS,
    placeholderData: keepPreviousData,
    retry: false,
  });
}
