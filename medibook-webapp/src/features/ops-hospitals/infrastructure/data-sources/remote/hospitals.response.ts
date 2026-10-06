import { z } from 'zod';

import { paginatedSchema } from '@/core/api/pagination';

import type {
  HospitalGoLiveBlocker,
  HospitalUsageMeter,
  PlatformHospital,
  PlatformHospitalDetail,
} from '@/features/ops-hospitals/domain/entities/hospitals.entity';

/**
 * `PlatformHospitalSerializer` (list row; also the suspend / reinstate body)
 * and `platform_hospitals.detail_extras()` (merged into the detail body) —
 * the detail is untyped in `schema.yml`, so its shape follows the backend
 * service. Only the fields the screens read are validated.
 */

const lifecycleSchema = z.enum(['draft', 'onboarding', 'active', 'suspended', 'closed']);

export const hospitalResponseSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  legal_name: z.string().nullable(),
  gstin: z.string().nullable(),
  registration_no: z.string().nullable(),
  email: z.string(),
  phone_e164: z.string(),
  website: z.string().nullable(),
  address_line1: z.string(),
  address_line2: z.string().nullable(),
  address_line3: z.string().nullable(),
  city: z.string(),
  state: z.string(),
  pincode: z.string(),
  status: lifecycleSchema,
  app_visibility: z.enum(['visible', 'hidden']),
  online_booking_enabled: z.boolean(),
  commission_bp: z.number().int(),
  convenience_fee_kind: z.enum(['flat', 'percent']),
  convenience_fee_value: z.number().int(),
  go_live_at: z.string().nullable(),
  created_at: z.string(),
  version: z.number().int(),
});

export const hospitalPageResponseSchema = paginatedSchema(hospitalResponseSchema);

const usageMeterSchema = z.object({
  current: z.number(),
  limit: z.number().nullable(),
  hard: z.boolean(),
});

const blockerSchema = z.object({
  code: z.string(),
  items: z.array(z.string()).optional(),
  kinds: z.array(z.string()).optional(),
});

export const hospitalDetailResponseSchema = hospitalResponseSchema.extend({
  subscription: z
    .object({
      id: z.string(),
      plan_id: z.string(),
      plan_code: z.string(),
      status: z.string(),
      billing_period: z.string(),
      trial_ends_at: z.string().nullable(),
      current_period_end: z.string().nullable(),
    })
    .nullable(),
  usage: z.object({
    users: usageMeterSchema.optional(),
    doctors: usageMeterSchema.optional(),
    storage: usageMeterSchema.optional(),
  }),
  onboarding: z
    .object({
      id: z.string(),
      stage: z.enum(['application', 'documents_pending', 'review', 'approved', 'live', 'rejected']),
    })
    .nullable(),
  staff_count: z.number().int(),
  active_suspensions: z.array(
    z.object({
      id: z.string(),
      reason: z.enum([
        'non_payment',
        'non_payment_read_only',
        'compliance',
        'manual',
        'onboarding_rejected',
      ]),
      suspended_at: z.string(),
    }),
  ),
  go_live_blockers: z.array(blockerSchema),
});

export type HospitalResponse = z.infer<typeof hospitalResponseSchema>;
export type HospitalDetailResponse = z.infer<typeof hospitalDetailResponseSchema>;

export function toPlatformHospital(dto: HospitalResponse): PlatformHospital {
  return {
    id: dto.id,
    slug: dto.slug,
    name: dto.name,
    legalName: dto.legal_name,
    gstin: dto.gstin,
    registrationNo: dto.registration_no,
    email: dto.email,
    phone: dto.phone_e164,
    website: dto.website,
    addressLine1: dto.address_line1,
    addressLine2: dto.address_line2,
    addressLine3: dto.address_line3,
    city: dto.city,
    state: dto.state,
    pincode: dto.pincode,
    status: dto.status,
    appVisibility: dto.app_visibility,
    onlineBookingEnabled: dto.online_booking_enabled,
    commissionBp: dto.commission_bp,
    convenienceFeeKind: dto.convenience_fee_kind,
    convenienceFeeValue: dto.convenience_fee_value,
    goLiveAt: dto.go_live_at,
    createdAt: dto.created_at,
    version: dto.version,
  };
}

function toMeter(
  dto: z.infer<typeof usageMeterSchema> | undefined,
): HospitalUsageMeter | undefined {
  return dto && { current: dto.current, limit: dto.limit, hard: dto.hard };
}

function toBlocker(dto: z.infer<typeof blockerSchema>): HospitalGoLiveBlocker {
  return { code: dto.code, details: dto.items ?? dto.kinds ?? [] };
}

export function toPlatformHospitalDetail(dto: HospitalDetailResponse): PlatformHospitalDetail {
  const users = toMeter(dto.usage.users);
  const doctors = toMeter(dto.usage.doctors);
  const storage = toMeter(dto.usage.storage);
  return {
    ...toPlatformHospital(dto),
    subscription: dto.subscription && {
      id: dto.subscription.id,
      planId: dto.subscription.plan_id,
      planCode: dto.subscription.plan_code,
      status: dto.subscription.status,
      billingPeriod: dto.subscription.billing_period,
      trialEndsAt: dto.subscription.trial_ends_at,
      currentPeriodEnd: dto.subscription.current_period_end,
    },
    usage: {
      ...(users ? { users } : {}),
      ...(doctors ? { doctors } : {}),
      ...(storage ? { storage } : {}),
    },
    onboarding: dto.onboarding,
    staffCount: dto.staff_count,
    activeSuspensions: dto.active_suspensions.map((s) => ({
      id: s.id,
      reason: s.reason,
      suspendedAt: s.suspended_at,
    })),
    goLiveBlockers: dto.go_live_blockers.map(toBlocker),
  };
}

/** `POST /platform/hospitals` → 201 `{hospital, subscription}`; only the hospital is read. */
export const hospitalCreatedResponseSchema = z.object({ hospital: hospitalResponseSchema });
