import { cn } from '@/shared/lib/cn';
import { Icon } from '@/shared/ui/Icon';

import { useAppointmentsStore } from '@/features/appointments/application/store/appointments.store';
import { doctorLoad } from '@/features/appointments/application/store/appointments.logic';

interface DoctorCapacityHintProps {
  doctor: string;
}

/**
 * Front-desk capacity signal shown once a doctor is chosen (design
 * `Screens.jsx` `DoctorCapacityHint`) — flags over-booked or off-duty doctors.
 * The design's unused `source` prop is dropped (it had no effect).
 */
export function DoctorCapacityHint({ doctor }: DoctorCapacityHintProps) {
  // Derived from the two slices this component subscribes to, through the pure
  // `doctorLoad` rule — so the load recomputes whenever bookings or the
  // doctor's status change, with no memo to keep in step.
  const appts = useAppointmentsStore((s) => s.appts);
  const docStatus = useAppointmentsStore((s) => s.docStatus);
  const { booked, cap, status, off, full } = doctorLoad(appts, docStatus, doctor);
  const pct = Math.min(100, Math.round((booked / cap) * 100));
  const warn = off || full;
  const barColorClass = off || full ? 'bg-d-500' : pct > 75 ? 'bg-y-600' : 'bg-g-600';
  const msg = off
    ? `${doctor.split(' ').slice(-1)} is ${status === 'On Break' ? 'on a break' : status.toLowerCase()} today — avoid booking new walk-ins.`
    : full
      ? 'Doctor is fully booked for today — consider another slot or doctor.'
      : `${booked} of ${cap} slots booked today · ${cap - booked} remaining.`;
  return (
    <div
      className={cn(
        'mt-3.5 flex items-center gap-3 rounded-md px-3.5 py-3',
        warn ? 'bg-d-100' : 'bg-blue-soft-bg',
      )}
    >
      <Icon
        name={warn ? 'triangle-alert' : 'calendar-check'}
        size={18}
        className={cn('flex-none', warn ? 'text-d-500' : 'text-blue')}
      />
      <div className="min-w-0 flex-1">
        <div className={cn('text-body font-medium', warn ? 'text-d-600' : 'text-text-strong')}>
          Today's load — {doctor}
        </div>
        <div className="text-caption text-text-muted">{msg}</div>
      </div>
      {!off && (
        <div className="w-30 flex-none">
          <div className="bg-grey-300 h-2 overflow-hidden rounded-full">
            <div
              className={cn('h-full rounded-full', barColorClass)}
              style={{ width: `${pct}%` }}
            ></div>
          </div>
          <div className="text-caption text-text-muted mt-1 text-right tabular-nums">
            {booked}/{cap}
          </div>
        </div>
      )}
    </div>
  );
}
