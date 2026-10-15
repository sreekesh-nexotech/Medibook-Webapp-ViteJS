import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { OnboardingListQuery } from '@/features/ops-hospitals/domain/entities/onboarding.entity';
import {
  ONBOARDING_STALE_TIME_MS,
  onboardingKeys,
} from '@/features/ops-hospitals/application/queries/onboarding.keys';
import { fetchOnboardingCases } from '@/features/ops-hospitals/application/usecases/fetchOnboardingCases';

/** One page of the pipeline (filtered on the server) and the server's count per stage. */
export function useOnboardingCasesQuery(query: OnboardingListQuery) {
  return useQuery({
    queryKey: onboardingKeys.caseList(query),
    queryFn: async () => unwrap(await fetchOnboardingCases(query)),
    placeholderData: keepPreviousData,
    staleTime: ONBOARDING_STALE_TIME_MS,
  });
}
