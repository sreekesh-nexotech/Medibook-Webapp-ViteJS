import { idempotencyKey, ifMatch } from '@/core/api/headers';
import { hospitalApi } from '@/core/api/http';
import { MAX_PAGE_SIZE, paginatedSchema } from '@/core/api/pagination';

import type {
  AppointmentRange,
  PaymentLineInput,
  WalkInInput,
} from '@/features/appointments/domain/entities/appointments.entities';
import {
  appointmentEventSchema,
  appointmentResponseSchema,
  cancellationResponseSchema,
  PAISE_PER_RUPEE,
  paymentResponseSchema,
  receiptPdfResponseSchema,
  receiptResponseSchema,
  tokenSlipResponseSchema,
  walkInResponseSchema,
} from '@/features/appointments/infrastructure/data-sources/remote/appointments.response';

/**
 * Hospital appointment endpoints (`/api/v1/hospital/appointments…`). Lists
 * are paginated server-side (despite `schema.yml` typing them as arrays) and
 * fetched in full for the requested date window. Every state-changing POST
 * the backend declares idempotent carries a fresh `Idempotency-Key`.
 */

export const appointmentPageSchema = paginatedSchema(appointmentResponseSchema);
export const eventPageSchema = paginatedSchema(appointmentEventSchema);

async function fetchAllPages<T>(
  fetchPage: (page: number) => Promise<{ results: T[]; has_next: boolean }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 1; ; page += 1) {
    const data = await fetchPage(page);
    rows.push(...data.results);
    if (!data.has_next) return rows;
  }
}

const base = (id: string) => `/appointments/${encodeURIComponent(id)}`;

export function getAppointments(range: AppointmentRange) {
  return fetchAllPages(async (page) => {
    const response = await hospitalApi.get('/appointments', {
      params: {
        page,
        page_size: MAX_PAGE_SIZE,
        date_from: range.dateFrom,
        date_to: range.dateTo,
      },
    });
    return appointmentPageSchema.parse(response.data);
  });
}

export async function getAppointment(id: string) {
  const response = await hospitalApi.get(base(id));
  return appointmentResponseSchema.parse(response.data);
}

export function getEvents(id: string) {
  return fetchAllPages(async (page) => {
    const response = await hospitalApi.get(`${base(id)}/events`, {
      params: { page, page_size: MAX_PAGE_SIZE },
    });
    return eventPageSchema.parse(response.data);
  });
}

export async function postWalkIn(input: WalkInInput) {
  const patient =
    input.patient.kind === 'existing'
      ? { hospital_patient_id: input.patient.hospitalPatientId }
      : {
          new: {
            first_name: input.patient.patient.firstName,
            last_name: input.patient.patient.lastName || null,
            phone_e164: input.patient.patient.phone || null,
            gender: input.patient.patient.gender,
            date_of_birth: input.patient.patient.dateOfBirth,
          },
        };
  const response = await hospitalApi.post(
    '/appointments',
    {
      patient,
      consultations: input.consultations.map((c) => ({
        department_id: c.departmentId,
        doctor_id: c.doctorId,
        slot_id: c.slotId,
      })),
      remark: input.remark || null,
    },
    { headers: idempotencyKey() },
  );
  return walkInResponseSchema.parse(response.data);
}

export async function patchRemark(id: string, remark: string, version: number) {
  const response = await hospitalApi.patch(
    base(id),
    { remark: remark || null },
    { headers: ifMatch(version) },
  );
  return appointmentResponseSchema.parse(response.data);
}

/** A bodiless action that answers the updated appointment. */
async function act(id: string, action: 'approve' | 'check-in' | 'no-show', idempotent: boolean) {
  const response = await hospitalApi.post(`${base(id)}/${encodeURIComponent(action)}`, undefined, {
    headers: idempotent ? idempotencyKey() : undefined,
  });
  return appointmentResponseSchema.parse(response.data);
}

export const postApprove = (id: string) => act(id, 'approve', false);
export const postCheckIn = (id: string) => act(id, 'check-in', true);
export const postNoShow = (id: string) => act(id, 'no-show', false);

async function withReason(id: string, action: 'cancel' | 'reject', reason: string) {
  const response = await hospitalApi.post(
    `${base(id)}/${encodeURIComponent(action)}`,
    { reason },
    { headers: idempotencyKey() },
  );
  return cancellationResponseSchema.parse(response.data).appointment;
}

export const postCancel = (id: string, reason: string) => withReason(id, 'cancel', reason);
export const postReject = (id: string, reason: string) => withReason(id, 'reject', reason);

export async function postPayment(id: string, lines: readonly PaymentLineInput[]) {
  const response = await hospitalApi.post(
    `${base(id)}/payments`,
    {
      lines: lines.map((l) => ({
        method: l.method,
        amount_paise: Math.round(l.amountRupees * PAISE_PER_RUPEE),
        reference: l.reference || null,
      })),
    },
    { headers: idempotencyKey() },
  );
  return paymentResponseSchema.parse(response.data).receipt;
}

export async function postRefund(id: string, reason: string): Promise<void> {
  await hospitalApi.post(`${base(id)}/refunds`, { reason }, { headers: idempotencyKey() });
}

export async function getReceipt(id: string) {
  const response = await hospitalApi.get(`${base(id)}/receipt`);
  return receiptResponseSchema.parse(response.data);
}

export async function getReceiptPdfUrl(id: string) {
  const response = await hospitalApi.get(`${base(id)}/receipt.pdf`);
  return receiptPdfResponseSchema.parse(response.data).url;
}

/** The token slip as the backend renders it (`Content-Type: application/pdf`). */
export async function getTokenSlipPdf(id: string): Promise<Blob> {
  const response = await hospitalApi.get<Blob>(`${base(id)}/token-slip.pdf`, {
    responseType: 'blob',
  });
  return response.data;
}

export async function getTokenSlip(id: string) {
  const response = await hospitalApi.get(`${base(id)}/token-slip`);
  return tokenSlipResponseSchema.parse(response.data);
}
