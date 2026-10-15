import type { Result } from '@/core/error/failure';

import type { SlotGenerationRunPage } from '@/features/slots/domain/entities/slots.entities';
import { slotsRepository } from '@/features/slots/infrastructure/repositories/slots.repository.impl';

export function fetchGenerationRuns(
  doctorId: string | null,
  page: number,
): Promise<Result<SlotGenerationRunPage>> {
  return slotsRepository.listGenerationRuns(doctorId, page);
}
