import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { onboardingKeys } from '@/features/ops-hospitals/application/queries/onboarding.keys';
import { fetchDocumentRequirements } from '@/features/ops-hospitals/application/usecases/fetchDocumentRequirements';

/** The catalogue is platform configuration and rarely changes. */
const REQUIREMENTS_STALE_TIME_MS = 5 * 60_000;

/** The platform's document catalogue (needs `settings.view`). */
export function useDocumentRequirementsQuery() {
  return useQuery({
    queryKey: onboardingKeys.requirements(),
    queryFn: async () => unwrap(await fetchDocumentRequirements()),
    staleTime: REQUIREMENTS_STALE_TIME_MS,
  });
}
