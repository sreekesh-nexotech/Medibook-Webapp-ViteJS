import type { Result } from '@/core/error/failure';

import type { ScheduledSlot } from '@/features/slots/domain/entities/slots.entities';
import { slotsRepository } from '@/features/slots/infrastructure/repositories/slots.repository.impl';

export function blockSlot(slotId: string, idempotencyKey: string): Promise<Result<ScheduledSlot>> {
  return slotsRepository.blockSlot(slotId, idempotencyKey);
}
