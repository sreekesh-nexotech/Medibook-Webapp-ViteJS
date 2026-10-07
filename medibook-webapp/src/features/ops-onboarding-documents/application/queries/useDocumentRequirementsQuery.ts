import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { onboardingDocumentsKeys } from '@/features/ops-onboarding-documents/application/queries/onboardingDocuments.keys';
import { fetchDocumentRequirements } from '@/features/ops-onboarding-documents/application/usecases/fetchDocumentRequirements';

/** The catalogue changes only from this screen, which invalidates on every write. */
const REQUIREMENTS_STALE_MS = 60_000;

/** Every onboarding document requirement, in checklist order. */
export function useDocumentRequirementsQuery() {
  return useQuery({
    queryKey: onboardingDocumentsKeys.list(),
    queryFn: async () => unwrap(await fetchDocumentRequirements()),
    staleTime: REQUIREMENTS_STALE_MS,
  });
}
