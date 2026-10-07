import { useState } from 'react';

import { useCan } from '@/shared/hooks/usePermission';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import { Can } from '@/shared/ui/Can';
import { Card } from '@/shared/ui/Card';
import { ConfirmModal } from '@/shared/ui/ConfirmModal';
import { IconBtn } from '@/shared/ui/IconBtn';
import { toast } from '@/shared/ui/toast/toast.store';

import { isFailure, type FailureKind } from '@/core/error/failure';

import type { DeskAppointment } from '@/features/appointments/domain/entities/appointments.entities';
import type {
  QueueSession,
  SessionCommand,
  TokenCommand,
} from '@/features/token-queue/domain/entities/tokenQueue.entities';
import {
  useSessionCommandMutation,
  useSkipTokenMutation,
  useTokenCommandMutation,
} from '@/features/token-queue/application/queries/tokenQueue.mutations';

import { TokenChip } from './TokenChip';
import {
  callNextState,
  canOfferNoShow,
  closeSessionCopy,
  isLiveSession,
  isServing,
  isStaleQueueRefusal,
  minutesSince,
  pillFor,
  queueRefusalText,
  servingLabel,
  servingSince,
  servingTokenNo,
  sessionQueue,
  type QueuePill,
  type QueueTicket,
} from './tokenQueue.view';

/** Up-next chips shown before collapsing into "+N". */
const UP_NEXT_CHIPS = 3;

/** The backend's answer when a token is no longer in the session (e.g. just cancelled). */
const NOT_FOUND: FailureKind = 'notFound';

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
  Consulting: 'bg-g-100 text-g-700',
  Waiting: 'bg-y-100 text-y-700',
  'On Break': 'bg-grey-300 text-text-muted',
  Available: 'bg-blue-soft-bg text-blue',
  'Not opened': 'bg-grey-200 text-text-muted',
  Closed: 'bg-grey-200 text-text-muted',
};

/** A chip's tooltip: the patient and, when the server estimates it, the wait. */
function ticketTitle(t: QueueTicket): string | null {
  const wait = t.estimatedWaitMinutes;
  const parts = [t.patientName, wait != null && wait > 0 ? `about ${wait} min` : null];
  const text = parts.filter(Boolean).join(' · ');
  return text || null;
}

function failureText(error: unknown, fallback: string): string {
  return isFailure(error) ? queueRefusalText(error.code, error.message) : fallback;
}

interface NoShowOffer {
  readonly tokenNo: number;
  readonly label: string;
}

interface DoctorQueueCardProps {
  session: QueueSession;
  doctorName: string;
  departmentName: string;
  room: string | null;
  /**
   * Today's appointments (H7) — names and the queue lists when the backend
   * does not send its own queue (B5 `queue`).
   */
  appointments: readonly DeskAppointment[];
  /** Hospital-local today (`yyyy-mm-dd`); a no-show is only offered on the session's own day. */
  today: string;
  /** Clock for the elapsed timers (re-renders every 30 s). */
  now: number;
  /** Expected consultation length; a call open longer than this is flagged. */
  expectedMinutes: number;
  /** Open this session's call history. */
  onShowCalls: () => void;
  /** Re-read the day's bookings (after a token turned out to be gone). */
  onStale: () => void;
}

/**
 * Live queue card for one doctor session (design `DoctorQueueCard`): status
 * pill, the now-serving box with elapsed minutes, the up-next token chips and
 * the desk controls — Open, Call Next, Start, Done, Recall, Skip (offering a
 * no-show after the hospital's attempt limit), Pause / Resume and Close.
 * Every control is a backend session command; the card re-renders from the
 * snapshot the command (or the live socket) returns.
 *
 * "At the desk" is `current_appointment_id` (UAT-01): once Done, Skip or
 * No-show clears it, Call Next, the chips and Close come back, and Done can
 * never complete a skipped, unseen patient. Every control is disabled while
 * one of this card's commands is in flight (UAT-46).
 */
export function DoctorQueueCard({
  session,
  doctorName,
  departmentName,
  room,
  appointments,
  today,
  now,
  expectedMinutes,
  onShowCalls,
  onStale,
}: DoctorQueueCardProps) {
  const canRunQueue = useCan('Token Management.edit');
  const sessionCommand = useSessionCommandMutation();
  const tokenCommand = useTokenCommandMutation();
  const skip = useSkipTokenMutation();
  const [offerNoShow, setOfferNoShow] = useState<NoShowOffer | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);

  const pill = pillFor(session);
  const serving = isServing(session);
  const deskTokenNo = servingTokenNo(session);
  const servingAppt = appointments.find((a) => a.id === session.currentAppointmentId) ?? null;
  const tokenLabel = servingLabel(session, servingAppt);
  const elapsed = minutesSince(servingSince(session, servingAppt), now);
  const lists = sessionQueue(session, appointments);
  const queue = lists.upNext;
  const upNext = queue.slice(0, UP_NEXT_CHIPS);
  const skipped = lists.skipped;
  const isOpen = session.status === 'open';
  const isPaused = session.status === 'paused';
  const isLive = isLiveSession(session);
  const busy = sessionCommand.isPending || tokenCommand.isPending || skip.isPending;
  const callNext = callNextState(session, lists.upNextCount, skipped.length);
  // A specific token can be called (Q24) when the desk is free: open and
  // nobody called or with the doctor.
  const canCallToken = canRunQueue && isOpen && !serving && !busy;

  const onError = (fallback: string) => (error: unknown) => {
    if (isFailure(error) && (error.kind === NOT_FOUND || isStaleQueueRefusal(error.code))) {
      onStale();
    }
    toast(failureText(error, fallback), 'error');
  };

  const runSession = (command: SessionCommand) =>
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
    if (deskTokenNo === null) return;
    const label = tokenLabel ?? `#${deskTokenNo}`;
    skip.mutate(
      { sessionId: session.id, tokenNo: deskTokenNo },
      {
        onSuccess: (outcome) => {
          if (outcome.offerNoShow && canOfferNoShow(outcome.session, today, true)) {
            setOfferNoShow({ tokenNo: deskTokenNo, label });
          } else {
            toast(`Skipped ${label} — attempt ${outcome.attempts}`, 'info');
          }
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
        <IconBtn
          name="scroll-text"
          label={`Call history — ${doctorName} · ${session.label}`}
          title="Call history"
          box={30}
          size={14}
          onClick={onShowCalls}
        />
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
                {lists.servingName ?? '—'}
              </div>
            </div>
            <span
              className={cn(
                'text-caption flex-none font-semibold',
                elapsed != null && elapsed > expectedMinutes ? 'text-d-500' : 'text-text-muted',
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
                  : lists.upNextCount > 0
                    ? 'Ready to call next'
                    : skipped.length
                      ? 'Only skipped tokens are waiting'
                      : 'No patients waiting'}
          </span>
        )}
      </div>

      <div className="flex min-h-6 items-center gap-2">
        <span
          className="text-caption text-text-muted flex-none"
          title="In the order Call Next calls them"
        >
          Up next
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {upNext.length === 0 ? (
            <span className="text-caption text-text-muted">nobody yet</span>
          ) : (
            upNext.map((t) => (
              <TokenChip
                key={t.appointmentId}
                label={t.label}
                patientName={ticketTitle(t)}
                onCall={canCallToken ? () => runToken('call', t.tokenNo) : undefined}
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

      {lists.withDoctor.length > 0 && (
        <div className="flex min-h-6 items-center gap-2">
          <span
            className="text-caption text-text-muted flex-none"
            title="Still with the doctor — click one to mark the consultation done"
          >
            With doctor
          </span>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {lists.withDoctor.map((t) => (
              <TokenChip
                key={t.appointmentId}
                label={t.label}
                patientName={t.patientName}
                actionVerb="Mark done"
                onCall={
                  canRunQueue && isLive && !busy ? () => runToken('complete', t.tokenNo) : undefined
                }
              />
            ))}
          </div>
        </div>
      )}

      {skipped.length > 0 && (
        <div className="flex min-h-6 items-center gap-2">
          <span
            className="text-caption text-text-muted flex-none"
            title="Called earlier and skipped — Call Next passes them by; click one to call it again"
          >
            Skipped
          </span>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {skipped.map((t) => (
              <span key={t.appointmentId} className="inline-flex items-center gap-1">
                <TokenChip
                  label={t.label}
                  patientName={ticketTitle(t)}
                  muted
                  actionVerb="Call again"
                  onCall={canCallToken ? () => runToken('recall', t.tokenNo) : undefined}
                />
                {canRunQueue && t.offerNoShow && canOfferNoShow(session, today, true) && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setOfferNoShow({ tokenNo: t.tokenNo, label: t.label })}
                    title={`Skipped ${t.skipCount} times — mark ${t.label} as a no-show`}
                    className="text-caption text-d-700 cursor-pointer font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    No-show?
                  </button>
                )}
              </span>
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
          ) : serving && deskTokenNo !== null ? (
            <>
              {session.queueState !== 'consulting' && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1"
                  disabled={busy || !isOpen}
                  onClick={() => runToken('serve', deskTokenNo)}
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
                onClick={() => runToken('complete', deskTokenNo)}
              >
                Done
              </Button>
              {session.queueState !== 'consulting' && (
                <IconBtn
                  name="megaphone"
                  label="Recall — call this token again"
                  box={34}
                  size={15}
                  disabled={busy || !isOpen}
                  onClick={() => runToken('recall', deskTokenNo)}
                />
              )}
              {session.queueState !== 'consulting' && (
                <IconBtn
                  name="skip-forward"
                  label="Skip — call again later"
                  box={34}
                  size={15}
                  disabled={busy || !isOpen}
                  busy={skip.isPending}
                  onClick={skipCurrent}
                />
              )}
            </>
          ) : (
            <span
              className="flex-1"
              title={callNext.kind === 'blocked' ? callNext.reason : undefined}
            >
              <Button
                size="sm"
                className="w-full"
                disabled={callNext.kind !== 'ready' || busy}
                busy={sessionCommand.isPending && sessionCommand.variables.command === 'call-next'}
                onClick={() => runSession('call-next')}
              >
                Call Next
              </Button>
            </span>
          )}
          {isLive && (
            <IconBtn
              name={isPaused ? 'play' : 'pause'}
              label={isPaused ? 'Resume the session' : 'Pause the session — take a break'}
              box={34}
              size={15}
              color={isPaused ? 'var(--color-g-600)' : undefined}
              disabled={busy}
              onClick={() => runSession(isPaused ? 'resume' : 'pause')}
            />
          )}
          {isLive && !serving && (
            <IconBtn
              name="x"
              label="Close the session"
              box={34}
              size={15}
              disabled={busy}
              onClick={() => setConfirmClose(true)}
            />
          )}
        </div>
      </Can>

      <ConfirmModal
        open={offerNoShow !== null}
        title="Mark as no-show?"
        body={`Token ${offerNoShow?.label ?? ''} has been called the most times this hospital allows. Mark it as a no-show? It is never done automatically.`}
        confirmLabel="Mark No-show"
        onClose={() => setOfferNoShow(null)}
        onConfirm={() => {
          if (offerNoShow !== null) runToken('no-show', offerNoShow.tokenNo);
          setOfferNoShow(null);
        }}
      />
      <ConfirmModal
        open={confirmClose}
        title="Close this session?"
        body={closeSessionCopy(doctorName, session.label, session.waitingCount)}
        confirmLabel="Close session"
        danger={session.waitingCount > 0}
        onClose={() => setConfirmClose(false)}
        onConfirm={() => {
          setConfirmClose(false);
          runSession('close');
        }}
      />
    </Card>
  );
}
