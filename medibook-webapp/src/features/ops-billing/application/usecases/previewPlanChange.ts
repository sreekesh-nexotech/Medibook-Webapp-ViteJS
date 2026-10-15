import type { Result } from '@/core/error/failure';

import type { ProrationPreview } from '@/features/ops-billing/domain/entities/billing.entities';
import { billingRepository } from '@/features/ops-billing/infrastructure/repositories/billing.repository.impl';

export function previewPlanChange(id: string): Promise<Result<ProrationPreview | null>> {
  return billingRepository.previewPlanChange(id);
}
