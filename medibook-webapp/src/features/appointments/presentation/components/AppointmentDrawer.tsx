import { useState, type ReactNode } from 'react';

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

import type { DeskAppointment } from '@/features/appointments/domain/entities/appointments.entities';
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
  dateTimeOf,
  dayOf,
  isInQueue,
  needsApproval,
  needsPayment,
  PAYMENT_LABEL,
  SOURCE_LABEL,
  STATUS_LABEL,
  timeOf,
} from '@/features/appointments/presentation/components/appointments.view';

type ReasonKind = 'cancel' | 'reject' | 'refund';

const REASON_COPY: Readonly<
  Record<ReasonKind, { readonly title: string; readonly body: string; readonly confirm: string }>
> = {
  cancel: {
    title: 'Cancel Appointment',
    body: 'The booking is cancelled and the patient is refunded in full — including any convenience fee — to the original payment method. This cannot be undone.',
    confirm: 'Cancel & refund',
  },
  reject: {
    title: 'Reject Booking',
    body: 'The booking is rejected and the patient is refunded in full, including the convenience fee. This cannot be undone.',
    confirm: 'Reject & refund',
  },
  refund: {
    title: 'Refund Payment',
    body: 'The full amount is refunded — one refund per payment line, to its original method. Cash is handed back from your open cash session.',
    confirm: 'Refund in full',
  },
};

function failureText(error: unknown, fallback: string): string {
  return isFailure(error) ? error.message : fallback;
}

interface AppointmentDrawerProps {
  /** Appointment to show; `null` = closed. */
  id: string | null;
  onClose: () => void;
  onViewPatient?: (mrn: string) => void;
}

/**
 * Appointment detail drawer + its desk actions (design `Flows.jsx`
 * `AppointmentDrawer`), on the hospital API. Every action is one the
 * backend supports: approve / reject a booking awaiting approval, collect a
 * walk-in's fee, check in, mark a no-show, edit the remark, cancel or refund
 * (both in full), the receipt and the token slip. There is no reschedule or
 * fee waiver (D-14) — cancel and book again instead.
 */
export function AppointmentDrawer({ id, onClose, onViewPatient }: AppointmentDrawerProps) {
  const appt = useAppointmentQuery(id);
  const events = useAppointmentEventsQuery(id);

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
      ) : appt.isLoadingError ? (
        <ErrorState
          error={appt.error}
          inline
          title="Could not load this appointment"
          message={failureText(appt.error, 'Please try again.')}
          onRetry={() => void appt.refetch()}
        />
      ) : (
        <DrawerBody
          appt={appt.data}
          history={events.data ?? []}
          isHistoryLoading={events.isPending}
          onViewPatient={() => {
            if (!appt.data.patient) return;
            onClose();
            onViewPatient?.(appt.data.patient.mrn);
          }}
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
  history: readonly {
    readonly id: string;
    readonly eventType: string;
    readonly occurredAt: string;
  }[];
  isHistoryLoading: boolean;
  onViewPatient: () => void;
}

function DrawerBody({ appt, history, isHistoryLoading, onViewPatient }: DrawerBodyProps) {
  return (
    <>
      <div className="mb-4.5 flex flex-wrap gap-2">
        <Badge status={SOURCE_LABEL[appt.source]} />
        <Badge status={STATUS_LABEL[appt.status]} />
        <Badge status={PAYMENT_LABEL[appt.paymentStatus]} />
        {needsApproval(appt) && <Badge status="Pending verification">Needs approval</Badge>}
      </div>
      {needsApproval(appt) && (
        <Card pad={16} className="mb-4">
          <div className="text-caption text-text-muted mb-1">Desk confirmation</div>
          <div className="text-body text-text-body">
            This booking needs the hospital's approval. Approve it to confirm the slot, or reject it
            — the patient is refunded in full.
          </div>
        </Card>
      )}
      <Card pad={16} className="mb-4">
        <Row k="Doctor" v={appt.doctor.name} />
        <Row k="Department" v={appt.department.name} />
        <Row
          k="Date & Time"
          v={`${dayOf(appt.scheduledDate)}, ${timeOf(appt.scheduledStartAt)} · ${appt.sessionLabel}`}
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
                <span className="capitalize">{e.eventType.replace(/_/g, ' ')}</span>
                <span className="text-text-muted tabular-nums">{dateTimeOf(e.occurredAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {appt.patient && (
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
  const [pay, setPay] = useState(false);
  const [receipt, setReceipt] = useState(false);
  const [token, setToken] = useState(false);
  const [remark, setRemark] = useState(false);
  const [reason, setReason] = useState<ReasonKind | null>(null);
  const [confirmNoShow, setConfirmNoShow] = useState(false);

  const onError = (fallback: string) => (error: unknown) =>
    toast(failureText(error, fallback), 'error', error);

  const awaiting = needsApproval(appt);
  const closed =
    appt.status === 'cancelled' || appt.status === 'completed' || appt.status === 'no_show';
  const isPaid = appt.paymentStatus === 'paid';
  const reasonBusy = cancel.isPending || reject.isPending || refund.isPending;

  const runReason = (kind: ReasonKind, text: string): void => {
    const done = () => {
      setReason(null);
      toast(
        kind === 'refund'
          ? 'Refund issued'
          : kind === 'reject'
            ? 'Booking rejected'
            : 'Appointment cancelled',
        'info',
      );
    };
    const fail = onError('Could not complete that.');
    if (kind === 'cancel')
      cancel.mutate({ id: appt.id, reason: text }, { onSuccess: done, onError: fail });
    else if (kind === 'reject')
      reject.mutate({ id: appt.id, reason: text }, { onSuccess: done, onError: fail });
    else refund.mutate({ id: appt.id, reason: text }, { onSuccess: done, onError: fail });
  };

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
              <Button variant="ghost" className="text-d-600!" onClick={() => setReason('reject')}>
                Reject
              </Button>
            </Can>
          </>
        )}
        {!awaiting && needsPayment(appt) && (
          <Can perm="Payments.add">
            <Button icon="indian-rupee" onClick={() => setPay(true)}>
              Collect {money(appt.totalRupees)}
            </Button>
          </Can>
        )}
        {appt.status === 'scheduled' && (
          <Can perm="Appointments.edit">
            <Button
              icon="log-in"
              busy={checkIn.isPending}
              onClick={() =>
                checkIn.mutate(
                  { id: appt.id },
                  {
                    onSuccess: () => toast('Checked in', 'success'),
                    onError: onError('Could not check in.'),
                  },
                )
              }
            >
              Check in
            </Button>
          </Can>
        )}
        {appt.tokenLabel && appt.status !== 'cancelled' && (
          <Button variant="secondary" icon="ticket" onClick={() => setToken(true)}>
            Token
          </Button>
        )}
        {(isPaid || appt.paymentStatus === 'refunded') && (
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
        {(appt.status === 'scheduled' || isInQueue(appt)) && (
          <Can perm="Token Management.edit">
            <Button variant="ghost" onClick={() => setConfirmNoShow(true)}>
              No-show
            </Button>
          </Can>
        )}
        {isPaid && closed && (
          <Can perm="Payments.del">
            <Button variant="ghost" icon="undo-2" onClick={() => setReason('refund')}>
              Refund
            </Button>
          </Can>
        )}
        {!closed && !awaiting && (
          <Can perm="Appointments.del">
            <Button variant="ghost" className="text-d-600!" onClick={() => setReason('cancel')}>
              Cancel
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
      {reason && (
        <AppointmentReasonModal
          key={reason}
          open
          title={REASON_COPY[reason].title}
          body={REASON_COPY[reason].body}
          confirmLabel={REASON_COPY[reason].confirm}
          busy={reasonBusy}
          onClose={() => setReason(null)}
          onConfirm={(text) => runReason(reason, text)}
        />
      )}
      <ConfirmModal
        open={confirmNoShow}
        title="Mark as No-show"
        body={`Mark ${appt.patient?.fullName ?? 'this patient'} as a no-show? This is recorded in the appointment's history.`}
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
