import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { MESSAGING_DELIVERIES_STALE_TIME_MS } from '@/features/messaging/application/queries/messaging.config';
import { messagingKeys } from '@/features/messaging/application/queries/messaging.keys';
import { fetchMessageDelivery } from '@/features/messaging/application/usecases/fetchMessageDelivery';

/** One outbox row in full (`GET /messaging/deliveries/{id}`). `null` stays idle. */
export function useMessageDeliveryQuery(id: string | null) {
  return useQuery({
    queryKey: messagingKeys.delivery(id ?? ''),
    queryFn: async () => unwrap(await fetchMessageDelivery(id ?? '')),
    enabled: id !== null,
    staleTime: MESSAGING_DELIVERIES_STALE_TIME_MS,
  });
}
