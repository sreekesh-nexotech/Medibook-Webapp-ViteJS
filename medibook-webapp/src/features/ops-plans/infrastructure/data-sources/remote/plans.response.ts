import { z } from 'zod';

import { paginatedSchema } from '@/core/api/pagination';

import type {
  CatalogPlan,
  PlanHardLimit,
  PlanSubscriber,
} from '@/features/ops-plans/domain/entities/plans.catalog';

/** Paise in one rupee — the API speaks paise, the app speaks rupees. */
export const PAISE_PER_RUPEE = 100;

/** `PlanWriteSerializer` defaults, used when a row leaves the field out. */
const DEFAULT_GST_RATE_BP = 1800;
const DEFAULT_HARD_LIMITS: readonly PlanHardLimit[] = ['users', 'doctors'];

const hardLimitSchema = z.enum(['users', 'doctors', 'storage']);

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
  gst_rate_bp: z.number().int().optional(),
  trial_days: z.number().int().optional(),
  // An entry this build does not know is dropped rather than failing the catalog.
  hard_limits: z
    .array(z.string())
    .optional()
    .transform((list) =>
      list?.flatMap((v) => {
        const parsed = hardLimitSchema.safeParse(v);
        return parsed.success ? [parsed.data] : [];
      }),
    ),
  sort_order: z.number().int().optional(),
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

/** One `SubscriptionSerializer` row, as far as the subscribers drawer reads it. */
const subscriberRowSchema = z.object({
  id: z.string(),
  hospital_id: z.string(),
  hospital_name: z.string(),
  billing_period: z.string(),
  status: z.string(),
  started_at: z.string().nullable().optional(),
  trial_ends_at: z.string().nullable().optional(),
  next_invoice_at: z.string().nullable().optional(),
});

export const subscriberRowsPageSchema = paginatedSchema(subscriberRowSchema);

export type PlanResponse = z.infer<typeof planResponseSchema>;
export type SubscriberRowResponse = z.infer<typeof subscriberRowSchema>;

export function toPlanSubscriber(dto: SubscriberRowResponse): PlanSubscriber {
  return {
    id: dto.id,
    hospitalId: dto.hospital_id,
    hospitalName: dto.hospital_name,
    status: dto.status,
    billingPeriod: dto.billing_period,
    startedAt: dto.started_at ?? null,
    trialEndsAt: dto.trial_ends_at ?? null,
    nextInvoiceAt: dto.next_invoice_at ?? null,
  };
}

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
    hardLimits: dto.hard_limits ?? DEFAULT_HARD_LIMITS,
    gstRateBp: dto.gst_rate_bp ?? DEFAULT_GST_RATE_BP,
    trialDays: dto.trial_days ?? 0,
    sortOrder: dto.sort_order ?? 0,
    isPublic: dto.is_public,
    isActive: dto.is_active,
    version: dto.version,
  };
}
