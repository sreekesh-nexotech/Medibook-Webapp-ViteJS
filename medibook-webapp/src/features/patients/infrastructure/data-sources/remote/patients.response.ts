import { z } from 'zod';

import { paginatedSchema } from '@/core/api/pagination';

import type {
  PatientAppointment,
  PatientChangeDecision,
  PatientRecord,
  PendingPatientChange,
} from '@/features/patients/domain/entities/patients.entities';

/**
 * Response DTOs for `/hospital/patients…` and `/hospital/patient-approvals…`.
 * Every list is the paginated envelope (`core/pagination.py`), although
 * `schema.yml` declares a bare array.
 */

const genderSchema = z.enum(['female', 'male', 'other', 'undisclosed']);

/** `pending_request` — set by the detail read only (D-29). */
const pendingRequestSchema = z.object({
  id: z.string(),
  kind: z.enum(['edit', 'delete']),
  requested_at: z.string(),
  proposed: z.unknown(),
});

/** An edit request's `proposed` is `{changes, before, base_version}`. */
const proposedEditSchema = z.object({ changes: z.record(z.string(), z.unknown()) });

/** `HospitalPatient` (`schema.yml`). */
export const hospitalPatientResponseSchema = z.object({
  id: z.string(),
  mrn: z.string(),
  legacy_mrn: z.string().nullable(),
  first_name: z.string(),
  last_name: z.string().nullable(),
  full_name: z.string(),
  phone_e164: z.string().nullable(),
  email: z.string().nullable(),
  date_of_birth: z.string().nullable(),
  gender: genderSchema.nullable(),
  address_line1: z.string().nullable(),
  address_line2: z.string().nullable(),
  address_line3: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  pincode: z.string().nullable(),
  source: z.enum(['desk', 'online']),
  is_linked: z.boolean(),
  pending_request: pendingRequestSchema.nullable(),
  created_at: z.string(),
  version: z.number().int(),
});

export type HospitalPatientResponse = z.infer<typeof hospitalPatientResponseSchema>;

export const hospitalPatientPageResponseSchema = paginatedSchema(hospitalPatientResponseSchema);

/** `202` from PATCH when the edit became a change request. */
export const changeRequestedResponseSchema = z.object({
  request_id: z.string(),
  status: z.string(),
});

/** `HospitalAppointment` — only the fields the booking history shows. */
export const patientAppointmentResponseSchema = z.object({
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
  source: z.enum(['online', 'walk_in']),
  doctor: z.object({ name: z.string() }),
  department: z.object({ name: z.string() }),
  scheduled_date: z.string(),
  scheduled_start_at: z.string(),
  token_label: z.string().nullable(),
  payment_status: z.enum(['unpaid', 'pending', 'paid', 'refunded', 'failed']),
  total_paise: z.number().int(),
});

export type PatientAppointmentResponse = z.infer<typeof patientAppointmentResponseSchema>;

export const patientAppointmentPageResponseSchema = paginatedSchema(
  patientAppointmentResponseSchema,
);

/** `ApprovalRequest` — what approve / reject return. */
export const approvalRequestResponseSchema = z.object({
  id: z.string(),
  status: z.enum(['pending', 'approved', 'rejected']),
  hospital_patient: z.object({ id: z.string() }),
});

export type ApprovalRequestResponse = z.infer<typeof approvalRequestResponseSchema>;

function toPendingChange(
  dto: z.infer<typeof pendingRequestSchema> | null,
): PendingPatientChange | null {
  if (!dto) return null;
  const proposed = proposedEditSchema.safeParse(dto.proposed);
  return {
    id: dto.id,
    kind: dto.kind,
    requestedAt: dto.requested_at,
    changedFields:
      dto.kind === 'edit' && proposed.success ? Object.keys(proposed.data.changes) : [],
  };
}

export function toPatientRecord(dto: HospitalPatientResponse): PatientRecord {
  return {
    id: dto.id,
    mrn: dto.mrn,
    legacyMrn: dto.legacy_mrn,
    firstName: dto.first_name,
    lastName: dto.last_name,
    fullName: dto.full_name,
    phone: dto.phone_e164,
    email: dto.email,
    dateOfBirth: dto.date_of_birth,
    gender: dto.gender,
    addressLine1: dto.address_line1,
    addressLine2: dto.address_line2,
    addressLine3: dto.address_line3,
    city: dto.city,
    state: dto.state,
    pincode: dto.pincode,
    source: dto.source,
    isLinked: dto.is_linked,
    pendingChange: toPendingChange(dto.pending_request),
    createdAt: dto.created_at,
    version: dto.version,
  };
}

export function toPatientAppointment(dto: PatientAppointmentResponse): PatientAppointment {
  return {
    id: dto.id,
    bookingRef: dto.booking_ref,
    status: dto.status,
    source: dto.source,
    doctorName: dto.doctor.name,
    departmentName: dto.department.name,
    scheduledDate: dto.scheduled_date,
    scheduledStartAt: dto.scheduled_start_at,
    tokenLabel: dto.token_label,
    paymentStatus: dto.payment_status,
    totalPaise: dto.total_paise,
  };
}

export function toPatientChangeDecision(dto: ApprovalRequestResponse): PatientChangeDecision {
  return { id: dto.id, status: dto.status, hospitalPatientId: dto.hospital_patient.id };
}
