import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { COMPLIANCE_REQUESTS_STALE_TIME_MS } from '@/features/ops-compliance/application/queries/compliance.config';
import { complianceKeys } from '@/features/ops-compliance/application/queries/compliance.keys';
import { fetchComplianceDataRequests } from '@/features/ops-compliance/application/usecases/fetchComplianceDataRequests';
import type { DataRequestParams } from '@/features/ops-compliance/domain/entities/compliance.entities';

/** One page of the data-subject request register, newest first. */
export function useComplianceDataRequestsQuery(params: DataRequestParams) {
  return useQuery({
    queryKey: complianceKeys.requestPage(params),
    queryFn: async () => unwrap(await fetchComplianceDataRequests(params)),
    placeholderData: keepPreviousData,
    staleTime: COMPLIANCE_REQUESTS_STALE_TIME_MS,
  });
}
