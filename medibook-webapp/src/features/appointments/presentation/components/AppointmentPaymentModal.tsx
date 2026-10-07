import { useRef, useState } from 'react';

import { money, moneyFromPaise, parseHundredths, rupeesFromPaise } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { Field } from '@/shared/ui/Field';
import { IconBtn } from '@/shared/ui/IconBtn';
import { Modal } from '@/shared/ui/Modal';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import { isFailure } from '@/core/error/failure';

import type {
  DeskAppointment,
  DeskReceipt,
  PaymentMethod,
} from '@/features/appointments/domain/entities/appointments.entities';
import { useCollectPaymentMutation } from '@/features/appointments/application/queries/appointments.mutations';
import {
  DESK_METHODS,
  methodLabel,
} from '@/features/appointments/presentation/components/appointments.view';

/** Rupee amounts are compared at paise precision. */
const PAISE_PER_RUPEE = 100;

/** The backend's answer when a cash line has no open cash session (D-28). */
const CASH_SESSION_REQUIRED = 'CASH_SESSION_REQUIRED';

interface Line {
  readonly key: number;
  readonly method: PaymentMethod;
  readonly amount: string;
  readonly reference: string;
}

interface AppointmentPaymentModalProps {
  /** The walk-in to collect for; `null` = closed. */
  appt: DeskAppointment | null;
  onClose: () => void;
  onPaid: (receipt: DeskReceipt) => void;
}

/**
 * Collect a walk-in's fee at the desk (D-27): one or more lines across cash,
 * UPI and card that must add up to the amount due. Cash lines are taken into
 * the receptionist's open cash session; without one the backend refuses and
 * this says so. Online bookings are prepaid and never come here (Q89).
 */
export function AppointmentPaymentModal({ appt, onClose, onPaid }: AppointmentPaymentModalProps) {
  if (!appt) return null;
  return <PaymentForm key={appt.id} appt={appt} onClose={onClose} onPaid={onPaid} />;
}

function PaymentForm({
  appt,
  onClose,
  onPaid,
}: {
  appt: DeskAppointment;
  onClose: () => void;
  onPaid: (receipt: DeskReceipt) => void;
}) {
  const collect = useCollectPaymentMutation();
  const due = appt.totalRupees;
  const duePaise = Math.round(due * PAISE_PER_RUPEE);
  const [lines, setLines] = useState<readonly Line[]>([
    { key: 1, method: 'cash', amount: rupeesFromPaise(duePaise), reference: '' },
  ]);
  const [error, setError] = useState<string | null>(null);
  /** Set the moment Record is pressed, so a double click sends one request (DATA-11). */
  const inFlight = useRef(false);
  const busy = collect.isPending;

  // Every line in integer paise, parsed from the digits typed; `null` when the
  // text is not an amount with at most two decimals (DATA-09).
  const parsed = lines.map((l) => ({ ...l, paise: parseHundredths(l.amount) }));
  const enteredPaise = parsed.reduce((sum, l) => sum + (l.paise ?? 0), 0);
  const remainingPaise = duePaise - enteredPaise;

  const update = (key: number, patch: Partial<Line>): void =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const addLine = (): void =>
    setLines((ls) => [
      ...ls,
      {
        key: Math.max(...ls.map((l) => l.key)) + 1,
        method: 'upi',
        amount: remainingPaise > 0 ? rupeesFromPaise(remainingPaise) : '',
        reference: '',
      },
    ]);

  const submit = (): void => {
    if (inFlight.current) return;
    const valid = parsed.flatMap((l) =>
      l.paise !== null && l.paise > 0
        ? [{ method: l.method, amountPaise: l.paise, reference: l.reference.trim() }]
        : [],
    );
    if (valid.length !== parsed.length) {
      setError('Every line needs an amount greater than zero, with at most two decimals.');
      return;
    }
    if (remainingPaise !== 0) {
      setError(
        `The lines must add up to ${money(due)} — ${moneyFromPaise(Math.abs(remainingPaise))} ${remainingPaise > 0 ? 'still to collect' : 'too much'}.`,
      );
      return;
    }
    setError(null);
    inFlight.current = true;
    collect.mutate(
      { id: appt.id, lines: valid },
      {
        onSettled: () => {
          inFlight.current = false;
        },
        onSuccess: (receipt) => {
          toast(`Payment of ${money(due)} recorded`, 'success');
          onPaid(receipt);
        },
        onError: (failure) => {
          const message =
            isFailure(failure) && failure.code === CASH_SESSION_REQUIRED
              ? 'Open your cash drawer on the Payments screen before taking cash, or collect by UPI or card.'
              : isFailure(failure)
                ? failure.message
                : 'Could not record the payment.';
          setError(message);
        },
      },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!busy}
      title="Collect Payment"
      width={560}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button icon="indian-rupee" onClick={submit} busy={busy}>
            Record {money(due)}
          </Button>
        </>
      }
    >
      <div className="text-body text-text-body mb-4">
        {appt.patient?.fullName ?? 'Patient'} · {appt.doctor.name} · booking {appt.bookingRef}
      </div>
      <div className="flex flex-col gap-3">
        {lines.map((l) => (
          <div key={l.key} className="flex items-end gap-3">
            <Field label="Method" className="flex-1">
              <Select
                value={methodLabel(l.method)}
                options={DESK_METHODS.map(methodLabel)}
                onChange={(label) =>
                  update(l.key, {
                    method: DESK_METHODS.find((m) => methodLabel(m) === label) ?? 'cash',
                  })
                }
              />
            </Field>
            <Field label="Amount (₹)" className="flex-1">
              <TextInput
                value={l.amount}
                inputMode="decimal"
                onChange={(v) => update(l.key, { amount: v.replace(/[^0-9.]/g, '') })}
              />
            </Field>
            <Field label="Reference" className="flex-1">
              <TextInput
                value={l.reference}
                placeholder={l.method === 'cash' ? 'Optional' : 'UPI / card ref.'}
                onChange={(v) => update(l.key, { reference: v })}
              />
            </Field>
            <IconBtn
              name="trash-2"
              label="Remove line"
              box={40}
              size={15}
              color="var(--color-d-600)"
              onClick={() =>
                setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : ls))
              }
            />
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <Button size="sm" variant="ghost" icon="plus" onClick={addLine}>
          Split payment
        </Button>
        <span className="text-body text-text-muted tabular-nums">
          Due {money(due)} · entered {moneyFromPaise(enteredPaise)}
        </span>
      </div>
      {error && (
        <div role="alert" className="text-caption text-danger bg-d-100 mt-3 rounded-sm px-3 py-2.5">
          {error}
        </div>
      )}
    </Modal>
  );
}
