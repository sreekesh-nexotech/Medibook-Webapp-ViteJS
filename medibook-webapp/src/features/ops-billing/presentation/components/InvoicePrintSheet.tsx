import { cn } from '@/shared/lib/cn';
import { fmtDate } from '@/shared/lib/format';

import type { BillingInvoiceDetail } from '@/features/ops-billing/domain/entities/billing.entities';
import {
  INVOICE_STATUS_BADGES,
  dateOf,
  fmtDateTime,
  gstLabel,
  ratePercent,
  rupees,
} from '@/features/ops-billing/presentation/components/billingView';

interface InvoicePrintSheetProps {
  invoice: BillingInvoiceDetail;
  planName: string | null;
}

/**
 * The invoice as a document — the browser-print fallback for "Save as PDF"
 * when the server cannot render PDFs (`GET …/{id}.pdf` → 501). This is the
 * node `usePrintArea()` prints: the `.print-area` rule in `src/index.css`
 * hides everything else and lays this out full page.
 *
 * Every figure comes from the invoice as issued: its lines, its tax and the
 * parties' details snapshotted at issue time.
 */
export function InvoicePrintSheet({ invoice, planName }: InvoicePrintSheetProps) {
  const rowClass = 'border-border-soft border-b px-3.5 text-body text-text-body';
  const headClass = 'border-border-soft border-b px-3.5 text-body text-text-navy font-semibold';
  const period = `${fmtDate(invoice.periodStart)} – ${fmtDate(invoice.periodEnd)}`;
  const { billedBy, billedTo } = invoice;

  return (
    <div className="flex flex-col gap-6 bg-white p-8">
      <div className="border-border-soft flex flex-wrap items-start justify-between gap-4 border-b pb-5">
        <div>
          <div className="text-h2 text-text-navy">Medibook</div>
          {billedBy.name && (
            <div className="text-caption text-text-muted mt-1">{billedBy.name}</div>
          )}
          {billedBy.address && (
            <div className="text-caption text-text-muted">{billedBy.address}</div>
          )}
          {billedBy.gstin && (
            <div className="text-caption text-text-muted tabular-nums">GSTIN {billedBy.gstin}</div>
          )}
        </div>
        <div className="text-right">
          <div className="text-h3 text-text-strong tabular-nums">{invoice.invoiceNo}</div>
          <div className="text-caption text-text-muted">Tax invoice</div>
          <div className="text-caption text-text-muted">
            Issued {fmtDate(dateOf(invoice.issuedAt))} · Due {fmtDate(invoice.dueAt)}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-8">
        <div className="min-w-50 flex-1">
          <div className="text-caption text-text-muted">Billed to</div>
          <div className="text-body-lg text-text-strong font-semibold">
            {billedTo.name ?? invoice.hospitalName}
          </div>
          {billedTo.address && (
            <div className="text-caption text-text-muted">{billedTo.address}</div>
          )}
          <div className="text-caption text-text-muted tabular-nums">
            GSTIN {billedTo.gstin || 'not on file'}
          </div>
        </div>
        <div className="min-w-50 flex-1">
          <div className="text-caption text-text-muted">Subscription</div>
          <div className="text-body-lg text-text-strong font-semibold">
            {planName ? `${planName} Plan` : 'Subscription'}
          </div>
          <div className="text-caption text-text-muted">{period}</div>
        </div>
        <div className="min-w-50 flex-1">
          <div className="text-caption text-text-muted">Status</div>
          <div className="text-body-lg text-text-strong font-semibold">
            {INVOICE_STATUS_BADGES[invoice.status].label}
          </div>
          {invoice.paidAt && (
            <div className="text-caption text-text-muted">Paid {fmtDateTime(invoice.paidAt)}</div>
          )}
        </div>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={cn(headClass, 'text-left')}>Description</th>
            <th className={cn(headClass, 'text-right')}>Taxable value</th>
            <th className={cn(headClass, 'text-right')}>GST</th>
            <th className={cn(headClass, 'text-right')}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((line) => (
            <tr key={line.id}>
              <td className={rowClass}>{line.description}</td>
              <td className={cn(rowClass, 'text-right tabular-nums')}>
                {rupees(line.amountPaise)}
              </td>
              <td className={cn(rowClass, 'text-right tabular-nums')}>
                {line.taxRateBp > 0
                  ? `${rupees(line.taxPaise)} at ${ratePercent(line.taxRateBp)}`
                  : '—'}
              </td>
              <td className={cn(rowClass, 'text-right tabular-nums')}>
                {rupees(line.amountPaise + line.taxPaise)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-end">
        <div className="flex w-75 flex-col gap-2">
          {(
            [
              ['Taxable value', invoice.subtotalPaise],
              [gstLabel(invoice.lines), invoice.gstPaise],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="flex justify-between">
              <span className="text-body text-text-muted">{label}</span>
              <span className="text-body text-text-strong tabular-nums">{rupees(value)}</span>
            </div>
          ))}
          <div className="border-border-soft flex justify-between border-t pt-2">
            <span className="text-body-lg text-text-strong font-semibold">Total payable</span>
            <span className="text-body-lg text-text-strong font-semibold tabular-nums">
              {rupees(invoice.totalPaise)}
            </span>
          </div>
        </div>
      </div>

      <div className="text-caption text-text-muted border-border-soft border-t pt-4">
        This is a computer-generated tax invoice; no signature is required.
      </div>
    </div>
  );
}
