import { fetchAllPages } from '@/core/api/pagination';
import { attempt } from '@/core/error/attempt';
import type { FieldErrors, Result } from '@/core/error/failure';
import { err } from '@/core/error/failure';

import type { MessageTemplatesRepository } from '@/features/ops-message-templates/domain/repositories/messageTemplates.repository';
import * as api from '@/features/ops-message-templates/infrastructure/data-sources/remote/messageTemplates.api';
import { TEMPLATE_FIELD } from '@/features/ops-message-templates/infrastructure/data-sources/remote/messageTemplates.request';
import { toMessageTemplate } from '@/features/ops-message-templates/infrastructure/data-sources/remote/messageTemplates.response';

/** Rename a failure's wire field keys to draft keys, so nothing upward sees DTO names. */
async function withDraftFields<T>(pending: Promise<Result<T>>): Promise<Result<T>> {
  const result = await pending;
  if (result.ok) return result;
  const fieldErrors: Record<string, FieldErrors[string]> = {};
  for (const [field, messages] of Object.entries(result.failure.fieldErrors)) {
    fieldErrors[TEMPLATE_FIELD[field] ?? field] = messages;
  }
  return err({ ...result.failure, fieldErrors });
}

export const messageTemplatesRepository: MessageTemplatesRepository = {
  listTemplates: () =>
    attempt(async () => (await fetchAllPages(api.getTemplatesPage)).map(toMessageTemplate)),
  createTemplate: (draft) =>
    withDraftFields(attempt(async () => toMessageTemplate(await api.postTemplate(draft)))),
  updateTemplate: (id, draft, version) =>
    withDraftFields(
      attempt(async () => toMessageTemplate(await api.patchTemplate(id, draft, version))),
    ),
  deleteTemplate: (id, version) =>
    attempt(async () => {
      await api.deleteTemplate(id, version);
      return null;
    }),
};
