import { idempotencyKey, ifMatch } from '@/core/api/headers';
import { hospitalApi } from '@/core/api/http';
import { fetchAllPages, paginatedSchema } from '@/core/api/pagination';

import type {
  AppointmentListParams,
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
  refundListResponseSchema,
  tokenSlipResponseSchema,
  walkInResponseSchema,
} from '@/features/appointments/infrastructure/data-sources/remote/appointments.response';

/**
 * Hospital appointment endpoints (`/api/v1/hospital/appointments…`). The
 * desk list is filtered, sorted and paged by the server; a whole day can
 * still be read in full (the token queue and Payments need every booking of
 * the day). Every state-changing POST the backend declares idempotent
 * carries the `Idempotency-Key` the caller minted **once per user action**
 * and reuses on retry (UAT-16, D-21) — never a fresh key per HTTP call.
 */

export const appointmentPageSchema = paginatedSchema(appointmentResponseSchema);
export const eventPageSchema = paginatedSchema(appointmentEventSchema);

const base = (id: string) => `/appointments/${encodeURIComponent(id)}`;

/** One row is enough to read a filter's `total`. */
const COUNT_PAGE_SIZE = 1;

/**
 * The backend's query string for a list page: only allowlisted params, and
 * only the ones that filter (empty values are left out, a 400 otherwise).
 */
export function toListQuery(params: AppointmentListParams): Record<string, string | number> {
  const query: Record<string, string | number> = {
    date_from: params.dateFrom,
    date_to: params.dateTo,
    sort: `${params.sort.direction === 'desc' ? '-' : ''}${params.sort.field}`,
    page: params.page,
    page_size: params.pageSize,
  };
  if (params.statuses.length > 0) query.status = params.statuses.join(',');
  if (params.source) query.source = params.source;
  if (params.paymentStatus) query.payment_status = params.paymentStatus;
  if (params.departmentId) query.department_id = params.departmentId;
  if (params.doctorId) query.doctor_id = params.doctorId;
  const q = params.q.trim();
  if (q) query.q = q;
  return query;
}

/** Every appointment in a window, all pages, in the server's default order. */
export function getAppointments(range: AppointmentRange) {
  return fetchAllPages(async ({ page, page_size }) => {
    const response = await hospitalApi.get('/appointments', {
      params: { page, page_size, date_from: range.dateFrom, date_to: range.dateTo },
    });
    return appointmentPageSchema.parse(response.data);
  });
}

/** One server-filtered page of the desk list. */
export async function getAppointmentsPage(params: AppointmentListParams) {
  const response = await hospitalApi.get('/appointments', { params: toListQuery(params) });
  return appointmentPageSchema.parse(response.data);
}

/** How many appointments match a filter (the page envelope's `total`). */
export async function countAppointments(params: AppointmentListParams): Promise<number> {
  const response = await hospitalApi.get('/appointments', {
    params: toListQuery({ ...params, page: 1, pageSize: COUNT_PAGE_SIZE }),
  });
  return appointmentPageSchema.parse(response.data).total;
}

export async function getAppointment(id: string) {
  const response = await hospitalApi.get(base(id));
  return appointmentResponseSchema.parse(response.data);
}

export function getEvents(id: string) {
  return fetchAllPages(async ({ page, page_size }) => {
    const response = await hospitalApi.get(`${base(id)}/events`, { params: { page, page_size } });
    return eventPageSchema.parse(response.data);
  });
}

export async function postWalkIn(input: WalkInInput, key: string) {
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
        ...(c.serviceId ? { service_id: c.serviceId } : {}),
      })),
      remark: input.remark || null,
    },
    { headers: idempotencyKey(key) },
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
async function act(id: string, action: 'approve' | 'check-in' | 'no-show', key: string | null) {
  const response = await hospitalApi.post(`${base(id)}/${encodeURIComponent(action)}`, undefined, {
    headers: key ? idempotencyKey(key) : undefined,
  });
  return appointmentResponseSchema.parse(response.data);
}

export const postApprove = (id: string) => act(id, 'approve', null);
export const postCheckIn = (id: string, key: string) => act(id, 'check-in', key);
export const postNoShow = (id: string) => act(id, 'no-show', null);

async function withReason(id: string, action: 'cancel' | 'reject', reason: string, key: string) {
  const response = await hospitalApi.post(
    `${base(id)}/${encodeURIComponent(action)}`,
    { reason },
    { headers: idempotencyKey(key) },
  );
  return cancellationResponseSchema.parse(response.data);
}

export const postCancel = (id: string, reason: string, key: string) =>
  withReason(id, 'cancel', reason, key);
export const postReject = (id: string, reason: string, key: string) =>
  withReason(id, 'reject', reason, key);

function paymentLinesBody(lines: readonly PaymentLineInput[]) {
  return {
    lines: lines.map((l) => ({
      method: l.method,
      amount_paise: Math.round(l.amountRupees * PAISE_PER_RUPEE),
      reference: l.reference || null,
    })),
  };
}

export async function postPayment(id: string, lines: readonly PaymentLineInput[], key: string) {
  const response = await hospitalApi.post(`${base(id)}/payments`, paymentLinesBody(lines), {
    headers: idempotencyKey(key),
  });
  return paymentResponseSchema.parse(response.data).receipt;
}

/** `{results: [refund]}` — one refund per payment line (Q95). */
export async function postRefund(id: string, reason: string, key: string) {
  const response = await hospitalApi.post(
    `${base(id)}/refunds`,
    { reason },
    { headers: idempotencyKey(key) },
  );
  return refundListResponseSchema.parse(response.data).results;
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
