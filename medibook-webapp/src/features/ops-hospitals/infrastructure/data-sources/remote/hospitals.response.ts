import { z } from 'zod';

import { paginatedSchema } from '@/core/api/pagination';

import type {
  CommissionHistory,
  FirstAdminInvitation,
  HospitalBankAccount,
  HospitalGoLiveBlocker,
  HospitalUsageMeter,
  PayoutBankAccount,
  PlatformHospital,
  PlatformHospitalDetail,
} from '@/features/ops-hospitals/domain/entities/hospitals.entity';

/**
 * `PlatformHospitalSerializer` (list row; also the suspend / reinstate body),
 * `PlatformHospitalRowSerializer` (registry extras, BE-29) and
 * `PlatformHospitalDetailSerializer` (detail extras). Fields added by BE-29
 * are optional, so an older backend still parses. Only the fields the
 * screens read are validated.
 */

const lifecycleSchema = z.enum(['draft', 'onboarding', 'active', 'suspended', 'closed']);

const STAGES = [
  'application',
  'documents_pending',
  'review',
  'approved',
  'live',
  'rejected',
] as const;

const SUSPENSION_REASONS = [
  'non_payment',
  'non_payment_read_only',
  'compliance',
  'manual',
  'onboarding_rejected',
] as const;

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
  timezone: z.string().optional(),
  created_at: z.string(),
  version: z.number().int(),
  // Registry extras (BE-29) — only on list rows.
  plan_code: z.string().nullable().optional(),
  plan_name: z.string().nullable().optional(),
  subscription_status: z.string().nullable().optional(),
  bookings_30d: z.number().int().nullable().optional(),
  onboarding_stage: z.enum(STAGES).nullable().optional(),
  suspension_reason: z.enum(SUSPENSION_REASONS).nullable().optional(),
});

export const hospitalPageResponseSchema = paginatedSchema(hospitalResponseSchema);

/** `FirstAdminInvitationSerializer` (CORE-04). */
export const firstAdminInvitationResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  first_name: z.string(),
  last_name: z.string().nullable(),
  status: z.string(),
  invited_at: z.string(),
  last_sent_at: z.string(),
  expires_at: z.string(),
  resend_count: z.number().int(),
  max_resends: z.number().int(),
  accepted_at: z.string().nullable(),
  admin_accepted: z.boolean(),
  can_resend: z.boolean(),
});

export type FirstAdminInvitationResponse = z.infer<typeof firstAdminInvitationResponseSchema>;

export function toFirstAdminInvitation(dto: FirstAdminInvitationResponse): FirstAdminInvitation {
  return {
    id: dto.id,
    email: dto.email,
    firstName: dto.first_name,
    lastName: dto.last_name,
    status: dto.status,
    invitedAt: dto.invited_at,
    lastSentAt: dto.last_sent_at,
    expiresAt: dto.expires_at,
    resendCount: dto.resend_count,
    maxResends: dto.max_resends,
    acceptedAt: dto.accepted_at,
    adminAccepted: dto.admin_accepted,
    canResend: dto.can_resend,
  };
}

/** `PlatformBankAccountMaskedSerializer`. */
const bankAccountSchema = z.object({
  id: z.string(),
  account_holder: z.string(),
  bank_name: z.string(),
  ifsc: z.string(),
  account_number_masked: z.string(),
  upi_id_masked: z.string().nullable(),
  is_primary: z.boolean(),
  verified_at: z.string().nullable(),
  created_at: z.string(),
});

function toBankAccount(dto: z.infer<typeof bankAccountSchema>): HospitalBankAccount {
  return {
    id: dto.id,
    accountHolder: dto.account_holder,
    bankName: dto.bank_name,
    ifsc: dto.ifsc,
    accountNumberMasked: dto.account_number_masked,
    upiIdMasked: dto.upi_id_masked,
    isPrimary: dto.is_primary,
    verifiedAt: dto.verified_at,
    createdAt: dto.created_at,
  };
}

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
      plan_code: z.string().optional(),
      plan_name: z.string().optional(),
      status: z.string(),
      billing_period: z.string(),
      trial_ends_at: z.string().nullable(),
      current_period_end: z.string().nullable().optional(),
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
      stage: z.enum(STAGES),
      rejection_reason: z.string().nullable().optional(),
    })
    .nullable(),
  staff_count: z.number().int(),
  active_suspensions: z.array(
    z.object({
      id: z.string(),
      reason: z.enum(SUSPENSION_REASONS),
      note: z.string().nullable().optional(),
      suspended_at: z.string(),
    }),
  ),
  go_live_blockers: z.array(blockerSchema),
  first_admin_invitation: firstAdminInvitationResponseSchema.nullable().optional(),
  bank_accounts: z.array(bankAccountSchema).optional(),
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
    timezone: dto.timezone ?? null,
    createdAt: dto.created_at,
    version: dto.version,
    planName: dto.plan_name ?? null,
    planCode: dto.plan_code ?? null,
    subscriptionStatus: dto.subscription_status ?? null,
    bookings30d: dto.bookings_30d ?? null,
    onboardingStage: dto.onboarding_stage ?? null,
    suspensionReason: dto.suspension_reason ?? null,
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
      planCode: dto.subscription.plan_code ?? null,
      planName: dto.subscription.plan_name ?? null,
      status: dto.subscription.status,
      billingPeriod: dto.subscription.billing_period,
      trialEndsAt: dto.subscription.trial_ends_at,
      currentPeriodEnd: dto.subscription.current_period_end ?? null,
    },
    usage: {
      ...(users ? { users } : {}),
      ...(doctors ? { doctors } : {}),
      ...(storage ? { storage } : {}),
    },
    onboarding: dto.onboarding && {
      id: dto.onboarding.id,
      stage: dto.onboarding.stage,
      rejectionReason: dto.onboarding.rejection_reason ?? null,
    },
    staffCount: dto.staff_count,
    activeSuspensions: dto.active_suspensions.map((s) => ({
      id: s.id,
      reason: s.reason,
      note: s.note ?? null,
      suspendedAt: s.suspended_at,
    })),
    goLiveBlockers: dto.go_live_blockers.map(toBlocker),
    firstAdminInvitation: dto.first_admin_invitation
      ? toFirstAdminInvitation(dto.first_admin_invitation)
      : null,
    bankAccounts: dto.bank_accounts ? dto.bank_accounts.map(toBankAccount) : null,
  };
}

/** `POST /platform/hospitals` → 201 `{hospital, subscription}`; only the hospital is read. */
export const hospitalCreatedResponseSchema = z.object({ hospital: hospitalResponseSchema });

/** `GET /platform/hospitals/{id}/commission-history` (API-01). */
export const commissionHistoryResponseSchema = z.object({
  today: z.string().optional(),
  results: z.array(
    z.object({
      id: z.string(),
      commission_bp: z.number().int(),
      effective_from: z.string(),
      status: z.string(),
      note: z.string().nullable().optional(),
      set_by_name: z.string().nullable().optional(),
      created_at: z.string(),
    }),
  ),
});

export type CommissionHistoryResponse = z.infer<typeof commissionHistoryResponseSchema>;

export function toCommissionHistory(dto: CommissionHistoryResponse): CommissionHistory {
  return {
    today: dto.today ?? null,
    rates: dto.results.map((r) => ({
      id: r.id,
      commissionBp: r.commission_bp,
      effectiveFrom: r.effective_from,
      status: r.status,
      note: r.note ?? null,
      setByName: r.set_by_name ?? null,
      createdAt: r.created_at,
    })),
  };
}

/** `PlatformBankAccountSerializer` (M-45). */
export const payoutBankAccountResponseSchema = z.object({
  id: z.string(),
  account_holder: z.string(),
  bank_name: z.string(),
  ifsc: z.string(),
  account_number_masked: z.string(),
  upi_id: z.string().nullable().optional(),
  is_primary: z.boolean(),
  verified_at: z.string().nullable(),
  version: z.number().int(),
});

export const payoutBankAccountPageResponseSchema = paginatedSchema(payoutBankAccountResponseSchema);

export type PayoutBankAccountResponse = z.infer<typeof payoutBankAccountResponseSchema>;

export function toPayoutBankAccount(dto: PayoutBankAccountResponse): PayoutBankAccount {
  return {
    id: dto.id,
    accountHolder: dto.account_holder,
    bankName: dto.bank_name,
    ifsc: dto.ifsc,
    accountNumberMasked: dto.account_number_masked,
    upiId: dto.upi_id ?? null,
    isPrimary: dto.is_primary,
    verifiedAt: dto.verified_at,
    version: dto.version,
  };
}
