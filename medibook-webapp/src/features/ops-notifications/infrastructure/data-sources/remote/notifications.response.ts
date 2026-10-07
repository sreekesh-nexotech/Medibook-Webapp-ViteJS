import { z } from 'zod';

import { paginatedSchema } from '@/core/api/pagination';
import { toLocalISO } from '@/shared/lib/format';

import type { CampaignBanner } from '@/features/ops-notifications/domain/entities/notifications.entities';

/**
 * `ConfigBanner` (`schema.yml`). `GET /platform/banners` is paginated
 * (`core/pagination.py`) even though the schema documents a bare array.
 */
export const bannerResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string().nullable().optional(),
  cta_label: z.string().nullable().optional(),
  cta_target: z.string().nullable().optional(),
  audience: z.string().optional(),
  image_file: z.string().nullable(),
  starts_at: z.string().nullable(),
  ends_at: z.string().nullable(),
  sort_order: z.number().int(),
  is_enabled: z.boolean(),
  version: z.number().int(),
});

export const bannersPageResponseSchema = paginatedSchema(bannerResponseSchema);

export type BannerResponse = z.infer<typeof bannerResponseSchema>;
export type BannersPageResponse = z.infer<typeof bannersPageResponseSchema>;

/** The model default (`HospitalBanner.audience`) when an older backend omits the field. */
const DEFAULT_AUDIENCE = 'hospital_patients';

/** A UTC timestamp as the local calendar day it falls on. */
function toLocalDay(iso: string | null): string | null {
  return iso ? toLocalISO(new Date(iso)) : null;
}

export function toCampaignBanner(dto: BannerResponse): CampaignBanner {
  return {
    id: dto.id,
    title: dto.title,
    body: dto.body ?? null,
    ctaLabel: dto.cta_label ?? null,
    ctaTarget: dto.cta_target ?? null,
    audience: dto.audience ?? DEFAULT_AUDIENCE,
    imageFileId: dto.image_file,
    from: toLocalDay(dto.starts_at),
    to: toLocalDay(dto.ends_at),
    active: dto.is_enabled,
    sortOrder: dto.sort_order,
    version: dto.version,
  };
}
