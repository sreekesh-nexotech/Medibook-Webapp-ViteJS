import { z } from 'zod';

import { paginatedSchema } from '@/core/api/pagination';

import type {
  BillingInvoice,
  BillingInvoiceDetail,
  BillingParty,
  BillingSubscription,
  DunningEvent,
  PlanChangeRequest,
  SubscriptionPayment,
} from '@/features/ops-billing/domain/entities/billing.entities';

/**
 * Response DTOs for `/platform/billing/…`. Shapes follow the serializers in
 * `subscriptions/serializers` (`schema.yml` types several bodies loosely and
 * shows the lists as bare arrays; every list is the paginated envelope).
 */

const invoiceStatusSchema = z.enum(['draft', 'issued', 'paid', 'overdue', 'void', 'uncollectible']);
const billingPeriodSchema = z.enum(['monthly', 'yearly']);

/** `InvoiceSerializer`. */
const invoiceResponseSchema = z.object({
  id: z.string(),
  invoice_no: z.string(),
  hospital_id: z.string(),
  hospital_name: z.string(),
  subscription_id: z.string(),
  period_start: z.string(),
  period_end: z.string(),
  issued_at: z.string(),
  due_at: z.string(),
  subtotal_paise: z.number().int(),
  gst_paise: z.number().int(),
  total_paise: z.number().int(),
  amount_paid_paise: z.number().int(),
  status: invoiceStatusSchema,
  paid_at: z.string().nullable(),
  grace_ends_at: z.string().nullable(),
  reminders_sent: z.number().int(),
  last_reminder_at: z.string().nullable(),
  version: z.number().int(),
});

type InvoiceResponse = z.infer<typeof invoiceResponseSchema>;

export const invoiceSchema = invoiceResponseSchema;
export const invoicePageSchema = paginatedSchema(invoiceResponseSchema);

/** Snapshot values are copied from the hospital / platform records; any may be absent. */
const snapshotValue = z.string().nullable().optional();

const snapshotSchema = z.object({
  name: snapshotValue,
  legal_name: snapshotValue,
  gstin: snapshotValue,
  email: snapshotValue,
  phone_e164: snapshotValue,
  address_line1: snapshotValue,
  address_line2: snapshotValue,
  address_line3: snapshotValue,
  city: snapshotValue,
  state: snapshotValue,
  pincode: snapshotValue,
});

/** `InvoiceDetailSerializer`. */
export const invoiceDetailSchema = invoiceResponseSchema.extend({
  lines: z.array(
    z.object({
      id: z.string(),
      line_type: z.string(),
      description: z.string(),
      quantity: z.number(),
      unit_paise: z.number().int(),
      amount_paise: z.number().int(),
      tax_rate_bp: z.number().int(),
      tax_paise: z.number().int(),
    }),
  ),
  hospital_snapshot: snapshotSchema,
  platform_snapshot: snapshotSchema,
});

/** `SubscriptionPaymentSerializer`. */
const paymentResponseSchema = z.object({
  id: z.string(),
  invoice_id: z.string(),
  invoice_no: z.string(),
  hospital_id: z.string(),
  amount_paise: z.number().int(),
  method: z.enum(['razorpay', 'bank_transfer', 'manual']),
  gateway_payment_id: z.string().nullable(),
  status: z.enum(['created', 'captured', 'failed', 'refunded']),
  attempt_no: z.number().int(),
  attempted_at: z.string(),
  captured_at: z.string().nullable(),
  failure_reason: z.string().nullable(),
  reference_note: z.string().nullable(),
  created_at: z.string(),
});

export const paymentPageSchema = paginatedSchema(paymentResponseSchema);

/** `DunningEventSerializer`. */
const dunningResponseSchema = z.object({
  id: z.string(),
  invoice_id: z.string(),
  kind: z.enum([
    'reminder_queued',
    'reminder_sent',
    'grace_started',
    'grace_extended',
    'suspended',
    'read_only',
    'reinstated',
    'marked_paid',
    'retry_scheduled',
    'retry_attempted',
    'voided',
  ]),
  actor_user_id: z.string().nullable(),
  note: z.string().nullable(),
  occurred_at: z.string(),
});

export const dunningPageSchema = paginatedSchema(dunningResponseSchema);

/** `SubscriptionSerializer` — only what the billing screens read. */
export const subscriptionSchema = z.object({
  id: z.string(),
  hospital_id: z.string(),
  plan_name: z.string(),
  billing_period: billingPeriodSchema,
  status: z.string(),
  grace_days_override: z.number().int().nullable(),
});

/** `PlanChangeRequestSerializer`. */
const planChangeResponseSchema = z.object({
  id: z.string(),
  hospital_id: z.string(),
  from_plan_id: z.string(),
  to_plan_id: z.string(),
  to_billing_period: billingPeriodSchema,
  requested_at: z.string(),
  note: z.string().nullable(),
  status: z.enum(['requested', 'approved', 'rejected', 'applied', 'withdrawn']),
  reviewed_at: z.string().nullable(),
  review_note: z.string().nullable(),
});

export const planChangeSchema = planChangeResponseSchema;
export const planChangePageSchema = paginatedSchema(planChangeResponseSchema);

/** Approve returns `{request, proration_invoice}`. */
export const planChangeApproveSchema = z.object({ request: planChangeResponseSchema });

export function toBillingInvoice(dto: InvoiceResponse): BillingInvoice {
  return {
    id: dto.id,
    invoiceNo: dto.invoice_no,
    hospitalId: dto.hospital_id,
    hospitalName: dto.hospital_name,
    subscriptionId: dto.subscription_id,
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
    graceEndsAt: dto.grace_ends_at,
    remindersSent: dto.reminders_sent,
    lastReminderAt: dto.last_reminder_at,
    version: dto.version,
  };
}

function toParty(dto: z.infer<typeof snapshotSchema>): BillingParty {
  const address = [
    dto.address_line1,
    dto.address_line2,
    dto.address_line3,
    dto.city,
    dto.state,
    dto.pincode,
  ]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(', ');
  return {
    name: dto.legal_name ?? dto.name ?? null,
    gstin: dto.gstin ?? null,
    email: dto.email ?? null,
    phone: dto.phone_e164 ?? null,
    address,
  };
}

export function toBillingInvoiceDetail(
  dto: z.infer<typeof invoiceDetailSchema>,
): BillingInvoiceDetail {
  return {
    ...toBillingInvoice(dto),
    lines: dto.lines.map((l) => ({
      id: l.id,
      lineType: l.line_type,
      description: l.description,
      quantity: l.quantity,
      unitPaise: l.unit_paise,
      amountPaise: l.amount_paise,
      taxRateBp: l.tax_rate_bp,
      taxPaise: l.tax_paise,
    })),
    billedTo: { ...toParty(dto.hospital_snapshot), name: dto.hospital_name || null },
    billedBy: toParty(dto.platform_snapshot),
  };
}

export function toSubscriptionPayment(
  dto: z.infer<typeof paymentResponseSchema>,
): SubscriptionPayment {
  return {
    id: dto.id,
    invoiceId: dto.invoice_id,
    invoiceNo: dto.invoice_no,
    hospitalId: dto.hospital_id,
    amountPaise: dto.amount_paise,
    method: dto.method,
    gatewayPaymentId: dto.gateway_payment_id,
    status: dto.status,
    attemptNo: dto.attempt_no,
    attemptedAt: dto.attempted_at,
    capturedAt: dto.captured_at,
    failureReason: dto.failure_reason,
    referenceNote: dto.reference_note,
    createdAt: dto.created_at,
  };
}

export function toDunningEvent(dto: z.infer<typeof dunningResponseSchema>): DunningEvent {
  return {
    id: dto.id,
    invoiceId: dto.invoice_id,
    kind: dto.kind,
    isAutomatic: dto.actor_user_id === null,
    note: dto.note,
    occurredAt: dto.occurred_at,
  };
}

export function toBillingSubscription(
  dto: z.infer<typeof subscriptionSchema>,
): BillingSubscription {
  return {
    id: dto.id,
    hospitalId: dto.hospital_id,
    planName: dto.plan_name,
    billingPeriod: dto.billing_period,
    status: dto.status,
    graceDaysOverride: dto.grace_days_override,
  };
}

export function toPlanChangeRequest(
  dto: z.infer<typeof planChangeResponseSchema>,
): PlanChangeRequest {
  return {
    id: dto.id,
    hospitalId: dto.hospital_id,
    fromPlanId: dto.from_plan_id,
    toPlanId: dto.to_plan_id,
    toBillingPeriod: dto.to_billing_period,
    requestedAt: dto.requested_at,
    note: dto.note,
    status: dto.status,
    reviewedAt: dto.reviewed_at,
    reviewNote: dto.review_note,
  };
}
