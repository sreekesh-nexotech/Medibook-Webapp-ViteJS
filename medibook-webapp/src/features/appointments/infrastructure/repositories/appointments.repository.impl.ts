import { attempt } from '@/core/error/attempt';
import { isFailure } from '@/core/error/failure';
import { toFailure } from '@/core/error/toFailure';

import type { AppointmentsRepository } from '@/features/appointments/domain/repositories/appointments.repository';
import * as api from '@/features/appointments/infrastructure/data-sources/remote/appointments.api';
import {
  toAppointment,
  toEvent,
  toFeeQuote,
  toReceipt,
  toRefund,
  toRefundOutcome,
  toTokenSlip,
} from '@/features/appointments/infrastructure/data-sources/remote/appointments.response';

const HTTP_NOT_FOUND = 404;
const HTTP_METHOD_NOT_ALLOWED = 405;

export const appointmentsRepository: AppointmentsRepository = {
  list: (range) => attempt(async () => (await api.getAppointments(range)).map(toAppointment)),
  listPage: (params) =>
    attempt(async () => {
      const dto = await api.getAppointmentsPage(params);
      return {
        items: dto.results.map(toAppointment),
        page: dto.page,
        pageSize: dto.page_size,
        total: dto.total,
      };
    }),
  count: (params) => attempt(() => api.countAppointments(params)),
  get: (id) => attempt(async () => toAppointment(await api.getAppointment(id))),
  events: (id) => attempt(async () => (await api.getEvents(id)).map(toEvent)),
  quote: (input) =>
    attempt(async () => {
      try {
        return toFeeQuote(await api.postQuote(input));
      } catch (error) {
        // A backend without the quote route (404/405): the screen falls back to
        // the doctor's list fees and says the final figure comes at booking.
        const failure = isFailure(error) ? error : toFailure(error);
        if (failure.status === HTTP_NOT_FOUND || failure.status === HTTP_METHOD_NOT_ALLOWED) {
          return null;
        }
        throw failure;
      }
    }),
  createWalkIn: (input, key) =>
    attempt(async () => {
      const dto = await api.postWalkIn(input, key);
      return { visitId: dto.visit.id, appointments: dto.appointments.map(toAppointment) };
    }),
  updateRemark: (id, remark, version) =>
    attempt(async () => toAppointment(await api.patchRemark(id, remark, version))),
  approve: (id) => attempt(async () => toAppointment(await api.postApprove(id))),
  reject: (id, reason, key) =>
    attempt(async () => toRefundOutcome(await api.postReject(id, reason, key))),
  checkIn: (id, key) => attempt(async () => toAppointment(await api.postCheckIn(id, key))),
  noShow: (id) => attempt(async () => toAppointment(await api.postNoShow(id))),
  cancel: (id, reason, key) =>
    attempt(async () => toRefundOutcome(await api.postCancel(id, reason, key))),
  collectPayment: (id, lines, key) =>
    attempt(async () => toReceipt(await api.postPayment(id, lines, key))),
  refund: (id, reason, key) =>
    attempt(async () => (await api.postRefund(id, reason, key)).map(toRefund)),
  receipt: (id) => attempt(async () => toReceipt(await api.getReceipt(id))),
  receiptPdfUrl: (id) => attempt(() => api.getReceiptPdfUrl(id)),
  tokenSlip: (id) => attempt(async () => toTokenSlip(await api.getTokenSlip(id))),
  tokenSlipPdf: (id) => attempt(() => api.getTokenSlipPdf(id)),
};
