import { usePrintArea } from '@/shared/hooks/usePrintArea';
import { downloadCsv } from '@/shared/lib/download';
import { fmtDate, money } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { toast } from '@/shared/ui/toast/toast.store';

import {
  GST_LABEL,
  MEDIBOOK_GSTIN,
  splitGst,
} from '@/features/settlements/application/store/plan-billing';
import type { PlanInvoice } from '@/features/settlements/application/store/settlements.types';

interface InvoiceModalProps {
  invoice: PlanInvoice;
  /** Hospital the invoice is billed to (from Hospital Settings). */
  hospitalName: string;
  hospitalAddress: string;
  /** The hospital's own GSTIN — blank shows an em dash rather than nothing. */
  hospitalGstin: string;
  onClose: () => void;
}

/**
 * One plan invoice as a printable document — audit 3.1.5, where the invoice
 * "download" link on this screen had no behaviour of any kind.
 *
 * Both actions are real, so both may report success: **Save as PDF** hands the
 * document to the browser's print dialog through `usePrintArea` (labelled for
 * what it does, never "Download PDF"), and **Download CSV** writes an actual
 * file with `downloadCsv`.
 *
 * The document itself shows what a tax invoice has to: the canonical invoice
 * and receipt series, both GSTINs, and the 18% GST as its own line rather than
 * buried inside the fee.
 */
export function InvoiceModal({
  invoice,
  hospitalName,
  hospitalAddress,
  hospitalGstin,
  onClose,
}: InvoiceModalProps) {
  const { ref, print } = usePrintArea<HTMLDivElement>();
  const { taxable, gst, total } = splitGst(invoice.total);

  const exportCsv = (): void => {
    downloadCsv(`${invoice.id}.csv`, [
      [
        'Invoice',
        'Invoice date',
        'Billed to',
        'Hospital GSTIN',
        'Medibook GSTIN',
        'Plan',
        'Taxable value',
        'GST rate',
        'GST',
        'Total',
        'Receipt',
        'Status',
        'Paid on',
        'Mode',
      ],
      [
        invoice.id,
        fmtDate(invoice.date),
        hospitalName,
        hospitalGstin || '—',
        MEDIBOOK_GSTIN,
        invoice.plan,
        taxable,
        GST_LABEL,
        gst,
        total,
        invoice.receipt,
        invoice.status,
        fmtDate(invoice.paidOn),
        invoice.mode,
      ],
    ]);
    toast(`Downloaded ${invoice.id}.csv`, 'success');
  };

  const line = (label: string, value: string) => (
    <div className="flex justify-between gap-4">
      <span className="text-body text-text-muted">{label}</span>
      <span className="text-body text-text-strong text-right font-medium">{value}</span>
    </div>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={`Invoice ${invoice.id}`}
      width={620}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button variant="secondary" icon="file-down" onClick={exportCsv}>
            Download CSV
          </Button>
          <Button icon="printer" onClick={print}>
            Save as PDF
          </Button>
        </>
      }
    >
      <div ref={ref} className="bg-white">
        <div className="border-border-soft mb-4 flex items-start justify-between gap-4 border-b pb-4">
          <div>
            <div className="text-h3 text-text-strong">Tax Invoice</div>
            <div className="text-caption text-text-muted mt-1">
              Medibook Health Technologies · GSTIN {MEDIBOOK_GSTIN}
            </div>
            <div className="text-caption text-text-muted">Plan subscription billing</div>
          </div>
          <div className="text-right">
            <div className="text-body text-text-strong font-semibold">{invoice.id}</div>
            <div className="text-caption text-text-muted">{fmtDate(invoice.date)}</div>
            <div className="mt-1.5">
              <Badge status={invoice.status} />
            </div>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-4">
          <div>
            <div className="text-caption text-text-muted mb-1 font-semibold uppercase">
              Billed to
            </div>
            <div className="text-body text-text-strong font-medium">{hospitalName}</div>
            <div className="text-caption text-text-muted">{hospitalAddress}</div>
            <div className="text-caption text-text-body mt-1">GSTIN {hospitalGstin || '—'}</div>
          </div>
          <div>
            <div className="text-caption text-text-muted mb-1 font-semibold uppercase">Payment</div>
            <div className="flex flex-col gap-1">
              {line('Receipt no.', invoice.receipt)}
              {line('Paid on', fmtDate(invoice.paidOn))}
              {line('Mode', invoice.mode)}
            </div>
          </div>
        </div>

        <div className="border-border-soft overflow-hidden rounded-md border">
          <div className="bg-bg-tint text-text-navy text-body flex justify-between px-3.5 py-2.5 font-semibold">
            <span>Description</span>
            <span>Amount</span>
          </div>
          <div className="border-border-soft flex justify-between border-b px-3.5 py-3">
            <span className="text-body text-text-body">
              {invoice.plan} — Medibook subscription
              <span className="text-caption text-text-muted block">
                Taxable value, exclusive of GST
              </span>
            </span>
            <span className="text-body text-text-strong font-medium tabular-nums">
              {money(taxable)}
            </span>
          </div>
          <div className="border-border-soft flex justify-between border-b px-3.5 py-3">
            <span className="text-body text-text-body">GST @ {GST_LABEL}</span>
            <span className="text-body text-text-strong font-medium tabular-nums">
              {money(gst)}
            </span>
          </div>
          <div className="bg-bg-subtle flex justify-between px-3.5 py-3">
            <span className="text-body text-text-strong font-semibold">Total paid</span>
            <span className="text-body-lg text-text-strong font-bold tabular-nums">
              {money(total)}
            </span>
          </div>
        </div>

        <div className="text-caption text-text-muted mt-3">
          GST of {GST_LABEL} is charged on the subscription fee and shown separately — it is never
          included in the plan price quoted elsewhere. Computer-generated invoice; no signature
          required.
        </div>
      </div>
    </Modal>
  );
}
