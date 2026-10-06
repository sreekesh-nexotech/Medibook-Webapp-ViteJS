import { useState } from 'react';

import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { calendarInstant, todayISO } from '@/shared/lib/format';
import { notFutureDate, positiveAmount } from '@/shared/lib/validate';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { OpsField } from '@/shared/ui/OpsField';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import { useMarkInvoicePaidMutation } from '@/features/ops-billing/application/queries/useMarkInvoicePaidMutation';
import type {
  BillingInvoice,
  PaymentMethod,
} from '@/features/ops-billing/domain/entities/billing.entities';
import {
  METHOD_LABELS,
  failureText,
  fromLabel,
  outstandingPaise,
  rupees,
} from '@/features/ops-billing/presentation/components/billingView';

/** Time of day recorded for a payment entered by date alone. */
const MIDDAY = '12:00:00';

const PAISE_PER_RUPEE = 100;
const REFERENCE_MAX_LENGTH = 200;
const MARK_PAID_FAILED = 'The payment could not be recorded. Please try again.';

/** Order the modes the way ops collects off-gateway money most often. */
const METHOD_ORDER: readonly PaymentMethod[] = ['bank_transfer', 'manual', 'razorpay'];

/** Placeholder per mode, so ops knows which reference to paste. */
const REFERENCE_PLACEHOLDER: Readonly<Record<PaymentMethod, string>> = {
  bank_transfer: 'UTR, e.g. HDFCN52026061300123',
  manual: 'Cheque no., receipt no. or UPI reference',
  razorpay: 'Razorpay payment id, e.g. pay_29QQoUBi66xm2f',
};

interface MarkPaidForm {
  method: string;
  amount: string;
  reference: string;
  dateIso: string;
}

interface MarkPaidModalProps {
  invoice: BillingInvoice;
  onClose: () => void;
}

/**
 * Record a payment received outside the gateway (audit SA-03: "no
 * mark-as-paid"). The amount defaults to what is still owed and may be less —
 * a partial payment keeps the invoice open. The backend writes the payment row
 * and moves the invoice to Paid once it is covered in full.
 */
export function MarkPaidModal({ invoice, onClose }: MarkPaidModalProps) {
  const markPaid = useMarkInvoicePaidMutation();
  // One idempotency key per opening of the modal: a retried submit is
  // deduplicated by the backend instead of recording the money twice.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const owedPaise = outstandingPaise(invoice);
  const owedRupees = owedPaise / PAISE_PER_RUPEE;

  const validators: FormValidators<MarkPaidForm> = {
    amount: (value) => {
      const invalid = positiveAmount(value, 'Amount');
      if (invalid) return invalid;
      return Number(value) <= owedRupees
        ? undefined
        : `Amount cannot be more than the ${rupees(owedPaise)} still owed.`;
    },
    dateIso: (value) => notFutureDate(value, 'Payment date'),
  };

  const form = useForm<MarkPaidForm>({
    initial: {
      method: METHOD_LABELS.bank_transfer,
      amount: String(owedRupees),
      reference: '',
      dateIso: todayISO(),
    },
    validate: validators,
    onSubmit: async (values) => {
      const method = fromLabel(METHOD_LABELS, values.method) ?? 'bank_transfer';
      const amountPaise = Math.round(Number(values.amount) * PAISE_PER_RUPEE);
      try {
        const updated = await markPaid.mutateAsync({
          id: invoice.id,
          idempotencyKey,
          input: {
            method,
            reference: values.reference.trim() || null,
            // Only the day is known, so record noon on the hospital's calendar: that
            // instant falls on the chosen day in both IST and UTC (DATA-03).
            paidAt: calendarInstant(values.dateIso, MIDDAY),
            amountPaise,
          },
        });
        toast(
          updated.status === 'paid'
            ? `${invoice.invoiceNo} marked paid — ${rupees(amountPaise)} recorded.`
            : `${rupees(amountPaise)} recorded against ${invoice.invoiceNo}; ${rupees(outstandingPaise(updated))} still owed.`,
          'success',
        );
        onClose();
      } catch (error) {
        toast(failureText(error, MARK_PAID_FAILED), 'error');
      }
    },
  });

  const { values } = form;
  const method = fromLabel(METHOD_LABELS, values.method) ?? 'bank_transfer';

  return (
    <FormModal
      open
      onClose={onClose}
      title={`Mark ${invoice.invoiceNo} as paid`}
      width={520}
      onSubmit={form.handleSubmit}
      submitLabel="Record Payment"
      submitVariant="success"
      busy={form.submitting}
    >
      <div className="flex flex-col gap-4.5">
        <div className="bg-bg-subtle border-border flex flex-col gap-2 rounded-md border px-4 py-3">
          <div className="flex justify-between gap-3">
            <span className="text-caption text-text-muted">Hospital</span>
            <span className="text-body text-text-strong font-medium">{invoice.hospitalName}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-caption text-text-muted">Invoice total (incl. GST)</span>
            <span className="text-body text-text-strong font-medium tabular-nums">
              {rupees(invoice.totalPaise)}
            </span>
          </div>
          {invoice.amountPaidPaise > 0 && (
            <div className="flex justify-between gap-3">
              <span className="text-caption text-text-muted">Still owed</span>
              <span className="text-body text-text-strong font-medium tabular-nums">
                {rupees(owedPaise)}
              </span>
            </div>
          )}
        </div>
        <OpsField label="Payment Mode" required>
          <Select
            value={values.method}
            options={METHOD_ORDER.map((m) => METHOD_LABELS[m])}
            onChange={(v) => form.setField('method', v)}
            height={48}
          />
        </OpsField>
        <OpsField
          label="Amount Received (₹)"
          required
          error={form.errorFor('amount')}
          hint="Less than the amount owed records a part payment; the invoice stays open."
        >
          <TextInput
            value={values.amount}
            onChange={(v) => form.setField('amount', v)}
            onBlur={() => form.blurField('amount')}
            inputMode="decimal"
            height={48}
          />
        </OpsField>
        <OpsField
          label="Reference"
          hint="Stored on the payment record so finance can reconcile it."
        >
          <TextInput
            value={values.reference}
            onChange={(v) => form.setField('reference', v)}
            placeholder={REFERENCE_PLACEHOLDER[method]}
            maxLength={REFERENCE_MAX_LENGTH}
            height={48}
          />
        </OpsField>
        <OpsField label="Date Received" required error={form.errorFor('dateIso')}>
          <TextInput
            value={values.dateIso}
            onChange={(v) => form.setField('dateIso', v)}
            onBlur={() => form.blurField('dateIso')}
            type="date"
            max={todayISO()}
            height={48}
          />
        </OpsField>
        <div className="text-caption text-text-muted bg-blue-soft-bg flex items-start gap-2 rounded-sm px-3 py-2.5">
          <Icon name="info" size={14} className="mt-px flex-none" /> A payment record is created for
          this invoice. Once it is paid in full, a subscription held for non-payment is reinstated
          automatically; a manual suspension has to be lifted separately.
        </div>
      </div>
    </FormModal>
  );
}
