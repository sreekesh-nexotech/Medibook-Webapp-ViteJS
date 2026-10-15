import { z } from 'zod';

import { paginatedSchema } from '@/core/api/pagination';

import type {
  BillingInvoice,
  BillingInvoiceDetail,
  BillingPlan,
  BillingUsage,
  CreditNote,
  InvoiceParty,
  PlanChangeRequest,
  Subscription,
  UsageMeter,
  UsageMetric,
} from '@/features/settlements/domain/entities/billing.entities';

/**
 * Plan & Billing DTOs. Lists come back in the standard page envelope even
 * where `schema.yml` says array; `subscription` and `usage` are untyped
 * `dict`s in the schema — their shapes come from `SubscriptionSerializer` +
 * `PlanSerializer` and `limits.usage()`.
 */

export const billingPlanResponseSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  price_monthly_paise: z.number().int(),
  price_yearly_paise: z.number().int().nullable(),
  gst_rate_bp: z.number().int(),
});

export const billingPlanPageResponseSchema = paginatedSchema(billingPlanResponseSchema);

export const subscriptionResponseSchema = z.object({
  id: z.string(),
  billing_period: z.string(),
  status: z.string(),
  read_only: z.boolean(),
  current_period_start: z.string().nullable(),
  current_period_end: z.string().nullable(),
  next_invoice_at: z.string().nullable(),
  trial_ends_at: z.string().nullable(),
  cancel_at_period_end: z.boolean(),
  grace_days_override: z.number().int().nullable().optional(),
  plan: billingPlanResponseSchema,
});

const usageMeterResponseSchema = z.object({
  current: z.number(),
  limit: z.number().nullable(),
  hard: z.boolean(),
});

export const usageResponseSchema = z.object({
  period_start: z.string().nullable(),
  metrics: z.object({
    users: usageMeterResponseSchema,
    doctors: usageMeterResponseSchema,
    storage: usageMeterResponseSchema,
  }),
});

export const invoiceResponseSchema = z.object({
  id: z.string(),
  invoice_no: z.string(),
  hospital_name: z.string(),
  period_start: z.string(),
  period_end: z.string(),
  issued_at: z.string(),
  due_at: z.string(),
  subtotal_paise: z.number().int(),
  gst_paise: z.number().int(),
  total_paise: z.number().int(),
  amount_paid_paise: z.number().int(),
  status: z.string(),
  paid_at: z.string().nullable(),
  grace_ends_at: z.string().nullable().optional(),
});

export const invoicePageResponseSchema = paginatedSchema(invoiceResponseSchema);

/** Snapshot party block (`invoicing.hospital_snapshot` / `platform_snapshot`); every key optional. */
const partySnapshotSchema = z
  .object({
    name: z.string().nullable().optional(),
    legal_name: z.string().nullable().optional(),
    gstin: z.string().nullable().optional(),
    address_line1: z.string().nullable().optional(),
    address_line2: z.string().nullable().optional(),
    address_line3: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    state: z.string().nullable().optional(),
    pincode: z.string().nullable().optional(),
  })
  .nullable();

export const invoiceDetailResponseSchema = invoiceResponseSchema.extend({
  lines: z.array(
    z.object({
      id: z.string(),
      description: z.string(),
      quantity: z.number(),
      amount_paise: z.number().int(),
      tax_rate_bp: z.number().int(),
      tax_paise: z.number().int(),
    }),
  ),
  hospital_snapshot: partySnapshotSchema,
  platform_snapshot: partySnapshotSchema,
});

export const planChangeRequestResponseSchema = z.object({
  id: z.string(),
  to_plan_id: z.string(),
  to_plan_name: z.string().nullable().optional(),
  to_billing_period: z.string(),
  requested_at: z.string(),
  status: z.string(),
  note: z.string().nullable(),
  review_note: z.string().nullable(),
  proration_invoice_id: z.string().nullable().optional(),
  credit_note_id: z.string().nullable().optional(),
});

export const planChangeRequestPageResponseSchema = paginatedSchema(planChangeRequestResponseSchema);

/** `GET /hospital/billing/credit-notes` rows (backend B4, M-25). */
export const creditNoteResponseSchema = z.object({
  id: z.string(),
  credit_note_no: z.string(),
  issued_at: z.string(),
  reason: z.string().nullable().optional(),
  subtotal_paise: z.number().int(),
  gst_paise: z.number().int(),
  total_paise: z.number().int(),
  applied_paise: z.number().int(),
  remaining_paise: z.number().int().optional(),
});

export const creditNotePageResponseSchema = paginatedSchema(creditNoteResponseSchema);

type BillingPlanResponse = z.infer<typeof billingPlanResponseSchema>;
type SubscriptionResponse = z.infer<typeof subscriptionResponseSchema>;
type UsageResponse = z.infer<typeof usageResponseSchema>;
type InvoiceResponse = z.infer<typeof invoiceResponseSchema>;
type InvoiceDetailResponse = z.infer<typeof invoiceDetailResponseSchema>;
type PartySnapshot = z.infer<typeof partySnapshotSchema>;
type PlanChangeRequestResponse = z.infer<typeof planChangeRequestResponseSchema>;
type CreditNoteResponse = z.infer<typeof creditNoteResponseSchema>;

/** Name used when the issuer snapshot carries no name. */
const DEFAULT_ISSUER_NAME = 'Medibook';

/** Display order of the usage meters. */
const USAGE_METRICS: readonly UsageMetric[] = ['users', 'doctors', 'storage'];

export function toBillingPlan(dto: BillingPlanResponse): BillingPlan {
  return {
    id: dto.id,
    code: dto.code,
    name: dto.name,
    priceMonthlyPaise: dto.price_monthly_paise,
    priceYearlyPaise: dto.price_yearly_paise,
    gstRateBp: dto.gst_rate_bp,
  };
}

export function toSubscription(dto: SubscriptionResponse): Subscription {
  return {
    id: dto.id,
    plan: toBillingPlan(dto.plan),
    billingPeriod: dto.billing_period,
    status: dto.status,
    readOnly: dto.read_only,
    currentPeriodStart: dto.current_period_start,
    currentPeriodEnd: dto.current_period_end,
    nextInvoiceAt: dto.next_invoice_at,
    trialEndsAt: dto.trial_ends_at,
    cancelAtPeriodEnd: dto.cancel_at_period_end,
    graceDaysOverride: dto.grace_days_override ?? null,
  };
}

export function toBillingUsage(dto: UsageResponse): BillingUsage {
  const meters: UsageMeter[] = USAGE_METRICS.map((metric) => ({
    metric,
    current: dto.metrics[metric].current,
    limit: dto.metrics[metric].limit,
    hard: dto.metrics[metric].hard,
  }));
  return { periodStart: dto.period_start, meters };
}

export function toBillingInvoice(dto: InvoiceResponse): BillingInvoice {
  return {
    id: dto.id,
    invoiceNo: dto.invoice_no,
    periodStart: dto.period_start,
    periodEnd: dto.period_end,
    issuedAt: dto.issued_at,
    dueAt: dto.due_at,
    subtotalPaise: dto.subtotal_paise,
    gstPaise: dto.gst_paise,
    totalPaise: dto.total_paise,
    amountPaidPaise: dto.amount_paid_paise,
    status: dto.status,
    paidAt: dto.paid_at,
    graceEndsAt: dto.grace_ends_at ?? null,
  };
}

function toParty(snapshot: PartySnapshot, fallbackName: string): InvoiceParty {
  const s = snapshot ?? {};
  const cityLine = [s.city, s.state, s.pincode].filter(Boolean).join(', ');
  const addressLines = [s.address_line1, s.address_line2, s.address_line3, cityLine].filter(
    (line): line is string => Boolean(line),
  );
  return {
    name: s.legal_name || s.name || fallbackName,
    gstin: s.gstin || null,
    addressLines,
  };
}

export function toBillingInvoiceDetail(dto: InvoiceDetailResponse): BillingInvoiceDetail {
  return {
    ...toBillingInvoice(dto),
    lines: dto.lines.map((l) => ({
      id: l.id,
      description: l.description,
      quantity: l.quantity,
      amountPaise: l.amount_paise,
      taxRateBp: l.tax_rate_bp,
      taxPaise: l.tax_paise,
    })),
    billedTo: toParty(dto.hospital_snapshot, dto.hospital_name),
    issuer: toParty(dto.platform_snapshot, DEFAULT_ISSUER_NAME),
  };
}

export function toPlanChangeRequest(dto: PlanChangeRequestResponse): PlanChangeRequest {
  return {
    id: dto.id,
    toPlanId: dto.to_plan_id,
    toPlanName: dto.to_plan_name ?? null,
    toBillingPeriod: dto.to_billing_period,
    requestedAt: dto.requested_at,
    status: dto.status,
    note: dto.note,
    reviewNote: dto.review_note,
    prorationInvoiceId: dto.proration_invoice_id ?? null,
    creditNoteId: dto.credit_note_id ?? null,
  };
}

export function toCreditNote(dto: CreditNoteResponse): CreditNote {
  return {
    id: dto.id,
    creditNoteNo: dto.credit_note_no,
    issuedAt: dto.issued_at,
    reason: dto.reason || null,
    subtotalPaise: dto.subtotal_paise,
    gstPaise: dto.gst_paise,
    totalPaise: dto.total_paise,
    appliedPaise: dto.applied_paise,
    remainingPaise: dto.remaining_paise ?? dto.total_paise - dto.applied_paise,
  };
}
