import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { COMPLIANCE_LOGS_STALE_TIME_MS } from '@/features/ops-compliance/application/queries/compliance.config';
import { complianceKeys } from '@/features/ops-compliance/application/queries/compliance.keys';
import { fetchComplianceConfigChanges } from '@/features/ops-compliance/application/usecases/fetchComplianceConfigChanges';
import type { ConfigChangeParams } from '@/features/ops-compliance/domain/entities/compliance.entities';

/** One server-side page of the configuration-change log. */
export function useComplianceConfigChangesQuery(params: ConfigChangeParams) {
  return useQuery({
    queryKey: complianceKeys.changePage(params),
    queryFn: async () => unwrap(await fetchComplianceConfigChanges(params)),
    placeholderData: keepPreviousData,
    staleTime: COMPLIANCE_LOGS_STALE_TIME_MS,
  });
}
