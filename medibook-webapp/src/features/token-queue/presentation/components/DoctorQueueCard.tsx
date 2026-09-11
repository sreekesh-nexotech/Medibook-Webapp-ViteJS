import { useNow } from '@/shared/hooks/useNow';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { IconBtn } from '@/shared/ui/IconBtn';

import { useAppointmentsStore } from '@/features/appointments/application/store/appointments.store';
import { DOCTOR_META } from '@/features/appointments/application/store/appointments.types';
import type { DoctorStatus } from '@/features/appointments/application/store/appointments.types';

interface DoctorQueueCardProps {
  doctor: string;
}

/**
 * Live queue card for one doctor (design `Screens.jsx` `DoctorQueueCard` +
 * `DOC_STATUS_META`): status dot + pill, the now-serving box with elapsed
 * minutes, the up-next token chips (+N overflow) and the Done / Call Next /
 * Skip / break-toggle controls with the prototype's exact enable rules.
 */

/** Per-status dot fill (design `DOC_STATUS_META[...].fg`). */
const STATUS_DOT: Readonly<Record<DoctorStatus, string>> = {
  Consulting: 'bg-g-700',
  Waiting: 'bg-y-700',
  'On Break': 'bg-text-muted',
  Available: 'bg-blue',
};

/** Per-status pill background + text (design `DOC_STATUS_META`). */
const STATUS_PILL: Readonly<Record<DoctorStatus, string>> = {
  Consulting: 'bg-g-100 text-g-700',
  Waiting: 'bg-y-100 text-y-700',
  'On Break': 'bg-grey-300 text-text-muted',
  Available: 'bg-blue-soft-bg text-blue',
};

export function DoctorQueueCard({ doctor }: DoctorQueueCardProps) {
  const appts = useAppointmentsStore((s) => s.appts);
  const serving = useAppointmentsStore((s) => s.serving);
  const docStatus = useAppointmentsStore((s) => s.docStatus);
  const queueForDoctor = useAppointmentsStore((s) => s.queueForDoctor);
  const callNext = useAppointmentsStore((s) => s.callNext);
  const complete = useAppointmentsStore((s) => s.complete);
  const skip = useAppointmentsStore((s) => s.skip);
  const setDocStatus = useAppointmentsStore((s) => s.setDocStatus);

  const now = useNow(30000);
  const meta = DOCTOR_META[doctor];
  const status = docStatus[doctor] ?? 'Available';
  const tok = serving[doctor];
  const servingAppt = tok ? appts.find((a) => a.token === tok && a.doctor === doctor) : null;
  const elapsed =
    servingAppt && servingAppt.calledAt
      ? Math.max(0, Math.round((now - servingAppt.calledAt) / 60000))
      : null;
  const queue = queueForDoctor(doctor);
  const upNext = queue.slice(0, 3);
  const onBreak = status === 'On Break';
  const canCall = !onBreak && queue.length > 0;

  return (
    <Card pad={16} className="flex flex-col gap-2.75">
      <div className="flex items-center gap-2.5">
        <span className={cn('size-2.25 flex-none rounded-full', STATUS_DOT[status])} />
        <div className="min-w-0 flex-1">
          <div className="text-body text-text-strong truncate font-medium">{doctor}</div>
          <div className="text-caption text-text-muted">
            {meta.dept} · Room {meta.room}
          </div>
        </div>
        <span
          className={cn(
            'text-caption inline-flex flex-none rounded-full px-2.5 py-0.75 font-semibold',
            STATUS_PILL[status],
          )}
        >
          {status}
        </span>
      </div>

      <div
        className={cn(
          'flex min-h-13.5 items-center gap-3.5 rounded-md px-3.5 py-2.25',
          servingAppt ? 'bg-blue-soft-bg' : 'bg-grey-200',
        )}
      >
        {servingAppt ? (
          <>
            <span className="text-stat text-blue flex-none leading-none font-extrabold">{tok}</span>
            <div className="min-w-0 flex-1">
              <div className="text-caption text-text-muted">Now serving</div>
              <div className="text-body text-text-strong truncate font-medium">
                {servingAppt.name}
              </div>
            </div>
            <span
              className={cn(
                'text-caption flex-none font-semibold',
                elapsed != null && elapsed > 20 ? 'text-d-500' : 'text-text-muted',
              )}
            >
              {elapsed == null ? '' : elapsed === 0 ? 'just now' : `${elapsed} min`}
            </span>
          </>
        ) : (
          <span className="text-body text-text-muted">
            {onBreak ? 'On a break' : queue.length ? 'Ready to call next' : 'No patients waiting'}
          </span>
        )}
      </div>

      <div className="flex min-h-6 items-center gap-2">
        <span className="text-caption text-text-muted flex-none">Up next</span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {upNext.length === 0 ? (
            <span className="text-caption text-text-muted">nobody yet</span>
          ) : (
            upNext.map((a) => (
              <span
                key={a.id}
                title={a.name}
                className="text-caption text-blue bg-blue-soft-bg rounded-full px-2.25 py-0.5 font-semibold"
              >
                {a.token}
              </span>
            ))
          )}
          {queue.length > 3 && (
            <span className="text-caption text-text-muted">{`+${queue.length - 3}`}</span>
          )}
        </div>
        <span
          className={cn(
            'text-caption flex-none font-semibold',
            queue.length ? 'text-text-strong' : 'text-text-muted',
          )}
        >
          {queue.length} waiting
        </span>
      </div>

      <div className="flex items-center gap-2">
        {servingAppt ? (
          <>
            <Button
              size="sm"
              variant="success"
              icon="check"
              className="flex-1"
              onClick={() => complete(doctor)}
            >
              Done
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="flex-1"
              disabled={queue.length === 0}
              onClick={() => callNext(doctor)}
            >
              Call Next
            </Button>
            <IconBtn
              name="skip-forward"
              label="Skip — move to end of queue"
              box={34}
              size={15}
              onClick={() => skip(doctor)}
            />
          </>
        ) : (
          <Button size="sm" className="flex-1" disabled={!canCall} onClick={() => callNext(doctor)}>
            Call Next
          </Button>
        )}
        <IconBtn
          name={onBreak ? 'play' : 'pause'}
          label="Pause or resume doctor"
          title={onBreak ? 'Resume' : 'Take a break'}
          box={34}
          size={15}
          color={onBreak ? 'var(--color-g-600)' : undefined}
          onClick={() => setDocStatus(doctor, onBreak ? 'Available' : 'On Break')}
        />
      </div>
    </Card>
  );
}
