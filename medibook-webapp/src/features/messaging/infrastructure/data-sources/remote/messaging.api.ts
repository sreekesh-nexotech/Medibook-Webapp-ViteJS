import { idempotencyKey } from '@/core/api/headers';
import { hospitalApi } from '@/core/api/http';
import { MAX_PAGE_SIZE } from '@/core/api/pagination';

import type { PatientChannel } from '@/features/messaging/domain/entities/messaging.entities';
import type {
  DeliveryQueryParams,
  MessageSendRequest,
} from '@/features/messaging/infrastructure/data-sources/remote/messaging.request';
import {
  deliveryPageResponseSchema,
  sendResponseSchema,
  templatePageResponseSchema,
  type DeliveryResponse,
  type TemplateResponse,
} from '@/features/messaging/infrastructure/data-sources/remote/messaging.response';

/** `GET /hospital/messaging/templates?channel=` — every page. */
export async function getTemplates(channel: PatientChannel): Promise<TemplateResponse[]> {
  const rows: TemplateResponse[] = [];
  for (let page = 1; ; page += 1) {
    const response = await hospitalApi.get('/messaging/templates', {
      params: { channel, page, page_size: MAX_PAGE_SIZE },
    });
    const body = templatePageResponseSchema.parse(response.data);
    rows.push(...body.results);
    if (!body.has_next) return rows;
  }
}

/** `GET /hospital/messaging/deliveries` — one page. */
export async function getDeliveries(params: DeliveryQueryParams) {
  const response = await hospitalApi.get('/messaging/deliveries', { params });
  return deliveryPageResponseSchema.parse(response.data);
}

/** `GET /hospital/messaging/deliveries` — every page from 1 onward. */
export async function getAllDeliveries(params: DeliveryQueryParams): Promise<DeliveryResponse[]> {
  const rows: DeliveryResponse[] = [];
  for (let page = 1; ; page += 1) {
    const body = await getDeliveries({ ...params, page });
    rows.push(...body.results);
    if (!body.has_next) return rows;
  }
}

/** `POST /hospital/messaging/send` — idempotent on the caller's replay key. */
export async function postSend(body: MessageSendRequest, key: string): Promise<DeliveryResponse[]> {
  const response = await hospitalApi.post('/messaging/send', body, {
    headers: idempotencyKey(key),
  });
  return sendResponseSchema.parse(response.data).deliveries;
}
