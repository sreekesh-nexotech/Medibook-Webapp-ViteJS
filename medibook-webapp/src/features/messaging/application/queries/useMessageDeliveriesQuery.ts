import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { MESSAGING_DELIVERIES_STALE_TIME_MS } from '@/features/messaging/application/queries/messaging.config';
import { messagingKeys } from '@/features/messaging/application/queries/messaging.keys';
import { fetchMessageDeliveries } from '@/features/messaging/application/usecases/fetchMessageDeliveries';
import type { DeliveryListParams } from '@/features/messaging/domain/entities/messaging.entities';

/** One server-side outbox page; the previous page stays on screen while the next loads. */
export function useMessageDeliveriesQuery(params: DeliveryListParams) {
  return useQuery({
    queryKey: messagingKeys.deliveryPage(params),
    queryFn: async () => unwrap(await fetchMessageDeliveries(params)),
    placeholderData: keepPreviousData,
    staleTime: MESSAGING_DELIVERIES_STALE_TIME_MS,
  });
}
