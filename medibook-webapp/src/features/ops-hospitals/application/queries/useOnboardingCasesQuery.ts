import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import {
  ONBOARDING_STALE_TIME_MS,
  onboardingKeys,
} from '@/features/ops-hospitals/application/queries/onboarding.keys';
import { fetchOnboardingCases } from '@/features/ops-hospitals/application/usecases/fetchOnboardingCases';

/** The onboarding pipeline: the newest cases and the server's count per stage. */
export function useOnboardingCasesQuery() {
  return useQuery({
    queryKey: onboardingKeys.cases(),
    queryFn: async () => unwrap(await fetchOnboardingCases()),
    staleTime: ONBOARDING_STALE_TIME_MS,
  });
}
