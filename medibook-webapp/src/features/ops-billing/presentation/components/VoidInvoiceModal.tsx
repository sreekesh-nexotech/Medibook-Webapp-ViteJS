import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { required } from '@/shared/lib/validate';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { OpsField } from '@/shared/ui/OpsField';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import { useVoidInvoiceMutation } from '@/features/ops-billing/application/queries/useVoidInvoiceMutation';
import type { BillingInvoice } from '@/features/ops-billing/domain/entities/billing.entities';
import { failureText, rupees } from '@/features/ops-billing/presentation/components/billingView';

/** `VoidSerializer.reason` max length. */
const REASON_MAX_LENGTH = 2000;
const VOID_FAILED = 'The invoice could not be voided. Please try again.';

interface VoidForm {
  reason: string;
}

const VALIDATORS: FormValidators<VoidForm> = {
  reason: (value) => required(value, 'A reason'),
};

interface VoidInvoiceModalProps {
  invoice: BillingInvoice;
  onClose: () => void;
}

/**
 * Void an invoice that was raised in error. Only a draft or unpaid invoice
 * with nothing paid against it can be voided; the reason is kept on the
 * invoice's billing history.
 */
export function VoidInvoiceModal({ invoice, onClose }: VoidInvoiceModalProps) {
  const voidInvoice = useVoidInvoiceMutation();

  const form = useForm<VoidForm>({
    initial: { reason: '' },
    validate: VALIDATORS,
    onSubmit: async (values) => {
      try {
        await voidInvoice.mutateAsync({ id: invoice.id, reason: values.reason.trim() });
        toast(`${invoice.invoiceNo} voided.`, 'success');
        onClose();
      } catch (error) {
        toast(failureText(error, VOID_FAILED), 'error');
      }
    },
  });

  return (
    <FormModal
      open
      onClose={onClose}
      title={`Void ${invoice.invoiceNo}?`}
      width={520}
      onSubmit={form.handleSubmit}
      submitLabel="Void Invoice"
      submitVariant="danger"
      busy={form.submitting}
    >
      <div className="flex flex-col gap-4.5">
        <OpsField label="Reason" required error={form.errorFor('reason')}>
          <TextInput
            value={form.values.reason}
            onChange={(v) => form.setField('reason', v)}
            onBlur={() => form.blurField('reason')}
            maxLength={REASON_MAX_LENGTH}
            placeholder="e.g. Raised against the wrong plan"
            height={48}
          />
        </OpsField>
        <div className="text-caption text-text-muted bg-y-100 flex items-start gap-2 rounded-sm px-3 py-2.5">
          <Icon name="triangle-alert" size={14} className="mt-px flex-none" />
          {invoice.hospitalName} will no longer owe {rupees(invoice.totalPaise)} on this invoice.
          Voiding cannot be undone.
        </div>
      </div>
    </FormModal>
  );
}
