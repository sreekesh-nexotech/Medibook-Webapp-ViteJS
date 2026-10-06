import { Button } from '@/shared/ui/Button';
import { formatInstant } from '@/shared/lib/format';
import { Modal } from '@/shared/ui/Modal';

import type { AffectedBooking } from '@/features/doctors/domain/entities/doctors.types';

/** How many affected bookings to name before summarising the rest. */
const LISTED_BOOKINGS = 5;

const DATE_TIME_FORMAT: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' };

function when(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : formatInstant(date, DATE_TIME_FORMAT);
}

interface ScheduleChangeModalProps {
  /** `null` = closed. */
  affected: readonly AffectedBooking[] | null;
  isApplying: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Asks before a schedule change cancels existing bookings (refunded in full). */
export function ScheduleChangeModal({
  affected,
  isApplying,
  onConfirm,
  onCancel,
}: ScheduleChangeModalProps) {
  const count = affected?.length ?? 0;
  const rest = count - LISTED_BOOKINGS;
  return (
    <Modal
      open={affected !== null}
      onClose={onCancel}
      title="Cancel existing bookings?"
      width={520}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={isApplying}>
            Keep as is
          </Button>
          <Button variant="danger" onClick={onConfirm} busy={isApplying}>
            Apply & cancel {count} booking{count === 1 ? '' : 's'}
          </Button>
        </>
      }
    >
      <p className="text-body text-text-body mb-3.5">
        This change removes time that {count} booking{count === 1 ? ' is' : 's are'} already in.
        Applying it cancels {count === 1 ? 'that booking' : 'them'} and refunds the patient
        {count === 1 ? '' : 's'} in full.
      </p>
      <ul className="divide-border-soft border-border-soft divide-y rounded-md border">
        {(affected ?? []).slice(0, LISTED_BOOKINGS).map((b) => (
          <li key={b.appointmentId} className="flex items-center gap-3 px-3.5 py-2.5">
            <span className="text-body text-text-strong flex-1 font-medium">{b.patientName}</span>
            <span className="text-caption text-text-muted">
              {b.bookingRef} · {when(b.scheduledStartAt)}
            </span>
          </li>
        ))}
      </ul>
      {rest > 0 && (
        <p className="text-caption text-text-muted mt-2">
          and {rest} more booking{rest === 1 ? '' : 's'}.
        </p>
      )}
    </Modal>
  );
}
