import { z } from 'zod';

import { paginatedSchema } from '@/core/api/pagination';

import type {
  AmbulanceProvider,
  ContentLocation,
  FaqEntry,
  LegalDocument,
} from '@/features/ops-content/domain/entities/content.entities';

/** `ConfigLegalDocumentSerializer`. */
export const legalDocumentResponseSchema = z.object({
  id: z.string(),
  slug: z.enum(['terms', 'privacy', 'guidelines']),
  version: z.number().int(),
  title: z.string(),
  body_md: z.string(),
  published_at: z.string().nullable(),
  is_current: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

/** `ConfigFaqSerializer`; `audience` is B9's (BE-34). */
export const faqResponseSchema = z.object({
  id: z.string(),
  category: z.string(),
  question: z.string(),
  answer_md: z.string(),
  sort_order: z.number().int(),
  is_published: z.boolean(),
  audience: z.enum(['patient', 'hospital', 'all']).optional(),
  created_at: z.string(),
  updated_at: z.string(),
  version: z.number().int(),
});

/** `ConfigLocationSerializer` — `lat`/`lng` are DRF decimals, sent as strings. */
export const locationResponseSchema = z.object({
  id: z.string(),
  city: z.string(),
  area: z.string(),
  state: z.string(),
  lat: z.union([z.string(), z.number()]).nullable(),
  lng: z.union([z.string(), z.number()]).nullable(),
  is_popular: z.boolean(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  version: z.number().int(),
});

/** `ConfigAmbulanceSerializer`. */
export const ambulanceResponseSchema = z.object({
  id: z.string(),
  location: z.string().nullable(),
  name: z.string(),
  phone_e164: z.string(),
  eta_minutes: z.number().int().nullable(),
  service_area: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  version: z.number().int(),
});

export const legalDocumentPageResponseSchema = paginatedSchema(legalDocumentResponseSchema);
export const faqPageResponseSchema = paginatedSchema(faqResponseSchema);
export const locationPageResponseSchema = paginatedSchema(locationResponseSchema);
export const ambulancePageResponseSchema = paginatedSchema(ambulanceResponseSchema);

export type LegalDocumentResponse = z.infer<typeof legalDocumentResponseSchema>;
export type FaqResponse = z.infer<typeof faqResponseSchema>;
export type LocationResponse = z.infer<typeof locationResponseSchema>;
export type AmbulanceResponse = z.infer<typeof ambulanceResponseSchema>;

export function toLegalDocument(dto: LegalDocumentResponse): LegalDocument {
  return {
    id: dto.id,
    slug: dto.slug,
    version: dto.version,
    title: dto.title,
    bodyMd: dto.body_md,
    publishedAt: dto.published_at,
    isCurrent: dto.is_current,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

export function toFaqEntry(dto: FaqResponse): FaqEntry {
  return {
    id: dto.id,
    category: dto.category,
    question: dto.question,
    answerMd: dto.answer_md,
    sortOrder: dto.sort_order,
    isPublished: dto.is_published,
    audience: dto.audience ?? null,
    rowVersion: dto.version,
  };
}

const decimal = (v: string | number | null): string | null => (v === null ? null : String(v));

export function toContentLocation(dto: LocationResponse): ContentLocation {
  return {
    id: dto.id,
    city: dto.city,
    area: dto.area,
    state: dto.state,
    lat: decimal(dto.lat),
    lng: decimal(dto.lng),
    isPopular: dto.is_popular,
    isActive: dto.is_active,
    rowVersion: dto.version,
  };
}

export function toAmbulanceProvider(dto: AmbulanceResponse): AmbulanceProvider {
  return {
    id: dto.id,
    locationId: dto.location,
    name: dto.name,
    phoneE164: dto.phone_e164,
    etaMinutes: dto.eta_minutes,
    serviceArea: dto.service_area,
    isActive: dto.is_active,
    rowVersion: dto.version,
  };
}
