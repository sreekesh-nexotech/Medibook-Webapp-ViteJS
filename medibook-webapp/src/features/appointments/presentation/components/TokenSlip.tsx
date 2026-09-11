import { usePrintArea } from '@/shared/hooks/usePrintArea';
import { Button } from '@/shared/ui/Button';

import { HOSPITAL_NAME } from '@/features/appointments/application/store/appointments.logic';
import type { Appointment } from '@/features/appointments/application/store/appointments.types';

interface TokenSlipProps {
  appt: Appointment;
  /**
   * Render the slip's own "Save as PDF" action beneath it, so one slip can be
   * printed without the whole receipt (HA-10). The action sits outside the
   * printed node, so it never appears on the paper.
   */
  printable?: boolean;
}

/**
 * Printable queue-token slip (design `Flows.jsx` `TokenSlip`).
 *
 * The slip prints through `usePrintArea`, which isolates exactly this node —
 * the old bare `window.print()` printed whichever `.print-area` happened to be
 * in the document. The control says "Save as PDF" because it opens the
 * browser's print dialog rather than writing a file.
 */
export function TokenSlip({ appt, printable = false }: TokenSlipProps) {
  const { ref, print } = usePrintArea<HTMLDivElement>();
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        ref={ref}
        className="border-border mx-auto w-65 rounded-lg border border-dashed bg-white p-5 text-center"
      >
        <div className="text-text-navy text-[13px] font-bold tracking-[.04em]">{HOSPITAL_NAME}</div>
        <div className="text-caption text-text-muted mb-3">Queue Token</div>
        <div className="text-blue text-[52px] leading-none font-extrabold">{appt.token ?? '—'}</div>
        <div className="bg-border-soft my-3.5 h-px"></div>
        <div className="text-body text-text-body flex flex-col gap-1.25">
          <div className="flex justify-between">
            <span className="text-text-muted">Patient</span>
            <b>{appt.name}</b>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Doctor</span>
            <span>{appt.doctor}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Dept</span>
            <span>{appt.dept}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Time</span>
            <span>
              {appt.date} · {appt.time}
            </span>
          </div>
          {appt.receiptNo && (
            <div className="flex justify-between">
              <span className="text-text-muted">Receipt</span>
              <span className="tabular-nums">{appt.receiptNo}</span>
            </div>
          )}
        </div>
        <div className="text-caption text-text-muted mt-3.5">
          Please wait for your token to be called.
        </div>
      </div>
      {printable && (
        <Button variant="ghost" size="sm" icon="printer" onClick={print}>
          Save token as PDF
        </Button>
      )}
    </div>
  );
}
