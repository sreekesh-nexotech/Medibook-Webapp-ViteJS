import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { isFailure, unwrap } from '@/core/error/failure';

import { COMPLIANCE_LOGS_STALE_TIME_MS } from '@/features/ops-compliance/application/queries/compliance.config';
import { complianceKeys } from '@/features/ops-compliance/application/queries/compliance.keys';
import { fetchCompliancePhiAccess } from '@/features/ops-compliance/application/usecases/fetchCompliancePhiAccess';
import type { PhiAccessParams } from '@/features/ops-compliance/domain/entities/compliance.entities';

/** Retries of a failed read; a 404 (older backend without B6) is final at once. */
const MAX_RETRIES = 2;

/** One server-side page of the PHI read audit (B6); the previous page stays while the next loads. */
export function useCompliancePhiAccessQuery(params: PhiAccessParams) {
  return useQuery({
    queryKey: complianceKeys.phiAccessPage(params),
    queryFn: async () => unwrap(await fetchCompliancePhiAccess(params)),
    placeholderData: keepPreviousData,
    staleTime: COMPLIANCE_LOGS_STALE_TIME_MS,
    retry: (count, error) =>
      !(isFailure(error) && error.kind === 'notFound') && count < MAX_RETRIES,
  });
}
