import { useMutation } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { exportMessageDeliveries } from '@/features/messaging/application/usecases/exportMessageDeliveries';
import type { DeliveryFilters } from '@/features/messaging/domain/entities/messaging.entities';

/** Fetch every outbox row matching the filters, on demand, for a CSV export. Writes nothing. */
export function useExportMessageDeliveriesMutation() {
  return useMutation({
    mutationFn: async (filters: DeliveryFilters) => unwrap(await exportMessageDeliveries(filters)),
  });
}
