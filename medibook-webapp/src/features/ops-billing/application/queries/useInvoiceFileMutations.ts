import { useMutation } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';
import { MAX_PAGE_SIZE } from '@/core/api/pagination';

import type {
  InvoiceListParams,
  PaymentListParams,
} from '@/features/ops-billing/domain/entities/billing.entities';
import { downloadInvoicePdf } from '@/features/ops-billing/application/usecases/downloadInvoicePdf';
import { exportInvoices } from '@/features/ops-billing/application/usecases/exportInvoices';
import { fetchPayments } from '@/features/ops-billing/application/usecases/fetchPayments';

/** Fetch an invoice's server-rendered PDF. A 501 means the server cannot render PDFs. */
export function useInvoicePdfMutation() {
  return useMutation({
    mutationFn: async ({ id, invoiceNo }: { readonly id: string; readonly invoiceNo: string }) =>
      unwrap(await downloadInvoicePdf(id, invoiceNo)),
  });
}

/** Every invoice matching the filters, as the backend's CSV. */
export function useExportInvoicesMutation() {
  return useMutation({
    mutationFn: async (params: InvoiceListParams) => unwrap(await exportInvoices(params)),
  });
}

/**
 * Payments have no export endpoint: read the widest page the backend allows
 * (the newest 100 matching rows) for the screen to write as CSV.
 */
export function usePaymentsExportMutation() {
  return useMutation({
    mutationFn: async (params: PaymentListParams) =>
      unwrap(await fetchPayments({ ...params, page: 1, pageSize: MAX_PAGE_SIZE })),
  });
}
