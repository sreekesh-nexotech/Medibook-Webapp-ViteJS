import { z } from 'zod';

import { paginatedSchema } from '@/core/api/pagination';

import type {
  BookingStatus,
  CashCounter,
  CashSession,
  CashSummary,
  CashSummaryDrawer,
  LineRefund,
  PaymentDetail,
  PaymentLine,
  PaymentRefund,
  VisitReceipt,
} from '@/features/payments/domain/entities/payments.entities';

/**
 * Response DTOs for module H9, from `schema.yml` (`HospitalPayment`,
 * `HospitalRefund`, `HospitalReceipt`, `HospitalCashSession`) and the backend
 * views where the schema types a body loosely (`hospital_payment_detail.py`
 * adds `refunds`, `hospital_payment_serializer.get_patient` shapes `patient`).
 *
 * Fields the fix wave adds to these bodies (doctor, department, booking
 * status, receipt number and latest refund on a line — backend B3; drawer
 * versions, closer and reconciler names, per-drawer summary rows — B2) are
 * optional, so the same schemas read the old and the new backend.
 */

const PAISE_PER_RUPEE = 100;

function rupees(paise: number): number {
  return paise / PAISE_PER_RUPEE;
}

const methodSchema = z.enum([
  'upi',
  'card',
  'netbanking',
  'wallet',
  'emi',
  'paylater',
  'cash',
  'pos',
  'other',
]);

const bookingStatusSchema = z.enum([
  'pending_payment',
  'pending_approval',
  'scheduled',
  'checked_in',
  'in_consultation',
  'completed',
  'cancelled',
  'no_show',
]);

const refundStatusSchema = z.enum(['requested', 'processing', 'processed', 'failed', 'superseded']);

/** A named reference the backend may embed (`{id, name}`), or just the name. */
const namedRefSchema = z.object({ id: z.string().optional(), name: z.string() });

/** The latest refund of a line, when the backend embeds it (B3). */
const latestRefundSchema = z.object({
  id: z.string().optional(),
  status: refundStatusSchema,
  amount_paise: z.number().int().optional(),
  failure_reason: z.string().nullable().optional(),
});

export const paymentLineSchema = z.object({
  id: z.string(),
  order_id: z.string().nullable().optional(),
  appointment_id: z.string().nullable(),
  visit_id: z.string().nullable(),
  channel: z.enum(['desk', 'online']),
  method: methodSchema,
  amount_paise: z.number().int(),
  status: z.enum(['captured', 'failed', 'refunded']),
  gateway_payment_id: z.string().nullable().optional(),
  captured_at: z.string().nullable(),
  reference_note: z.string().nullable(),
  collected_by_name: z.string().nullable(),
  counter_code: z.string().nullable(),
  cash_session_id: z.string().nullable().optional(),
  booking_refs: z.array(z.string()),
  patient: z.object({ id: z.string(), mrn: z.string(), full_name: z.string() }).nullable(),
  doctor: namedRefSchema.nullable().optional(),
  doctor_name: z.string().nullable().optional(),
  department: namedRefSchema.nullable().optional(),
  department_name: z.string().nullable().optional(),
  appointment_status: bookingStatusSchema.nullable().optional(),
  receipt_no: z.string().nullable().optional(),
  latest_refund: latestRefundSchema.nullable().optional(),
  refund_status: refundStatusSchema.nullable().optional(),
  refund_failure_reason: z.string().nullable().optional(),
  created_at: z.string(),
});

export type PaymentLineResponse = z.infer<typeof paymentLineSchema>;

export const paymentPageResponseSchema = paginatedSchema(paymentLineSchema);

export type PaymentPageResponse = z.infer<typeof paymentPageResponseSchema>;

/**
 * The line's latest refund: embedded (`latest_refund`), flat (`refund_status`),
 * or — when the backend sends neither key — `undefined` ("not said").
 */
function toLineRefund(dto: PaymentLineResponse): LineRefund | null | undefined {
  if (dto.latest_refund !== undefined) {
    const r = dto.latest_refund;
    return r === null
      ? null
      : {
          id: r.id ?? null,
          status: r.status,
          amountRupees: r.amount_paise === undefined ? null : rupees(r.amount_paise),
          failureReason: r.failure_reason ?? null,
        };
  }
  if (dto.refund_status !== undefined) {
    return dto.refund_status === null
      ? null
      : {
          id: null,
          status: dto.refund_status,
          amountRupees: null,
          failureReason: dto.refund_failure_reason ?? null,
        };
  }
  return undefined;
}

export function toPaymentLine(dto: PaymentLineResponse): PaymentLine {
  const bookingStatus: BookingStatus | null = dto.appointment_status ?? null;
  return {
    id: dto.id,
    orderId: dto.order_id ?? null,
    appointmentId: dto.appointment_id,
    visitId: dto.visit_id,
    channel: dto.channel,
    method: dto.method,
    amountRupees: rupees(dto.amount_paise),
    status: dto.status,
    capturedAt: dto.captured_at,
    referenceNote: dto.reference_note,
    gatewayPaymentId: dto.gateway_payment_id ?? null,
    collectedByName: dto.collected_by_name,
    counterCode: dto.counter_code,
    cashSessionId: dto.cash_session_id ?? null,
    bookingRefs: dto.booking_refs,
    patient: dto.patient && {
      id: dto.patient.id,
      mrn: dto.patient.mrn,
      fullName: dto.patient.full_name,
    },
    doctorName: dto.doctor?.name ?? dto.doctor_name ?? null,
    departmentName: dto.department?.name ?? dto.department_name ?? null,
    bookingStatus,
    receiptNo: dto.receipt_no ?? null,
    latestRefund: toLineRefund(dto),
    createdAt: dto.created_at,
  };
}

/** `HospitalRefundSerializer`. */
const refundSchema = z.object({
  id: z.string(),
  payment_id: z.string().nullable().optional(),
  appointment_id: z.string().nullable().optional(),
  booking_ref: z.string().nullable().optional(),
  amount_paise: z.number().int(),
  method: z.string(),
  status: refundStatusSchema,
  reason: z.string(),
  requested_at: z.string().nullable().optional(),
  processed_at: z.string().nullable(),
  failure_reason: z.string().nullable().optional(),
  cash_session_id: z.string().nullable().optional(),
  channel: z.enum(['desk', 'online']).nullable().optional(),
});

export type RefundResponse = z.infer<typeof refundSchema>;

export function toPaymentRefund(r: RefundResponse): PaymentRefund {
  return {
    id: r.id,
    paymentId: r.payment_id ?? null,
    appointmentId: r.appointment_id ?? null,
    bookingRef: r.booking_ref ?? null,
    amountRupees: rupees(r.amount_paise),
    method: r.method,
    status: r.status,
    reason: r.reason,
    requestedAt: r.requested_at ?? null,
    processedAt: r.processed_at,
    failureReason: r.failure_reason ?? null,
    cashSessionId: r.cash_session_id ?? null,
    channel: r.channel ?? null,
  };
}

/** `GET /payments/{id}` — the line plus its refunds. */
export const paymentDetailResponseSchema = paymentLineSchema.extend({
  refunds: z.array(refundSchema),
});

export type PaymentDetailResponse = z.infer<typeof paymentDetailResponseSchema>;

export function toPaymentDetail(dto: PaymentDetailResponse): PaymentDetail {
  return { line: toPaymentLine(dto), refunds: dto.refunds.map(toPaymentRefund) };
}

/** `GET /refunds` — refunds by the day they were requested (paginated). */
export const refundPageResponseSchema = paginatedSchema(refundSchema);

export type RefundPageResponse = z.infer<typeof refundPageResponseSchema>;

/** `POST /appointments/{id}/refunds` → 201 `{results: [...]}`, one row per refunded line. */
export const refundCreatedResponseSchema = z.object({ results: z.array(refundSchema) });

const receiptSchema = z.object({
  id: z.string(),
  receipt_no: z.string(),
  appointment_id: z.string().nullable(),
  total_paise: z.number().int(),
  issued_at: z.string(),
});

export const visitReceiptPageResponseSchema = paginatedSchema(receiptSchema);

export type VisitReceiptPageResponse = z.infer<typeof visitReceiptPageResponseSchema>;

export function toVisitReceipts(dto: VisitReceiptPageResponse): readonly VisitReceipt[] {
  return dto.results.map((r) => ({
    id: r.id,
    receiptNo: r.receipt_no,
    appointmentId: r.appointment_id,
    totalRupees: rupees(r.total_paise),
    issuedAt: r.issued_at,
  }));
}

/* ------------------------------------------------------------ cash sessions */

/** `HospitalCashSession` (`schema.yml`, `hospital_cash_session_serializer.py`). */
export const cashSessionResponseSchema = z.object({
  id: z.string(),
  staff_id: z.string(),
  staff_name: z.string(),
  counter_id: z.string().nullable().optional(),
  counter_code: z.string().nullable(),
  business_date: z.string(),
  opened_at: z.string(),
  opening_float_paise: z.number().int(),
  expected_cash_paise: z.number().int(),
  counted_cash_paise: z.number().int().nullable(),
  variance_paise: z.number().int().nullable(),
  closed_at: z.string().nullable(),
  closed_by_name: z.string().nullable().optional(),
  close_note: z.string().nullable(),
  auto_closed: z.boolean().optional(),
  status: z.enum(['open', 'closed', 'reconciled']),
  reconciled_at: z.string().nullable(),
  reconciled_by_name: z.string().nullable().optional(),
  reconcile_note: z.string().nullable().optional(),
  version: z.number().int().optional(),
});

export const cashSessionPageResponseSchema = paginatedSchema(cashSessionResponseSchema);

export type CashSessionResponse = z.infer<typeof cashSessionResponseSchema>;

export function toCashSession(dto: CashSessionResponse): CashSession {
  return {
    id: dto.id,
    staffId: dto.staff_id,
    staffName: dto.staff_name,
    counterId: dto.counter_id ?? null,
    counterCode: dto.counter_code,
    businessDate: dto.business_date,
    openedAt: dto.opened_at,
    openingFloatPaise: dto.opening_float_paise,
    expectedCashPaise: dto.expected_cash_paise,
    countedCashPaise: dto.counted_cash_paise,
    variancePaise: dto.variance_paise,
    closedAt: dto.closed_at,
    closedByName: dto.closed_by_name ?? null,
    closeNote: dto.close_note,
    // An older backend has no flag: a closed drawer with no count was auto-closed.
    isAutoClosed: dto.auto_closed ?? (dto.status !== 'open' && dto.counted_cash_paise === null),
    status: dto.status,
    reconciledAt: dto.reconciled_at,
    reconciledByName: dto.reconciled_by_name ?? null,
    reconcileNote: dto.reconcile_note ?? null,
    version: dto.version ?? null,
  };
}

const summaryDrawerSchema = z.object({
  id: z.string(),
  status: z.enum(['open', 'closed', 'reconciled']),
  counter_code: z.string().nullable().optional(),
  opened_at: z.string().nullable().optional(),
  closed_at: z.string().nullable().optional(),
  auto_closed: z.boolean().optional(),
  opening_float_paise: z.number().int(),
  cash_in_paise: z.number().int(),
  cash_refunds_paise: z.number().int(),
  expected_cash_paise: z.number().int(),
  counted_cash_paise: z.number().int().nullable(),
  variance_paise: z.number().int().nullable(),
  version: z.number().int().optional(),
});

/** `GET /cash-sessions/summary?date` — one row per staff member who held a drawer. */
export const cashSummaryResponseSchema = z.object({
  date: z.string(),
  scope: z.enum(['all', 'own']).optional(),
  staff: z.array(
    z.object({
      staff_id: z.string(),
      staff_name: z.string(),
      counters: z.array(z.string()),
      open_sessions: z.number().int(),
      opening_float_paise: z.number().int(),
      cash_in_paise: z.number().int(),
      cash_refunds_paise: z.number().int(),
      expected_cash_paise: z.number().int(),
      counted_cash_paise: z.number().int().nullable(),
      counted_expected_paise: z.number().int().nullable().optional(),
      variance_paise: z.number().int().nullable(),
      uncounted_sessions: z.number().int(),
      sessions: z.array(summaryDrawerSchema).optional(),
    }),
  ),
  totals: z
    .object({
      opening_float_paise: z.number().int(),
      cash_in_paise: z.number().int(),
      cash_refunds_paise: z.number().int(),
      expected_cash_paise: z.number().int(),
    })
    .optional(),
});

export type CashSummaryResponse = z.infer<typeof cashSummaryResponseSchema>;

function toSummaryDrawer(d: z.infer<typeof summaryDrawerSchema>): CashSummaryDrawer {
  return {
    id: d.id,
    status: d.status,
    counterCode: d.counter_code ?? null,
    openedAt: d.opened_at ?? null,
    closedAt: d.closed_at ?? null,
    isAutoClosed: d.auto_closed ?? false,
    openingFloatPaise: d.opening_float_paise,
    cashInPaise: d.cash_in_paise,
    cashRefundsPaise: d.cash_refunds_paise,
    expectedCashPaise: d.expected_cash_paise,
    countedCashPaise: d.counted_cash_paise,
    variancePaise: d.variance_paise,
    version: d.version ?? null,
  };
}

export function toCashSummary(dto: CashSummaryResponse): CashSummary {
  return {
    date: dto.date,
    scope: dto.scope ?? 'all',
    rows: dto.staff.map((s) => ({
      staffId: s.staff_id,
      staffName: s.staff_name,
      counters: s.counters,
      openSessions: s.open_sessions,
      openingFloatPaise: s.opening_float_paise,
      cashInPaise: s.cash_in_paise,
      cashRefundsPaise: s.cash_refunds_paise,
      expectedCashPaise: s.expected_cash_paise,
      countedCashPaise: s.counted_cash_paise,
      countedExpectedPaise: s.counted_expected_paise ?? null,
      variancePaise: s.variance_paise,
      uncountedSessions: s.uncounted_sessions,
      drawers: (s.sessions ?? []).map(toSummaryDrawer),
    })),
    totals: dto.totals
      ? {
          openingFloatPaise: dto.totals.opening_float_paise,
          cashInPaise: dto.totals.cash_in_paise,
          cashRefundsPaise: dto.totals.cash_refunds_paise,
          expectedCashPaise: dto.totals.expected_cash_paise,
        }
      : null,
  };
}

/** `GET /counters` — the hospital's counters (readable by drawer holders, B2 `COUNTER_READ`). */
export const counterPageResponseSchema = paginatedSchema(
  z.object({ id: z.string(), code: z.string(), name: z.string(), is_active: z.boolean() }),
);

export type CounterPageResponse = z.infer<typeof counterPageResponseSchema>;

export function toCashCounters(rows: CounterPageResponse['results']): readonly CashCounter[] {
  return rows.map((c) => ({ id: c.id, code: c.code, name: c.name, isActive: c.is_active }));
}
