import type { MessageTemplateDraft } from '@/features/ops-message-templates/domain/entities/messageTemplates.entities';

/** Wire field → draft field, so a `400` lands on the right input. */
export const TEMPLATE_FIELD: Readonly<Record<string, string>> = {
  event_code: 'eventCode',
  whatsapp_template_name: 'whatsappTemplateName',
  is_active: 'isActive',
};

const blankToNull = (v: string | null): string | null => (v && v.trim() !== '' ? v.trim() : null);

/** `POST` body: everything, including the fields fixed after creation. */
export function toTemplateCreateBody(draft: MessageTemplateDraft) {
  return {
    event_code: draft.eventCode.trim(),
    channel: draft.channel,
    locale: draft.locale.trim(),
    ...toTemplatePatchBody(draft),
  };
}

/** `PATCH` body: the wording and the switch (sending event/channel/locale is refused). */
export function toTemplatePatchBody(draft: MessageTemplateDraft) {
  return {
    subject: blankToNull(draft.subject),
    body: draft.body,
    whatsapp_template_name:
      draft.channel === 'whatsapp' ? blankToNull(draft.whatsappTemplateName) : null,
    is_active: draft.isActive,
  };
}
