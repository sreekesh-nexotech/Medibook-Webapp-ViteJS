import { ifMatch } from '@/core/api/headers';
import { platformApi } from '@/core/api/http';
import type { PageParams } from '@/core/api/pagination';

import type { MessageTemplateDraft } from '@/features/ops-message-templates/domain/entities/messageTemplates.entities';
import {
  toTemplateCreateBody,
  toTemplatePatchBody,
} from '@/features/ops-message-templates/infrastructure/data-sources/remote/messageTemplates.request';
import {
  messageTemplatePageResponseSchema,
  messageTemplateResponseSchema,
} from '@/features/ops-message-templates/infrastructure/data-sources/remote/messageTemplates.response';

const TEMPLATES_PATH = '/messaging/templates';

const byId = (id: string): string => `${TEMPLATES_PATH}/${encodeURIComponent(id)}`;

/** `GET /platform/messaging/templates` (`settings.view`), event × channel × locale order. */
export async function getTemplatesPage(page: Required<PageParams>) {
  const response = await platformApi.get(TEMPLATES_PATH, { params: page });
  return messageTemplatePageResponseSchema.parse(response.data);
}

/** `POST` (`settings.add`); one active template per event × channel × locale (else 400). */
export async function postTemplate(draft: MessageTemplateDraft) {
  const response = await platformApi.post(TEMPLATES_PATH, toTemplateCreateBody(draft));
  return messageTemplateResponseSchema.parse(response.data);
}

/** `PATCH …/{id}` (`settings.edit`, `If-Match` required). */
export async function patchTemplate(id: string, draft: MessageTemplateDraft, version: number) {
  const response = await platformApi.patch(byId(id), toTemplatePatchBody(draft), {
    headers: ifMatch(version),
  });
  return messageTemplateResponseSchema.parse(response.data);
}

/** `DELETE …/{id}` (`settings.del`) — a soft delete. */
export async function deleteTemplate(id: string, version: number): Promise<void> {
  await platformApi.delete(byId(id), { headers: ifMatch(version) });
}
