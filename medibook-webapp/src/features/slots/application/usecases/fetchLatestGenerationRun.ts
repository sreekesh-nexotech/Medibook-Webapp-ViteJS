import type { Result } from '@/core/error/failure';

import type { SlotGenerationRun } from '@/features/slots/domain/entities/slots.entities';
import { slotsRepository } from '@/features/slots/infrastructure/repositories/slots.repository.impl';

export function fetchLatestGenerationRun(): Promise<Result<SlotGenerationRun | null>> {
  return slotsRepository.getLatestGenerationRun();
}
