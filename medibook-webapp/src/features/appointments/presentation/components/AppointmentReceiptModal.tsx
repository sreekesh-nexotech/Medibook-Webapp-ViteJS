import { useHospitalTimeZone } from '@/shared/hooks/useHospitalTime';
import { usePrintArea } from '@/shared/hooks/usePrintArea';
import { cn } from '@/shared/lib/cn';
import { downloadFromUrl } from '@/shared/lib/download';
import { money } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Modal } from '@/shared/ui/Modal';
import { Spinner } from '@/shared/ui/Spinner';
import { toast } from '@/shared/ui/toast/toast.store';

import { isFailure } from '@/core/error/failure';

import type { DeskReceipt } from '@/features/appointments/domain/entities/appointments.entities';
import { useReceiptPdfMutation } from '@/features/appointments/application/queries/appointments.mutations';
import { useReceiptQuery } from '@/features/appointments/application/queries/appointments.queries';
import {
  dateTimeOf,
  methodLabel,
} from '@/features/appointments/presentation/components/appointments.view';

/** Receipt table cell classes (the design's `rcTh` / `rcTd`). */
const rcTh =
  'border-border text-text-muted text-caption border-b px-2 py-2.5 uppercase tracking-[.05em]';
const rcTd = 'border-border-soft text-text-body border-b px-2 py-3';

/** The backend renders receipt PDFs only where its PDF libraries are installed. */
const NOT_IMPLEMENTED_STATUS = 501;

interface AppointmentReceiptModalProps {
  /** Appointment whose receipt to show; `null` = closed. */
  appointmentId: string | null;
  onClose: () => void;
}

/**
 * The issued tax receipt of a paid appointment, exactly as the backend
 * recorded it: its series number, every line with its own tax, how it was
 * paid and the hospital's GSTIN. "Save as PDF" prints this view; "Download
 * PDF" fetches the hospital's rendered PDF when the server has one.
 */
export function AppointmentReceiptModal({ appointmentId, onClose }: AppointmentReceiptModalProps) {
  const receipt = useReceiptQuery(appointmentId);
  const timeZone = useHospitalTimeZone();
  const pdf = useReceiptPdfMutation();
  const { ref, print } = usePrintArea<HTMLDivElement>();

  const downloadPdf = (): void => {
    if (!appointmentId) return;
    pdf.mutate(appointmentId, {
      onSuccess: (url) => downloadFromUrl(url),
      onError: (failure) =>
        toast(
          isFailure(failure) && failure.status === NOT_IMPLEMENTED_STATUS
            ? 'The server cannot render PDFs yet — use Save as PDF.'
            : isFailure(failure)
              ? failure.message
              : 'Could not download the receipt.',
          'error',
        ),
    });
  };

  return (
    <Modal
      open={appointmentId !== null}
      onClose={onClose}
      title="Receipt"
      width={640}
      footer={
        <>
          <Button
            variant="secondary"
            icon="download"
            onClick={downloadPdf}
            busy={pdf.isPending}
            disabled={!receipt.data}
          >
            Download PDF
          </Button>
          <Button variant="secondary" icon="printer" onClick={print} disabled={!receipt.data}>
            Save as PDF
          </Button>
          <Button variant="info" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      {receipt.isPending ? (
        <div className="text-text-muted flex justify-center py-10">
          <Spinner size={28} label="Loading the receipt" />
        </div>
      ) : receipt.isError ? (
        <ErrorState
          inline
          title="Could not load the receipt"
          message={isFailure(receipt.error) ? receipt.error.message : undefined}
          onRetry={() => void receipt.refetch()}
        />
      ) : (
        <div ref={ref}>
          <ReceiptBody receipt={receipt.data} timeZone={timeZone} />
        </div>
      )}
    </Modal>
  );
}

function ReceiptBody({ receipt, timeZone }: { receipt: DeskReceipt; timeZone: string }) {
  return (
    <div className="border-border overflow-hidden rounded-lg border">
      <div className="bg-bg-tint p-4.5">
        <div className="text-h3 text-text-navy">{receipt.hospitalName}</div>
        <div className="text-caption text-text-muted">Tax Receipt</div>
        {receipt.hospitalGstin && (
          <div className="text-caption text-text-muted">GSTIN {receipt.hospitalGstin}</div>
        )}
      </div>
      <div className="p-4.5">
        <div className="text-body mb-4 grid grid-cols-2 gap-x-4 gap-y-1.5">
          <span className="text-text-muted">Receipt No.</span>
          <span className="text-text-strong text-right font-medium tabular-nums">
            {receipt.receiptNo}
          </span>
          <span className="text-text-muted">Issued</span>
          <span className="text-text-strong text-right font-medium">
            {dateTimeOf(receipt.issuedAt, timeZone)}
          </span>
          {receipt.issuedByName && (
            <>
              <span className="text-text-muted">Issued by</span>
              <span className="text-text-strong text-right font-medium">
                {receipt.issuedByName}
                {receipt.counterCode ? ` · ${receipt.counterCode}` : ''}
              </span>
            </>
          )}
        </div>
        <div className="overflow-x-auto" role="region" aria-label="Receipt lines" tabIndex={0}>
          <table className="text-body w-full border-collapse">
            <thead>
              <tr>
                <th className={cn(rcTh, 'text-left')}>Item</th>
                <th className={cn(rcTh, 'text-right')}>Amount</th>
                <th className={cn(rcTh, 'text-right')}>Tax</th>
              </tr>
            </thead>
            <tbody>
              {receipt.lines.map((l, i) => (
                <tr key={`${l.bookingRef}-${l.description}-${i}`}>
                  <td className={rcTd}>
                    {l.description}
                    <span className="text-caption text-text-muted block">{l.bookingRef}</span>
                  </td>
                  <td className={cn(rcTd, 'text-right tabular-nums')}>{money(l.amountRupees)}</td>
                  <td className={cn(rcTd, 'text-right tabular-nums')}>
                    {l.taxRatePercent === 0
                      ? '—'
                      : `${l.taxInclusive ? 'incl.' : money(l.taxRupees)} · ${l.taxRatePercent}%`}
                  </td>
                </tr>
              ))}
              <tr>
                <td className={cn(rcTd, 'text-text-strong font-semibold')}>Total</td>
                <td
                  colSpan={2}
                  className={cn(rcTd, 'text-g-700 text-right font-bold tabular-nums')}
                >
                  {money(receipt.totalRupees)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="text-caption text-text-muted mt-3.5">
          Paid by{' '}
          {receipt.payments
            .map(
              (p) =>
                `${methodLabel(p.method)} ${money(p.amountRupees)}${p.reference ? ` (${p.reference})` : ''}`,
            )
            .join(' + ') || '—'}
          . This is a computer-generated receipt.
        </div>
      </div>
    </div>
  );
}
