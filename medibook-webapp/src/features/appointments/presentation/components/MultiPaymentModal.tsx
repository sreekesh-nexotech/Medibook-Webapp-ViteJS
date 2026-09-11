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

const MIN_REF_LEN = 4;

interface MultiPayForm {
  mode: PaymentMode;
  ref: string;
}

/** A non-cash payment with no traceable reference cannot be reconciled later. */
const VALIDATORS: FormValidators<MultiPayForm> = {
  ref: (value, values) =>
    values.mode === 'Cash' || value.trim() === ''
      ? undefined
      : minLen(value, MIN_REF_LEN, 'The reference'),
};

interface MultiPaymentModalProps {
  open: boolean;
  patient?: string;
  appts: readonly Appointment[] | null;
  onClose: () => void;
  onPaid?: (updated: Appointment[]) => void;
}

/** Combined walk-in payment for several consultations (design `Flows.jsx` `MultiPaymentModal`). */
function MultiPaymentForm({
  patient,
  appts,
  onClose,
  onPaid,
}: {
  patient?: string;
  appts: readonly Appointment[];
  onClose: () => void;
  onPaid?: (updated: Appointment[]) => void;
}) {
  const markPaidMany = useAppointmentsStore((s) => s.markPaidMany);
  const tax = taxBreakdown(appts.reduce((s, a) => s + a.amount, 0));
  const form = useForm<MultiPayForm>({
    initial: { mode: 'Cash', ref: '' },
    validate: VALIDATORS,
    onSubmit: (v) => {
      const updated = markPaidMany(
        appts.map((a) => a.id),
        { mode: v.mode, ref: v.ref.trim() },
      );
      onPaid?.(updated);
    },
  });

  return (
    <FormModal
      open
      onClose={onClose}
      title={appts.length > 1 ? 'Record Payment · Multiple Consultations' : 'Record Payment'}
      width={560}
      onSubmit={form.handleSubmit}
      submitLabel={`Mark Paid & Issue ${appts.length > 1 ? 'Tokens' : 'Token'}`}
      submitVariant="success"
      busy={form.submitting}
    >
      <div className="flex flex-col gap-4">
        <div className="bg-blue-soft-bg flex items-center gap-3 rounded-md px-3.5 py-3">
          <Avatar name={patient} size={38} />
          <div className="flex-1">
            <div className="text-body text-text-strong font-medium">{patient}</div>
            <div className="text-caption text-text-muted">
              {appts.length} consultation{appts.length > 1 ? 's' : ''}
            </div>
          </div>
          <Badge status="Walk-in" />
        </div>
        <div className="border-border-soft overflow-hidden rounded-md border">
          {appts.map((a) => (
            <div
              key={a.id}
              className="border-border-soft text-body text-text-body flex justify-between border-b px-3.5 py-2.75"
            >
              <span>
                {a.doctor} · {a.dept}
              </span>
              <span className="font-semibold tabular-nums">{money(a.amount)}</span>
            </div>
          ))}
          <div className="border-border-soft text-body text-text-body flex justify-between border-b px-3.5 py-2.75">
            <span>Subtotal</span>
            <span className="tabular-nums">{money(tax.subtotal)}</span>
          </div>
          <div className="border-border-soft text-body text-text-body flex justify-between border-b px-3.5 py-2.75">
            <span>{GST_LABEL}</span>
            <span className="tabular-nums">{money(tax.gst)}</span>
          </div>
          <div className="bg-bg-tint text-body text-text-navy flex justify-between px-3.5 py-3 font-medium">
            <span>Total Payable</span>
            <span className="tabular-nums">{money(tax.total)}</span>
          </div>
        </div>
        <div className="text-caption text-text-muted bg-y-100 flex items-center gap-2 rounded-md px-3 py-2.25">
          <Icon name="info" size={15} className="text-y-700 flex-none" /> Fees are set by each
          department/doctor — collected together, with a token issued per consultation.
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

/** Keyed wrapper: a fresh batch gets a fresh form, with no prop-to-state effect. */
export function MultiPaymentModal({
  open,
  patient,
  appts,
  onClose,
  onPaid,
}: MultiPaymentModalProps) {
  if (!open || !appts || appts.length === 0) return null;
  return (
    <MultiPaymentForm
      key={appts.map((a) => a.id).join('-')}
      patient={patient}
      appts={appts}
      onClose={onClose}
      onPaid={onPaid}
    />
  );
}
