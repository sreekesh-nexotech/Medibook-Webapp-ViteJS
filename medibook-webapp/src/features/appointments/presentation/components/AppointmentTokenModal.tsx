import { useHospitalTimeZone } from '@/shared/hooks/useHospitalTime';
import { usePrintArea } from '@/shared/hooks/usePrintArea';
import { downloadFromUrl } from '@/shared/lib/download';
import { Button } from '@/shared/ui/Button';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Modal } from '@/shared/ui/Modal';
import { Spinner } from '@/shared/ui/Spinner';
import { toast } from '@/shared/ui/toast/toast.store';

import { isFailure } from '@/core/error/failure';

import { useTokenSlipPdfMutation } from '@/features/appointments/application/queries/appointments.mutations';
import { useTokenSlipQuery } from '@/features/appointments/application/queries/appointments.queries';
import { dayOf, timeOf } from '@/features/appointments/presentation/components/appointments.view';

/** The backend renders PDFs only where its PDF libraries are installed. */
const NOT_IMPLEMENTED_STATUS = 501;

/** Revoking an object URL in the same tick can cancel the download. */
const REVOKE_DELAY_MS = 10_000;

interface AppointmentTokenModalProps {
  /** Appointment whose token slip to print; `null` = closed. */
  appointmentId: string | null;
  onClose: () => void;
}

/**
 * The queue token slip as the backend prints it (`/token-slip`): only
 * human-readable numbers, never an id (Q43). "Download PDF" fetches the slip
 * the backend renders (`/token-slip.pdf`); "Save as PDF" prints this view.
 */
export function AppointmentTokenModal({ appointmentId, onClose }: AppointmentTokenModalProps) {
  const slip = useTokenSlipQuery(appointmentId);
  const timeZone = useHospitalTimeZone();
  const { ref, print } = usePrintArea<HTMLDivElement>();
  const pdf = useTokenSlipPdfMutation();

  const downloadPdf = (): void => {
    if (!appointmentId || !slip.data) return;
    const filename = `token-${slip.data.tokenLabel}.pdf`;
    pdf.mutate(appointmentId, {
      onSuccess: (blob) => {
        const url = URL.createObjectURL(blob);
        downloadFromUrl(url, filename);
        setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
      },
      onError: (failure) =>
        toast(
          isFailure(failure) && failure.status === NOT_IMPLEMENTED_STATUS
            ? 'The server cannot render PDFs yet — use Save as PDF.'
            : isFailure(failure)
              ? failure.message
              : 'Could not download the token slip.',
          'error',
        ),
    });
  };

  const row = (k: string, v: string) => (
    <div className="flex justify-between gap-3">
      <span className="text-text-muted">{k}</span>
      <span className="text-right">{v}</span>
    </div>
  );

  return (
    <Modal
      open={appointmentId !== null}
      onClose={onClose}
      title="Token Slip"
      width={380}
      footer={
        <>
          <Button
            variant="secondary"
            icon="download"
            onClick={downloadPdf}
            busy={pdf.isPending}
            disabled={!slip.data}
          >
            Download PDF
          </Button>
          <Button variant="secondary" icon="printer" onClick={print} disabled={!slip.data}>
            Save as PDF
          </Button>
          <Button variant="info" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      {slip.isPending ? (
        <div className="text-text-muted flex justify-center py-10">
          <Spinner size={28} label="Loading the token slip" />
        </div>
      ) : slip.isError ? (
        <ErrorState
          inline
          title="No token slip"
          message={isFailure(slip.error) ? slip.error.message : undefined}
          onRetry={() => void slip.refetch()}
        />
      ) : (
        <div
          ref={ref}
          className="border-border mx-auto w-65 rounded-lg border border-dashed bg-white p-5 text-center"
        >
          <div className="text-caption text-text-navy font-bold">{slip.data.hospitalName}</div>
          <div className="text-caption text-text-muted mb-3">Queue Token</div>
          <div className="text-display text-blue">{slip.data.tokenLabel}</div>
          <div className="bg-border-soft my-3.5 h-px" />
          <div className="text-body text-text-body flex flex-col gap-1.25 text-left">
            {row('Patient', slip.data.patientName)}
            {row('MR Number', slip.data.mrn)}
            {row('Doctor', slip.data.doctorName)}
            {row('Dept', slip.data.departmentName)}
            {slip.data.doctorRoom ? row('Room', slip.data.doctorRoom) : null}
            {row(
              'Time',
              `${dayOf(slip.data.scheduledStartAt, timeZone)} · ${timeOf(slip.data.scheduledStartAt, timeZone)}`,
            )}
            {row('Booking', slip.data.bookingRef)}
          </div>
          <div className="text-caption text-text-muted mt-3.5">
            Please wait for your token to be called.
          </div>
        </div>
      )}
    </Modal>
  );
}
