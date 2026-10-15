import { z } from 'zod';

import type {
  AppointmentEvent,
  DeskAppointment,
  DeskReceipt,
  DeskRefund,
  FeeQuote,
  RefundOutcome,
  TokenSlipData,
} from '@/features/appointments/domain/entities/appointments.entities';

/** Paise per rupee — money crosses the API boundary in paise. */
export const PAISE_PER_RUPEE = 100;

const BP_PER_PERCENT = 100;

function rupees(paise: number): number {
  return paise / PAISE_PER_RUPEE;
}

/** `HospitalAppointmentSerializer` (`appointments/serializers/hospital_appointment_serializer.py`). */
export const appointmentResponseSchema = z.object({
  id: z.string(),
  booking_ref: z.string(),
  status: z.enum([
    'pending_payment',
    'pending_approval',
    'scheduled',
    'checked_in',
    'in_consultation',
    'completed',
    'cancelled',
    'no_show',
  ]),
  status_reason: z.string().nullable(),
  source: z.enum(['online', 'walk_in']),
  patient: z
    .object({
      id: z.string(),
      mrn: z.string(),
      full_name: z.string(),
      phone_e164: z.string().nullable(),
      gender: z.string().nullable(),
      date_of_birth: z.string().nullable(),
    })
    .nullable(),
  doctor: z.object({ id: z.string(), name: z.string(), room: z.string().nullable() }),
  department: z.object({ id: z.string(), name: z.string() }),
  session: z.object({
    id: z.string(),
    label: z.string(),
    status: z.string().optional(),
  }),
  service_id: z.string().nullable().optional(),
  visit_id: z.string().nullable(),
  scheduled_date: z.string(),
  scheduled_start_at: z.string(),
  scheduled_end_at: z.string(),
  token_label: z.string().nullable(),
  token_no: z.number().int().nullable(),
  called_at: z.string().nullable(),
  consultation_started_at: z.string().nullable().optional(),
  no_show_attempts: z.number().int().optional(),
  is_follow_up: z.boolean(),
  patient_notes: z.string().nullable(),
  remark: z.string().nullable(),
  // `not_required` (BE-07): a ₹0 walk-in, older backends leave it `unpaid`;
  // `cancelled` (APPT-02): cancelled before any money was taken.
  payment_status: z.enum([
    'unpaid',
    'pending',
    'paid',
    'refunded',
    'failed',
    'not_required',
    'cancelled',
  ]),
  consultation_fee_paise: z.number().int(),
  service_fee_paise: z.number().int(),
  discount_paise: z.number().int(),
  convenience_fee_paise: z.number().int(),
  tax_paise: z.number().int(),
  total_paise: z.number().int(),
  approved_at: z.string().nullable(),
  checked_in_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  cancelled_at: z.string().nullable(),
  cancellation_reason: z.string().nullable(),
  no_show_at: z.string().nullable(),
  created_at: z.string(),
  version: z.number().int(),
});

export const appointmentEventSchema = z.object({
  id: z.string(),
  event_type: z.string(),
  actor_kind: z.string(),
  /** The staff member's name, "Patient" or "System" (B5 APPT-04). */
  actor_name: z.string().nullable().optional(),
  from_status: z.string().nullable(),
  to_status: z.string().nullable(),
  occurred_at: z.string(),
});

/** A structured address as the receipt snapshots store it (`receipts.hospital_snapshot`). */
const snapshotAddressFields = {
  address_line1: z.string().nullable().optional(),
  address_line2: z.string().nullable().optional(),
  address_line3: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  pincode: z.string().nullable().optional(),
};

/** `HospitalReceiptSerializer`; `lines` / `payment_lines` per `payments/services/receipts.py`. */
export const receiptResponseSchema = z.object({
  id: z.string(),
  receipt_no: z.string(),
  issued_at: z.string(),
  issued_by_name: z.string().nullable(),
  counter_code: z.string().nullable(),
  subtotal_paise: z.number().int(),
  tax_paise: z.number().int(),
  total_paise: z.number().int(),
  has_pdf: z.boolean(),
  lines: z.array(
    z.object({
      supplier: z.enum(['hospital', 'platform']).optional(),
      description: z.string(),
      booking_ref: z.string(),
      amount_paise: z.number().int(),
      tax_paise: z.number().int(),
      tax_rate_bp: z.number().int(),
      tax_inclusive: z.boolean(),
    }),
  ),
  payment_lines: z.array(
    z.object({
      method: z.string(),
      amount_paise: z.number().int(),
      reference: z.string().nullable(),
    }),
  ),
  hospital_snapshot: z.object({
    name: z.string(),
    gstin: z.string().nullable(),
    legal_name: z.string().nullable().optional(),
    phone_e164: z.string().nullable().optional(),
    ...snapshotAddressFields,
  }),
  platform_snapshot: z
    .object({
      legal_name: z.string().nullable().optional(),
      gstin: z.string().nullable().optional(),
      ...snapshotAddressFields,
    })
    .nullable()
    .optional(),
  // The patient on the receipt (backend B3 / BE-22): nested, or flat.
  patient: z
    .object({ full_name: z.string().nullable().optional(), mrn: z.string().nullable().optional() })
    .nullable()
    .optional(),
  patient_name: z.string().nullable().optional(),
  patient_mrn: z.string().nullable().optional(),
});

export const tokenSlipResponseSchema = z.object({
  hospital_name: z.string(),
  token_label: z.string(),
  booking_ref: z.string(),
  mrn: z.string(),
  patient_name: z.string(),
  doctor_name: z.string(),
  doctor_room: z.string().nullable(),
  department_name: z.string(),
  session_label: z.string(),
  scheduled_start_at: z.string(),
});

/** One refund row as the cancel / reject / refund answers carry it (`Refund.Status`). */
const refundBriefSchema = z.object({
  id: z.string(),
  amount_paise: z.number().int(),
  status: z.enum(['requested', 'processing', 'processed', 'failed', 'superseded']),
  method: z.string().nullable().optional(),
});

/** Cancel / reject answer `{appointment, refunds}`. */
export const cancellationResponseSchema = z.object({
  appointment: appointmentResponseSchema,
  refunds: z.array(refundBriefSchema).optional(),
});

/** Refund answers `{results: [refund]}` — one per payment line (`HospitalRefundSerializer`). */
export const refundListResponseSchema = z.object({ results: z.array(refundBriefSchema) });

/** Walk-in create answers `{visit, appointments}`. */
export const walkInResponseSchema = z.object({
  visit: z.object({ id: z.string() }),
  appointments: z.array(appointmentResponseSchema),
});

/** Desk payment answers `{order_id, amount_paise, status, receipt}`. */
export const paymentResponseSchema = z.object({ receipt: receiptResponseSchema });

export const receiptPdfResponseSchema = z.object({ url: z.string().min(1) });

export type AppointmentResponse = z.infer<typeof appointmentResponseSchema>;
export type ReceiptResponse = z.infer<typeof receiptResponseSchema>;

export function toAppointment(dto: AppointmentResponse): DeskAppointment {
  return {
    id: dto.id,
    bookingRef: dto.booking_ref,
    status: dto.status,
    statusReason: dto.status_reason,
    source: dto.source,
    patient: dto.patient
      ? {
          id: dto.patient.id,
          mrn: dto.patient.mrn,
          fullName: dto.patient.full_name,
          phone: dto.patient.phone_e164,
          gender: dto.patient.gender,
          dateOfBirth: dto.patient.date_of_birth,
        }
      : null,
    doctor: dto.doctor,
    department: dto.department,
    sessionId: dto.session.id,
    sessionLabel: dto.session.label,
    sessionStatus: dto.session.status ?? null,
    serviceId: dto.service_id ?? null,
    visitId: dto.visit_id,
    scheduledDate: dto.scheduled_date,
    scheduledStartAt: dto.scheduled_start_at,
    scheduledEndAt: dto.scheduled_end_at,
    tokenLabel: dto.token_label,
    tokenNo: dto.token_no,
    calledAt: dto.called_at,
    noShowAttempts: dto.no_show_attempts ?? 0,
    consultationStartedAt: dto.consultation_started_at ?? null,
    isFollowUp: dto.is_follow_up,
    patientNotes: dto.patient_notes ?? '',
    remark: dto.remark ?? '',
    paymentStatus: dto.payment_status,
    consultationRupees: rupees(dto.consultation_fee_paise),
    serviceRupees: rupees(dto.service_fee_paise),
    discountRupees: rupees(dto.discount_paise),
    convenienceRupees: rupees(dto.convenience_fee_paise),
    taxRupees: rupees(dto.tax_paise),
    totalRupees: rupees(dto.total_paise),
    approvedAt: dto.approved_at,
    checkedInAt: dto.checked_in_at,
    completedAt: dto.completed_at,
    cancelledAt: dto.cancelled_at,
    cancellationReason: dto.cancellation_reason,
    noShowAt: dto.no_show_at,
    createdAt: dto.created_at,
    version: dto.version,
  };
}

export function toEvent(dto: z.infer<typeof appointmentEventSchema>): AppointmentEvent {
  return {
    id: dto.id,
    eventType: dto.event_type,
    actorKind: dto.actor_kind,
    actorName: dto.actor_name ?? null,
    fromStatus: dto.from_status,
    toStatus: dto.to_status,
    occurredAt: dto.occurred_at,
  };
}

type SnapshotAddress = {
  readonly address_line1?: string | null;
  readonly address_line2?: string | null;
  readonly address_line3?: string | null;
  readonly city?: string | null;
  readonly state?: string | null;
  readonly pincode?: string | null;
};

/** The snapshot's address parts joined for print ("NH 66, Maradu, Kochi, Kerala 682040"). */
export function snapshotAddress(a: SnapshotAddress): string | null {
  const place = [a.state, a.pincode].filter((p) => p && p.trim()).join(' ');
  const parts = [a.address_line1, a.address_line2, a.address_line3, a.city, place].filter(
    (p): p is string => Boolean(p && p.trim()),
  );
  return parts.length > 0 ? parts.join(', ') : null;
}

export function toReceipt(dto: ReceiptResponse): DeskReceipt {
  const hospital = dto.hospital_snapshot;
  const platform = dto.platform_snapshot ?? null;
  return {
    id: dto.id,
    receiptNo: dto.receipt_no,
    issuedAt: dto.issued_at,
    issuedByName: dto.issued_by_name,
    counterCode: dto.counter_code,
    hospitalName: hospital.name,
    hospitalGstin: hospital.gstin,
    hospitalLegalName: hospital.legal_name ?? null,
    hospitalAddress: snapshotAddress(hospital),
    hospitalPhone: hospital.phone_e164 ?? null,
    platform: platform && {
      legalName: platform.legal_name ?? null,
      gstin: platform.gstin ?? null,
      address: snapshotAddress(platform),
    },
    patientName: dto.patient?.full_name ?? dto.patient_name ?? null,
    patientMrn: dto.patient?.mrn ?? dto.patient_mrn ?? null,
    lines: dto.lines.map((l) => ({
      supplier: l.supplier ?? null,
      description: l.description,
      bookingRef: l.booking_ref,
      amountRupees: rupees(l.amount_paise),
      taxRupees: rupees(l.tax_paise),
      taxRatePercent: l.tax_rate_bp / BP_PER_PERCENT,
      taxInclusive: l.tax_inclusive,
    })),
    payments: dto.payment_lines.map((p) => ({
      method: p.method,
      amountRupees: rupees(p.amount_paise),
      reference: p.reference,
    })),
    subtotalRupees: rupees(dto.subtotal_paise),
    taxRupees: rupees(dto.tax_paise),
    totalRupees: rupees(dto.total_paise),
    hasPdf: dto.has_pdf,
  };
}

export function toTokenSlip(dto: z.infer<typeof tokenSlipResponseSchema>): TokenSlipData {
  return {
    hospitalName: dto.hospital_name,
    tokenLabel: dto.token_label,
    bookingRef: dto.booking_ref,
    mrn: dto.mrn,
    patientName: dto.patient_name,
    doctorName: dto.doctor_name,
    doctorRoom: dto.doctor_room,
    departmentName: dto.department_name,
    sessionLabel: dto.session_label,
    scheduledStartAt: dto.scheduled_start_at,
  };
}

export function toRefund(dto: z.infer<typeof refundBriefSchema>): DeskRefund {
  return {
    id: dto.id,
    amountRupees: rupees(dto.amount_paise),
    status: dto.status,
    method: dto.method ?? null,
  };
}

export function toRefundOutcome(dto: z.infer<typeof cancellationResponseSchema>): RefundOutcome {
  return {
    appointment: toAppointment(dto.appointment),
    refunds: (dto.refunds ?? []).map(toRefund),
  };
}

/** `POST /hospital/appointments/quote` (APPT-05): `fees.quote(channel="desk")` per consultation. */
export const quoteResponseSchema = z.object({
  consultations: z.array(
    z.object({
      index: z.number().int(),
      is_follow_up: z.boolean(),
      consultation_fee_paise: z.number().int(),
      service_fee_paise: z.number().int(),
      discount_paise: z.number().int(),
      tax_paise: z.number().int(),
      total_paise: z.number().int(),
    }),
  ),
  total_paise: z.number().int(),
});

export function toFeeQuote(dto: z.infer<typeof quoteResponseSchema>): FeeQuote {
  return {
    consultations: dto.consultations.map((c) => ({
      index: c.index,
      isFollowUp: c.is_follow_up,
      consultationRupees: rupees(c.consultation_fee_paise),
      serviceRupees: rupees(c.service_fee_paise),
      discountRupees: rupees(c.discount_paise),
      taxRupees: rupees(c.tax_paise),
      totalRupees: rupees(c.total_paise),
    })),
    totalRupees: rupees(dto.total_paise),
  };
}
