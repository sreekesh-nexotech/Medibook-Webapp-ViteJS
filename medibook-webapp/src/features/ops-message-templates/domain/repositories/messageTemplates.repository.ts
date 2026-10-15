import type { Result } from '@/core/error/failure';

import type {
  MessageTemplate,
  MessageTemplateDraft,
} from '@/features/ops-message-templates/domain/entities/messageTemplates.entities';

/** Platform message templates (`settings.*`). */
export interface MessageTemplatesRepository {
  listTemplates(): Promise<Result<MessageTemplate[]>>;
  createTemplate(draft: MessageTemplateDraft): Promise<Result<MessageTemplate>>;
  /** Wording and switch only — event, channel and locale never change. */
  updateTemplate(
    id: string,
    draft: MessageTemplateDraft,
    version: number,
  ): Promise<Result<MessageTemplate>>;
  /** Soft delete (D-07). */
  deleteTemplate(id: string, version: number): Promise<Result<null>>;
}
