import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import {
  ONBOARDING_STALE_TIME_MS,
  onboardingKeys,
} from '@/features/ops-hospitals/application/queries/onboarding.keys';
import { fetchOnboardingCase } from '@/features/ops-hospitals/application/usecases/fetchOnboardingCase';

/** One case with its checklist and current go-live blockers. */
export function useOnboardingCaseQuery(caseId: string) {
  return useQuery({
    queryKey: onboardingKeys.case(caseId),
    queryFn: async () => unwrap(await fetchOnboardingCase(caseId)),
    staleTime: ONBOARDING_STALE_TIME_MS,
  });
}
