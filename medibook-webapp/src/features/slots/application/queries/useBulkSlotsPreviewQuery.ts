import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { BulkSlotRequest } from '@/features/slots/domain/entities/slots.entities';
import { BULK_PREVIEW_STALE_TIME_MS } from '@/features/slots/application/queries/slots.config';
import { slotsKeys } from '@/features/slots/application/queries/slots.keys';
import { previewBulkSlots } from '@/features/slots/application/usecases/previewBulkSlots';

/**
 * The backend's dry run of a bulk update — the real counts and the bookings
 * a block would cancel. A POST, but it changes nothing, so it is read like a
 * query. Pass `null` while the form is invalid.
 */
export function useBulkSlotsPreviewQuery(request: BulkSlotRequest | null) {
  return useQuery({
    queryKey: request ? slotsKeys.bulkPreview(request) : slotsKeys.bulkPreviews(),
    queryFn: async () => (request ? unwrap(await previewBulkSlots(request)) : null),
    enabled: request !== null,
    staleTime: BULK_PREVIEW_STALE_TIME_MS,
  });
}
