import { useState, type ReactNode } from 'react';

import { useActionKeys } from '@/shared/hooks/useActionKeys';
import { useHospitalToday } from '@/shared/hooks/useHospitalTime';
import { useNow } from '@/shared/hooks/useNow';
import { useCan } from '@/shared/hooks/usePermission';
import { money } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Can } from '@/shared/ui/Can';
import { Card } from '@/shared/ui/Card';
import { ConfirmModal } from '@/shared/ui/ConfirmModal';
import { Drawer } from '@/shared/ui/Drawer';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Spinner } from '@/shared/ui/Spinner';
import { toast } from '@/shared/ui/toast/toast.store';

import { isFailure } from '@/core/error/failure';

import type {
  AppointmentEvent,
  DeskAppointment,
  DeskRefund,
} from '@/features/appointments/domain/entities/appointments.entities';
import {
  useApproveMutation,
  useCancelMutation,
  useCheckInMutation,
  useNoShowMutation,
  useRefundMutation,
  useRejectMutation,
} from '@/features/appointments/application/queries/appointments.mutations';
import {
  useAppointmentEventsQuery,
  useAppointmentQuery,
} from '@/features/appointments/application/queries/appointments.queries';
import { AppointmentPaymentModal } from '@/features/appointments/presentation/components/AppointmentPaymentModal';
import { AppointmentReasonModal } from '@/features/appointments/presentation/components/AppointmentReasonModal';
import { AppointmentReceiptModal } from '@/features/appointments/presentation/components/AppointmentReceiptModal';
import { AppointmentRemarkModal } from '@/features/appointments/presentation/components/AppointmentRemarkModal';
import { AppointmentTokenModal } from '@/features/appointments/presentation/components/AppointmentTokenModal';
import {
  actorLabel,
  canCancel,
  canCheckIn,
  canMarkNoShow,
  dateTimeOf,
  dayOf,
  deskErrorText,
  eventLabel,
  hasPaid,
  hasTokenSlip,
  isClosed,
  isNothingDue,
  moneyBackAction,
  needsApproval,
  needsPayment,
  paymentBadge,
  reasonCopy,
  sourceBadge,
  statusBadge,
  statusLabelOf,
  timeOf,
  type ReasonKind,
} from '@/features/appointments/presentation/components/appointments.view';

/** The no-show rule depends on the slot's start; re-read the clock each minute. */
const CLOCK_TICK_MS = 60_000;

function failureText(error: unknown, fallback: string): string {
  return isFailure(error) ? deskErrorText(error, fallback) : fallback;
}

/** What to say once refunds were started: gateway refunds finish later (03 F12). */
function refundToast(refunds: readonly DeskRefund[], done: string): string {
  const pending = refunds.some((r) => r.status === 'requested' || r.status === 'processing');
  return pending
    ? `${done} The online refund shows as refunded once the payment gateway confirms it.`
    : done;
}

interface AppointmentDrawerProps {
  /** Appointment to show; `null` = closed. */
  id: string | null;
  onClose: () => void;
  /** Open the patient's record; offered only to roles that may (03 F7). */
  onViewPatient?: (mrn: string) => void;
}

/**
 * Appointment detail drawer + its desk actions (design `Flows.jsx`
 * `AppointmentDrawer`), on the hospital API. Every action is one the
 * backend supports: approve / reject a booking awaiting approval, collect a
 * walk-in's fee, check in, mark a no-show, edit the remark, cancel (a live
 * booking, refunding what was paid) or refund (a finished one), the receipt
 * and the token slip. There is no reschedule or fee waiver (D-14) — cancel
 * and book again instead. Dates and times are the hospital's (UAT-47).
 */
export function AppointmentDrawer({ id, onClose, onViewPatient }: AppointmentDrawerProps) {
  const appt = useAppointmentQuery(id);
  const events = useAppointmentEventsQuery(id);
  const { timeZone } = useHospitalToday();
  const canViewPatients = useCan('Patients.view');

  return (
    <Drawer
      open={id !== null}
      onClose={onClose}
      title={appt.data?.patient?.fullName ?? 'Appointment'}
      subtitle={appt.data ? subtitleOf(appt.data) : undefined}
      width={440}
      footer={appt.data ? <DrawerActions appt={appt.data} /> : undefined}
    >
      {appt.isPending ? (
        <div className="text-text-muted flex justify-center py-12">
          <Spinner size={28} label="Loading the appointment" />
        </div>
      ) : appt.isError ? (
        <ErrorState
          inline
          title="Could not load this appointment"
          message={failureText(appt.error, 'Please try again.')}
          onRetry={() => void appt.refetch()}
        />
      ) : (
        <DrawerBody
          appt={appt.data}
          timeZone={timeZone}
          history={events.data ?? []}
          isHistoryLoading={events.isPending}
          onViewPatient={
            canViewPatients && onViewPatient
              ? () => {
                  if (!appt.data.patient) return;
                  onClose();
                  onViewPatient(appt.data.patient.mrn);
                }
              : undefined
          }
        />
      )}
    </Drawer>
  );
}

function subtitleOf(a: DeskAppointment): string {
  return [a.patient?.mrn, a.bookingRef].filter(Boolean).join(' · ');
}

function Row({ k, v }: { k: ReactNode; v: ReactNode }) {
  return (
    <div className="border-border-soft flex items-center justify-between border-b py-3">
      <span className="text-body text-text-muted">{k}</span>
      <span className="text-body text-text-strong text-right font-medium">{v}</span>
    </div>
  );
}

interface DrawerBodyProps {
  appt: DeskAppointment;
  timeZone: string;
  history: readonly AppointmentEvent[];
  isHistoryLoading: boolean;
  /** Absent for roles that cannot open patient records. */
  onViewPatient?: () => void;
}

function DrawerBody({ appt, timeZone, history, isHistoryLoading, onViewPatient }: DrawerBodyProps) {
  const payBadge = paymentBadge(appt);
  const status = statusBadge(appt.status);
  const source = sourceBadge(appt.source);
  const refundedButLive = needsPayment(appt) && appt.paymentStatus === 'refunded';
  return (
    <>
      <div className="mb-4.5 flex flex-wrap gap-2">
        <Badge status={source.status}>{source.label}</Badge>
        <Badge status={status.status}>{status.label}</Badge>
        <Badge status={payBadge.status}>{payBadge.label}</Badge>
        {needsApproval(appt) && <Badge status="Pending verification">Needs approval</Badge>}
      </div>
      {needsApproval(appt) && (
        <Card pad={16} className="mb-4">
          <div className="text-caption text-text-muted mb-1">Desk confirmation</div>
          <div className="text-body text-text-body">
            This booking needs the hospital's approval. Approve it to confirm the slot, or reject it
            {hasPaid(appt) ? ' — the patient is refunded in full.' : '.'}
          </div>
        </Card>
      )}
      {isNothingDue(appt) && appt.source === 'walk_in' && !isClosed(appt) && (
        <Card pad={16} className="mb-4">
          <div className="text-caption text-text-muted mb-1">Nothing to collect</div>
          <div className="text-body text-text-body">
            This consultation is free (a follow-up or a doctor without a fee). No receipt is issued;
            the patient can be checked in on the day.
          </div>
        </Card>
      )}
      {refundedButLive && (
        <Card pad={16} className="mb-4">
          <div className="text-caption text-text-muted mb-1">Payment refunded</div>
          <div className="text-body text-text-body">
            This walk-in's fee was refunded but the visit is still on. Collect the fee again before
            checking the patient in, or cancel the appointment.
          </div>
        </Card>
      )}
      <Card pad={16} className="mb-4">
        <Row k="Doctor" v={appt.doctor.name} />
        <Row k="Department" v={appt.department.name} />
        <Row
          k="Date & Time"
          v={`${dayOf(appt.scheduledDate, timeZone)}, ${timeOf(appt.scheduledStartAt, timeZone)} · ${appt.sessionLabel}`}
        />
        <Row
          k="Booking Source"
          v={appt.source === 'online' ? 'Medibook App (online)' : 'Walk-in (at desk)'}
        />
        <Row
          k="Consultation Fee"
          v={<span className="tabular-nums">{money(appt.consultationRupees)}</span>}
        />
        {appt.serviceRupees > 0 && (
          <Row k="Service" v={<span className="tabular-nums">{money(appt.serviceRupees)}</span>} />
        )}
        {appt.discountRupees > 0 && (
          <Row
            k="Discount"
            v={<span className="tabular-nums">−{money(appt.discountRupees)}</span>}
          />
        )}
        {appt.convenienceRupees > 0 && (
          <Row
            k="Convenience fee"
            v={<span className="tabular-nums">{money(appt.convenienceRupees)}</span>}
          />
        )}
        <Row k="Tax" v={<span className="tabular-nums">{money(appt.taxRupees)}</span>} />
        <Row k="Total" v={<span className="tabular-nums">{money(appt.totalRupees)}</span>} />
        <div className="flex items-center justify-between py-3">
          <span className="text-body text-text-muted">Token</span>
          <span
            className={
              appt.tokenLabel
                ? 'text-body text-blue font-bold'
                : 'text-body text-text-strong font-medium'
            }
          >
            {appt.tokenLabel || '—'}
          </span>
        </div>
      </Card>
      {appt.remark && (
        <Card pad={16} className="mb-4">
          <div className="text-caption text-text-muted mb-1">Booking Remark</div>
          <div className="text-body text-text-body">{appt.remark}</div>
        </Card>
      )}
      {appt.patientNotes && (
        <Card pad={16} className="mb-4">
          <div className="text-caption text-text-muted mb-1">Patient's note</div>
          <div className="text-body text-text-body">{appt.patientNotes}</div>
        </Card>
      )}
      {appt.status === 'cancelled' && appt.cancellationReason && (
        <Card pad={16} className="mb-4">
          <div className="text-caption text-text-muted mb-1">Cancellation Reason</div>
          <div className="text-body text-text-body">{appt.cancellationReason}</div>
        </Card>
      )}
      <Card pad={16} className="mb-4">
        <div className="text-caption text-text-muted mb-2">History</div>
        {isHistoryLoading ? (
          <Spinner size={18} label="Loading history" />
        ) : history.length === 0 ? (
          <div className="text-body text-text-muted">No events yet.</div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {history.map((e) => (
              <li key={e.id} className="text-caption text-text-body flex justify-between gap-3">
                <span>
                  {eventLabel(e.eventType)}
                  <span className="text-text-muted"> · {actorLabel(e.actorKind)}</span>
                  {e.fromStatus && e.toStatus && e.fromStatus !== e.toStatus && (
                    <span className="text-text-muted block">
                      {statusLabelOf(e.fromStatus)} → {statusLabelOf(e.toStatus)}
                    </span>
                  )}
                </span>
                <span className="text-text-muted tabular-nums">
                  {dateTimeOf(e.occurredAt, timeZone)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {appt.patient && onViewPatient && (
        <Button variant="secondary" icon="user" className="w-full" onClick={onViewPatient}>
          View Patient Profile
        </Button>
      )}
    </>
  );
}

/** The drawer footer: the actions this appointment allows, with their modals. */
function DrawerActions({ appt }: { appt: DeskAppointment }) {
  const approve = useApproveMutation();
  const reject = useRejectMutation();
  const checkIn = useCheckInMutation();
  const noShow = useNoShowMutation();
  const cancel = useCancelMutation();
  const refund = useRefundMutation();
  const actionKeys = useActionKeys();
  const { today, timeZone } = useHospitalToday();
  const now = useNow(CLOCK_TICK_MS);
  const canCollect = useCan('Payments.add');
  const [pay, setPay] = useState(false);
  const [receipt, setReceipt] = useState(false);
  const [token, setToken] = useState(false);
  const [remark, setRemark] = useState(false);
  const [reason, setReason] = useState<ReasonKind | null>(null);
  const [confirmNoShow, setConfirmNoShow] = useState(false);

  const onError = (fallback: string) => (error: unknown) =>
    toast(failureText(error, fallback), 'error');

  const awaiting = needsApproval(appt);
  const closed = isClosed(appt);
  const owes = needsPayment(appt);
  const moneyBack = moneyBackAction(appt);
  const reasonBusy = cancel.isPending || reject.isPending || refund.isPending;
  const total = money(appt.totalRupees);

  const runReason = (kind: ReasonKind, text: string): void => {
    const scope = `${kind}:${appt.id}`;
    const idempotencyKey = actionKeys.keyFor(scope);
    const settle = () => {
      actionKeys.settle(scope);
      setReason(null);
    };
    const fail = onError('Could not complete that.');
    if (kind === 'cancel') {
      cancel.mutate(
        { id: appt.id, reason: text, idempotencyKey },
        {
          onSuccess: (outcome) => {
            settle();
            toast(refundToast(outcome.refunds, 'Appointment cancelled.'), 'info');
          },
          onError: fail,
        },
      );
    } else if (kind === 'reject') {
      reject.mutate(
        { id: appt.id, reason: text, idempotencyKey },
        {
          onSuccess: (outcome) => {
            settle();
            toast(refundToast(outcome.refunds, 'Booking rejected.'), 'info');
          },
          onError: fail,
        },
      );
    } else {
      refund.mutate(
        { id: appt.id, reason: text, idempotencyKey },
        {
          onSuccess: (refunds) => {
            settle();
            toast(refundToast(refunds, 'Refund issued.'), 'info');
          },
          onError: fail,
        },
      );
    }
  };

  const doCheckIn = (): void => {
    const scope = `check-in:${appt.id}`;
    checkIn.mutate(
      { id: appt.id, idempotencyKey: actionKeys.keyFor(scope) },
      {
        onSuccess: () => {
          actionKeys.settle(scope);
          toast('Checked in', 'success');
        },
        onError: onError('Could not check in.'),
      },
    );
  };

  const copy = reason ? reasonCopy(reason, appt, total) : null;

  return (
    <>
      <div className="flex w-full flex-wrap items-center gap-2">
        {awaiting && (
          <>
            <Can perm="Appointments.edit">
              <Button
                icon="check-check"
                busy={approve.isPending}
                onClick={() =>
                  approve.mutate(
                    { id: appt.id },
                    {
                      onSuccess: () => toast('Booking approved', 'success'),
                      onError: onError('Could not approve.'),
                    },
                  )
                }
              >
                Approve
              </Button>
            </Can>
            <Can perm="Appointments.edit">
              <Button variant="ghost" className="text-d-500!" onClick={() => setReason('reject')}>
                Reject
              </Button>
            </Can>
          </>
        )}
        {!awaiting && owes && canCollect && (
          <Button icon="indian-rupee" onClick={() => setPay(true)}>
            Collect {total}
          </Button>
        )}
        {!awaiting && owes && !canCollect && (
          <span className="text-caption text-text-muted">
            Unpaid — the patient pays {total} at reception before check-in.
          </span>
        )}
        {canCheckIn(appt, today) && (
          <Can perm="Appointments.edit">
            <Button icon="log-in" busy={checkIn.isPending} onClick={doCheckIn}>
              Check in
            </Button>
          </Can>
        )}
        {hasTokenSlip(appt) && (
          <Button variant="secondary" icon="ticket" onClick={() => setToken(true)}>
            Token
          </Button>
        )}
        {(hasPaid(appt) || appt.paymentStatus === 'refunded') && (
          <Can perm="Payments.view">
            <Button variant="secondary" icon="receipt" onClick={() => setReceipt(true)}>
              Receipt
            </Button>
          </Can>
        )}
        {!closed && (
          <Can perm="Appointments.edit">
            <Button variant="ghost" icon="pencil" onClick={() => setRemark(true)}>
              Remark
            </Button>
          </Can>
        )}
        {canMarkNoShow(appt, today, now) && (
          <Can perm="Token Management.edit">
            <Button variant="ghost" onClick={() => setConfirmNoShow(true)}>
              No-show
            </Button>
          </Can>
        )}
        {moneyBack === 'refund' && (
          <Can perm="Payments.del">
            <Button variant="ghost" icon="undo-2" onClick={() => setReason('refund')}>
              Refund
            </Button>
          </Can>
        )}
        {!awaiting && canCancel(appt) && (
          <Can perm="Appointments.del">
            <Button variant="ghost" className="text-d-500!" onClick={() => setReason('cancel')}>
              {moneyBack === 'cancel-refund' ? 'Cancel & refund' : 'Cancel'}
            </Button>
          </Can>
        )}
      </div>

      <AppointmentPaymentModal
        appt={pay ? appt : null}
        onClose={() => setPay(false)}
        onPaid={() => {
          setPay(false);
          setReceipt(true);
        }}
      />
      <AppointmentReceiptModal
        appointmentId={receipt ? appt.id : null}
        onClose={() => setReceipt(false)}
      />
      <AppointmentTokenModal
        appointmentId={token ? appt.id : null}
        onClose={() => setToken(false)}
      />
      <AppointmentRemarkModal appt={remark ? appt : null} onClose={() => setRemark(false)} />
      {reason && copy && (
        <AppointmentReasonModal
          key={reason}
          open
          title={copy.title}
          body={copy.body}
          confirmLabel={copy.confirm}
          dismissLabel={reason === 'refund' ? 'Back' : 'Keep booking'}
          busy={reasonBusy}
          onClose={() => setReason(null)}
          onConfirm={(text) => runReason(reason, text)}
        />
      )}
      <ConfirmModal
        open={confirmNoShow}
        title="Mark as No-show"
        body={`Mark ${appt.patient?.fullName ?? 'this patient'} as a no-show for ${dayOf(appt.scheduledDate, timeZone)}? This is recorded in the appointment's history.`}
        confirmLabel="Mark No-show"
        onClose={() => setConfirmNoShow(false)}
        onConfirm={() => {
          setConfirmNoShow(false);
          noShow.mutate(
            { id: appt.id },
            {
              onSuccess: () => toast('Marked as no-show', 'info'),
              onError: onError('Could not mark no-show.'),
            },
          );
        }}
      />
    </>
  );
}
