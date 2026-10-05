import { useMutation } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { fetchInvoicePdf } from '@/features/settlements/application/usecases/fetchInvoicePdf';

/** The server-rendered invoice PDF. A read: nothing to invalidate. */
export function useInvoicePdfMutation() {
  return useMutation({
    mutationFn: async (invoiceId: string) => unwrap(await fetchInvoicePdf(invoiceId)),
  });
}
