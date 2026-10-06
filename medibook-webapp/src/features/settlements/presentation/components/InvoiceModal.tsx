import { isFailure } from '@/core/error/failure';
import { usePrintArea } from '@/shared/hooks/usePrintArea';
import { downloadCsv } from '@/shared/lib/download';
import { fmtDate, rupeesFromPaise } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Modal } from '@/shared/ui/Modal';
import { SkeletonLine } from '@/shared/ui/Skeleton';
import { toast } from '@/shared/ui/toast/toast.store';

import { useInvoicePdfMutation } from '@/features/settlements/application/queries/useInvoicePdfMutation';
import { useInvoiceQuery } from '@/features/settlements/application/queries/useInvoiceQuery';
import type {
  BillingInvoiceDetail,
  InvoiceParty,
} from '@/features/settlements/domain/entities/billing.entities';
import {
  bpToPct,
  downloadBlob,
  fmtDateTime,
  invoiceStatus,
  periodLabel,
  rupees,
} from '@/features/settlements/presentation/components/settlementsFormat';

const MODAL_WIDTH = 620;
const SKELETON_LINES = 6;
interface InvoiceModalProps {
  invoiceId: string;
  /** Shown in the title while the detail loads. */
  invoiceNo: string;
  onClose: () => void;
}

function Party({ heading, party }: { heading: string; party: InvoiceParty }) {
  return (
    <div>
      <div className="text-caption text-text-muted mb-1 font-semibold uppercase">{heading}</div>
      <div className="text-body text-text-strong font-medium">{party.name}</div>
      {party.addressLines.map((line) => (
        <div key={line} className="text-caption text-text-muted">
          {line}
        </div>
      ))}
      <div className="text-caption text-text-body mt-1">GSTIN {party.gstin ?? '—'}</div>
    </div>
  );
}

function invoiceCsv(inv: BillingInvoiceDetail): void {
  const inRupees = rupeesFromPaise;
  downloadCsv(`${inv.invoiceNo}.csv`, [
    [
      'Invoice',
      'Issued',
      'Due',
      'Period',
      'Billed to',
      'Hospital GSTIN',
      'Issuer GSTIN',
      'Line',
      'Quantity',
      'Taxable value',
      'GST rate',
      'GST',
    ],
    ...inv.lines.map((l) => [
      inv.invoiceNo,
      fmtDateTime(inv.issuedAt),
      fmtDate(inv.dueAt),
      periodLabel(inv.periodStart, inv.periodEnd),
      inv.billedTo.name,
      inv.billedTo.gstin ?? '—',
      inv.issuer.gstin ?? '—',
      l.description,
      l.quantity,
      inRupees(l.amountPaise),
      bpToPct(l.taxRateBp),
      inRupees(l.taxPaise),
    ]),
    [],
    ['Subtotal', inRupees(inv.subtotalPaise)],
    ['GST', inRupees(inv.gstPaise)],
    ['Total', inRupees(inv.totalPaise)],
    ['Paid', inRupees(inv.amountPaidPaise)],
    ['Status', invoiceStatus(inv.status).label],
    ['Paid on', fmtDateTime(inv.paidAt)],
  ]);
  toast(`Downloaded ${inv.invoiceNo}.csv`, 'success');
}

/**
 * One subscription invoice (`GET /hospital/billing/invoices/{id}`) as a
 * printable tax invoice: both parties as frozen at issue time, every line
 * with its own GST, and the totals the backend computed.
 *
 * Three real actions: **Download PDF** (the server-rendered invoice — the
 * server may answer 501 when it cannot render, surfaced as a toast),
 * **Save as PDF** (the browser print dialog via `usePrintArea`) and
 * **Download CSV** (an actual file from the same figures).
 */
export function InvoiceModal({ invoiceId, invoiceNo, onClose }: InvoiceModalProps) {
  const { ref, print } = usePrintArea<HTMLDivElement>();
  const invoiceQuery = useInvoiceQuery(invoiceId);
  const pdf = useInvoicePdfMutation();
  const inv = invoiceQuery.data;

  const downloadPdf = (): void => {
    pdf.mutate(invoiceId, {
      onSuccess: (blob) => downloadBlob(blob, `${invoiceNo}.pdf`),
      onError: (failure) =>
        toast(isFailure(failure) ? failure.message : 'Could not download the PDF.', 'error'),
    });
  };

  const status = inv ? invoiceStatus(inv.status) : null;

  return (
    <Modal
      open
      onClose={onClose}
      title={`Invoice ${invoiceNo}`}
      width={MODAL_WIDTH}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="secondary"
            icon="file-down"
            onClick={() => inv && invoiceCsv(inv)}
            disabled={!inv}
          >
            Download CSV
          </Button>
          <Button variant="secondary" icon="printer" onClick={print} disabled={!inv}>
            Save as PDF
          </Button>
          <Button icon="download" onClick={downloadPdf} busy={pdf.isPending}>
            Download PDF
          </Button>
        </>
      }
    >
      {invoiceQuery.isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: SKELETON_LINES }, (_, i) => (
            <SkeletonLine key={i} />
          ))}
        </div>
      ) : invoiceQuery.isLoadingError || !inv || !status ? (
        <ErrorState
          inline
          title="This invoice didn't load"
          message={isFailure(invoiceQuery.error) ? invoiceQuery.error.message : undefined}
          onRetry={() => void invoiceQuery.refetch()}
        />
      ) : (
        <div ref={ref} className="bg-white">
          <div className="border-border-soft mb-4 flex items-start justify-between gap-4 border-b pb-4">
            <div>
              <div className="text-h3 text-text-strong">Tax Invoice</div>
              <div className="text-caption text-text-muted mt-1">
                Plan subscription · {periodLabel(inv.periodStart, inv.periodEnd)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-body text-text-strong font-semibold">{inv.invoiceNo}</div>
              <div className="text-caption text-text-muted">
                Issued {fmtDateTime(inv.issuedAt)} · due {fmtDate(inv.dueAt)}
              </div>
              <div className="mt-1.5">
                <Badge status={status.badge}>{status.label}</Badge>
              </div>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-4">
            <Party heading="Billed to" party={inv.billedTo} />
            <Party heading="Issued by" party={inv.issuer} />
          </div>

          <div className="border-border-soft overflow-hidden rounded-md border">
            <div className="bg-bg-tint text-text-navy text-body flex justify-between px-3.5 py-2.5 font-semibold">
              <span>Description</span>
              <span>Amount</span>
            </div>
            {inv.lines.map((l) => (
              <div
                key={l.id}
                className="border-border-soft flex justify-between gap-4 border-b px-3.5 py-3"
              >
                <span className="text-body text-text-body">
                  {l.description}
                  <span className="text-caption text-text-muted block">
                    Qty {l.quantity} · GST @ {bpToPct(l.taxRateBp)} = {rupees(l.taxPaise)}
                  </span>
                </span>
                <span className="text-body text-text-strong font-medium tabular-nums">
                  {rupees(l.amountPaise)}
                </span>
              </div>
            ))}
            <div className="border-border-soft flex justify-between border-b px-3.5 py-3">
              <span className="text-body text-text-body">Taxable value</span>
              <span className="text-body text-text-strong font-medium tabular-nums">
                {rupees(inv.subtotalPaise)}
              </span>
            </div>
            <div className="border-border-soft flex justify-between border-b px-3.5 py-3">
              <span className="text-body text-text-body">GST</span>
              <span className="text-body text-text-strong font-medium tabular-nums">
                {rupees(inv.gstPaise)}
              </span>
            </div>
            <div className="bg-bg-subtle flex justify-between px-3.5 py-3">
              <span className="text-body text-text-strong font-semibold">Total</span>
              <span className="text-body-lg text-text-strong font-bold tabular-nums">
                {rupees(inv.totalPaise)}
              </span>
            </div>
          </div>

          <div className="text-caption text-text-muted mt-3">
            {inv.paidAt
              ? `Paid ${rupees(inv.amountPaidPaise)} on ${fmtDateTime(inv.paidAt)}.`
              : `Paid so far: ${rupees(inv.amountPaidPaise)}.`}{' '}
            GST is charged on the subscription fee and shown separately. Computer-generated invoice;
            no signature required.
          </div>
        </div>
      )}
    </Modal>
  );
}
