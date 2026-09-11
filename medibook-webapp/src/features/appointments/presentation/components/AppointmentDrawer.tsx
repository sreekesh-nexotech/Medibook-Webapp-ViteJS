import { useState, type ReactNode } from 'react';

import { money } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Can } from '@/shared/ui/Can';
import { Card } from '@/shared/ui/Card';
import { ConfirmModal } from '@/shared/ui/ConfirmModal';
import { Drawer } from '@/shared/ui/Drawer';

import { useAppointmentsStore } from '@/features/appointments/application/store/appointments.store';
import {
  GST_LABEL,
  taxBreakdown,
} from '@/features/appointments/application/store/appointments.logic';
import type { Appointment } from '@/features/appointments/application/store/appointments.types';
import { CancelApptModal } from '@/features/appointments/presentation/components/CancelApptModal';
import { EditApptModal } from '@/features/appointments/presentation/components/EditApptModal';
import { MarkPaymentModal } from '@/features/appointments/presentation/components/MarkPaymentModal';
import { ReceiptModal } from '@/features/appointments/presentation/components/ReceiptModal';
import { RefundModal } from '@/features/appointments/presentation/components/RefundModal';
import { RescheduleModal } from '@/features/appointments/presentation/components/RescheduleModal';
import { WaiveFeeModal } from '@/features/appointments/presentation/components/WaiveFeeModal';

/** Statuses that close the queue path (design `canQueue` exclusion list). */
const NON_QUEUEABLE: readonly Appointment['status'][] = [
  'In Queue',
  'Completed',
  'Cancelled',
  'No-show',
];

type ConfirmKind = { kind: 'noshow' | 'undoci' } | null;

interface AppointmentDrawerProps {
  id: string | null;
  onClose: () => void;
  onViewPatient?: (appt: Appointment) => void;
}

/** Appointment detail drawer + its action modals (design `Flows.jsx` `AppointmentDrawer`). */
export function AppointmentDrawer({ id, onClose, onViewPatient }: AppointmentDrawerProps) {
  const appt = useAppointmentsStore((s) => s.appts.find((a) => a.id === id));
  const checkIn = useAppointmentsStore((s) => s.checkIn);
  const noShow = useAppointmentsStore((s) => s.noShow);
  const undoCheckIn = useAppointmentsStore((s) => s.undoCheckIn);
  const revertToScheduled = useAppointmentsStore((s) => s.revertToScheduled);
  const approve = useAppointmentsStore((s) => s.approve);
  const ensureReceiptNo = useAppointmentsStore((s) => s.ensureReceiptNo);
  const [pay, setPay] = useState(false);
  const [receipt, setReceipt] = useState<Appointment | null>(null);
  const [resched, setResched] = useState(false);
  const [edit, setEdit] = useState(false);
  const [cancel, setCancel] = useState(false);
  const [refund, setRefund] = useState(false);
  const [waive, setWaive] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmKind>(null);
  if (!appt) return null;

  const row = (k: ReactNode, v: ReactNode) => (
    <div className="border-border-soft flex items-center justify-between border-b py-3">
      <span className="text-body text-text-muted">{k}</span>
      <span className="text-body text-text-strong text-right font-medium">{v}</span>
    </div>
  );

  const tax = taxBreakdown(appt.amount);
  const awaitingApproval = appt.needsApproval === true;
  const canQueue = !NON_QUEUEABLE.includes(appt.status) && !awaitingApproval;
  const needsPay = appt.source === 'Walk-in' && appt.payment === 'Pending';
  const editable = appt.status === 'Scheduled';
  const refundable = appt.payment === 'Paid';
  const waivable = appt.payment === 'Pending' || appt.payment === 'Paid';

  /**
   * Minting the receipt number on the way in keeps it out of render: a receipt
   * that is opened twice must show the same number.
   */
  const openReceipt = (): void => {
    ensureReceiptNo(appt.id);
    setReceipt(useAppointmentsStore.getState().appts.find((a) => a.id === appt.id) ?? appt);
  };

  const footer = (
    <>
      {awaitingApproval && (
        <Can perm="Appointments.edit">
          <Button variant="primary" icon="check-check" onClick={() => approve(appt.id)}>
            Approve
          </Button>
        </Can>
      )}
      {!awaitingApproval && needsPay && (
        <Can perm="Payments.add">
          <Button variant="primary" icon="indian-rupee" onClick={() => setPay(true)}>
            Mark Payment
          </Button>
        </Can>
      )}
      {!needsPay && canQueue && (
        <Button variant="primary" icon="log-in" onClick={() => checkIn(appt.id)}>
          {appt.source === 'Online' ? 'Check In' : 'Issue Token'}
        </Button>
      )}
      {(appt.payment === 'Paid' || appt.payment === 'Refunded') && (
        <Button variant="secondary" icon="receipt" onClick={openReceipt}>
          Receipt
        </Button>
      )}
      {waivable && (
        <Can perm="Appointments.edit">
          <Button variant="ghost" icon="percent" onClick={() => setWaive(true)}>
            Waive fee
          </Button>
        </Can>
      )}
      {refundable && (
        <Can perm={['Payments.del', 'Appointments.del']}>
          <Button variant="ghost" icon="undo-2" onClick={() => setRefund(true)}>
            Refund
          </Button>
        </Can>
      )}
      {editable && (
        <Can perm="Appointments.edit">
          <Button variant="ghost" icon="pencil" onClick={() => setEdit(true)}>
            Edit
          </Button>
        </Can>
      )}
      {canQueue && (
        <Can perm="Appointments.edit">
          <Button variant="ghost" icon="calendar-clock" onClick={() => setResched(true)}>
            Reschedule
          </Button>
        </Can>
      )}
      {canQueue && (
        <Can perm="Appointments.edit">
          <Button variant="ghost" onClick={() => setConfirm({ kind: 'noshow' })}>
            No-show
          </Button>
        </Can>
      )}
      {!NON_QUEUEABLE.includes(appt.status) && (
        <Can perm={['Appointments.del', 'Payments.del']}>
          <Button variant="ghost" className="text-d-500!" onClick={() => setCancel(true)}>
            Cancel
          </Button>
        </Can>
      )}
      {appt.status === 'In Queue' && (
        <Can perm="Appointments.edit">
          <Button variant="ghost" icon="undo-2" onClick={() => setConfirm({ kind: 'undoci' })}>
            Undo check-in
          </Button>
        </Can>
      )}
      {appt.status === 'No-show' && (
        <Can perm="Appointments.edit">
          <Button variant="secondary" icon="rotate-ccw" onClick={() => revertToScheduled(appt.id)}>
            Undo no-show
          </Button>
        </Can>
      )}
      {appt.status === 'Cancelled' && (
        <Can perm="Appointments.edit">
          <Button variant="secondary" icon="rotate-ccw" onClick={() => revertToScheduled(appt.id)}>
            Reinstate
          </Button>
        </Can>
      )}
    </>
  );

  return (
    <>
      <Drawer
        open={!!id}
        onClose={onClose}
        title={appt.name}
        subtitle={`${appt.mrn} · ${appt.age} yrs · ${appt.gender}`}
        footer={footer}
        width={440}
      >
        <div className="mb-4.5 flex flex-wrap gap-2">
          <Badge status={appt.source} />
          <Badge status={appt.status} />
          <Badge status={appt.payment} />
          {awaitingApproval && <Badge status="Pending verification">Needs approval</Badge>}
        </div>
        {awaitingApproval && (
          <Card pad={16} className="mb-4">
            <div className="text-caption text-text-muted mb-1">Desk confirmation</div>
            <div className="text-body text-text-body">
              This booking arrived unconfirmed. Approve it before collecting payment or issuing a
              token — nothing else in the appointment is available until then.
            </div>
          </Card>
        )}
        <Card pad={16} className="mb-4">
          {row('Doctor', appt.doctor)}
          {row('Department', appt.dept)}
          {row('Date & Time', `${appt.date}, ${appt.time}`)}
          {row(
            'Booking Source',
            appt.source === 'Online' ? 'Medibook App (online)' : 'Walk-in (at desk)',
          )}
          {row('Consultation Fee', <span className="tabular-nums">{money(tax.subtotal)}</span>)}
          {row(GST_LABEL, <span className="tabular-nums">{money(tax.gst)}</span>)}
          {row('Total', <span className="tabular-nums">{money(tax.total)}</span>)}
          {row('Payment', <Badge status={appt.payment} />)}
          {appt.receiptNo != null && row('Receipt No.', <span>{appt.receiptNo}</span>)}
          <div className="flex items-center justify-between py-3">
            <span className="text-body text-text-muted">Token</span>
            <span
              className={
                appt.token
                  ? 'text-body text-blue font-bold'
                  : 'text-body text-text-strong font-medium'
              }
            >
              {appt.token || '—'}
            </span>
          </div>
        </Card>
        {appt.payment === 'Refunded' && (
          <Card pad={16} className="mb-4">
            <div className="text-caption text-text-muted mb-1">
              Refund {appt.refundVia === 'Medibook' ? '· via Medibook' : '· at desk'}
            </div>
            <div className="text-body text-text-body">
              <span className="font-medium tabular-nums">{money(appt.refundAmount ?? 0)}</span>{' '}
              refunded
              {appt.refundAmount != null && appt.refundAmount < tax.total
                ? ` · ${money(tax.total - appt.refundAmount)} retained`
                : ''}
              {appt.refundReason ? ` — ${appt.refundReason}` : ''}
            </div>
          </Card>
        )}
        {appt.payment === 'Waived' && (
          <Card pad={16} className="mb-4">
            <div className="text-caption text-text-muted mb-1">Fee waiver</div>
            <div className="text-body text-text-body">
              <span className="font-medium tabular-nums">{money(appt.waivedAmount ?? 0)}</span>{' '}
              waived — {appt.waiveReason || 'no reason recorded'}
            </div>
          </Card>
        )}
        {appt.remark && (
          <Card pad={16} className="mb-4">
            <div className="text-caption text-text-muted mb-1">Booking Remark</div>
            <div className="text-body text-text-body">{appt.remark}</div>
          </Card>
        )}
        {appt.status === 'Cancelled' && appt.cancelReason && (
          <Card pad={16} className="mb-4">
            <div className="text-caption text-text-muted mb-1">Cancellation Reason</div>
            <div className="text-body text-text-body">{appt.cancelReason}</div>
          </Card>
        )}
        <Button
          variant="secondary"
          icon="user"
          className="w-full"
          onClick={() => {
            onClose();
            onViewPatient?.(appt);
          }}
        >
          View Patient Profile
        </Button>
      </Drawer>
      <MarkPaymentModal
        appt={pay ? appt : null}
        onClose={() => setPay(false)}
        onPaid={() => {
          setPay(false);
          setReceipt(useAppointmentsStore.getState().appts.find((a) => a.id === appt.id) ?? null);
        }}
      />
      <ReceiptModal appt={receipt} onClose={() => setReceipt(null)} />
      <RescheduleModal
        appt={resched ? appt : null}
        onClose={() => setResched(false)}
        onCancelInstead={() => setCancel(true)}
      />
      <EditApptModal appt={edit ? appt : null} onClose={() => setEdit(false)} />
      <CancelApptModal appt={cancel ? appt : null} onClose={() => setCancel(false)} />
      <RefundModal appt={refund ? appt : null} onClose={() => setRefund(false)} />
      <WaiveFeeModal appt={waive ? appt : null} onClose={() => setWaive(false)} />
      <ConfirmModal
        open={!!confirm}
        danger={confirm?.kind === 'undoci'}
        title={confirm?.kind === 'noshow' ? 'Mark as No-show' : 'Undo Check-in'}
        body={
          confirm?.kind === 'noshow'
            ? `Mark ${appt.name} as a no-show? You can undo this afterwards.`
            : `Send ${appt.name} back to Scheduled and remove their token from the queue?`
        }
        confirmLabel={confirm?.kind === 'noshow' ? 'Mark No-show' : 'Undo Check-in'}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (!confirm) return;
          if (confirm.kind === 'noshow') noShow(appt.id);
          else undoCheckIn(appt.id);
          setConfirm(null);
        }}
      />
    </>
  );
}
