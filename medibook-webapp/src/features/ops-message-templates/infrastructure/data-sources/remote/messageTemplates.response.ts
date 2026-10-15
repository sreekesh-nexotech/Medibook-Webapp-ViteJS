import { z } from 'zod';

import { paginatedSchema } from '@/core/api/pagination';

import type { MessageTemplate } from '@/features/ops-message-templates/domain/entities/messageTemplates.entities';
import { MESSAGE_CHANNELS } from '@/features/ops-message-templates/domain/entities/messageTemplates.entities';

/** `PlatformTemplateSerializer`. */
export const messageTemplateResponseSchema = z.object({
  id: z.string(),
  event_code: z.string(),
  channel: z.enum(MESSAGE_CHANNELS),
  locale: z.string(),
  subject: z.string().nullable(),
  body: z.string(),
  whatsapp_template_name: z.string().nullable(),
  is_active: z.boolean(),
  version: z.number().int(),
  updated_by: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const messageTemplatePageResponseSchema = paginatedSchema(messageTemplateResponseSchema);

export type MessageTemplateResponse = z.infer<typeof messageTemplateResponseSchema>;

export function toMessageTemplate(dto: MessageTemplateResponse): MessageTemplate {
  return {
    id: dto.id,
    eventCode: dto.event_code,
    channel: dto.channel,
    locale: dto.locale,
    subject: dto.subject,
    body: dto.body,
    whatsappTemplateName: dto.whatsapp_template_name,
    isActive: dto.is_active,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
    version: dto.version,
  };
}
