/** Query keys for the onboarding document catalogue. */
export const onboardingDocumentsKeys = {
  all: ['ops-onboarding-documents'] as const,
  list: () => [...onboardingDocumentsKeys.all, 'list'] as const,
};
