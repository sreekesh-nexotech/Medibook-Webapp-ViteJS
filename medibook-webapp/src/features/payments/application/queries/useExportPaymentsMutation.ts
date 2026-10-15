import { useMutation } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type {
  PaymentExportFormat,
  PaymentFilters,
} from '@/features/payments/domain/entities/payments.entities';
import { exportPayments } from '@/features/payments/application/usecases/exportPayments';

interface ExportInput {
  readonly filters: PaymentFilters;
  readonly format: PaymentExportFormat;
}

/** Fetch a server-built export of `filters` (a mutation: it is a one-off download). */
export function useExportPaymentsMutation() {
  return useMutation({
    mutationFn: async ({ filters, format }: ExportInput) =>
      unwrap(await exportPayments(filters, format)),
  });
}
