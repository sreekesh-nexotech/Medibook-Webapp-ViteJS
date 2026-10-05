import { toPage } from '@/core/api/pagination';
import { attempt } from '@/core/error/attempt';

import type { PaymentsRepository } from '@/features/payments/domain/repositories/payments.repository';
import {
  exportPaymentsCsv,
  getPaymentDetail,
  listAllPayments,
  listPayments,
  listVisitReceipts,
} from '@/features/payments/infrastructure/data-sources/remote/payments.api';
import {
  toPaymentLine,
  toPaymentRefunds,
  toVisitReceipts,
} from '@/features/payments/infrastructure/data-sources/remote/payments.response';

export const paymentsRepository: PaymentsRepository = {
  listPayments: (query) => attempt(async () => toPage(await listPayments(query), toPaymentLine)),

  listAllPayments: (filters) =>
    attempt(async () => (await listAllPayments(filters)).map(toPaymentLine)),

  listPaymentRefunds: (paymentId) =>
    attempt(async () => toPaymentRefunds(await getPaymentDetail(paymentId))),

  listVisitReceipts: (visitId) =>
    attempt(async () => toVisitReceipts(await listVisitReceipts(visitId))),

  exportCsv: (filters) => attempt(() => exportPaymentsCsv(filters)),
};
