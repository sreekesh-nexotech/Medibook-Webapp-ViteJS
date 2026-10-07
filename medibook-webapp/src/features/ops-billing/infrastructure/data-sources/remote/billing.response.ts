import { z } from 'zod';

import { paginatedSchema } from '@/core/api/pagination';

import type {
  BillingInvoice,
  BillingInvoiceDetail,
  BillingParty,
  BillingSubscription,
  BillingSummary,
  DunningEvent,
  PlanChangeOutcome,
  PlanChangeRequest,
  ProrationDocument,
  ProrationPreview,
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
  // BE-28 (optional for an older backend).
  last_reminder_sent_at: z.string().nullable().optional(),
  reminder_status: z.enum(['none', 'queued', 'sent']).optional(),
  plan_name: z.string().nullable().optional(),
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
  hospital_name: z.string().nullable().optional(),
  plan_name: z.string().nullable().optional(),
  recorded_by_name: z.string().nullable().optional(),
  amount_paise: z.number().int(),
  method: z.enum(['razorpay', 'bank_transfer', 'manual', 'credit_note']),
  gateway_payment_id: z.string().nullable(),
  status: z.enum(['created', 'captured', 'failed', 'refunded']),
  attempt_no: z.number().int(),
  attempted_at: z.string(),
  captured_at: z.string().nullable(),
  failure_reason: z.string().nullable(),
  reference_note: z.string().nullable(),
  created_at: z.string(),
});

export const paymentSchema = paymentResponseSchema;
export const paymentPageSchema = paginatedSchema(paymentResponseSchema);

/** `DunningEventSerializer`. */
const dunningResponseSchema = z.object({
  id: z.string(),
  invoice_id: z.string(),
  hospital_id: z.string().nullable().optional(),
  invoice_no: z.string().nullable().optional(),
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

/** `SubscriptionSerializer`. Everything beyond the original fields is optional. */
export const subscriptionSchema = z.object({
  id: z.string(),
  hospital_id: z.string(),
  hospital_name: z.string().nullable().optional(),
  plan_id: z.string().optional(),
  plan_code: z.string().nullable().optional(),
  plan_name: z.string(),
  billing_period: billingPeriodSchema,
  status: z.string(),
  read_only: z.boolean().optional(),
  started_at: z.string().nullable().optional(),
  trial_ends_at: z.string().nullable().optional(),
  current_period_end: z.string().nullable().optional(),
  next_invoice_at: z.string().nullable().optional(),
  cancel_at_period_end: z.boolean().optional(),
  grace_days_override: z.number().int().nullable(),
  version: z.number().int().optional(),
});

export const subscriptionPageSchema = paginatedSchema(subscriptionSchema);

const prorationLineSchema = z.object({
  line_type: z.string(),
  description: z.string(),
  amount_paise: z.number().int(),
  tax_rate_bp: z.number().int(),
  tax_paise: z.number().int(),
  total_paise: z.number().int(),
});

/** The plan-change / subscription proration preview (BE-28). */
export const prorationPreviewSchema = z.object({
  kind: z.string(),
  lines: z.array(prorationLineSchema),
  subtotal_paise: z.number().int(),
  gst_paise: z.number().int(),
  total_paise: z.number().int(),
  invoice_total_paise: z.number().int().optional(),
  credit_note_total_paise: z.number().int().optional(),
  new_period_start: z.string().nullable().optional(),
  new_period_end: z.string().nullable().optional(),
});

export function toProrationPreview(dto: z.infer<typeof prorationPreviewSchema>): ProrationPreview {
  return {
    kind: dto.kind,
    lines: dto.lines.map((l) => ({
      lineType: l.line_type,
      description: l.description,
      amountPaise: l.amount_paise,
      taxRateBp: l.tax_rate_bp,
      taxPaise: l.tax_paise,
      totalPaise: l.total_paise,
    })),
    subtotalPaise: dto.subtotal_paise,
    gstPaise: dto.gst_paise,
    totalPaise: dto.total_paise,
    invoiceTotalPaise: dto.invoice_total_paise ?? Math.max(dto.total_paise, 0),
    creditNoteTotalPaise: dto.credit_note_total_paise ?? 0,
    newPeriodStart: dto.new_period_start ?? null,
    newPeriodEnd: dto.new_period_end ?? null,
  };
}

/** Enough of an issued invoice or credit note to show and link it. */
const documentSchema = z.object({
  id: z.string(),
  invoice_no: z.string().optional(),
  credit_note_no: z.string().optional(),
  total_paise: z.number().int(),
});

function toDocument(
  dto: z.infer<typeof documentSchema> | null | undefined,
): ProrationDocument | null {
  if (!dto) return null;
  return {
    id: dto.id,
    number: dto.invoice_no ?? dto.credit_note_no ?? '',
    totalPaise: dto.total_paise,
  };
}

/** `PATCH …/subscriptions/{id}` → `{subscription, proration_invoice, credit_note}`. */
export const subscriptionChangeSchema = z.object({
  subscription: subscriptionSchema,
  proration_invoice: documentSchema.nullable().optional(),
  credit_note: documentSchema.nullable().optional(),
});

export function toPlanChangeOutcome(dto: {
  proration_invoice?: z.infer<typeof documentSchema> | null;
  credit_note?: z.infer<typeof documentSchema> | null;
}): PlanChangeOutcome {
  return {
    prorationInvoice: toDocument(dto.proration_invoice),
    creditNote: toDocument(dto.credit_note),
  };
}

/** `GET /platform/billing/summary` (BE-28). */
export const billingSummarySchema = z.object({
  mrr_paise: z.number().int(),
  outstanding_paise: z.number().int(),
  overdue_paise: z.number().int().optional(),
  unpaid_invoices: z.number().int().optional(),
  collected_paise: z.number().int(),
  credit_balance_paise: z.number().int().optional(),
  subscriptions_by_status: z.record(z.string(), z.number().int()).optional(),
});

export function toBillingSummary(dto: z.infer<typeof billingSummarySchema>): BillingSummary {
  return {
    mrrPaise: dto.mrr_paise,
    outstandingPaise: dto.outstanding_paise,
    overduePaise: dto.overdue_paise ?? 0,
    unpaidInvoices: dto.unpaid_invoices ?? 0,
    collectedPaise: dto.collected_paise,
    creditBalancePaise: dto.credit_balance_paise ?? 0,
    subscriptionsByStatus: dto.subscriptions_by_status ?? {},
  };
}

/** `PlanChangeRequestSerializer`. */
const planChangeResponseSchema = z.object({
  id: z.string(),
  hospital_id: z.string(),
  hospital_name: z.string().nullable().optional(),
  from_plan_name: z.string().nullable().optional(),
  to_plan_name: z.string().nullable().optional(),
  from_plan_id: z.string(),
  to_plan_id: z.string(),
  to_billing_period: billingPeriodSchema,
  requested_at: z.string(),
  note: z.string().nullable(),
  status: z.enum(['requested', 'approved', 'rejected', 'applied', 'withdrawn']),
  reviewed_at: z.string().nullable(),
  review_note: z.string().nullable(),
  proration_invoice_id: z.string().nullable().optional(),
  credit_note_id: z.string().nullable().optional(),
});

export const planChangeSchema = planChangeResponseSchema;
export const planChangePageSchema = paginatedSchema(planChangeResponseSchema);

/** Approve returns `{request, proration_invoice, credit_note}` (credit note: B4, M-25). */
export const planChangeApproveSchema = z.object({
  request: planChangeResponseSchema,
  proration_invoice: documentSchema.nullable().optional(),
  credit_note: documentSchema.nullable().optional(),
});

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
    lastReminderSentAt: dto.last_reminder_sent_at ?? null,
    reminderStatus: dto.reminder_status ?? null,
    planName: dto.plan_name ?? null,
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
    hospitalName: dto.hospital_name ?? null,
    planName: dto.plan_name ?? null,
    recordedByName: dto.recorded_by_name ?? null,
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
    hospitalId: dto.hospital_id ?? null,
    invoiceNo: dto.invoice_no ?? null,
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
    hospitalName: dto.hospital_name ?? null,
    planId: dto.plan_id ?? null,
    planCode: dto.plan_code ?? null,
    planName: dto.plan_name,
    billingPeriod: dto.billing_period,
    status: dto.status,
    readOnly: dto.read_only ?? dto.status === 'read_only',
    startedAt: dto.started_at ?? null,
    trialEndsAt: dto.trial_ends_at ?? null,
    currentPeriodEnd: dto.current_period_end ?? null,
    nextInvoiceAt: dto.next_invoice_at ?? null,
    cancelAtPeriodEnd: dto.cancel_at_period_end ?? false,
    graceDaysOverride: dto.grace_days_override,
    version: dto.version ?? null,
  };
}

export function toPlanChangeRequest(
  dto: z.infer<typeof planChangeResponseSchema>,
): PlanChangeRequest {
  return {
    id: dto.id,
    hospitalId: dto.hospital_id,
    hospitalName: dto.hospital_name ?? null,
    fromPlanName: dto.from_plan_name ?? null,
    toPlanName: dto.to_plan_name ?? null,
    fromPlanId: dto.from_plan_id,
    toPlanId: dto.to_plan_id,
    toBillingPeriod: dto.to_billing_period,
    requestedAt: dto.requested_at,
    note: dto.note,
    status: dto.status,
    reviewedAt: dto.reviewed_at,
    reviewNote: dto.review_note,
    prorationInvoiceId: dto.proration_invoice_id ?? null,
    creditNoteId: dto.credit_note_id ?? null,
  };
}
