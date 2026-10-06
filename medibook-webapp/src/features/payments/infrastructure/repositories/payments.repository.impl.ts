import { toPage } from '@/core/api/pagination';
import { attempt } from '@/core/error/attempt';

import type { PaymentsRepository } from '@/features/payments/domain/repositories/payments.repository';
import {
  exportPaymentsCsv,
  getOpenCashSession,
  getPaymentDetail,
  listAllPayments,
  listClosedCashSessions,
  listPayments,
  listVisitReceipts,
  postCashSession,
  postCloseCashSession,
  postReconcileCashSession,
} from '@/features/payments/infrastructure/data-sources/remote/payments.api';
import {
  toCashSession,
  toPaymentLine,
  toPaymentRefunds,
  toVisitReceipts,
} from '@/features/payments/infrastructure/data-sources/remote/payments.response';

export const paymentsRepository: PaymentsRepository = {
  listPayments: (query) => attempt(async () => toPage(await listPayments(query), toPaymentLine)),

  listAllPayments: (filters) =>
    attempt(async () => {
      const { rows, truncated } = await listAllPayments(filters);
      return { lines: rows.map(toPaymentLine), truncated };
    }),

  listPaymentRefunds: (paymentId) =>
    attempt(async () => toPaymentRefunds(await getPaymentDetail(paymentId))),

  listVisitReceipts: (visitId) =>
    attempt(async () => toVisitReceipts(await listVisitReceipts(visitId))),

  exportCsv: (filters) => attempt(() => exportPaymentsCsv(filters)),

  getOpenCashSession: (staffId) =>
    attempt(async () => {
      const dto = await getOpenCashSession(staffId);
      return dto ? toCashSession(dto) : null;
    }),

  openCashSession: (openingFloatPaise, counterId) =>
    attempt(async () => toCashSession(await postCashSession(openingFloatPaise, counterId))),

  closeCashSession: (id, countedCashPaise, note) =>
    attempt(async () => toCashSession(await postCloseCashSession(id, countedCashPaise, note))),

  listCashSessionsToReconcile: () =>
    attempt(async () => (await listClosedCashSessions()).map(toCashSession)),

  reconcileCashSession: (id) =>
    attempt(async () => toCashSession(await postReconcileCashSession(id))),
};
