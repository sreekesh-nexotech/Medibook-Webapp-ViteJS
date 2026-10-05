import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type {
  DeliveryFilters,
  DeliveryListParams,
  MessageDelivery,
  MessageSendInput,
  MessagingTemplate,
  PatientChannel,
} from '@/features/messaging/domain/entities/messaging.entities';

/** The hospital's view of patient messaging. */
export interface MessagingRepository {
  /** Every active platform template on `channel`. */
  listTemplates(channel: PatientChannel): Promise<Result<readonly MessagingTemplate[]>>;
  /** One outbox page. */
  listDeliveries(params: DeliveryListParams): Promise<Result<Page<MessageDelivery>>>;
  /** Every outbox row matching `filters`, newest first — for export. */
  listAllDeliveries(filters: DeliveryFilters): Promise<Result<readonly MessageDelivery[]>>;
  /**
   * Queue a message for an appointment. Resolves to the deliveries created —
   * empty when the patient has no reachable address on the chosen channels.
   */
  sendMessage(input: MessageSendInput): Promise<Result<readonly MessageDelivery[]>>;
}
