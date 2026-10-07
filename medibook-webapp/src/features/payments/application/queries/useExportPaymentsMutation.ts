import { useMutation } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type {
  PaymentChannel,
  PaymentFilters,
} from '@/features/payments/domain/entities/payments.entities';
import { exportPayments } from '@/features/payments/application/usecases/exportPayments';

/** What to export: the server filters, plus the on-screen source (`null` = both). */
export interface PaymentsExportRequest {
  readonly filters: PaymentFilters;
  readonly channel: PaymentChannel | null;
}

/** Fetch the CSV for the screen's filters (a mutation: it is a one-off download). */
export function useExportPaymentsMutation() {
  return useMutation({
    mutationFn: async ({ filters, channel }: PaymentsExportRequest) =>
      unwrap(await exportPayments(filters, channel)),
  });
}
