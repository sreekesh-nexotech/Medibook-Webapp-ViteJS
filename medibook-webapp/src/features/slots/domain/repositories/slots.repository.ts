import type { Result } from '@/core/error/failure';

import type {
  BulkSlotRequest,
  BulkSlotResult,
  ScheduledSlot,
  SlotGenerationRun,
  SlotGridPage,
  SlotGridParams,
  SlotRegenerateResult,
} from '@/features/slots/domain/entities/slots.entities';

/** The hospital's materialised slot inventory (HA-08). */
export interface SlotsRepository {
  getSlotGrid(params: SlotGridParams): Promise<Result<SlotGridPage>>;
  /** Block an open slot. Booked slots are never sent here from the grid. */
  blockSlot(slotId: string, idempotencyKey: string): Promise<Result<ScheduledSlot>>;
  /** Unblock a future blocked slot. */
  openSlot(slotId: string): Promise<Result<ScheduledSlot>>;
  /** What a bulk update would do — changes nothing. */
  previewBulk(request: BulkSlotRequest): Promise<Result<BulkSlotResult>>;
  /** Execute a bulk update; a block cancels affected bookings with a full refund. */
  applyBulk(request: BulkSlotRequest, idempotencyKey: string): Promise<Result<BulkSlotResult>>;
  /** A manual materialisation run (one doctor, or the whole hospital); never cancels bookings. */
  regenerate(doctorId: string | null): Promise<Result<SlotRegenerateResult>>;
  /** The most recent generation run, or `null` when there has been none. */
  getLatestGenerationRun(): Promise<Result<SlotGenerationRun | null>>;
}
