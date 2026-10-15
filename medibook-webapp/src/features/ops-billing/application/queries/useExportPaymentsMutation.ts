import { useMutation } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { PaymentListParams } from '@/features/ops-billing/domain/entities/billing.entities';
import { exportPayments } from '@/features/ops-billing/application/usecases/exportPayments';

/** Every payment matching the filters, as the server's CSV (BE-28). Reads only. */
export function useExportPaymentsMutation() {
  return useMutation({
    mutationFn: async (params: PaymentListParams) => unwrap(await exportPayments(params)),
  });
}
