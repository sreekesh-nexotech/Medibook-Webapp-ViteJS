import { useState } from 'react';

import { useCan } from '@/shared/hooks/usePermission';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import { Can } from '@/shared/ui/Can';
import { Card } from '@/shared/ui/Card';
import { ConfirmModal } from '@/shared/ui/ConfirmModal';
import { IconBtn } from '@/shared/ui/IconBtn';
import { toast } from '@/shared/ui/toast/toast.store';

import { isFailure } from '@/core/error/failure';

import type { DeskAppointment } from '@/features/appointments/domain/entities/appointments.entities';
import type {
  QueueSession,
  TokenCommand,
} from '@/features/token-queue/domain/entities/tokenQueue.entities';
import {
  useSessionCommandMutation,
  useSkipTokenMutation,
  useTokenCommandMutation,
} from '@/features/token-queue/application/queries/tokenQueue.mutations';

import { TokenChip } from './TokenChip';
import {
  isServing,
  minutesSince,
  pillFor,
  skippedFor,
  upNextFor,
  type QueuePill,
} from './tokenQueue.view';

/** Up-next chips shown before collapsing into "+N". */
const UP_NEXT_CHIPS = 3;

/** Per-status dot fill (design `DOC_STATUS_META[...].fg`). */
const STATUS_DOT: Readonly<Record<QueuePill, string>> = {
  Consulting: 'bg-g-700',
  Waiting: 'bg-y-700',
  'On Break': 'bg-text-muted',
  Available: 'bg-blue',
  'Not opened': 'bg-grey-300',
  Closed: 'bg-grey-300',
};

/** Per-status pill background + text (design `DOC_STATUS_META`). */
const STATUS_PILL: Readonly<Record<QueuePill, string>> = {
  Consulting: 'bg-g-100 text-g-800',
  Waiting: 'bg-y-100 text-y-700',
  'On Break': 'bg-grey-300 text-text-muted',
  Available: 'bg-blue-soft-bg text-blue',
  'Not opened': 'bg-grey-200 text-text-muted',
  Closed: 'bg-grey-200 text-text-muted',
};

function failureText(error: unknown, fallback: string): string {
  return isFailure(error) ? error.message : fallback;
}

interface DoctorQueueCardProps {
  session: QueueSession;
  doctorName: string;
  departmentName: string;
  room: string | null;
  /** Today's appointments (H7) — the source of patient names and up-next tokens. */
  appointments: readonly DeskAppointment[];
  /** Clock for the elapsed timers (re-renders every 30 s). */
  now: number;
  /** Expected consultation length; a call open longer than this is flagged. */
  expectedMinutes: number;
}

/**
 * Live queue card for one doctor session (design `DoctorQueueCard`): status
 * pill, the now-serving box with elapsed minutes, the up-next token chips and
 * the desk controls — Open, Call Next, Start, Done, Skip (offering a no-show
 * after the hospital's attempt limit), Pause / Resume and Close. Every
 * control is a backend session command; the card re-renders from the
 * snapshot the command (or the live socket) returns.
 */
export function DoctorQueueCard({
  session,
  doctorName,
  departmentName,
  room,
  appointments,
  now,
  expectedMinutes,
}: DoctorQueueCardProps) {
  const canRunQueue = useCan('Token Management.edit');
  const sessionCommand = useSessionCommandMutation();
  const tokenCommand = useTokenCommandMutation();
  const skip = useSkipTokenMutation();
  const [offerNoShow, setOfferNoShow] = useState<number | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);

  const pill = pillFor(session);
  const serving = isServing(session);
  const servingAppt = appointments.find((a) => a.id === session.currentAppointmentId) ?? null;
  const tokenLabel = servingAppt?.tokenLabel ?? (serving ? `#${session.currentTokenNo}` : null);
  const elapsed = serving ? minutesSince(session.lastCalledAt, now) : null;
  const queue = upNextFor(session, appointments);
  const upNext = queue.slice(0, UP_NEXT_CHIPS);
  const skipped = skippedFor(session, appointments);
  const isOpen = session.status === 'open';
  const isPaused = session.status === 'paused';
  const isLive = isOpen || isPaused;
  const busy = sessionCommand.isPending || tokenCommand.isPending || skip.isPending;
  const canCall = isOpen && session.waitingCount > 0 && session.queueState !== 'consulting';
  // A specific token can be called (Q24) when the desk is free: open, nobody
  // with the doctor and nobody already called.
  const canCallToken = canRunQueue && isOpen && !serving && !busy;

  const onError = (fallback: string) => (error: unknown) =>
    toast(failureText(error, fallback), 'error', error);

  const runSession = (command: 'open' | 'call-next' | 'pause' | 'resume' | 'close') =>
    sessionCommand.mutate(
      { sessionId: session.id, command },
      { onError: onError('The queue did not accept that.') },
    );

  const runToken = (command: TokenCommand, tokenNo: number) =>
    tokenCommand.mutate(
      { sessionId: session.id, command, tokenNo },
      { onError: onError('The queue did not accept that.') },
    );

  const skipCurrent = (): void => {
    const tokenNo = session.currentTokenNo;
    if (tokenNo === null) return;
    skip.mutate(
      { sessionId: session.id, tokenNo },
      {
        onSuccess: (outcome) => {
          if (outcome.offerNoShow) setOfferNoShow(tokenNo);
          else toast(`Skipped — attempt ${outcome.attempts}`, 'info');
        },
        onError: onError('Could not skip the token.'),
      },
    );
  };

  return (
    <Card pad={16} className="flex flex-col gap-2.75">
      <div className="flex items-center gap-2.5">
        <span className={cn('size-2.25 flex-none rounded-full', STATUS_DOT[pill])} />
        <div className="min-w-0 flex-1">
          <div className="text-body text-text-strong truncate font-medium">
            {doctorName} · {session.label}
          </div>
          <div className="text-caption text-text-muted">
            {departmentName || '—'} · Room {room || '—'}
          </div>
        </div>
        <span
          className={cn(
            'text-caption inline-flex flex-none rounded-full px-2.5 py-0.75 font-semibold',
            STATUS_PILL[pill],
          )}
        >
          {pill}
        </span>
      </div>

      <div
        className={cn(
          'flex min-h-13.5 items-center gap-3.5 rounded-md px-3.5 py-2.25',
          serving ? 'bg-blue-soft-bg' : 'bg-grey-200',
        )}
      >
        {serving ? (
          <>
            <span className="text-stat text-blue flex-none leading-none font-extrabold">
              {tokenLabel}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-caption text-text-muted">
                {session.queueState === 'consulting' ? 'In consultation' : 'Called'}
              </div>
              <div className="text-body text-text-strong truncate font-medium">
                {servingAppt?.patient?.fullName ?? '—'}
              </div>
            </div>
            <span
              className={cn(
                'text-caption flex-none font-semibold',
                elapsed != null && elapsed > expectedMinutes ? 'text-d-600' : 'text-text-muted',
              )}
            >
              {elapsed == null ? '' : elapsed === 0 ? 'just now' : `${elapsed} min`}
            </span>
          </>
        ) : (
          <span className="text-body text-text-muted">
            {session.status === 'scheduled'
              ? 'Open the session to start calling'
              : !isLive
                ? 'Session closed'
                : isPaused
                  ? 'On a break'
                  : session.waitingCount
                    ? 'Ready to call next'
                    : 'No patients waiting'}
          </span>
        )}
      </div>

      <div className="flex min-h-6 items-center gap-2">
        <span className="text-caption text-text-muted flex-none" title="Next by booking order">
          Up next
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {upNext.length === 0 ? (
            <span className="text-caption text-text-muted">nobody yet</span>
          ) : (
            upNext.map((a) => (
              <TokenChip
                key={a.id}
                label={a.tokenLabel ?? '—'}
                patientName={a.patient?.fullName ?? null}
                onCall={
                  canCallToken && a.tokenNo !== null
                    ? () => runToken('call', a.tokenNo ?? 0)
                    : undefined
                }
              />
            ))
          )}
          {queue.length > UP_NEXT_CHIPS && (
            <span className="text-caption text-text-muted">{`+${queue.length - UP_NEXT_CHIPS}`}</span>
          )}
        </div>
        <span
          className={cn(
            'text-caption flex-none font-semibold',
            session.waitingCount ? 'text-text-strong' : 'text-text-muted',
          )}
        >
          {session.waitingCount} waiting
        </span>
      </div>

      {skipped.length > 0 && (
        <div className="flex min-h-6 items-center gap-2">
          <span
            className="text-caption text-text-muted flex-none"
            title="Called earlier and skipped — Call Next passes them by"
          >
            Skipped
          </span>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {skipped.map((a) => (
              <TokenChip
                key={a.id}
                label={a.tokenLabel ?? '—'}
                patientName={a.patient?.fullName ?? null}
                muted
                onCall={
                  canCallToken && a.tokenNo !== null
                    ? () => runToken('call', a.tokenNo ?? 0)
                    : undefined
                }
              />
            ))}
          </div>
        </div>
      )}

      <Can
        perm="Token Management.edit"
        disableInstead
        disabledTitle="Your role cannot run the queue"
      >
        <div className="flex w-full items-center gap-2">
          {session.status === 'scheduled' ? (
            <Button size="sm" className="flex-1" busy={busy} onClick={() => runSession('open')}>
              Open session
            </Button>
          ) : !isLive ? (
            <span className="text-caption text-text-muted flex-1">
              {session.completedCount} seen · {session.noShowCount} no-show
            </span>
          ) : serving && session.currentTokenNo !== null ? (
            <>
              {session.queueState === 'waiting' && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1"
                  disabled={busy}
                  onClick={() => runToken('serve', session.currentTokenNo ?? 0)}
                >
                  Start
                </Button>
              )}
              <Button
                size="sm"
                variant="success"
                icon="check"
                className="flex-1"
                disabled={busy}
                onClick={() => runToken('complete', session.currentTokenNo ?? 0)}
              >
                Done
              </Button>
              {session.queueState === 'waiting' && (
                <IconBtn
                  name="megaphone"
                  label="Recall — call this token again"
                  box={34}
                  size={15}
                  onClick={() => runToken('recall', session.currentTokenNo ?? 0)}
                />
              )}
              {session.queueState === 'waiting' && (
                <IconBtn
                  name="skip-forward"
                  label="Skip — call again later"
                  box={34}
                  size={15}
                  onClick={skipCurrent}
                />
              )}
            </>
          ) : (
            <Button
              size="sm"
              className="flex-1"
              disabled={!canCall || busy}
              onClick={() => runSession('call-next')}
            >
              Call Next
            </Button>
          )}
          {isLive && (
            <IconBtn
              name={isPaused ? 'play' : 'pause'}
              label="Pause or resume doctor"
              title={isPaused ? 'Resume' : 'Take a break'}
              box={34}
              size={15}
              color={isPaused ? 'var(--color-g-800)' : undefined}
              onClick={() => runSession(isPaused ? 'resume' : 'pause')}
            />
          )}
          {isLive && !serving && session.waitingCount === 0 && (
            <IconBtn
              name="x"
              label="Close session"
              title="Close the session"
              box={34}
              size={15}
              onClick={() => setConfirmClose(true)}
            />
          )}
        </div>
      </Can>

      <ConfirmModal
        open={offerNoShow !== null}
        title="Mark as no-show?"
        body={`Token ${tokenLabel ?? ''} has been called the most times this hospital allows. Mark it as a no-show? It is never done automatically.`}
        confirmLabel="Mark No-show"
        onClose={() => setOfferNoShow(null)}
        onConfirm={() => {
          if (offerNoShow !== null) runToken('no-show', offerNoShow);
          setOfferNoShow(null);
        }}
      />
      <ConfirmModal
        open={confirmClose}
        title="Close this session?"
        body={`Close ${doctorName}'s ${session.label} session for today? No more tokens can be called in it.`}
        confirmLabel="Close session"
        onClose={() => setConfirmClose(false)}
        onConfirm={() => {
          setConfirmClose(false);
          runSession('close');
        }}
      />
    </Card>
  );
}
