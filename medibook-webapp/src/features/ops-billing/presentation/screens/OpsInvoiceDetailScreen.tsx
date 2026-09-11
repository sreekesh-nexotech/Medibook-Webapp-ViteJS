import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useOpsAct } from '@/shared/hooks/useOpsAct';
import { usePrintArea } from '@/shared/hooks/usePrintArea';
import { cn } from '@/shared/lib/cn';
import { downloadCsv } from '@/shared/lib/download';
import { money } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Icon } from '@/shared/ui/Icon';
import { IconBtn } from '@/shared/ui/IconBtn';
import { InfoGrid, type InfoGridItem } from '@/shared/ui/InfoGrid';
import { OpsConfirm } from '@/shared/ui/OpsConfirm';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import { toast } from '@/shared/ui/toast/toast.store';

import { OPS_BASE_PATH, OPS_VIEW_SEGMENT, opsHospitalDetailPath } from '@/app/router/paths';

import {
  gstinOf,
  useHospitalsStore,
} from '@/features/ops-hospitals/application/store/hospitals.store';
import { longDateFromIso } from '@/features/ops-hospitals/application/store/opsDates';
import { useOpsSettingsStore } from '@/features/ops-settings/application/store/opsSettings.store';

import {
  graceFor,
  invoiceTax,
  isUnpaid,
} from '@/features/ops-billing/application/store/billing.derive';
import {
  billingTodayIso,
  useBillingStore,
} from '@/features/ops-billing/application/store/billing.store';
import { GracePeriodModal } from '@/features/ops-billing/presentation/components/GracePeriodModal';
import { InvoicePrintSheet } from '@/features/ops-billing/presentation/components/InvoicePrintSheet';
import { MarkPaidModal } from '@/features/ops-billing/presentation/components/MarkPaidModal';
import { SendReminderModal } from '@/features/ops-billing/presentation/components/SendReminderModal';

/** The billing period a subscription invoice covers (design copy). */
const INVOICE_PERIOD = 'June 01 – June 30, 2026';

/** Which action dialog is open. */
type InvoiceModal = 'reminder' | 'paid' | 'grace' | 'suspend' | 'unsuspend' | null;

const REMINDER_COLUMNS = ['Requested', 'Channel', 'To', 'Status', 'Requested by'] as const;
const ATTEMPT_COLUMNS = ['Transaction', 'Method', 'Date', 'Attempts', 'Status', 'Action'] as const;

/**
 * Ops invoice detail (design `Ops.jsx` `OpsInvoiceDetail`), rebuilt around the
 * collection actions audit SA-03 found missing — queue a reminder, mark the
 * invoice paid, retry a failed payment, set the grace window and suspend the
 * hospital for non-payment once that window has closed.
 *
 * The old "Download PDF" button is gone: it claimed a file that never arrived
 * (audit 3.1.4). In its place are two controls that do what they say — **Save
 * as PDF**, which prints the real invoice node through the browser's print
 * dialog, and **Export CSV**, which writes an actual file.
 */
export function OpsInvoiceDetailScreen() {
  const navigate = useNavigate();
  const { id } = useParams();
  const invoices = useBillingStore((s) => s.invoices);
  const payments = useBillingStore((s) => s.payments);
  const retryPayment = useBillingStore((s) => s.retryPayment);
  const hospitals = useHospitalsStore((s) => s.hospitals);
  const suspend = useHospitalsStore((s) => s.suspend);
  const unsuspend = useHospitalsStore((s) => s.unsuspend);
  const medibookGstin = useOpsSettingsStore((s) => s.settings.gst);
  const [modal, setModal] = useState<InvoiceModal>(null);
  const [busy, run] = useOpsAct();
  const { ref: printRef, print } = usePrintArea<HTMLDivElement>();

  const inv = invoices.find((x) => x.id === Number(id)) ?? invoices[0];
  const host = hospitals.find((h) => h.id === inv.hid) ?? null;
  const hostGstin = host ? gstinOf(host) : null;
  const planName = host ? host.plan : 'Growth';
  const tax = invoiceTax(inv.amount);
  const attempts = payments.filter((p) => p.inv === inv.no);
  const unpaid = isUnpaid(inv);
  const grace = graceFor(inv, host, billingTodayIso());
  const suspended = host?.status === 'Suspended';

  const totals: readonly (readonly [string, number])[] = [
    ['Subtotal', tax.base],
    ['CGST (9%)', tax.cgst],
    ['SGST (9%)', tax.sgst],
  ];

  const toPayment = (pid: number): void => {
    navigate(`${OPS_BASE_PATH}/${OPS_VIEW_SEGMENT['payment-detail'].replace(':id', String(pid))}`);
  };

  const exportCsv = (): void => {
    const filename = `${inv.no}.csv`;
    downloadCsv(filename, [
      [
        'Invoice',
        'Hospital',
        'Plan',
        'Issued',
        'Due',
        'Status',
        'Taxable value',
        'CGST (9%)',
        'SGST (9%)',
        'Total',
        'Paid on',
        'Payment mode',
        'Reference',
      ],
      [
        inv.no,
        inv.hospital,
        planName,
        inv.issued,
        inv.due,
        inv.status,
        tax.base,
        tax.cgst,
        tax.sgst,
        tax.total,
        inv.paidOn ? longDateFromIso(inv.paidOn) : '',
        inv.paidMode ?? '',
        inv.paidRef ?? '',
      ],
    ]);
    toast(`Exported ${filename}`, 'success');
  };

  const infoItems: InfoGridItem[] = [
    { k: 'Hospital', v: inv.hospital },
    { k: 'Billing Period', v: INVOICE_PERIOD },
    { k: 'Plan', v: planName },
    { k: 'Issued', v: inv.issued },
    { k: 'Due', v: inv.due },
    { k: 'Amount', v: money(inv.amount), num: true },
    { k: 'Hospital GSTIN', v: hostGstin || '—', num: Boolean(hostGstin) },
    { k: 'Medibook GSTIN', v: medibookGstin, num: true },
    { k: 'Tax Treatment', v: '18% GST (9% CGST + 9% SGST)' },
    {
      k: 'Grace Window',
      v: grace
        ? `${grace.days} day${grace.days === 1 ? '' : 's'} · ends ${longDateFromIso(grace.endsIso)}`
        : `${inv.graceDays ?? '—'}`,
    },
    ...(inv.paidOn
      ? [
          { k: 'Paid On', v: longDateFromIso(inv.paidOn) },
          { k: 'Payment Mode', v: inv.paidMode ?? '—' },
          { k: 'Payment Reference', v: inv.paidRef ?? '—', num: true },
        ]
      : []),
  ];

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
                <span className="tabular-nums">{inv.no}</span>
              </SectionTitle>
              <Badge status={inv.status} />
            </div>
            <span className="text-caption text-text-muted">
              {inv.hospital} · Issued {inv.issued} · Due {inv.due}
            </span>
          </div>
          <div className="flex-1"></div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="ghost"
              onClick={() => {
                if (host) navigate(opsHospitalDetailPath(host.id));
              }}
            >
              View Hospital
            </Button>
            <Button variant="secondary" icon="printer" onClick={print}>
              Save as PDF
            </Button>
            <Button variant="secondary" icon="download" onClick={exportCsv}>
              Export CSV
            </Button>
            {unpaid && (
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
                  ? `Grace window closed ${-grace.daysLeft} day${grace.daysLeft === -1 ? '' : 's'} ago`
                  : grace.inGrace
                    ? `Grace ends in ${grace.daysLeft} day${grace.daysLeft === 1 ? '' : 's'}`
                    : `Due in ${grace.daysLeft - grace.days} day${grace.daysLeft - grace.days === 1 ? '' : 's'} · ${grace.days}-day grace after that`}
              </div>
              <div className="text-caption text-text-muted">
                {grace.days} day{grace.days === 1 ? '' : 's'} after the due date (
                {grace.source === 'invoice'
                  ? 'set on this invoice'
                  : grace.source === 'hospital'
                    ? 'set on the hospital'
                    : 'platform default'}
                ) · ends {longDateFromIso(grace.endsIso)}
              </div>
            </div>
            <Button size="sm" variant="secondary" icon="clock" onClick={() => setModal('grace')}>
              Grace Window
            </Button>
            {suspended ? (
              <Button size="sm" variant="secondary" onClick={() => setModal('unsuspend')}>
                Lift Suspension
              </Button>
            ) : (
              // `Button` takes no tooltip, so the reason a disabled control is
              // unavailable is carried by the wrapper's title (and is spelled
              // out in the grace line above it).
              <span
                title={
                  grace.expired
                    ? 'Suspend this hospital for non-payment'
                    : `Available once the grace window closes on ${longDateFromIso(grace.endsIso)}`
                }
              >
                <Button
                  size="sm"
                  variant="danger"
                  icon="ban"
                  disabled={!grace.expired}
                  onClick={() => setModal('suspend')}
                >
                  Suspend for Non-payment
                </Button>
              </span>
            )}
          </div>
        </Card>
      )}

      {suspended && host?.suspension && (
        <Card pad={16} className="border-d-500">
          <div className="flex flex-wrap items-start gap-3.5">
            <div className="bg-d-100 text-d-500 flex size-10 flex-none items-center justify-center rounded-md">
              <Icon name="ban" size={19} />
            </div>
            <div className="min-w-50 flex-1">
              <div className="text-body text-text-strong font-medium">
                {host.name} is suspended — {host.suspension.reason.toLowerCase()}
              </div>
              <div className="text-caption text-text-muted">
                Since {longDateFromIso(host.suspension.since)} by {host.suspension.by}
                {host.suspension.invoiceNo ? ` · ${host.suspension.invoiceNo}` : ''}
                {host.suspension.note ? ` · ${host.suspension.note}` : ''}
              </div>
            </div>
            <Button size="sm" variant="secondary" onClick={() => setModal('unsuspend')}>
              Lift Suspension
            </Button>
          </div>
        </Card>
      )}

      <InfoGrid items={infoItems} />

      <Card>
        <SectionTitle className="mb-4">Line Items</SectionTitle>
        <TableShell
          columns={['Item', 'Period', 'Amount']}
          rightCols={['Amount']}
          scrollLabel="Invoice line items"
        >
          <tr>
            <td className={tdClass}>{planName} Plan — subscription</td>
            <td className={tdClass}>{INVOICE_PERIOD}</td>
            <td className={cn(tdClass, 'text-right tabular-nums')}>{money(tax.base)}</td>
          </tr>
        </TableShell>
        <div className="mt-4 flex justify-end">
          <div className="flex w-75 flex-col gap-2">
            {totals.map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-body text-text-muted">{k}</span>
                <span className="text-body text-text-strong tabular-nums">{money(v)}</span>
              </div>
            ))}
            <div className="border-border-soft flex justify-between border-t pt-2">
              <span className="text-body-lg text-text-strong font-semibold">Total</span>
              <span className="text-body-lg text-text-strong font-semibold tabular-nums">
                {money(tax.total)}
              </span>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <SectionTitle>Reminder History</SectionTitle>
          {unpaid && (
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
        <TableShell
          columns={REMINDER_COLUMNS}
          scrollLabel="Reminder history"
          state={
            inv.reminders.length === 0
              ? {
                  kind: 'empty',
                  icon: 'bell-ring',
                  title: 'No reminders requested for this invoice.',
                  message: unpaid
                    ? 'Queue one to record that the hospital was chased for payment.'
                    : 'The invoice was paid without needing a reminder.',
                  ...(unpaid
                    ? { actionLabel: 'Queue reminder', onAction: () => setModal('reminder') }
                    : {}),
                }
              : undefined
          }
        >
          {inv.reminders.map((r) => (
            <tr key={r.id}>
              <td className={cn(tdClass, 'text-text-strong font-medium')}>{r.at}</td>
              <td className={tdClass}>{r.channel}</td>
              <td className={tdClass}>{r.to}</td>
              <td className={tdClass}>
                <Badge status="Queued">Queued</Badge>
              </td>
              <td className={tdClass}>{r.by}</td>
            </tr>
          ))}
        </TableShell>
        <div className="text-caption text-text-muted mt-3">
          Reminders are recorded here and not transmitted — this build has no email or SMS delivery,
          so nothing claims to have reached the hospital.
        </div>
      </Card>

      <Card>
        <SectionTitle className="mb-4">Payment Attempts</SectionTitle>
        {attempts.length > 0 ? (
          <TableShell columns={ATTEMPT_COLUMNS} scrollLabel="Payment attempts">
            {attempts.map((p) => (
              <tr key={p.id}>
                <td className={cn(tdClass, 'tabular-nums')}>{p.txn}</td>
                <td className={tdClass}>{p.method}</td>
                <td className={tdClass}>
                  {p.date}
                  {p.lastAttemptAt && (
                    <div className="text-caption text-text-muted">
                      Last attempt {p.lastAttemptAt}
                    </div>
                  )}
                </td>
                <td className={cn(tdClass, 'tabular-nums')}>
                  {p.attempts} of 3
                  {p.attempts >= 3 && p.status === 'Payment failed' && (
                    <div className="text-caption text-d-700">Retry limit reached</div>
                  )}
                </td>
                <td className={tdClass}>
                  <Badge status={p.status} />
                </td>
                <td className={tdClass}>
                  <div className="flex gap-2">
                    <IconBtn
                      name="eye"
                      label="View payment"
                      box={36}
                      size={16}
                      onClick={() => toPayment(p.id)}
                    />
                    {p.status === 'Payment failed' && (
                      <IconBtn
                        name="rotate-ccw"
                        label="Retry payment"
                        box={36}
                        size={16}
                        disabled={p.attempts >= 3}
                        busy={busy[`retry${p.id}`]}
                        title={
                          p.attempts >= 3
                            ? 'Three attempts have failed — collect this payment manually'
                            : `Retry ${p.txn} (attempt ${p.attempts + 1})`
                        }
                        onClick={() =>
                          run(
                            `retry${p.id}`,
                            `Retry queued for ${p.txn} — attempt ${p.attempts + 1} is pending with the gateway.`,
                            () => retryPayment(p.id),
                          )
                        }
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </TableShell>
        ) : (
          <EmptyState
            icon="indian-rupee"
            title="No payment attempts yet."
            message={
              unpaid
                ? 'Nothing has been attempted against this invoice. Record a payment received outside the gateway with Mark as Paid.'
                : 'This invoice was settled without a gateway transaction.'
            }
            {...(unpaid ? { actionLabel: 'Mark as paid', onAction: () => setModal('paid') } : {})}
          />
        )}
      </Card>

      {/* The real print target. `invisible` (not `hidden`) because the print
          rule restores visibility; `display: none` could not be undone. */}
      <div
        ref={printRef}
        aria-hidden="true"
        className="pointer-events-none invisible fixed inset-0 -z-10 overflow-hidden bg-white"
      >
        <InvoicePrintSheet
          invoice={inv}
          hospitalName={inv.hospital}
          hospitalGstin={hostGstin}
          planName={planName}
          period={INVOICE_PERIOD}
        />
      </div>

      {modal === 'reminder' && (
        <SendReminderModal
          open
          invoice={inv}
          hospitalEmail={host ? host.email : ''}
          hospitalPhone={host ? host.phone : ''}
          onClose={() => setModal(null)}
          onDone={() => setModal(null)}
        />
      )}
      {modal === 'paid' && (
        <MarkPaidModal
          open
          invoice={inv}
          onClose={() => setModal(null)}
          onDone={() => setModal(null)}
        />
      )}
      {modal === 'grace' && (
        <GracePeriodModal
          open
          invoice={inv}
          hospital={host}
          onClose={() => setModal(null)}
          onDone={() => setModal(null)}
        />
      )}
      <OpsConfirm
        open={modal === 'suspend'}
        onClose={() => setModal(null)}
        icon="ban"
        tone="danger"
        title="Suspend this hospital for non-payment?"
        body={
          host
            ? `${host.name}'s staff lose access to Medibook immediately and patients can no longer book appointments there. Existing bookings are kept. Reactivation is a separate action once ${inv.no} is paid.`
            : ''
        }
        summary={
          host
            ? [
                { k: 'Hospital', v: host.name },
                { k: 'Unpaid invoice', v: inv.no, num: true },
                { k: 'Amount', v: money(inv.amount), num: true },
                { k: 'Due', v: inv.due },
              ]
            : undefined
        }
        confirmLabel={busy.suspend ? 'Suspending…' : 'Suspend Hospital'}
        confirmVariant="danger"
        busy={busy.suspend}
        onConfirm={() => {
          if (!host) return;
          run('suspend', `${host.name} suspended for non-payment of ${inv.no}.`, () => {
            suspend(host.id, {
              reason: 'Non-payment',
              invoiceNo: inv.no,
              note: `${inv.no} unpaid past its grace window.`,
            });
            setModal(null);
          });
        }}
      />
      <OpsConfirm
        open={modal === 'unsuspend'}
        onClose={() => setModal(null)}
        icon="circle-check"
        tone="success"
        title="Lift this suspension?"
        body={
          host
            ? `${host.name} regains access immediately and can take new bookings right away.`
            : ''
        }
        confirmLabel={busy.unsuspend ? 'Reactivating…' : 'Lift Suspension'}
        busy={busy.unsuspend}
        onConfirm={() => {
          if (!host) return;
          run('unsuspend', `${host.name} reactivated.`, () => {
            unsuspend(host.id);
            setModal(null);
          });
        }}
      />
    </div>
  );
}
