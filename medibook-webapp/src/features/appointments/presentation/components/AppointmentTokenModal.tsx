import { usePrintArea } from '@/shared/hooks/usePrintArea';
import { Button } from '@/shared/ui/Button';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Modal } from '@/shared/ui/Modal';
import { Spinner } from '@/shared/ui/Spinner';

import { isFailure } from '@/core/error/failure';

import { useTokenSlipQuery } from '@/features/appointments/application/queries/appointments.queries';
import { dayOf, timeOf } from '@/features/appointments/presentation/components/appointments.view';

interface AppointmentTokenModalProps {
  /** Appointment whose token slip to print; `null` = closed. */
  appointmentId: string | null;
  onClose: () => void;
}

/**
 * The queue token slip as the backend prints it (`/token-slip`): only
 * human-readable numbers, never an id (Q43). "Save as PDF" prints this slip.
 */
export function AppointmentTokenModal({ appointmentId, onClose }: AppointmentTokenModalProps) {
  const slip = useTokenSlipQuery(appointmentId);
  const { ref, print } = usePrintArea<HTMLDivElement>();

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
      ) : slip.isLoadingError ? (
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
              `${dayOf(slip.data.scheduledStartAt)} · ${timeOf(slip.data.scheduledStartAt)}`,
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
