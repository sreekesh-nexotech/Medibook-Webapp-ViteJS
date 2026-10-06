import { useNavigate } from 'react-router-dom';

import { Badge } from '@/shared/ui/Badge';
import { Card } from '@/shared/ui/Card';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';

import { opsInvoiceDetailPath, opsPath, opsPaymentDetailPath } from '@/app/router/paths';

import { useInvoicesQuery } from '@/features/ops-billing/application/queries/useInvoicesQuery';
import { usePaymentsQuery } from '@/features/ops-billing/application/queries/usePaymentsQuery';
import type {
  InvoiceListParams,
  PaymentListParams,
} from '@/features/ops-billing/domain/entities/billing.entities';
import {
  dateOf,
  INVOICE_STATUS_BADGES,
  METHOD_LABELS,
  PAYMENT_STATUS_BADGES,
  rupees,
} from '@/features/ops-billing/presentation/components/billingView';

/** Rows shown per table; the Billing screen has the full, filterable lists. */
const RECENT_ROWS = 5;

const INVOICE_COLUMNS = ['Invoice', 'Period', 'Due', 'Total', 'Status'] as const;
const PAYMENT_COLUMNS = ['Invoice', 'Attempted', 'Method', 'Amount', 'Status'] as const;

interface ListState {
  readonly isPending: boolean;
  /** Failed with nothing to show; a failed refresh keeps the rows (RUN-04). */
  readonly isLoadingError: boolean;
  readonly refetch: () => unknown;
}

function tableState(
  query: ListState,
  rows: number,
  emptyTitle: string,
): TableStateSpec | undefined {
  if (query.isPending) return { kind: 'loading', rows: 3 };
  if (query.isLoadingError) return { kind: 'error', onRetry: () => void query.refetch() };
  if (rows === 0) return { kind: 'empty', icon: 'file-text', title: emptyTitle };
  return undefined;
}

interface BillingHospitalCardProps {
  hospitalId: string;
}

/**
 * One hospital's latest subscription invoices and payments, for its ops
 * profile. Rows open the invoice / payment detail; the Billing screen holds
 * the full lists.
 */
export function BillingHospitalCard({ hospitalId }: BillingHospitalCardProps) {
  const navigate = useNavigate();
  const invoiceParams: InvoiceListParams = {
    page: 1,
    pageSize: RECENT_ROWS,
    q: '',
    statuses: [],
    dueFrom: null,
    dueTo: null,
    overdue: null,
    sortField: 'issued_at',
    sortDirection: 'desc',
    hospitalId,
  };
  const paymentParams: PaymentListParams = {
    page: 1,
    pageSize: RECENT_ROWS,
    statuses: [],
    method: null,
    invoiceId: null,
    sortField: 'attempted_at',
    sortDirection: 'desc',
    hospitalId,
  };
  const invoices = useInvoicesQuery(invoiceParams);
  const payments = usePaymentsQuery(paymentParams);
  const invoiceRows = invoices.data?.items ?? [];
  const paymentRows = payments.data?.items ?? [];

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <SectionTitle>Invoices &amp; Payments</SectionTitle>
        <button
          type="button"
          onClick={() => navigate(opsPath('billing'))}
          className="text-body text-blue cursor-pointer border-none bg-transparent p-0"
        >
          Open billing
        </button>
      </div>
      <div className="flex flex-col gap-4">
        <TableShell
          columns={INVOICE_COLUMNS}
          scrollLabel="This hospital's invoices"
          state={tableState(invoices, invoiceRows.length, 'No invoices issued yet.')}
        >
          {invoiceRows.map((inv) => {
            const badge = INVOICE_STATUS_BADGES[inv.status];
            return (
              <tr
                key={inv.id}
                onClick={() => navigate(opsInvoiceDetailPath(inv.id))}
                className="cursor-pointer"
              >
                <td className={tdClass}>{inv.invoiceNo}</td>
                <td className={tdClass}>
                  {inv.periodStart} – {inv.periodEnd}
                </td>
                <td className={tdClass}>{inv.dueAt}</td>
                <td className={`${tdClass} tabular-nums`}>{rupees(inv.totalPaise)}</td>
                <td className={tdClass}>
                  <Badge status={badge.status}>{badge.label}</Badge>
                </td>
              </tr>
            );
          })}
        </TableShell>
        <TableShell
          columns={PAYMENT_COLUMNS}
          scrollLabel="This hospital's payments"
          state={tableState(payments, paymentRows.length, 'No payments recorded yet.')}
        >
          {paymentRows.map((pay) => {
            const badge = PAYMENT_STATUS_BADGES[pay.status];
            return (
              <tr
                key={pay.id}
                onClick={() =>
                  navigate(opsPaymentDetailPath(pay.id), { state: { invoiceId: pay.invoiceId } })
                }
                className="cursor-pointer"
              >
                <td className={tdClass}>{pay.invoiceNo}</td>
                <td className={tdClass}>{dateOf(pay.attemptedAt)}</td>
                <td className={tdClass}>{METHOD_LABELS[pay.method]}</td>
                <td className={`${tdClass} tabular-nums`}>{rupees(pay.amountPaise)}</td>
                <td className={tdClass}>
                  <Badge status={badge.status}>{badge.label}</Badge>
                </td>
              </tr>
            );
          })}
        </TableShell>
      </div>
    </Card>
  );
}
