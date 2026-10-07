import { toPage } from '@/core/api/pagination';
import { attempt } from '@/core/error/attempt';

import type { PaymentsRepository } from '@/features/payments/domain/repositories/payments.repository';
import {
  exportPayments,
  getCashSummary,
  getOpenCashSession,
  getPaymentDetail,
  listAllPayments,
  listClosedCashSessions,
  listPayments,
  listRefunds,
  listVisitReceipts,
  postCashSession,
  postCloseCashSession,
  postReconcileCashSession,
} from '@/features/payments/infrastructure/data-sources/remote/payments.api';
import {
  toCashSession,
  toCashSummary,
  toPaymentLine,
  toPaymentRefunds,
  toRefundList,
  toVisitReceipts,
} from '@/features/payments/infrastructure/data-sources/remote/payments.response';

/** Downloaded exports are named `medibook-payments.<format>`. */
const EXPORT_BASENAME = 'medibook-payments';

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

  exportPayments: (filters, format) =>
    attempt(async () => ({
      blob: await exportPayments(filters, format),
      filename: `${EXPORT_BASENAME}.${format}`,
    })),

  listRefunds: (dateFrom, dateTo) =>
    attempt(async () => toRefundList(await listRefunds(dateFrom, dateTo))),

  getCashSummary: (date) => attempt(async () => toCashSummary(await getCashSummary(date))),

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
