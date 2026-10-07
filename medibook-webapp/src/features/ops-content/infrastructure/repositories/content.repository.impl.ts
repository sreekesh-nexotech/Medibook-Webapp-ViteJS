import { fetchAllPages } from '@/core/api/pagination';
import { attempt } from '@/core/error/attempt';
import type { FieldErrors, Result } from '@/core/error/failure';
import { err } from '@/core/error/failure';

import type { ContentRepository } from '@/features/ops-content/domain/repositories/content.repository';
import * as api from '@/features/ops-content/infrastructure/data-sources/remote/content.api';
import {
  CONTENT_FIELD,
  toAmbulanceRequest,
  toFaqRequest,
  toLocationRequest,
} from '@/features/ops-content/infrastructure/data-sources/remote/content.request';
import {
  toAmbulanceProvider,
  toContentLocation,
  toFaqEntry,
  toLegalDocument,
} from '@/features/ops-content/infrastructure/data-sources/remote/content.response';

/** Rename a failure's wire field keys to draft keys, so nothing upward sees DTO names. */
async function withDraftFields<T>(pending: Promise<Result<T>>): Promise<Result<T>> {
  const result = await pending;
  if (result.ok) return result;
  const fieldErrors: Record<string, FieldErrors[string]> = {};
  for (const [field, messages] of Object.entries(result.failure.fieldErrors)) {
    fieldErrors[CONTENT_FIELD[field] ?? field] = messages;
  }
  return err({ ...result.failure, fieldErrors });
}

const deleted = async (run: () => Promise<void>): Promise<null> => {
  await run();
  return null;
};

export const contentRepository: ContentRepository = {
  listLegalDocuments: () =>
    attempt(async () => (await fetchAllPages(api.getLegalDocumentsPage)).map(toLegalDocument)),
  createLegalDraft: (draft) =>
    withDraftFields(attempt(async () => toLegalDocument(await api.postLegalDraft(draft)))),
  updateLegalDraft: (id, changes) =>
    withDraftFields(
      attempt(async () =>
        toLegalDocument(await api.patchLegalDraft(id, changes.title, changes.bodyMd)),
      ),
    ),
  publishLegalDraft: (slug) =>
    attempt(async () => toLegalDocument(await api.postPublishLegal(slug))),

  listFaqs: () => attempt(async () => (await fetchAllPages(api.getFaqsPage)).map(toFaqEntry)),
  createFaq: (draft) =>
    withDraftFields(attempt(async () => toFaqEntry(await api.postFaq(toFaqRequest(draft))))),
  updateFaq: (id, draft, version) =>
    withDraftFields(
      attempt(async () => toFaqEntry(await api.patchFaq(id, toFaqRequest(draft), version))),
    ),
  deleteFaq: (id, version) => attempt(() => deleted(() => api.deleteFaq(id, version))),

  listLocations: () =>
    attempt(async () => (await fetchAllPages(api.getLocationsPage)).map(toContentLocation)),
  createLocation: (draft) =>
    withDraftFields(
      attempt(async () => toContentLocation(await api.postLocation(toLocationRequest(draft)))),
    ),
  updateLocation: (id, draft, version) =>
    withDraftFields(
      attempt(async () =>
        toContentLocation(await api.patchLocation(id, toLocationRequest(draft), version)),
      ),
    ),
  deleteLocation: (id, version) => attempt(() => deleted(() => api.deleteLocation(id, version))),

  listAmbulanceProviders: () =>
    attempt(async () =>
      (await fetchAllPages(api.getAmbulanceProvidersPage)).map(toAmbulanceProvider),
    ),
  createAmbulanceProvider: (draft) =>
    withDraftFields(
      attempt(async () =>
        toAmbulanceProvider(await api.postAmbulanceProvider(toAmbulanceRequest(draft))),
      ),
    ),
  updateAmbulanceProvider: (id, draft, version) =>
    withDraftFields(
      attempt(async () =>
        toAmbulanceProvider(
          await api.patchAmbulanceProvider(id, toAmbulanceRequest(draft), version),
        ),
      ),
    ),
  deleteAmbulanceProvider: (id, version) =>
    attempt(() => deleted(() => api.deleteAmbulanceProvider(id, version))),
};
