import { z } from 'zod';

import { paginatedSchema } from '@/core/api/pagination';

import type {
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
