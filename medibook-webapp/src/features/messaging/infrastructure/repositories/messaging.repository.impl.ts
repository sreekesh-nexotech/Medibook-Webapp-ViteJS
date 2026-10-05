import { MAX_PAGE_SIZE, toPage } from '@/core/api/pagination';
import { attempt } from '@/core/error/attempt';

import type { MessagingRepository } from '@/features/messaging/domain/repositories/messaging.repository';
import {
  getAllDeliveries,
  getDeliveries,
  getTemplates,
  postSend,
} from '@/features/messaging/infrastructure/data-sources/remote/messaging.api';
import {
  toDeliveryQueryParams,
  toExportQueryParams,
  toMessageSendRequest,
} from '@/features/messaging/infrastructure/data-sources/remote/messaging.request';
import {
  toMessageDelivery,
  toMessagingTemplate,
} from '@/features/messaging/infrastructure/data-sources/remote/messaging.response';

export const messagingRepository: MessagingRepository = {
  listTemplates: (channel) =>
    attempt(async () => (await getTemplates(channel)).map(toMessagingTemplate)),

  listDeliveries: (params) =>
    attempt(async () =>
      toPage(await getDeliveries(toDeliveryQueryParams(params)), toMessageDelivery),
    ),

  listAllDeliveries: (filters) =>
    attempt(async () =>
      (await getAllDeliveries(toExportQueryParams(filters, MAX_PAGE_SIZE))).map(toMessageDelivery),
    ),

  sendMessage: (input) =>
    attempt(async () =>
      (await postSend(toMessageSendRequest(input), input.idempotencyKey)).map(toMessageDelivery),
    ),
};
