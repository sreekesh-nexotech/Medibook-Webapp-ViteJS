import type { Result } from '@/core/error/failure';
import { ok } from '@/core/error/failure';

import { onboardingRepository } from '@/features/ops-hospitals/infrastructure/repositories/onboarding.repository.impl';

/**
 * Put `codes` on a case's checklist as pending. The API adds an item the
 * first time it is ticked, one PATCH per document (there is no bulk call);
 * stops at the first failure.
 */
export async function addChecklistItems(
  caseId: string,
  codes: readonly string[],
): Promise<Result<null>> {
  for (const code of codes) {
    // A code not on the checklist yet has no row, so no version to send.
    const result = await onboardingRepository.updateChecklistItem(
      caseId,
      code,
      { status: 'pending' },
      null,
    );
    if (!result.ok) return result;
  }
  return ok(null);
}
