import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Modal } from '@/shared/ui/Modal';

import type { AffectedBooking } from '@/features/doctors/domain/entities/doctors.types';
import { useHospitalProfileQuery } from '@/features/settings/application/queries/useHospitalProfileQuery';

/** How many affected bookings to name before summarising the rest. */
const LISTED_BOOKINGS = 5;

/** Booking times in the hospital's zone (D-09); the browser's only as a fallback. */
function when(iso: string, timeZone: string | undefined): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(date);
}

interface ScheduleChangeModalProps {
  /** `null` = closed. */
  affected: readonly AffectedBooking[] | null;
  /** The list was refreshed because the bookings changed since the first preview. */
  changed?: boolean;
  isApplying: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Asks before a schedule change cancels existing bookings (refunded in full). */
export function ScheduleChangeModal({
  affected,
  changed = false,
  isApplying,
  onConfirm,
  onCancel,
}: ScheduleChangeModalProps) {
  const profile = useHospitalProfileQuery(affected !== null);
  const timeZone = profile.data?.timezone ?? undefined;
  const count = affected?.length ?? 0;
  const rest = count - LISTED_BOOKINGS;
  return (
    <Modal
      open={affected !== null}
      onClose={onCancel}
      title={count === 0 ? 'Apply this change?' : 'Cancel existing bookings?'}
      width={520}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={isApplying}>
            Keep as is
          </Button>
          <Button
            variant={count === 0 ? 'primary' : 'danger'}
            onClick={onConfirm}
            busy={isApplying}
          >
            {count === 0 ? 'Apply' : `Apply & cancel ${count} booking${count === 1 ? '' : 's'}`}
          </Button>
        </>
      }
    >
      {changed && (
        <p className="text-body bg-y-100 text-y-700 mb-3.5 flex items-start gap-2 rounded-md px-3 py-2.5">
          <Icon name="triangle-alert" size={16} className="mt-0.5 flex-none" />
          The bookings this change affects changed since you looked — someone booked or cancelled in
          the meantime. Review the updated list before applying.
        </p>
      )}
      {count === 0 ? (
        <p className="text-body text-text-body">
          No bookings are affected any more. Applying the change cancels nothing.
        </p>
      ) : (
        <>
          <p className="text-body text-text-body mb-3.5">
            This change removes time that {count} booking{count === 1 ? ' is' : 's are'} already in.
            Applying it cancels {count === 1 ? 'that booking' : 'them'} and refunds the patient
            {count === 1 ? '' : 's'} in full.
          </p>
          <ul className="divide-border-soft border-border-soft divide-y rounded-md border">
            {(affected ?? []).slice(0, LISTED_BOOKINGS).map((b) => (
              <li key={b.appointmentId} className="flex items-center gap-3 px-3.5 py-2.5">
                <span className="text-body text-text-strong flex-1 font-medium">
                  {b.patientName}
                </span>
                <span className="text-caption text-text-muted">
                  {b.tokenLabel ? `${b.tokenLabel} · ` : ''}
                  {b.bookingRef} · {when(b.scheduledStartAt, timeZone)}
                </span>
              </li>
            ))}
          </ul>
          {rest > 0 && (
            <p className="text-caption text-text-muted mt-2">
              and {rest} more booking{rest === 1 ? '' : 's'}.
            </p>
          )}
        </>
      )}
    </Modal>
  );
}
