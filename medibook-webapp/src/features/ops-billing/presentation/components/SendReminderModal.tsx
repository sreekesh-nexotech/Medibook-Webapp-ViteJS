import { OpsConfirm } from '@/shared/ui/OpsConfirm';
import { toast } from '@/shared/ui/toast/toast.store';

import { useQueueReminderMutation } from '@/features/ops-billing/application/queries/useQueueReminderMutation';
import type { BillingInvoice } from '@/features/ops-billing/domain/entities/billing.entities';
import {
  failureText,
  outstandingPaise,
  plural,
  rupees,
} from '@/features/ops-billing/presentation/components/billingView';

const REMINDER_FAILED = 'The reminder could not be queued. Please try again.';

interface SendReminderModalProps {
  invoice: BillingInvoice;
  /** The billing contact on the invoice, when it has one. */
  hospitalEmail: string | null;
  onClose: () => void;
}

/**
 * Queue a payment reminder against an unpaid invoice (audit SA-03: "no
 * reminder"). The backend picks the channel and recipient from the hospital's
 * billing contact and delivers it, so ops only confirms; the reminder then
 * shows in the invoice's history as Queued, and as Sent once delivered.
 */
export function SendReminderModal({ invoice, hospitalEmail, onClose }: SendReminderModalProps) {
  const queue = useQueueReminderMutation();

  const handleConfirm = (): void => {
    queue.mutate(invoice.id, {
      onSuccess: () => {
        toast(`Reminder queued for ${invoice.invoiceNo}.`, 'success');
        onClose();
      },
      onError: (error) => toast(failureText(error, REMINDER_FAILED), 'error', error),
    });
  };

  return (
    <OpsConfirm
      open
      onClose={onClose}
      icon="bell-ring"
      tone="primary"
      title={`Queue a payment reminder for ${invoice.invoiceNo}?`}
      body={`${invoice.hospitalName} is reminded that ${rupees(outstandingPaise(invoice))} is due. ${
        invoice.remindersSent > 0
          ? `${plural(invoice.remindersSent, 'reminder')} already went out for this invoice.`
          : 'This is the first reminder for this invoice.'
      }`}
      summary={[
        { k: 'Hospital', v: invoice.hospitalName },
        { k: 'Billing contact', v: hospitalEmail ?? 'On the hospital record' },
        { k: 'Amount due', v: rupees(outstandingPaise(invoice)), num: true },
      ]}
      confirmLabel={queue.isPending ? 'Queuing…' : 'Queue Reminder'}
      busy={queue.isPending}
      onConfirm={handleConfirm}
    />
  );
}
