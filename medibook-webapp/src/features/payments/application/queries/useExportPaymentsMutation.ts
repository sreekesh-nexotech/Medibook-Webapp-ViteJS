import { useMutation } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { PaymentFilters } from '@/features/payments/domain/entities/payments.entities';
import { exportPayments } from '@/features/payments/application/usecases/exportPayments';

/** Fetch the server-built CSV for `filters` (a mutation: it is a one-off download). */
export function useExportPaymentsMutation() {
  return useMutation({
    mutationFn: async (filters: PaymentFilters) => unwrap(await exportPayments(filters)),
  });
}
