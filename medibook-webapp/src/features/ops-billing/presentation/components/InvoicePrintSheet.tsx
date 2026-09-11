import { cn } from '@/shared/lib/cn';
import { money } from '@/shared/lib/format';

import { longDateFromIso } from '@/features/ops-hospitals/application/store/opsDates';

import {
  MEDIBOOK_GSTIN,
  invoiceTax,
} from '@/features/ops-billing/application/store/billing.derive';
import type { Invoice } from '@/features/ops-billing/application/store/billing.types';

interface InvoicePrintSheetProps {
  invoice: Invoice;
  hospitalName: string;
  hospitalGstin?: string | null;
  planName: string;
  /** Billing period the line item covers, e.g. "June 01 – June 30, 2026". */
  period: string;
}

/**
 * The invoice as a document (audit 3.1.4). This is the node `usePrintArea()`
 * prints: the `.print-area` rule in `src/index.css` hides everything else and
 * lays this out full page, which is what makes "Save as PDF" a real PDF path
 * through the browser's own print dialog — and the reason the control may not
 * be labelled "Download PDF", because no file is written.
 *
 * Rendered off-screen with `invisible` rather than `hidden`: the print rule
 * flips visibility back on, and `display: none` could not be recovered.
 */
export function InvoicePrintSheet({
  invoice,
  hospitalName,
  hospitalGstin,
  planName,
  period,
}: InvoicePrintSheetProps) {
  const tax = invoiceTax(invoice.amount);
  const rowClass = 'border-border-soft border-b px-3.5 text-body text-text-body';
  const headClass = 'border-border-soft border-b px-3.5 text-body text-text-navy font-semibold';

  return (
    <div className="flex flex-col gap-6 bg-white p-8">
      <div className="border-border-soft flex flex-wrap items-start justify-between gap-4 border-b pb-5">
        <div>
          <div className="text-h2 text-text-navy">Medibook</div>
          <div className="text-caption text-text-muted mt-1">
            Medibook Health Technologies Pvt. Ltd. · support@medibook.in
          </div>
          <div className="text-caption text-text-muted tabular-nums">GSTIN {MEDIBOOK_GSTIN}</div>
        </div>
        <div className="text-right">
          <div className="text-h3 text-text-strong tabular-nums">{invoice.no}</div>
          <div className="text-caption text-text-muted">Tax invoice</div>
          <div className="text-caption text-text-muted">
            Issued {invoice.issued} · Due {invoice.due}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-8">
        <div className="min-w-50 flex-1">
          <div className="text-caption text-text-muted">Billed to</div>
          <div className="text-body-lg text-text-strong font-semibold">{hospitalName}</div>
          <div className="text-caption text-text-muted tabular-nums">
            GSTIN {hospitalGstin || 'not on file'}
          </div>
        </div>
        <div className="min-w-50 flex-1">
          <div className="text-caption text-text-muted">Subscription</div>
          <div className="text-body-lg text-text-strong font-semibold">{planName} Plan</div>
          <div className="text-caption text-text-muted">{period}</div>
        </div>
        <div className="min-w-50 flex-1">
          <div className="text-caption text-text-muted">Status</div>
          <div className="text-body-lg text-text-strong font-semibold">{invoice.status}</div>
          {invoice.paidOn && (
            <div className="text-caption text-text-muted">
              Paid {longDateFromIso(invoice.paidOn)} · {invoice.paidMode} · {invoice.paidRef}
            </div>
          )}
        </div>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={cn(headClass, 'text-left')}>Description</th>
            <th className={cn(headClass, 'text-left')}>Period</th>
            <th className={cn(headClass, 'text-right')}>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={rowClass}>{planName} Plan — subscription</td>
            <td className={rowClass}>{period}</td>
            <td className={cn(rowClass, 'text-right tabular-nums')}>{money(tax.base)}</td>
          </tr>
        </tbody>
      </table>

      <div className="flex justify-end">
        <div className="flex w-75 flex-col gap-2">
          {(
            [
              ['Taxable value', tax.base],
              ['CGST (9%)', tax.cgst],
              ['SGST (9%)', tax.sgst],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="flex justify-between">
              <span className="text-body text-text-muted">{label}</span>
              <span className="text-body text-text-strong tabular-nums">{money(value)}</span>
            </div>
          ))}
          <div className="border-border-soft flex justify-between border-t pt-2">
            <span className="text-body-lg text-text-strong font-semibold">Total payable</span>
            <span className="text-body-lg text-text-strong font-semibold tabular-nums">
              {money(tax.total)}
            </span>
          </div>
        </div>
      </div>

      <div className="text-caption text-text-muted border-border-soft border-t pt-4">
        18% GST (9% CGST + 9% SGST) is charged on the plan price and shown as its own line. This is
        a computer-generated tax invoice; no signature is required.
      </div>
    </div>
  );
}
