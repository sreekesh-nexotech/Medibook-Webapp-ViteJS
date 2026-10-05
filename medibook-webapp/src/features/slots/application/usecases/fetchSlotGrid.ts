import type { Result } from '@/core/error/failure';

import type { SlotGridPage, SlotGridParams } from '@/features/slots/domain/entities/slots.entities';
import { slotsRepository } from '@/features/slots/infrastructure/repositories/slots.repository.impl';

export function fetchSlotGrid(params: SlotGridParams): Promise<Result<SlotGridPage>> {
  return slotsRepository.getSlotGrid(params);
}
