import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { COMPLIANCE_REQUESTS_STALE_TIME_MS } from '@/features/ops-compliance/application/queries/compliance.config';
import { complianceKeys } from '@/features/ops-compliance/application/queries/compliance.keys';
import { fetchComplianceDataRequest } from '@/features/ops-compliance/application/usecases/fetchComplianceDataRequest';

/** One data-subject request in full (`GET …/data-requests/{id}`); idle while `id` is null. */
export function useComplianceDataRequestQuery(id: string | null) {
  return useQuery({
    enabled: id !== null,
    queryKey: complianceKeys.requestDetail(id ?? ''),
    queryFn: async () => unwrap(await fetchComplianceDataRequest(id ?? '')),
    staleTime: COMPLIANCE_REQUESTS_STALE_TIME_MS,
  });
}
