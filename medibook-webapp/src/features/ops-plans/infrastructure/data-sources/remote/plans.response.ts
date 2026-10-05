import { z } from 'zod';

import { paginatedSchema } from '@/core/api/pagination';

import type { CatalogPlan } from '@/features/ops-plans/domain/entities/plans.catalog';

/** Paise in one rupee — the API speaks paise, the app speaks rupees. */
export const PAISE_PER_RUPEE = 100;

/** `Plan` (`schema.yml`). Limits: `null` = unlimited, 0 = a real cap of zero. */
export const planResponseSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  price_monthly_paise: z.number().int(),
  price_yearly_paise: z.number().int().nullable(),
  limit_users: z.number().int().nullable(),
  limit_doctors: z.number().int().nullable(),
  limit_storage_gb: z.number().int().nullable(),
  is_public: z.boolean(),
  is_active: z.boolean(),
  version: z.number().int(),
});

/**
 * `GET /platform/plans` — `schema.yml` documents a plain array, but the view
 * (`platform_plan_list.py`) returns the standard paginated envelope.
 */
export const planPageResponseSchema = paginatedSchema(planResponseSchema);

/** `GET /platform/plans/{id}/subscribers` — only the total is read. */
export const subscriberPageResponseSchema = paginatedSchema(z.unknown());

export type PlanResponse = z.infer<typeof planResponseSchema>;

export function toCatalogPlan(dto: PlanResponse): CatalogPlan {
  return {
    id: dto.id,
    code: dto.code,
    name: dto.name,
    description: dto.description,
    priceMonthly: dto.price_monthly_paise / PAISE_PER_RUPEE,
    priceYearly: dto.price_yearly_paise === null ? null : dto.price_yearly_paise / PAISE_PER_RUPEE,
    limits: {
      staff: dto.limit_users,
      doctors: dto.limit_doctors,
      storageGb: dto.limit_storage_gb,
    },
    isPublic: dto.is_public,
    isActive: dto.is_active,
    version: dto.version,
  };
}
