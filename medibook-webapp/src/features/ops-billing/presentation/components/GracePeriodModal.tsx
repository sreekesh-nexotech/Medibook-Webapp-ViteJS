import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { daysFromTodayISO, fmtDate } from '@/shared/lib/format';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { OpsField } from '@/shared/ui/OpsField';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import { useSetInvoiceGraceMutation } from '@/features/ops-billing/application/queries/useSetInvoiceGraceMutation';
import type { BillingInvoice } from '@/features/ops-billing/domain/entities/billing.entities';
import {
  type GraceView,
  failureText,
  plural,
} from '@/features/ops-billing/presentation/components/billingView';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const GRACE_FAILED = 'The grace window could not be saved. Please try again.';

interface GraceForm {
  endsIso: string;
}

interface GracePeriodModalProps {
  invoice: BillingInvoice;
  /** The window as it stands, so the field starts from it. */
  grace: GraceView;
  onClose: () => void;
}

/**
 * Set when an unpaid invoice's grace window closes (audit SA-03: "no grace
 * period"). The backend stores the end date on the invoice; it may not fall
 * before the due date. Moving it past today lifts the D-30 read-only state the
 * dunning job placed, if no other invoice is past its own window.
 */
export function GracePeriodModal({ invoice, grace, onClose }: GracePeriodModalProps) {
  const setGrace = useSetInvoiceGraceMutation();

  const validators: FormValidators<GraceForm> = {
    endsIso: (value) => {
      if (!ISO_DATE.test(value)) return 'Pick the date the grace window closes.';
      return value >= invoice.dueAt
        ? undefined
        : `The window cannot close before the due date, ${fmtDate(invoice.dueAt)}.`;
    },
  };

  const form = useForm<GraceForm>({
    initial: { endsIso: grace.endsIso },
    validate: validators,
    onSubmit: async (values) => {
      try {
        await setGrace.mutateAsync({ id: invoice.id, graceEndsAt: values.endsIso });
        toast(
          `Grace window for ${invoice.invoiceNo} now ends ${fmtDate(values.endsIso)}.`,
          'success',
        );
        onClose();
      } catch (error) {
        toast(failureText(error, GRACE_FAILED), 'error');
      }
    },
  });

  const { values } = form;
  const left = ISO_DATE.test(values.endsIso) ? daysFromTodayISO(values.endsIso) : null;

  return (
    <FormModal
      open
      onClose={onClose}
      title={`Grace window for ${invoice.invoiceNo}`}
      width={520}
      onSubmit={form.handleSubmit}
      submitLabel="Save Grace Window"
      busy={form.submitting}
    >
      <div className="flex flex-col gap-4.5">
        <OpsField
          label="Grace Ends On"
          required
          error={form.errorFor('endsIso')}
          hint={`Due ${fmtDate(invoice.dueAt)}. ${
            grace.source === 'invoice'
              ? 'Currently set on this invoice.'
              : grace.source === 'hospital'
                ? "Currently from the hospital's own grace setting."
                : grace.estimated
                  ? 'Currently the platform default (estimated here).'
                  : 'Currently the platform default.'
          }`}
        >
          <TextInput
            value={values.endsIso}
            onChange={(v) => form.setField('endsIso', v)}
            onBlur={() => form.blurField('endsIso')}
            type="date"
            min={invoice.dueAt}
            height={48}
          />
        </OpsField>
        <div className="text-caption text-text-muted bg-blue-soft-bg flex items-start gap-2 rounded-sm px-3 py-2.5">
          <Icon name="info" size={14} className="mt-px flex-none" />
          <span>
            {left === null
              ? 'Pick a date to see how long the hospital has.'
              : left >= 0
                ? `The hospital has ${plural(left, 'day')} left to pay.`
                : `That date is ${plural(-left, 'day')} ago, so the window stays closed.`}{' '}
            If the invoice is still unpaid when the window closes, the hospital becomes read-only
            (staff keep signing in) until it is paid; a date in the future lifts that again.
          </span>
        </div>
      </div>
    </FormModal>
  );
}
