import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Modal } from '@/shared/ui/Modal';

import type { SlotRegenerateResult } from '@/features/slots/domain/entities/slots.entities';

import { affectedBookingLine, runChangesCopy } from './slotsRuns.view';

/** Bookings named before "and N more". */
const LISTED_BOOKINGS = 8;

interface RegenerateResultModalProps {
  /** `null` = closed. */
  result: SlotRegenerateResult | null;
  timeZone: string | null;
  onClose: () => void;
  onShowRuns: () => void;
}

/**
 * What a manual regeneration did (06·Slots F4, UAT-73). Regeneration never
 * cancels bookings: a booking on a slot the rules no longer produce is kept
 * and listed here, so the desk can move or cancel it on purpose.
 */
export function RegenerateResultModal({
  result,
  timeZone,
  onClose,
  onShowRuns,
}: RegenerateResultModalProps) {
  const kept = result?.affectedBookings ?? [];
  const rest = kept.length - LISTED_BOOKINGS;
  return (
    <Modal
      open={result !== null}
      onClose={onClose}
      title="Slots regenerated"
      width={560}
      footer={
        <>
          <Button variant="secondary" onClick={onShowRuns}>
            Generation runs
          </Button>
          <Button onClick={onClose}>Done</Button>
        </>
      }
    >
      {result && (
        <div className="flex flex-col gap-3.5">
          <p className="text-body text-text-body">{runChangesCopy(result)}.</p>
          {kept.length === 0 ? (
            <p className="text-body text-text-muted flex items-center gap-2">
              <Icon name="circle-check" size={16} className="text-g-700 flex-none" /> No booking was
              left on a slot the rules no longer produce.
            </p>
          ) : (
            <>
              <p className="text-body bg-y-100 text-y-700 flex items-start gap-2 rounded-md px-3 py-2.5">
                <Icon name="triangle-alert" size={16} className="mt-0.5 flex-none" />
                {kept.length} booking{kept.length === 1 ? ' is' : 's are'} on slots the current
                rules no longer produce. They were kept, not cancelled — move or cancel{' '}
                {kept.length === 1 ? 'it' : 'them'} from Appointments if the doctor will not be in.
              </p>
              <ul className="divide-border-soft border-border-soft divide-y rounded-md border">
                {kept.slice(0, LISTED_BOOKINGS).map((b) => (
                  <li key={b.appointmentId} className="text-body text-text-body px-3.5 py-2.5">
                    {affectedBookingLine(b, timeZone)}
                  </li>
                ))}
              </ul>
              {rest > 0 && (
                <p className="text-caption text-text-muted">
                  and {rest} more booking{rest === 1 ? '' : 's'}.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
