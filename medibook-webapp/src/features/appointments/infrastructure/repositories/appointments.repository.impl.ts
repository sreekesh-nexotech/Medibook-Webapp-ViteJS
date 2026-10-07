import { attempt } from '@/core/error/attempt';

import type { AppointmentsRepository } from '@/features/appointments/domain/repositories/appointments.repository';
import * as api from '@/features/appointments/infrastructure/data-sources/remote/appointments.api';
import {
  toAppointment,
  toEvent,
  toReceipt,
  toTokenSlip,
} from '@/features/appointments/infrastructure/data-sources/remote/appointments.response';

export const appointmentsRepository: AppointmentsRepository = {
  list: (range) =>
    attempt(async () => {
      const { rows, truncated } = await api.getAppointments(range);
      return { items: rows.map(toAppointment), truncated };
    }),

  count: (range, source) => attempt(() => api.getAppointmentCount(range, source)),
  get: (id) => attempt(async () => toAppointment(await api.getAppointment(id))),
  events: (id) => attempt(async () => (await api.getEvents(id)).map(toEvent)),
  createWalkIn: (input, replayKey) =>
    attempt(async () => {
      const dto = await api.postWalkIn(input, replayKey);
      return { visitId: dto.visit.id, appointments: dto.appointments.map(toAppointment) };
    }),
  updateRemark: (id, remark, version) =>
    attempt(async () => toAppointment(await api.patchRemark(id, remark, version))),
  approve: (id) => attempt(async () => toAppointment(await api.postApprove(id))),
  reject: (id, reason, replayKey) =>
    attempt(async () => toAppointment(await api.postReject(id, reason, replayKey))),
  checkIn: (id, replayKey) =>
    attempt(async () => toAppointment(await api.postCheckIn(id, replayKey))),
  noShow: (id) => attempt(async () => toAppointment(await api.postNoShow(id))),
  cancel: (id, reason, replayKey) =>
    attempt(async () => toAppointment(await api.postCancel(id, reason, replayKey))),
  collectPayment: (id, lines, replayKey) =>
    attempt(async () => toReceipt(await api.postPayment(id, lines, replayKey))),
  refund: (id, reason, replayKey) =>
    attempt(async () => {
      await api.postRefund(id, reason, replayKey);
      return null;
    }),
  receipt: (id) => attempt(async () => toReceipt(await api.getReceipt(id))),
  receiptPdfUrl: (id) => attempt(() => api.getReceiptPdfUrl(id)),
  tokenSlip: (id) => attempt(async () => toTokenSlip(await api.getTokenSlip(id))),
};
