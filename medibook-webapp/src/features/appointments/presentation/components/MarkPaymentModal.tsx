import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { cn } from '@/shared/lib/cn';
import { money } from '@/shared/lib/format';
import { minLen } from '@/shared/lib/validate';
import { Avatar } from '@/shared/ui/Avatar';
import { Badge } from '@/shared/ui/Badge';
import { Field } from '@/shared/ui/Field';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import type { IconName } from '@/shared/ui/icon-registry';
import { TextInput } from '@/shared/ui/TextInput';

import { useAppointmentsStore } from '@/features/appointments/application/store/appointments.store';
import {
  GST_LABEL,
  taxBreakdown,
} from '@/features/appointments/application/store/appointments.logic';
import type {
  Appointment,
  PaymentMode,
} from '@/features/appointments/application/store/appointments.types';

const MODES: readonly (readonly [PaymentMode, IconName])[] = [
  ['Cash', 'banknote'],
  ['UPI', 'smartphone'],
  ['Card', 'credit-card'],
];

/** A UPI txn id or the last 4 card digits — short, but not one character. */
const MIN_REF_LEN = 4;

interface PayForm {
  mode: PaymentMode;
  ref: string;
}

/** A non-cash payment with no traceable reference cannot be reconciled later. */
const VALIDATORS: FormValidators<PayForm> = {
  ref: (value, values) =>
    values.mode === 'Cash' || value.trim() === ''
      ? undefined
      : minLen(value, MIN_REF_LEN, 'The reference'),
};

interface MarkPaymentModalProps {
  appt: Appointment | null;
  onClose: () => void;
  onPaid?: () => void;
}

/** Record a walk-in's external payment (design `Flows.jsx` `MarkPaymentModal`). */
function MarkPaymentForm({
  appt,
  onClose,
  onPaid,
}: {
  appt: Appointment;
  onClose: () => void;
  onPaid?: () => void;
}) {
  const markPaid = useAppointmentsStore((s) => s.markPaid);
  const tax = taxBreakdown(appt.amount);
  const form = useForm<PayForm>({
    initial: { mode: 'Cash', ref: '' },
    validate: VALIDATORS,
    onSubmit: (v) => {
      markPaid(appt.id, { mode: v.mode, ref: v.ref.trim() });
      onPaid?.();
    },
  });

  return (
    <FormModal
      open
      onClose={onClose}
      title="Record Payment"
      width={560}
      onSubmit={form.handleSubmit}
      submitLabel="Mark Paid & Issue Token"
      submitVariant="success"
      busy={form.submitting}
    >
      <div className="flex flex-col gap-4.5">
        <div className="bg-blue-soft-bg flex items-center gap-3 rounded-md px-3.5 py-3">
          <Avatar name={appt.name} size={38} />
          <div className="flex-1">
            <div className="text-body text-text-strong font-medium">{appt.name}</div>
            <div className="text-caption text-text-muted">
              {appt.mrn} · {appt.doctor} · {appt.dept}
            </div>
          </div>
          <Badge status="Walk-in" />
        </div>
        <div className="border-border-soft overflow-hidden rounded-md border">
          <div className="border-border-soft text-body text-text-body flex justify-between border-b px-3.5 py-3">
            <span>Consultation — {appt.dept}</span>
            <span className="font-semibold tabular-nums">{money(tax.subtotal)}</span>
          </div>
          <div className="border-border-soft text-body text-text-body flex justify-between border-b px-3.5 py-3">
            <span>{GST_LABEL}</span>
            <span className="tabular-nums">{money(tax.gst)}</span>
          </div>
          <div className="bg-bg-tint text-body text-text-navy flex justify-between px-3.5 py-3 font-medium">
            <span>Total Payable</span>
            <span className="tabular-nums">{money(tax.total)}</span>
          </div>
        </div>
        <div className="text-caption text-text-muted bg-y-100 flex items-center gap-2 rounded-md px-3 py-2.25">
          <Icon name="info" size={15} className="text-y-700 flex-none" /> Payment is collected
          externally — record the mode here to generate the bill &amp; token.
        </div>
        <div>
          <div className="text-body text-text-strong mb-2">Payment Mode</div>
          <div className="flex gap-3">
            {MODES.map(([m, ic]) => (
              <button
                key={m}
                type="button"
                aria-pressed={form.values.mode === m}
                onClick={() => form.setField('mode', m)}
                className={cn(
                  'flex flex-1 cursor-pointer flex-col items-center gap-2 rounded-lg py-3.5',
                  form.values.mode === m
                    ? 'border-blue bg-blue-soft-bg text-blue border-2'
                    : 'border-border text-text-muted border bg-white',
                )}
              >
                <Icon name={ic} size={22} />
                <span className="text-body">{m}</span>
              </button>
            ))}
          </div>
        </div>
        {form.values.mode !== 'Cash' && (
          <Field
            label={`${form.values.mode} Reference No. (optional)`}
            error={form.errorFor('ref')}
          >
            <TextInput
              value={form.values.ref}
              onChange={(v) => form.setField('ref', v)}
              onBlur={() => form.blurField('ref')}
              placeholder="e.g. UPI txn id / last 4 digits"
              height={48}
            />
          </Field>
        )}
      </div>
    </FormModal>
  );
}

/** Keyed wrapper: a new appointment gets a fresh form, with no prop-to-state effect. */
export function MarkPaymentModal({ appt, onClose, onPaid }: MarkPaymentModalProps) {
  if (!appt) return null;
  return <MarkPaymentForm key={appt.id} appt={appt} onClose={onClose} onPaid={onPaid} />;
}
