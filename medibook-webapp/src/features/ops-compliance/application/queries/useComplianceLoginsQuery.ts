import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { COMPLIANCE_LOGS_STALE_TIME_MS } from '@/features/ops-compliance/application/queries/compliance.config';
import { complianceKeys } from '@/features/ops-compliance/application/queries/compliance.keys';
import { fetchComplianceLogins } from '@/features/ops-compliance/application/usecases/fetchComplianceLogins';
import type { LoginHistoryParams } from '@/features/ops-compliance/domain/entities/compliance.entities';

/** One server-side page of sign-in history; the previous page stays while the next loads. */
export function useComplianceLoginsQuery(params: LoginHistoryParams) {
  return useQuery({
    queryKey: complianceKeys.loginPage(params),
    queryFn: async () => unwrap(await fetchComplianceLogins(params)),
    placeholderData: keepPreviousData,
    staleTime: COMPLIANCE_LOGS_STALE_TIME_MS,
  });
}
