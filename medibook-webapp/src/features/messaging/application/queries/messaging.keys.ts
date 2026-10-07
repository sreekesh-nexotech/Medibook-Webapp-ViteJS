import type {
  DeliveryListParams,
  PatientChannel,
} from '@/features/messaging/domain/entities/messaging.entities';

/** Query keys for patient messaging. */
export const messagingKeys = {
  all: ['messaging'] as const,
  templates: (channel: PatientChannel) => [...messagingKeys.all, 'templates', channel] as const,
  deliveries: () => [...messagingKeys.all, 'deliveries'] as const,
  deliveryPage: (params: DeliveryListParams) => [...messagingKeys.deliveries(), params] as const,
  delivery: (id: string) => [...messagingKeys.deliveries(), 'detail', id] as const,
};
