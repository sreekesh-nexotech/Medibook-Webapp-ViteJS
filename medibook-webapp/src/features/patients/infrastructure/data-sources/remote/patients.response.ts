import { z } from 'zod';

import { paginatedSchema } from '@/core/api/pagination';

import type {
  PatientApproval,
  PatientAppointment,
  PatientChangeDecision,
  PatientFieldChange,
  PatientRecord,
  PendingPatientChange,
} from '@/features/patients/domain/entities/patients.entities';

/**
 * Response DTOs for `/hospital/patients…` and `/hospital/patient-approvals…`.
 * Every list is the paginated envelope (`core/pagination.py`), although
 * `schema.yml` declares a bare array.
 */

const genderSchema = z.enum(['female', 'male', 'other', 'undisclosed']);

/**
 * The requester, as the server names them. `requested_by_name` is on every
 * approval row and joins `pending_request` with backend B6;
 * `requested_by_id` / `requested_by_user_id` are optional until the backend
 * sends one of them.
 */
const requesterFields = {
  requested_by_name: z.string().nullable().optional(),
  requested_by_id: z.string().nullable().optional(),
  requested_by_user_id: z.string().nullable().optional(),
};

/** `pending_request` — set by the detail read only (D-29). */
const pendingRequestSchema = z.object({
  id: z.string(),
  kind: z.enum(['edit', 'delete']),
  requested_at: z.string(),
  proposed: z.unknown(),
  ...requesterFields,
});

/** An edit request's `proposed` is `{changes, before, base_version}`. */
const proposedEditSchema = z.object({
  changes: z.record(z.string(), z.unknown()),
  before: z.record(z.string(), z.unknown()).optional(),
});

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
  link_method: z.string().nullable().optional(),
  linked_at: z.string().nullable().optional(),
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

/** `ApprovalRequest` — a row of the approvals queue; also what approve / reject return. */
export const approvalRequestResponseSchema = z.object({
  id: z.string(),
  kind: z.enum(['edit', 'delete']),
  status: z.enum(['pending', 'approved', 'rejected']),
  proposed: z.unknown(),
  hospital_patient: z.object({
    id: z.string(),
    mrn: z.string(),
    full_name: z.string(),
    deleted: z.boolean().optional(),
  }),
  ...requesterFields,
  requested_at: z.string(),
  reviewed_by_name: z.string().nullable().optional(),
  reviewed_at: z.string().nullable().optional(),
  review_note: z.string().nullable().optional(),
});

export type ApprovalRequestResponse = z.infer<typeof approvalRequestResponseSchema>;

/** `GET /hospital/patient-approvals` — the paginated queue. */
export const approvalRequestPageResponseSchema = paginatedSchema(approvalRequestResponseSchema);

/** A proposed or current value as display text: strings as-is, nullish as `null`, the rest as JSON. */
function displayValue(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

/** `proposed` of an edit → old → new per field; a delete (or anything else) has none. */
export function toFieldChanges(proposed: unknown): readonly PatientFieldChange[] {
  const parsed = proposedEditSchema.safeParse(proposed);
  if (!parsed.success) return [];
  const before = parsed.data.before ?? {};
  return Object.entries(parsed.data.changes).map(([field, after]) => ({
    field,
    before: displayValue(before[field]),
    after: displayValue(after),
  }));
}

function requesterId(dto: {
  readonly requested_by_id?: string | null;
  readonly requested_by_user_id?: string | null;
}): string | null {
  return dto.requested_by_user_id ?? dto.requested_by_id ?? null;
}

function toPendingChange(
  dto: z.infer<typeof pendingRequestSchema> | null,
): PendingPatientChange | null {
  if (!dto) return null;
  const changes = dto.kind === 'edit' ? toFieldChanges(dto.proposed) : [];
  return {
    id: dto.id,
    kind: dto.kind,
    requestedAt: dto.requested_at,
    changedFields: changes.map((c) => c.field),
    changes,
    requestedByName: dto.requested_by_name ?? null,
    requestedByUserId: requesterId(dto),
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
    linkMethod: dto.link_method ?? null,
    linkedAt: dto.linked_at ?? null,
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
  return {
    id: dto.id,
    kind: dto.kind,
    status: dto.status,
    hospitalPatientId: dto.hospital_patient.id,
  };
}

export function toPatientApproval(dto: ApprovalRequestResponse): PatientApproval {
  return {
    id: dto.id,
    kind: dto.kind,
    status: dto.status,
    patient: {
      id: dto.hospital_patient.id,
      mrn: dto.hospital_patient.mrn,
      fullName: dto.hospital_patient.full_name,
      isDeleted: dto.hospital_patient.deleted ?? false,
    },
    changes: dto.kind === 'edit' ? toFieldChanges(dto.proposed) : [],
    requestedByName: dto.requested_by_name ?? null,
    requestedByUserId: requesterId(dto),
    requestedAt: dto.requested_at,
    reviewedByName: dto.reviewed_by_name ?? null,
    reviewedAt: dto.reviewed_at ?? null,
    reviewNote: dto.review_note ?? null,
  };
}
