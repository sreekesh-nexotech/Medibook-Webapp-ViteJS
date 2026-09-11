import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { useOpsAct } from '@/shared/hooks/useOpsAct';
import { money } from '@/shared/lib/format';
import { minLen, notFutureDate } from '@/shared/lib/validate';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { OpsField } from '@/shared/ui/OpsField';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';

import { opsTodayIso } from '@/features/ops-hospitals/application/store/opsDates';

import { useBillingStore } from '@/features/ops-billing/application/store/billing.store';
import {
  OFFLINE_PAYMENT_METHODS,
  type Invoice,
  type PaymentMethod,
} from '@/features/ops-billing/application/store/billing.types';

interface MarkPaidForm {
  mode: PaymentMethod;
  reference: string;
  dateIso: string;
}

const VALIDATORS: FormValidators<MarkPaidForm> = {
  reference: (value) => minLen(value, 4, 'Payment reference'),
  dateIso: (value) => notFutureDate(value, 'Payment date'),
};

/** Placeholder per mode, so ops knows which reference to paste. */
const REFERENCE_PLACEHOLDER: Readonly<Record<PaymentMethod, string>> = {
  'Bank transfer': 'UTR, e.g. HDFCN52026061300123',
  Cheque: 'Cheque number, e.g. 004512',
  Cash: 'Receipt number, e.g. MB/CASH/0042',
  UPI: 'UPI reference, e.g. 415912345678',
  Card: 'Gateway reference',
  NetBanking: 'Bank reference',
};

interface MarkPaidModalProps {
  open: boolean;
  invoice: Invoice;
  onClose: () => void;
  onDone?: () => void;
}

/**
 * Record a payment received outside the gateway (audit SA-03: "no
 * mark-as-paid"). The mode, reference and date are all required because they
 * are what makes the record real: the store writes the payment row they
 * describe and recomputes the invoice status from it, rather than flipping a
 * status with nothing behind it.
 */
export function MarkPaidModal({ open, invoice, onClose, onDone }: MarkPaidModalProps) {
  const markPaid = useBillingStore((s) => s.markPaid);
  const [busy, run] = useOpsAct();

  const form = useForm<MarkPaidForm>({
    initial: { mode: 'Bank transfer', reference: '', dateIso: opsTodayIso() },
    validate: VALIDATORS,
    onSubmit: (values) => {
      run('markpaid', `${invoice.no} marked paid — ${money(invoice.amount)} recorded.`, () => {
        markPaid(invoice.id, {
          mode: values.mode,
          reference: values.reference.trim(),
          dateIso: values.dateIso,
        });
        onDone?.();
      });
    },
  });

  const { values } = form;

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={`Mark ${invoice.no} as paid`}
      width={520}
      onSubmit={form.handleSubmit}
      submitLabel="Mark as Paid"
      submitVariant="success"
      busy={busy.markpaid}
    >
      <div className="flex flex-col gap-4.5">
        <div className="bg-bg-subtle border-border flex flex-col gap-2 rounded-md border px-4 py-3">
          <div className="flex justify-between gap-3">
            <span className="text-caption text-text-muted">Hospital</span>
            <span className="text-body text-text-strong font-medium">{invoice.hospital}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-caption text-text-muted">Amount (incl. 18% GST)</span>
            <span className="text-body text-text-strong font-medium tabular-nums">
              {money(invoice.amount)}
            </span>
          </div>
        </div>
        <OpsField label="Payment Mode" required>
          <Select
            value={values.mode}
            options={OFFLINE_PAYMENT_METHODS}
            onChange={(v) => form.setField('mode', v as PaymentMethod)}
            height={48}
          />
        </OpsField>
        <OpsField
          label="Reference"
          required
          error={form.errorFor('reference')}
          hint="Stored on the payment record so finance can reconcile it."
        >
          <TextInput
            value={values.reference}
            onChange={(v) => form.setField('reference', v)}
            onBlur={() => form.blurField('reference')}
            placeholder={REFERENCE_PLACEHOLDER[values.mode]}
            height={48}
          />
        </OpsField>
        <OpsField label="Date Received" required error={form.errorFor('dateIso')}>
          <TextInput
            value={values.dateIso}
            onChange={(v) => form.setField('dateIso', v)}
            onBlur={() => form.blurField('dateIso')}
            type="date"
            height={48}
          />
        </OpsField>
        <div className="text-caption text-text-muted bg-blue-soft-bg flex items-start gap-2 rounded-sm px-3 py-2.5">
          <Icon name="info" size={14} className="mt-px flex-none" /> A payment transaction is
          created for this invoice and the invoice moves to Completed. Any suspension for
          non-payment has to be lifted separately, on the hospital&apos;s profile.
        </div>
      </div>
    </FormModal>
  );
}
