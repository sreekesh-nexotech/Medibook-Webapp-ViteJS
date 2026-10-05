import type { Result } from '@/core/error/failure';

import type {
  BulkSlotRequest,
  BulkSlotResult,
} from '@/features/slots/domain/entities/slots.entities';
import { slotsRepository } from '@/features/slots/infrastructure/repositories/slots.repository.impl';

export function previewBulkSlots(request: BulkSlotRequest): Promise<Result<BulkSlotResult>> {
  return slotsRepository.previewBulk(request);
}
