import { z } from 'zod';

import { paginatedSchema } from '@/core/api/pagination';

import type {
  CashSession,
  CashSummaryRow,
  PaymentLine,
  PaymentRefund,
  VisitReceipt,
} from '@/features/payments/domain/entities/payments.entities';

/**
 * Response DTOs for module H9, from `schema.yml` (`HospitalPayment`,
 * `HospitalRefund`, `HospitalReceipt`) and the backend views where the schema
 * types a body loosely (`hospital_payment_detail.py` adds `refunds`,
 * `hospital_payment_serializer.get_patient` shapes `patient`).
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

export const paymentLineSchema = z.object({
  id: z.string(),
  appointment_id: z.string().nullable(),
  visit_id: z.string().nullable(),
  channel: z.enum(['desk', 'online']),
  method: methodSchema,
  amount_paise: z.number().int(),
  status: z.enum(['captured', 'failed', 'refunded']),
  captured_at: z.string().nullable(),
  reference_note: z.string().nullable(),
  collected_by_name: z.string().nullable(),
  counter_code: z.string().nullable(),
  booking_refs: z.array(z.string()),
  patient: z.object({ id: z.string(), mrn: z.string(), full_name: z.string() }).nullable(),
  created_at: z.string(),
});

export type PaymentLineResponse = z.infer<typeof paymentLineSchema>;

export const paymentPageResponseSchema = paginatedSchema(paymentLineSchema);

export function toPaymentLine(dto: PaymentLineResponse): PaymentLine {
  return {
    id: dto.id,
    appointmentId: dto.appointment_id,
    visitId: dto.visit_id,
    channel: dto.channel,
    method: dto.method,
    amountRupees: rupees(dto.amount_paise),
    status: dto.status,
    capturedAt: dto.captured_at,
    referenceNote: dto.reference_note,
    collectedByName: dto.collected_by_name,
    counterCode: dto.counter_code,
    bookingRefs: dto.booking_refs,
    patient: dto.patient && {
      id: dto.patient.id,
      mrn: dto.patient.mrn,
      fullName: dto.patient.full_name,
    },
    createdAt: dto.created_at,
  };
}

const refundSchema = z.object({
  id: z.string(),
  amount_paise: z.number().int(),
  method: z.string(),
  status: z.enum(['requested', 'processing', 'processed', 'failed']),
  reason: z.string(),
  processed_at: z.string().nullable(),
});

export const paymentDetailResponseSchema = z.object({ refunds: z.array(refundSchema) });

/** `GET /refunds` — every refund in a date window (paginated). */
export const refundPageResponseSchema = paginatedSchema(refundSchema);

export type RefundPageResponse = z.infer<typeof refundPageResponseSchema>;

export type PaymentDetailResponse = z.infer<typeof paymentDetailResponseSchema>;

export function toPaymentRefunds(dto: PaymentDetailResponse): readonly PaymentRefund[] {
  return dto.refunds.map((r) => ({
    id: r.id,
    amountRupees: rupees(r.amount_paise),
    method: r.method,
    status: r.status,
    reason: r.reason,
    processedAt: r.processed_at,
  }));
}

export function toRefundList(rows: RefundPageResponse['results']): readonly PaymentRefund[] {
  return toPaymentRefunds({ refunds: rows });
}

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
  counter_code: z.string().nullable(),
  business_date: z.string(),
  opened_at: z.string(),
  opening_float_paise: z.number().int(),
  expected_cash_paise: z.number().int(),
  counted_cash_paise: z.number().int().nullable(),
  variance_paise: z.number().int().nullable(),
  closed_at: z.string().nullable(),
  close_note: z.string().nullable(),
  status: z.enum(['open', 'closed', 'reconciled']),
  reconciled_at: z.string().nullable(),
});

export const cashSessionPageResponseSchema = paginatedSchema(cashSessionResponseSchema);

export type CashSessionResponse = z.infer<typeof cashSessionResponseSchema>;

export function toCashSession(dto: CashSessionResponse): CashSession {
  return {
    id: dto.id,
    staffId: dto.staff_id,
    staffName: dto.staff_name,
    counterCode: dto.counter_code,
    businessDate: dto.business_date,
    openedAt: dto.opened_at,
    openingFloatPaise: dto.opening_float_paise,
    expectedCashPaise: dto.expected_cash_paise,
    countedCashPaise: dto.counted_cash_paise,
    variancePaise: dto.variance_paise,
    closedAt: dto.closed_at,
    closeNote: dto.close_note,
    status: dto.status,
    reconciledAt: dto.reconciled_at,
  };
}

/** `GET /cash-sessions/summary?date` — one row per staff member who held a drawer. */
export const cashSummaryResponseSchema = z.object({
  date: z.string(),
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
      variance_paise: z.number().int().nullable(),
      uncounted_sessions: z.number().int(),
    }),
  ),
});

export type CashSummaryResponse = z.infer<typeof cashSummaryResponseSchema>;

export function toCashSummary(dto: CashSummaryResponse): readonly CashSummaryRow[] {
  return dto.staff.map((s) => ({
    staffId: s.staff_id,
    staffName: s.staff_name,
    counters: s.counters,
    openSessions: s.open_sessions,
    openingFloatPaise: s.opening_float_paise,
    cashInPaise: s.cash_in_paise,
    cashRefundsPaise: s.cash_refunds_paise,
    expectedCashPaise: s.expected_cash_paise,
    countedCashPaise: s.counted_cash_paise,
    variancePaise: s.variance_paise,
    uncountedSessions: s.uncounted_sessions,
  }));
}
