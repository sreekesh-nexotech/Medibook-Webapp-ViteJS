import type { Result } from '@/core/error/failure';

import type { SlotRegenerateResult } from '@/features/slots/domain/entities/slots.entities';
import { slotsRepository } from '@/features/slots/infrastructure/repositories/slots.repository.impl';

export function regenerateSlots(doctorId: string | null): Promise<Result<SlotRegenerateResult>> {
  return slotsRepository.regenerate(doctorId);
}
