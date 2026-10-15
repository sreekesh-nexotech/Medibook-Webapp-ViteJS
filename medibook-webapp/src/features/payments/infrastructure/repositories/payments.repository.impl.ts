import { toPage } from '@/core/api/pagination';
import { attempt } from '@/core/error/attempt';

import type { PaymentsRepository } from '@/features/payments/domain/repositories/payments.repository';
import {
  exportPayments,
  getCashSummary,
  getOpenCashSession,
  getPaymentDetail,
  listAllPayments,
  listAllRefunds,
  listCashSessionPayments,
  listCashSessionRefunds,
  listClosedCashSessions,
  listCounters,
  listOrderLines,
  listPayments,
  listRefunds,
  listVisitReceipts,
  postCashSession,
  postCloseCashSession,
  postReconcileCashSession,
  postRefund,
} from '@/features/payments/infrastructure/data-sources/remote/payments.api';
import {
  toCashCounters,
  toCashSession,
  toCashSummary,
  toPaymentDetail,
  toPaymentLine,
  toPaymentRefund,
  toVisitReceipts,
} from '@/features/payments/infrastructure/data-sources/remote/payments.response';

/** Downloaded exports are named `medibook-payments.<format>`. */
const EXPORT_BASENAME = 'medibook-payments';

export const paymentsRepository: PaymentsRepository = {
  listPayments: (query) =>
    attempt(async () => {
      const { dto, isChannelFiltered } = await listPayments(query);
      return { ...toPage(dto, toPaymentLine), isChannelFiltered };
    }),

  listAllPayments: (filters) =>
    attempt(async () => (await listAllPayments(filters)).map(toPaymentLine)),

  listOrderLines: (orderId, bookingRef) =>
    attempt(async () => (await listOrderLines(orderId, bookingRef)).map(toPaymentLine)),

  getPayment: (paymentId) =>
    attempt(async () => toPaymentDetail(await getPaymentDetail(paymentId))),

  listVisitReceipts: (visitId) =>
    attempt(async () => toVisitReceipts(await listVisitReceipts(visitId))),

  exportPayments: (filters, format) =>
    attempt(async () => {
      const { blob, truncation } = await exportPayments(filters, format);
      return {
        blob,
        filename: `${EXPORT_BASENAME}.${format}`,
        isTruncated: truncation.truncated,
        rowLimit: truncation.rowLimit,
      };
    }),

  listRefunds: (query) => attempt(async () => toPage(await listRefunds(query), toPaymentRefund)),

  listAllRefunds: (dateFrom, dateTo) =>
    attempt(async () => (await listAllRefunds(dateFrom, dateTo)).map(toPaymentRefund)),

  refundBooking: (appointmentId, reason, idempotencyKey) =>
    attempt(async () => ({
      refunds: (await postRefund(appointmentId, reason, idempotencyKey)).map(toPaymentRefund),
    })),

  getCashSummary: (date) => attempt(async () => toCashSummary(await getCashSummary(date))),

  getOpenCashSession: (staffId) =>
    attempt(async () => {
      const dto = await getOpenCashSession(staffId);
      return dto ? toCashSession(dto) : null;
    }),

  listCounters: () => attempt(async () => toCashCounters(await listCounters())),

  openCashSession: (openingFloatPaise, counterId, idempotencyKey) =>
    attempt(async () =>
      toCashSession(await postCashSession(openingFloatPaise, counterId, idempotencyKey)),
    ),

  closeCashSession: (id, countedCashPaise, note, guard) =>
    attempt(async () =>
      toCashSession(await postCloseCashSession(id, countedCashPaise, note, guard)),
    ),

  listCashSessionsToReconcile: () =>
    attempt(async () => (await listClosedCashSessions()).map(toCashSession)),

  reconcileCashSession: (id, countedCashPaise, note, guard) =>
    attempt(async () =>
      toCashSession(await postReconcileCashSession(id, countedCashPaise, note, guard)),
    ),

  getCashSessionActivity: (sessionId, businessDate) =>
    attempt(async () => {
      const [payments, refunds] = await Promise.all([
        listCashSessionPayments(sessionId, businessDate),
        listCashSessionRefunds(sessionId, businessDate),
      ]);
      return { payments: payments.map(toPaymentLine), refunds: refunds.map(toPaymentRefund) };
    }),
};
