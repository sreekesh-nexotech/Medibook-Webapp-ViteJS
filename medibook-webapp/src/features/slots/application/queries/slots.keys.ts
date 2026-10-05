import type {
  BulkSlotRequest,
  SlotGridParams,
} from '@/features/slots/domain/entities/slots.entities';

/** Query keys for the slots feature (standards §4 — no inline key arrays). */
export const slotsKeys = {
  all: ['slots'] as const,
  grids: () => [...slotsKeys.all, 'grid'] as const,
  grid: (params: SlotGridParams) => [...slotsKeys.grids(), params] as const,
  bulkPreviews: () => [...slotsKeys.all, 'bulk-preview'] as const,
  bulkPreview: (request: BulkSlotRequest) => [...slotsKeys.bulkPreviews(), request] as const,
  latestRun: () => [...slotsKeys.all, 'generation-runs', 'latest'] as const,
};
