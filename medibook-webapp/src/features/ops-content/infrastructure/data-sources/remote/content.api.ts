import { ifMatch } from '@/core/api/headers';
import { platformApi } from '@/core/api/http';
import type { PageParams } from '@/core/api/pagination';

import type {
  LegalDraft,
  LegalSlug,
} from '@/features/ops-content/domain/entities/content.entities';
import {
  ambulancePageResponseSchema,
  ambulanceResponseSchema,
  faqPageResponseSchema,
  faqResponseSchema,
  legalDocumentPageResponseSchema,
  legalDocumentResponseSchema,
  locationPageResponseSchema,
  locationResponseSchema,
} from '@/features/ops-content/infrastructure/data-sources/remote/content.response';

const LEGAL_PATH = '/legal-documents';
const FAQS_PATH = '/faqs';
const LOCATIONS_PATH = '/locations';
const AMBULANCE_PATH = '/ambulance-providers';

const byId = (path: string, id: string): string => `${path}/${encodeURIComponent(id)}`;

/* ------------------------------------------------------------------- legal */

export async function getLegalDocumentsPage(page: Required<PageParams>) {
  const response = await platformApi.get(LEGAL_PATH, { params: page });
  return legalDocumentPageResponseSchema.parse(response.data);
}

export async function postLegalDraft(draft: LegalDraft) {
  const response = await platformApi.post(LEGAL_PATH, {
    slug: draft.slug,
    title: draft.title,
    body_md: draft.bodyMd,
  });
  return legalDocumentResponseSchema.parse(response.data);
}

export async function patchLegalDraft(id: string, title: string, bodyMd: string) {
  const response = await platformApi.patch(byId(LEGAL_PATH, id), { title, body_md: bodyMd });
  return legalDocumentResponseSchema.parse(response.data);
}

/** `POST /legal-documents/{slug}/publish {}` — publishes the latest draft. */
export async function postPublishLegal(slug: LegalSlug) {
  const response = await platformApi.post(`${LEGAL_PATH}/${encodeURIComponent(slug)}/publish`, {});
  return legalDocumentResponseSchema.parse(response.data);
}

/* -------------------------------------------------------------------- faqs */

export async function getFaqsPage(page: Required<PageParams>) {
  const response = await platformApi.get(FAQS_PATH, { params: page });
  return faqPageResponseSchema.parse(response.data);
}

export async function postFaq(body: Record<string, unknown>) {
  const response = await platformApi.post(FAQS_PATH, body);
  return faqResponseSchema.parse(response.data);
}

export async function patchFaq(id: string, body: Record<string, unknown>, version: number) {
  const response = await platformApi.patch(byId(FAQS_PATH, id), body, {
    headers: ifMatch(version),
  });
  return faqResponseSchema.parse(response.data);
}

export async function deleteFaq(id: string, version: number): Promise<void> {
  await platformApi.delete(byId(FAQS_PATH, id), { headers: ifMatch(version) });
}

/* --------------------------------------------------------------- locations */

export async function getLocationsPage(page: Required<PageParams>) {
  const response = await platformApi.get(LOCATIONS_PATH, { params: page });
  return locationPageResponseSchema.parse(response.data);
}

export async function postLocation(body: Record<string, unknown>) {
  const response = await platformApi.post(LOCATIONS_PATH, body);
  return locationResponseSchema.parse(response.data);
}

export async function patchLocation(id: string, body: Record<string, unknown>, version: number) {
  const response = await platformApi.patch(byId(LOCATIONS_PATH, id), body, {
    headers: ifMatch(version),
  });
  return locationResponseSchema.parse(response.data);
}

export async function deleteLocation(id: string, version: number): Promise<void> {
  await platformApi.delete(byId(LOCATIONS_PATH, id), { headers: ifMatch(version) });
}

/* -------------------------------------------------------------- ambulance */

export async function getAmbulanceProvidersPage(page: Required<PageParams>) {
  const response = await platformApi.get(AMBULANCE_PATH, { params: page });
  return ambulancePageResponseSchema.parse(response.data);
}

export async function postAmbulanceProvider(body: Record<string, unknown>) {
  const response = await platformApi.post(AMBULANCE_PATH, body);
  return ambulanceResponseSchema.parse(response.data);
}

export async function patchAmbulanceProvider(
  id: string,
  body: Record<string, unknown>,
  version: number,
) {
  const response = await platformApi.patch(byId(AMBULANCE_PATH, id), body, {
    headers: ifMatch(version),
  });
  return ambulanceResponseSchema.parse(response.data);
}

export async function deleteAmbulanceProvider(id: string, version: number): Promise<void> {
  await platformApi.delete(byId(AMBULANCE_PATH, id), { headers: ifMatch(version) });
}
