import type { QueryClient } from '@tanstack/react-query';

import type { OnboardingListQuery } from '@/features/ops-hospitals/domain/entities/onboarding.entity';
import { hospitalsKeys } from '@/features/ops-hospitals/application/queries/hospitals.keys';

/** Query keys for the onboarding pipeline (P3) — standards §4, no inline key arrays. */
export const onboardingKeys = {
  all: ['ops-onboarding'] as const,
  cases: () => [...onboardingKeys.all, 'cases'] as const,
  caseList: (query: OnboardingListQuery) => [...onboardingKeys.cases(), query] as const,
  case: (caseId: string) => [...onboardingKeys.all, 'case', caseId] as const,
  requirements: () => [...onboardingKeys.all, 'requirements'] as const,
};

/** The pipeline is worked on by several operators; re-read every 30 s. */
export const ONBOARDING_STALE_TIME_MS = 30_000;

/**
 * After any onboarding write: the pipeline and the case, and P2's hospital
 * registry too — approve and go-live change a hospital's status, and every
 * checklist tick changes the go-live blockers its detail page shows.
 */
export function invalidateOnboarding(queryClient: QueryClient): Promise<unknown> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: onboardingKeys.all }),
    queryClient.invalidateQueries({ queryKey: hospitalsKeys.all }),
  ]);
}
