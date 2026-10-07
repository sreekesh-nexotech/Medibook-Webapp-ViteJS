import { idempotencyKey, ifMatch } from '@/core/api/headers';
import { hospitalApi } from '@/core/api/http';
import { MAX_PAGE_SIZE, paginatedSchema, fetchCappedPages } from '@/core/api/pagination';

import type {
  AppointmentRange,
  ApptSource,
  PaymentLineInput,
  WalkInInput,
} from '@/features/appointments/domain/entities/appointments.entities';
import {
  appointmentEventSchema,
  appointmentResponseSchema,
  cancellationResponseSchema,
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

/** 50 pages of 100: far beyond a desk's day or week, and a bound on the page walk. */
const APPOINTMENT_PAGES_MAX = 50;
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

/**
 * Every appointment in a window, up to `APPOINTMENT_PAGES_MAX` pages. A longer
 * window comes back `truncated`, and the screen says "first N shown" (DATA-07).
 */
export function getAppointments(range: AppointmentRange) {
  return fetchCappedPages(async (page) => {
    const response = await hospitalApi.get('/appointments', {
      params: {
        page,
        page_size: MAX_PAGE_SIZE,
        date_from: range.dateFrom,
        date_to: range.dateTo,
      },
    });
    return appointmentPageSchema.parse(response.data);
  }, APPOINTMENT_PAGES_MAX);
}

/** How many appointments a window holds, optionally of one source — one row is read. */
export async function getAppointmentCount(range: AppointmentRange, source: ApptSource | null) {
  const response = await hospitalApi.get('/appointments', {
    params: {
      page: 1,
      page_size: 1,
      date_from: range.dateFrom,
      date_to: range.dateTo,
      ...(source ? { source } : {}),
    },
  });
  return appointmentPageSchema.parse(response.data).total;
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

export async function postWalkIn(input: WalkInInput, replayKey: string) {
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
    { headers: idempotencyKey(replayKey) },
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

/**
 * A bodiless action that answers the updated appointment. Idempotent actions
 * carry the caller's replay key: one per user intent, never one per call.
 */
async function act(id: string, action: 'approve' | 'check-in' | 'no-show', replayKey?: string) {
  const response = await hospitalApi.post(`${base(id)}/${encodeURIComponent(action)}`, undefined, {
    headers: replayKey ? idempotencyKey(replayKey) : undefined,
  });
  return appointmentResponseSchema.parse(response.data);
}

export const postApprove = (id: string) => act(id, 'approve');
export const postCheckIn = (id: string, replayKey: string) => act(id, 'check-in', replayKey);
export const postNoShow = (id: string) => act(id, 'no-show');

async function withReason(
  id: string,
  action: 'cancel' | 'reject',
  reason: string,
  replayKey: string,
) {
  const response = await hospitalApi.post(
    `${base(id)}/${encodeURIComponent(action)}`,
    { reason },
    { headers: idempotencyKey(replayKey) },
  );
  return cancellationResponseSchema.parse(response.data).appointment;
}

export const postCancel = (id: string, reason: string, replayKey: string) =>
  withReason(id, 'cancel', reason, replayKey);
export const postReject = (id: string, reason: string, replayKey: string) =>
  withReason(id, 'reject', reason, replayKey);

/** Lines are in integer paise, so they add up exactly to the amount due (DATA-09). */
export async function postPayment(
  id: string,
  lines: readonly PaymentLineInput[],
  replayKey: string,
) {
  const response = await hospitalApi.post(
    `${base(id)}/payments`,
    {
      lines: lines.map((l) => ({
        method: l.method,
        amount_paise: l.amountPaise,
        reference: l.reference || null,
      })),
    },
    { headers: idempotencyKey(replayKey) },
  );
  return paymentResponseSchema.parse(response.data).receipt;
}

export async function postRefund(id: string, reason: string, replayKey: string): Promise<void> {
  await hospitalApi.post(`${base(id)}/refunds`, { reason }, { headers: idempotencyKey(replayKey) });
}

export async function getReceipt(id: string) {
  const response = await hospitalApi.get(`${base(id)}/receipt`);
  return receiptResponseSchema.parse(response.data);
}

export async function getReceiptPdfUrl(id: string) {
  const response = await hospitalApi.get(`${base(id)}/receipt.pdf`);
  return receiptPdfResponseSchema.parse(response.data).url;
}

export async function getTokenSlip(id: string) {
  const response = await hospitalApi.get(`${base(id)}/token-slip`);
  return tokenSlipResponseSchema.parse(response.data);
}
