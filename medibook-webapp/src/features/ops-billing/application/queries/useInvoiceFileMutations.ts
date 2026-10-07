import { useMutation } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';
import { MAX_PAGE_SIZE } from '@/core/api/pagination';

import type { Page } from '@/core/api/pagination';

import type {
  BillingFile,
  InvoiceListParams,
  PaymentListParams,
  SubscriptionPayment,
} from '@/features/ops-billing/domain/entities/billing.entities';
import { downloadInvoicePdf } from '@/features/ops-billing/application/usecases/downloadInvoicePdf';
import { exportInvoices } from '@/features/ops-billing/application/usecases/exportInvoices';
import { exportPayments } from '@/features/ops-billing/application/usecases/exportPayments';
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

/** A payments export: the server's file, or — on an older backend — rows to write. */
export type PaymentsExport =
  | { readonly kind: 'file'; readonly file: BillingFile }
  | { readonly kind: 'rows'; readonly page: Page<SubscriptionPayment> };

/**
 * Every matching payment as the server's CSV (BE-28, formula-safe). A backend
 * without the export answers 404: then the widest page the API allows (the
 * newest 100 matching rows) is read for the screen to write as CSV.
 */
export function usePaymentsExportMutation() {
  return useMutation({
    mutationFn: async (params: PaymentListParams): Promise<PaymentsExport> => {
      const server = await exportPayments(params);
      if (server.ok) return { kind: 'file', file: server.data };
      if (server.failure.kind !== 'notFound') throw server.failure;
      const page = unwrap(await fetchPayments({ ...params, page: 1, pageSize: MAX_PAGE_SIZE }));
      return { kind: 'rows', page };
    },
  });
}
