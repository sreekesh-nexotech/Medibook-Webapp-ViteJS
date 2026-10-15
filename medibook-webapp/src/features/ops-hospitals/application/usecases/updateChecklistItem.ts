import type { Result } from '@/core/error/failure';

import type {
  ChecklistItem,
  ChecklistUpdate,
} from '@/features/ops-hospitals/domain/entities/onboarding.entity';
import { onboardingRepository } from '@/features/ops-hospitals/infrastructure/repositories/onboarding.repository.impl';

export function updateChecklistItem(
  caseId: string,
  code: string,
  update: ChecklistUpdate,
  version: number | null,
): Promise<Result<ChecklistItem>> {
  return onboardingRepository.updateChecklistItem(caseId, code, update, version);
}
