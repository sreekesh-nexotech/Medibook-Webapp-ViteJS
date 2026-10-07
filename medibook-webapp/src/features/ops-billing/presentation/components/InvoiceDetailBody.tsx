import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useOpsPermission } from '@/shared/hooks/useOpsPermission';
import { usePrintArea } from '@/shared/hooks/usePrintArea';
import { cn } from '@/shared/lib/cn';
import { downloadCsv } from '@/shared/lib/download';
import { fmtDate } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { IconBtn } from '@/shared/ui/IconBtn';
import { InfoGrid, type InfoGridItem } from '@/shared/ui/InfoGrid';
import { OpsConfirm } from '@/shared/ui/OpsConfirm';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';
import { toast } from '@/shared/ui/toast/toast.store';

import { OPS_BASE_PATH, OPS_VIEW_SEGMENT, opsPath } from '@/app/router/paths';

import { useInvoicePdfMutation } from '@/features/ops-billing/application/queries/useInvoiceFileMutations';
import { useInvoiceRemindersQuery } from '@/features/ops-billing/application/queries/useInvoiceRemindersQuery';
import { usePaymentsQuery } from '@/features/ops-billing/application/queries/usePaymentsQuery';
import { useRetryPaymentMutation } from '@/features/ops-billing/application/queries/useRetryPaymentMutation';
import { useSubscriptionQuery } from '@/features/ops-billing/application/queries/useSubscriptionQuery';
import type {
  BillingInvoiceDetail,
  PaymentListParams,
  SubscriptionPayment,
} from '@/features/ops-billing/domain/entities/billing.entities';
import {
  DUNNING_LABELS,
  INVOICE_STATUS_BADGES,
  METHOD_LABELS,
  PAYMENT_STATUS_BADGES,
  canVoid,
  dateOf,
  failureText,
  fmtDateTime,
  graceFor,
  gstLabel,
  ratePercent,
  isNotImplemented,
  isUnpaid,
  outstandingPaise,
  paiseToRupees,
  plural,
  reminderSummary,
  rupees,
  saveFile,
  subscriptionBadge,
} from '@/features/ops-billing/presentation/components/billingView';
import { GracePeriodModal } from '@/features/ops-billing/presentation/components/GracePeriodModal';
import { InvoicePrintSheet } from '@/features/ops-billing/presentation/components/InvoicePrintSheet';
import { MarkPaidModal } from '@/features/ops-billing/presentation/components/MarkPaidModal';
import { SendReminderModal } from '@/features/ops-billing/presentation/components/SendReminderModal';
import { VoidInvoiceModal } from '@/features/ops-billing/presentation/components/VoidInvoiceModal';
import { useHospitalQuery } from '@/features/ops-hospitals/application/queries/useHospitalQuery';
import { useReinstateHospitalMutation } from '@/features/ops-hospitals/application/queries/useReinstateHospitalMutation';
import { useOpsSettingsQuery } from '@/features/ops-settings/application/queries/useOpsSettingsQuery';

/** Which action dialog is open. */
type InvoiceModal = 'reminder' | 'paid' | 'grace' | 'void' | 'unsuspend' | null;

const REMINDER_COLUMNS = ['Date', 'Event', 'By', 'Note'] as const;
const ATTEMPT_COLUMNS = ['Payment', 'Method', 'Date', 'Amount', 'Status', 'Action'] as const;
const LINE_COLUMNS = ['Item', 'Qty', 'Amount', 'GST', 'Total'] as const;
const HISTORY_LOADING_ROWS = 2;

/** An invoice's payments fit one page; read the backend's widest. */
const INVOICE_PAYMENTS_PAGE_SIZE = 100;

const PDF_FAILED = 'The invoice PDF could not be downloaded. Please try again.';
const RETRY_FAILED = 'The payment could not be retried. Please try again.';
const RETRY_UNAVAILABLE =
  'Gateway retries are not available while subscription billing is manual. Record money received with Mark as Paid.';
const REINSTATE_FAILED = 'The suspension could not be lifted. Please try again.';

interface InvoiceDetailBodyProps {
  invoice: BillingInvoiceDetail;
}

/**
 * Everything on the invoice detail screen once the invoice has loaded: line
 * items and parties as issued, the collection actions (reminder, mark paid,
 * grace window, void), the reminder history from the dunning log, and the
 * invoice's payments. Non-payment is handled by D-30 dunning (grace, then
 * read-only with sign-in kept), so this screen shows that state rather than
 * offering a suspension (11·F14); suspending is a separate compliance action
 * on the hospital page. Split from the screen so the hospital read starts
 * only with a real hospital id.
 */
export function InvoiceDetailBody({ invoice: inv }: InvoiceDetailBodyProps) {
  const navigate = useNavigate();
  const { id } = inv;
  const [modal, setModal] = useState<InvoiceModal>(null);
  const { ref: printRef, print } = usePrintArea<HTMLDivElement>();

  const subscriptionQuery = useSubscriptionQuery(inv.subscriptionId);
  const remindersQuery = useInvoiceRemindersQuery(id);
  const paymentParams: PaymentListParams = {
    page: 1,
    pageSize: INVOICE_PAYMENTS_PAGE_SIZE,
    statuses: [],
    method: null,
    invoiceId: id,
    sortField: 'attempted_at',
    sortDirection: 'desc',
  };
  const paymentsQuery = usePaymentsQuery(paymentParams);
  const hospitalQuery = useHospitalQuery(inv.hospitalId);
  const reinstate = useReinstateHospitalMutation();
  const retry = useRetryPaymentMutation();
  const [retryUnavailable, setRetryUnavailable] = useState(false);
  const pdf = useInvoicePdfMutation();
  // SEC-05: invoice actions need billing.edit; lifting a suspension needs hospitals.edit.
  const ops = useOpsPermission();
  const canBill = ops.can('billing.edit');
  const canSuspend = ops.can('hospitals.edit');
  // 11·F13: the platform grace default, when this role may read settings.
  const settingsQuery = useOpsSettingsQuery(ops.can('settings.view'));

  const subscription = subscriptionQuery.data ?? null;
  const planName = subscription?.planName ?? inv.planName;
  const unpaid = isUnpaid(inv);
  const owed = outstandingPaise(inv);
  const grace = graceFor(inv, subscription, settingsQuery.data?.defaultGraceDays ?? null);
  const subscriptionStatus = subscription ? subscriptionBadge(subscription.status) : null;
  const readOnly = subscription?.status === 'read_only' || subscription?.readOnly === true;
  const reminder = reminderSummary(inv);
  const hospital = hospitalQuery.data;
  const suspended = hospital?.status === 'suspended';
  const suspension = hospital?.activeSuspensions[0];
  const statusBadge = INVOICE_STATUS_BADGES[inv.status];
  const period = `${fmtDate(inv.periodStart)} – ${fmtDate(inv.periodEnd)}`;
  const hospitalPath = `${opsPath('hospitals')}/${encodeURIComponent(inv.hospitalId)}`;

  const retryPayment = (payment: SubscriptionPayment): void => {
    retry.mutate(
      { id: payment.id, idempotencyKey: crypto.randomUUID() },
      {
        onSuccess: () => toast('A new charge attempt was started.', 'success'),
        onError: (error) => {
          if (isNotImplemented(error)) {
            setRetryUnavailable(true);
            toast(RETRY_UNAVAILABLE, 'info');
          } else toast(failureText(error, RETRY_FAILED), 'error');
        },
      },
    );
  };

  const toPayment = (pid: string): void => {
    navigate(`${OPS_BASE_PATH}/${OPS_VIEW_SEGMENT['payment-detail'].replace(':id', pid)}`, {
      state: { invoiceId: inv.id },
    });
  };

  const savePdf = (): void => {
    pdf.mutate(
      { id: inv.id, invoiceNo: inv.invoiceNo },
      {
        onSuccess: saveFile,
        onError: (error) => {
          // No server-side PDF renderer: print the invoice through the browser.
          if (isNotImplemented(error)) print();
          else toast(failureText(error, PDF_FAILED), 'error');
        },
      },
    );
  };

  const exportCsv = (): void => {
    const filename = `${inv.invoiceNo}.csv`;
    downloadCsv(filename, [
      [
        'Invoice',
        'Hospital',
        'Plan',
        'Period start',
        'Period end',
        'Issued',
        'Due',
        'Status',
        'Taxable value (₹)',
        'GST (₹)',
        'Total (₹)',
        'Paid (₹)',
        'Paid at',
      ],
      [
        inv.invoiceNo,
        inv.hospitalName,
        planName ?? '',
        inv.periodStart,
        inv.periodEnd,
        inv.issuedAt,
        inv.dueAt,
        statusBadge.label,
        paiseToRupees(inv.subtotalPaise),
        paiseToRupees(inv.gstPaise),
        paiseToRupees(inv.totalPaise),
        paiseToRupees(inv.amountPaidPaise),
        inv.paidAt ?? '',
      ],
    ]);
    toast(`Exported ${filename}`, 'success');
  };

  const infoItems: InfoGridItem[] = [
    { k: 'Hospital', v: inv.hospitalName },
    { k: 'Billing Period', v: period },
    {
      k: 'Plan',
      v: subscriptionQuery.isPending && !planName ? 'Loading…' : (planName ?? '—'),
    },
    ...(subscriptionStatus
      ? [
          {
            k: 'Subscription',
            v: <Badge status={subscriptionStatus.status}>{subscriptionStatus.label}</Badge>,
          },
        ]
      : []),
    { k: 'Issued', v: fmtDateTime(inv.issuedAt) },
    { k: 'Due', v: fmtDate(inv.dueAt) },
    { k: 'Total', v: rupees(inv.totalPaise), num: true },
    ...(inv.amountPaidPaise > 0
      ? [
          { k: 'Paid So Far', v: rupees(inv.amountPaidPaise), num: true },
          { k: 'Still Owed', v: rupees(owed), num: true },
        ]
      : []),
    { k: 'Hospital GSTIN', v: inv.billedTo.gstin || '—', num: Boolean(inv.billedTo.gstin) },
    { k: 'Medibook GSTIN', v: inv.billedBy.gstin || '—', num: Boolean(inv.billedBy.gstin) },
    {
      k: 'Grace Window',
      v: grace
        ? `Ends ${fmtDate(grace.endsIso)}${grace.estimated ? ' (estimate)' : ''}`
        : inv.graceEndsAt
          ? fmtDate(inv.graceEndsAt)
          : '—',
    },
    {
      k: 'Reminders',
      v: (
        <span className="flex flex-col gap-1">
          <span>
            <Badge status={reminder.badge.status}>{reminder.badge.label}</Badge>
          </span>
          <span className="text-caption text-text-muted">{reminder.detail}</span>
        </span>
      ),
    },
    ...(inv.paidAt ? [{ k: 'Paid On', v: fmtDateTime(inv.paidAt) }] : []),
  ];

  const reminders = remindersQuery.data ?? [];
  const reminderState: TableStateSpec | undefined = remindersQuery.isPending
    ? { kind: 'loading', rows: HISTORY_LOADING_ROWS }
    : remindersQuery.isError
      ? {
          kind: 'error',
          message: failureText(remindersQuery.error, 'The reminder history could not be loaded.'),
          onRetry: () => void remindersQuery.refetch(),
        }
      : reminders.length === 0
        ? {
            kind: 'empty',
            icon: 'bell-ring',
            title: 'No reminders for this invoice.',
            message: unpaid
              ? 'Queue one to chase the hospital for payment.'
              : 'The invoice was settled without needing a reminder.',
            ...(unpaid && canBill
              ? { actionLabel: 'Queue reminder', onAction: () => setModal('reminder') }
              : {}),
          }
        : undefined;

  const payments = paymentsQuery.data?.items ?? [];
  const paymentState: TableStateSpec | undefined = paymentsQuery.isPending
    ? { kind: 'loading', rows: HISTORY_LOADING_ROWS }
    : paymentsQuery.isError
      ? {
          kind: 'error',
          message: failureText(paymentsQuery.error, 'The payments could not be loaded.'),
          onRetry: () => void paymentsQuery.refetch(),
        }
      : payments.length === 0
        ? {
            kind: 'empty',
            icon: 'indian-rupee',
            title: 'No payments yet.',
            message: unpaid
              ? 'Nothing has been paid against this invoice. Record money received outside the gateway with Mark as Paid.'
              : 'This invoice was settled without a payment record.',
            ...(unpaid && canBill
              ? { actionLabel: 'Mark as paid', onAction: () => setModal('paid') }
              : {}),
          }
        : undefined;

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <div className="bg-blue-soft-bg text-text-navy flex size-14 flex-none items-center justify-center rounded-lg">
            <Icon name="file-text" size={26} />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-3">
              <SectionTitle size={20}>
                <span className="tabular-nums">{inv.invoiceNo}</span>
              </SectionTitle>
              <Badge status={statusBadge.status}>{statusBadge.label}</Badge>
            </div>
            <span className="text-caption text-text-muted">
              {inv.hospitalName} · Issued {fmtDate(dateOf(inv.issuedAt))} · Due {fmtDate(inv.dueAt)}
            </span>
          </div>
          <div className="flex-1"></div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="ghost" onClick={() => navigate(hospitalPath)}>
              View Hospital
            </Button>
            <Button variant="secondary" icon="download" busy={pdf.isPending} onClick={savePdf}>
              Save as PDF
            </Button>
            <Button variant="secondary" icon="download" onClick={exportCsv}>
              Export CSV
            </Button>
            {canBill && canVoid(inv) && (
              <Button variant="ghost" icon="ban" onClick={() => setModal('void')}>
                Void
              </Button>
            )}
            {unpaid && canBill && (
              <>
                <Button variant="secondary" icon="bell-ring" onClick={() => setModal('reminder')}>
                  Send Reminder
                </Button>
                <Button icon="circle-check" onClick={() => setModal('paid')}>
                  Mark as Paid
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

      {unpaid && grace && (
        <Card pad={16}>
          <div className="flex flex-wrap items-center gap-3.5">
            <div
              className={cn(
                'flex size-10 flex-none items-center justify-center rounded-md',
                grace.expired ? 'bg-d-100 text-d-500' : 'bg-y-100 text-y-600',
              )}
            >
              <Icon name={grace.expired ? 'triangle-alert' : 'hourglass'} size={19} />
            </div>
            <div className="min-w-50 flex-1">
              <div className="text-body text-text-strong font-medium">
                {grace.expired
                  ? `Grace window closed ${plural(-grace.daysLeft, 'day')} ago`
                  : grace.inGrace
                    ? `Grace ends in ${plural(grace.daysLeft, 'day')}`
                    : `Due ${fmtDate(inv.dueAt)} · grace runs to ${fmtDate(grace.endsIso)}`}
              </div>
              <div className="text-caption text-text-muted">
                Ends {fmtDate(grace.endsIso)} (
                {grace.source === 'invoice'
                  ? 'set on this invoice'
                  : grace.source === 'hospital'
                    ? "from the hospital's grace setting"
                    : grace.estimated
                      ? 'estimated from the usual platform default'
                      : 'platform default'}
                ).{' '}
                {readOnly
                  ? 'The hospital is read-only until this is paid: staff can still sign in and read, but every change is refused.'
                  : 'If it is still unpaid then, the hospital becomes read-only automatically: staff can still sign in, but changes are refused until it is paid.'}
              </div>
            </div>
            {canBill && (
              <Button size="sm" variant="secondary" icon="clock" onClick={() => setModal('grace')}>
                Grace Window
              </Button>
            )}
            {canSuspend && suspended && (
              <Button size="sm" variant="secondary" onClick={() => setModal('unsuspend')}>
                Lift Suspension
              </Button>
            )}
          </div>
        </Card>
      )}

      {suspended && suspension && !(unpaid && grace) && (
        <Card pad={16} className="border-d-500">
          <div className="flex flex-wrap items-start gap-3.5">
            <div className="bg-d-100 text-d-500 flex size-10 flex-none items-center justify-center rounded-md">
              <Icon name="ban" size={19} />
            </div>
            <div className="min-w-50 flex-1">
              <div className="text-body text-text-strong font-medium">
                {inv.hospitalName} is suspended
                {suspension.reason.startsWith('non_payment') ? ' for non-payment' : ''}
              </div>
              <div className="text-caption text-text-muted">
                Since {fmtDateTime(suspension.suspendedAt)}
              </div>
            </div>
            {canSuspend && (
              <Button size="sm" variant="secondary" onClick={() => setModal('unsuspend')}>
                Lift Suspension
              </Button>
            )}
          </div>
        </Card>
      )}

      <InfoGrid items={infoItems} />

      <Card>
        <SectionTitle className="mb-4">Line Items</SectionTitle>
        <TableShell
          columns={LINE_COLUMNS}
          rightCols={['Qty', 'Amount', 'GST', 'Total']}
          scrollLabel="Invoice line items"
          state={
            inv.lines.length === 0
              ? { kind: 'empty', icon: 'file-text', title: 'This invoice has no line items.' }
              : undefined
          }
        >
          {inv.lines.map((line) => (
            <tr key={line.id}>
              <td className={tdClass}>{line.description}</td>
              <td className={cn(tdClass, 'text-right tabular-nums')}>{line.quantity}</td>
              <td className={cn(tdClass, 'text-right tabular-nums')}>{rupees(line.amountPaise)}</td>
              <td className={cn(tdClass, 'text-right tabular-nums')}>
                {line.taxRateBp > 0 ? (
                  <>
                    {rupees(line.taxPaise)}
                    <div className="text-caption text-text-muted">
                      {ratePercent(line.taxRateBp)}
                    </div>
                  </>
                ) : (
                  '—'
                )}
              </td>
              <td className={cn(tdClass, 'text-right tabular-nums')}>
                {rupees(line.amountPaise + line.taxPaise)}
              </td>
            </tr>
          ))}
        </TableShell>
        <div className="mt-4 flex justify-end">
          <div className="flex w-75 flex-col gap-2">
            {(
              [
                ['Subtotal', inv.subtotalPaise],
                [gstLabel(inv.lines), inv.gstPaise],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-body text-text-muted">{k}</span>
                <span className="text-body text-text-strong tabular-nums">{rupees(v)}</span>
              </div>
            ))}
            <div className="border-border-soft flex justify-between border-t pt-2">
              <span className="text-body-lg text-text-strong font-semibold">Total</span>
              <span className="text-body-lg text-text-strong font-semibold tabular-nums">
                {rupees(inv.totalPaise)}
              </span>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <SectionTitle>Reminder History</SectionTitle>
          {unpaid && canBill && (
            <Button
              size="sm"
              variant="secondary"
              icon="bell-ring"
              onClick={() => setModal('reminder')}
            >
              Queue Reminder
            </Button>
          )}
        </div>
        <TableShell columns={REMINDER_COLUMNS} scrollLabel="Reminder history" state={reminderState}>
          {reminders.map((r) => (
            <tr key={r.id}>
              <td className={cn(tdClass, 'text-text-strong font-medium')}>
                {fmtDateTime(r.occurredAt)}
              </td>
              <td className={tdClass}>
                <Badge status={r.kind === 'reminder_sent' ? 'Sent' : 'Queued'}>
                  {DUNNING_LABELS[r.kind]}
                </Badge>
              </td>
              <td className={tdClass}>{r.isAutomatic ? 'Automatic' : 'Operations'}</td>
              <td className={tdClass}>{r.note || '—'}</td>
            </tr>
          ))}
        </TableShell>
        <div className="text-caption text-text-muted mt-3">
          {inv.billedTo.email
            ? `Reminders are emailed to the billing contact on this invoice, ${inv.billedTo.email}.`
            : "This invoice has no billing contact, so reminders are emailed to the hospital's admins."}{' '}
          A reminder shows as Sent once the email has been handed to the mail provider.
        </div>
      </Card>

      <Card>
        <SectionTitle className="mb-4">Payments</SectionTitle>
        <TableShell columns={ATTEMPT_COLUMNS} scrollLabel="Payments" state={paymentState}>
          {payments.map((p) => {
            const badge = PAYMENT_STATUS_BADGES[p.status];
            return (
              <tr key={p.id}>
                <td className={cn(tdClass, 'tabular-nums')}>
                  {p.gatewayPaymentId ?? p.referenceNote ?? 'Manual payment'}
                </td>
                <td className={tdClass}>{METHOD_LABELS[p.method]}</td>
                <td className={tdClass}>
                  {fmtDateTime(p.attemptedAt)}
                  {p.attemptNo > 1 && (
                    <div className="text-caption text-text-muted">Attempt {p.attemptNo}</div>
                  )}
                </td>
                <td className={cn(tdClass, 'tabular-nums')}>{rupees(p.amountPaise)}</td>
                <td className={tdClass}>
                  <Badge status={badge.status}>{badge.label}</Badge>
                  {p.status === 'failed' && p.failureReason && (
                    <div className="text-caption text-d-700">{p.failureReason}</div>
                  )}
                </td>
                <td className={tdClass}>
                  <div className="flex items-center gap-1">
                    <IconBtn
                      name="eye"
                      label="View payment"
                      box={36}
                      size={16}
                      onClick={() => toPayment(p.id)}
                    />
                    {canBill && unpaid && p.status === 'failed' && !retryUnavailable && (
                      <IconBtn
                        name="refresh-cw"
                        label="Retry payment"
                        box={36}
                        size={16}
                        disabled={retry.isPending}
                        onClick={() => retryPayment(p)}
                      />
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </TableShell>
        {retryUnavailable && unpaid && (
          <div className="text-caption text-text-muted mt-3">{RETRY_UNAVAILABLE}</div>
        )}
      </Card>

      {/* Browser-print fallback when the server cannot render PDFs. `invisible`
          (not `hidden`) because the print rule restores visibility; `display:
          none` could not be undone. */}
      <div
        ref={printRef}
        aria-hidden="true"
        className="pointer-events-none invisible fixed inset-0 -z-10 overflow-hidden bg-white"
      >
        <InvoicePrintSheet invoice={inv} planName={planName} />
      </div>

      {modal === 'reminder' && (
        <SendReminderModal
          invoice={inv}
          hospitalEmail={inv.billedTo.email}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'paid' && <MarkPaidModal invoice={inv} onClose={() => setModal(null)} />}
      {modal === 'grace' && grace && (
        <GracePeriodModal invoice={inv} grace={grace} onClose={() => setModal(null)} />
      )}
      {modal === 'void' && <VoidInvoiceModal invoice={inv} onClose={() => setModal(null)} />}
      <OpsConfirm
        open={modal === 'unsuspend'}
        onClose={() => setModal(null)}
        icon="circle-check"
        tone="success"
        title="Lift this suspension?"
        body={`${inv.hospitalName}'s staff can make changes again straight away, and patients can book there again.`}
        confirmLabel={reinstate.isPending ? 'Reactivating…' : 'Lift Suspension'}
        busy={reinstate.isPending}
        onConfirm={() =>
          reinstate.mutate(inv.hospitalId, {
            onSuccess: () => {
              toast(`${inv.hospitalName} reactivated.`, 'success');
              setModal(null);
            },
            onError: (error) => toast(failureText(error, REINSTATE_FAILED), 'error'),
          })
        }
      />
    </div>
  );
}
