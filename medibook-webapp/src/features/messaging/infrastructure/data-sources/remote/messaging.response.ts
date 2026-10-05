import { z } from 'zod';

import { paginatedSchema } from '@/core/api/pagination';

import {
  DELIVERY_STATUSES,
  type MessageDelivery,
  type MessagingTemplate,
} from '@/features/messaging/domain/entities/messaging.entities';

const channelSchema = z.enum(['sms', 'whatsapp', 'email', 'push']);

/** `HospitalTemplate` (`schema.yml`). */
export const templateResponseSchema = z.object({
  id: z.string(),
  event_code: z.string(),
  channel: channelSchema,
  locale: z.string(),
  subject: z.string().nullable(),
  body: z.string(),
  version: z.number().int(),
  updated_at: z.string(),
});

/** `HospitalDelivery` (`schema.yml`). */
export const deliveryResponseSchema = z.object({
  id: z.string(),
  channel: channelSchema,
  event_code: z.string(),
  recipient_address: z.string(),
  status: z.enum(DELIVERY_STATUSES),
  rendered_subject: z.string().nullable().optional(),
  queued_at: z.string(),
  sent_at: z.string().nullable().optional(),
  delivered_at: z.string().nullable().optional(),
  failed_at: z.string().nullable().optional(),
  error_message: z.string().nullable().optional(),
  triggered_by_kind: z.string().nullable().optional(),
});

/**
 * `GET /hospital/messaging/templates` and `…/deliveries` — `schema.yml`
 * documents plain arrays, but the views return the paginated envelope.
 */
export const templatePageResponseSchema = paginatedSchema(templateResponseSchema);
export const deliveryPageResponseSchema = paginatedSchema(deliveryResponseSchema);

/**
 * `POST /hospital/messaging/send` → 202. `schema.yml` documents an array; the
 * view returns `{deliveries: [...]}`.
 */
export const sendResponseSchema = z.object({ deliveries: z.array(deliveryResponseSchema) });

export type TemplateResponse = z.infer<typeof templateResponseSchema>;
export type DeliveryResponse = z.infer<typeof deliveryResponseSchema>;

export function toMessagingTemplate(dto: TemplateResponse): MessagingTemplate {
  return {
    id: dto.id,
    eventCode: dto.event_code,
    channel: dto.channel,
    locale: dto.locale,
    subject: dto.subject,
    body: dto.body,
    version: dto.version,
    updatedAt: dto.updated_at,
  };
}

export function toMessageDelivery(dto: DeliveryResponse): MessageDelivery {
  return {
    id: dto.id,
    channel: dto.channel,
    eventCode: dto.event_code,
    recipientAddress: dto.recipient_address,
    status: dto.status,
    renderedSubject: dto.rendered_subject ?? null,
    queuedAt: dto.queued_at,
    sentAt: dto.sent_at ?? null,
    deliveredAt: dto.delivered_at ?? null,
    failedAt: dto.failed_at ?? null,
    errorMessage: dto.error_message ?? null,
    triggeredByKind: dto.triggered_by_kind ?? null,
  };
}
