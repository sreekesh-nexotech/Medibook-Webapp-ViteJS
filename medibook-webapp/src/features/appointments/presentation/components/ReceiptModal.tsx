import type { ReactNode } from 'react';

import { usePrintArea } from '@/shared/hooks/usePrintArea';
import { cn } from '@/shared/lib/cn';
import { downloadCsv, type CsvCell } from '@/shared/lib/download';
import { money } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { toast } from '@/shared/ui/toast/toast.store';

import {
  GST_LABEL,
  HOSPITAL_GSTIN,
  HOSPITAL_LOGO_SRC,
  HOSPITAL_NAME,
  taxBreakdown,
} from '@/features/appointments/application/store/appointments.logic';
import type { Appointment } from '@/features/appointments/application/store/appointments.types';
import { TokenSlip } from '@/features/appointments/presentation/components/TokenSlip';

/**
 * Receipt table cell classes — the design's `rcTh`/`rcTd`. The `py-*` here
 * deliberately overrides the global 22px "Comfy" density: these compact
 * receipt sub-tables want tight rows (utilities layer wins over base).
 */
const rcTh =
  'border-border text-text-muted text-caption border-b px-2 py-2.5 uppercase tracking-[.05em]';
const rcTd = 'border-border-soft text-text-body border-b px-2 py-3';

function Kv({ k, v }: { k: ReactNode; v: ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-text-muted">{k}</span>
      <span className="text-text-strong text-right font-medium">{v}</span>
    </div>
  );
}

interface ReceiptModalProps {
  appt: Appointment | null;
  onClose: () => void;
}

/**
 * Printable GST payment receipt + token slip (design `Flows.jsx`
 * `ReceiptModal`), with the three things HA-10 found missing: a real
 * financial-year receipt series, tax shown on its own line rather than baked
 * into the fee, and the hospital's GSTIN. "Save as PDF" prints exactly this
 * receipt through `usePrintArea`; "Download CSV" writes a real file.
 */
export function ReceiptModal({ appt, onClose }: ReceiptModalProps) {
  const { ref, print } = usePrintArea<HTMLDivElement>();
  if (!appt) return null;

  const tax = taxBreakdown(appt.amount);
  const receiptNo = appt.receiptNo ?? '—';
  const refunded = appt.payment === 'Refunded';
  const refundAmount = appt.refundAmount ?? 0;
  const netPaid = refunded ? Math.max(0, tax.total - refundAmount) : tax.total;

  const exportCsv = (): void => {
    const filename = `medibook-receipt-${appt.mrn}.csv`;
    const rows: CsvCell[][] = [
      ['Receipt No.', 'Date', 'Patient', 'MR Number', 'Doctor', 'Department', 'Line', 'Amount'],
      [
        receiptNo,
        `${appt.date} ${appt.time}`,
        appt.name,
        appt.mrn,
        appt.doctor,
        appt.dept,
        'Consultation',
        tax.subtotal,
      ],
      [receiptNo, '', '', '', '', '', GST_LABEL, tax.gst],
      [receiptNo, '', '', '', '', '', 'Total', tax.total],
    ];
    if (refunded) rows.push([receiptNo, '', '', '', '', '', 'Refunded', -refundAmount]);
    rows.push(['', '', '', '', '', '', 'Hospital GSTIN', HOSPITAL_GSTIN]);
    downloadCsv(filename, rows);
    toast(`Exported ${filename}`, 'success');
  };

  return (
    <Modal
      open={!!appt}
      onClose={onClose}
      title="Receipt & Token"
      width={820}
      footer={
        <>
          <Button variant="secondary" icon="download" onClick={exportCsv}>
            Download CSV
          </Button>
          <Button variant="secondary" icon="printer" onClick={print}>
            Save as PDF
          </Button>
          <Button variant="info" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      <div className="flex items-stretch gap-6">
        {/* receipt */}
        <div ref={ref} className="border-border flex-[1.4] overflow-hidden rounded-lg border">
          <div className="bg-bg-tint flex items-center justify-between p-4.5">
            <div className="flex items-center gap-2.5">
              <img src={HOSPITAL_LOGO_SRC} className="size-8.5" alt={`${HOSPITAL_NAME} logo`} />
              <div>
                <div className="text-h3 text-text-navy">{HOSPITAL_NAME}</div>
                <div className="text-caption text-text-muted">
                  {appt.source === 'Online'
                    ? 'Tax Receipt · Prepaid via Medibook'
                    : 'Tax Receipt · Collected at Desk'}
                </div>
                <div className="text-caption text-text-muted">GSTIN {HOSPITAL_GSTIN}</div>
              </div>
            </div>
            <Badge status={appt.payment} />
          </div>
          <div className="p-4.5">
            <div className="text-body mb-4 grid grid-cols-2 gap-x-4 gap-y-1.5">
              <Kv k="Receipt No." v={<span className="tabular-nums">{receiptNo}</span>} />
              <Kv k="Date" v={`${appt.date}, ${appt.time}`} />
              <Kv k="Patient" v={appt.name} />
              <Kv k="MR Number" v={appt.mrn} />
              <Kv k="Payment Mode" v={appt.payMode || 'Cash'} />
              <Kv k="Reference" v={appt.payRef || '—'} />
            </div>
            <div className="overflow-x-auto" role="region" aria-label="Receipt lines" tabIndex={0}>
              <table className="text-body w-full border-collapse">
                <thead>
                  <tr>
                    <th className={cn(rcTh, 'text-left')}>Service</th>
                    <th className={cn(rcTh, 'text-right')}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className={rcTd}>
                      Consultation — {appt.doctor} ({appt.dept})
                    </td>
                    <td className={cn(rcTd, 'text-right tabular-nums')}>{money(tax.subtotal)}</td>
                  </tr>
                  <tr>
                    <td className={rcTd}>{GST_LABEL}</td>
                    <td className={cn(rcTd, 'text-right tabular-nums')}>{money(tax.gst)}</td>
                  </tr>
                  <tr>
                    <td className={cn(rcTd, 'text-text-strong font-semibold')}>
                      {refunded ? 'Total' : 'Total Paid'}
                    </td>
                    <td className={cn(rcTd, 'text-g-700 text-right font-bold tabular-nums')}>
                      {money(tax.total)}
                    </td>
                  </tr>
                  {refunded && (
                    <>
                      <tr>
                        <td className={rcTd}>
                          Refund {appt.refundVia === 'Medibook' ? '(via Medibook)' : '(at desk)'}
                          {appt.refundReason ? ` — ${appt.refundReason}` : ''}
                        </td>
                        <td className={cn(rcTd, 'text-d-500 text-right tabular-nums')}>
                          −{money(refundAmount)}
                        </td>
                      </tr>
                      <tr>
                        <td className={cn(rcTd, 'text-text-strong border-none font-semibold')}>
                          Net Retained
                        </td>
                        <td
                          className={cn(
                            rcTd,
                            'text-text-strong border-none text-right font-bold tabular-nums',
                          )}
                        >
                          {money(netPaid)}
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
            {appt.payment === 'Waived' && (
              <div className="text-caption text-y-700 bg-y-100 mt-3 rounded-md px-3 py-2.25">
                Fee waived{appt.waiveReason ? ` — ${appt.waiveReason}` : ''}. No amount was
                collected.
              </div>
            )}
            <div className="text-caption text-text-muted mt-3.5 leading-[1.6]">
              {appt.source === 'Online'
                ? 'Booked & prepaid through the Medibook app. This is a computer-generated receipt.'
                : 'Payment collected at the hospital desk and recorded in Medibook. This is a computer-generated receipt.'}
            </div>
          </div>
        </div>
        {/* token */}
        <div className="flex flex-1 items-center">
          <TokenSlip appt={appt} printable />
        </div>
      </div>
    </Modal>
  );
}
