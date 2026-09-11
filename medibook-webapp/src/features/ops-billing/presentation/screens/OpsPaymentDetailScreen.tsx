import { useNavigate, useParams } from 'react-router-dom';

import { useOpsAct } from '@/shared/hooks/useOpsAct';
import { cn } from '@/shared/lib/cn';
import { money } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { InfoGrid } from '@/shared/ui/InfoGrid';
import { SectionTitle } from '@/shared/ui/SectionTitle';

import { OPS_BASE_PATH, OPS_VIEW_SEGMENT, opsHospitalDetailPath } from '@/app/router/paths';

import { useBillingStore } from '@/features/ops-billing/application/store/billing.store';
import { hospName, opsHospById } from '@/features/ops-hospitals/application/store/hospitals.store';

/** One status-history row: label, timestamp, and the dot's token bg class. */
type HistoryStep = readonly [string, string, string];

/** Attempts a gateway payment gets before ops has to collect it manually. */
const MAX_PAYMENT_ATTEMPTS = 3;

/**
 * Ops payment detail (design `Ops.jsx` `OpsPaymentDetail`): the selected
 * payment resolves from the `:id` URL param with a first-record fallback.
 * Header + View Hospital / View Invoice links, the reference InfoGrid (gateway
 * ref `GW-<88000 + id * 7>`), and the status-history timeline whose dot colors
 * branch on the payment's status.
 *
 * A failed payment can be retried here (audit SA-03: "no retry"). The retry is
 * honest about what it does: the attempt counter moves and the payment goes
 * back to Pending with the gateway — nothing claims the bank has approved it.
 */
export function OpsPaymentDetailScreen() {
  const navigate = useNavigate();
  const { id } = useParams();
  const invoices = useBillingStore((s) => s.invoices);
  const payments = useBillingStore((s) => s.payments);
  const retryPayment = useBillingStore((s) => s.retryPayment);
  const [busy, run] = useOpsAct();

  const pay = payments.find((x) => x.id === Number(id)) ?? payments[0];
  const linked = invoices.find((x) => x.no === pay.inv);
  const retryable = pay.status === 'Payment failed' && pay.attempts < MAX_PAYMENT_ATTEMPTS;

  const hist: readonly HistoryStep[] =
    pay.status === 'Success'
      ? [
          ['Payment initiated', `${pay.date} · 10:41`, 'bg-text-faint'],
          ['Authorized by gateway', `${pay.date} · 10:41`, 'bg-text-faint'],
          ['Captured', `${pay.date} · 10:42`, 'bg-g-600'],
        ]
      : pay.status === 'Pending'
        ? [
            ['Payment initiated', `${pay.date} · 10:41`, 'bg-text-faint'],
            ['Awaiting confirmation', 'In progress', 'bg-y-600'],
          ]
        : [
            ['Payment initiated', `${pay.date} · 10:41`, 'bg-text-faint'],
            ['Authorized by gateway', `${pay.date} · 10:41`, 'bg-text-faint'],
            ['Payment failed — declined by bank', `${pay.date} · 10:42`, 'bg-d-500'],
          ];

  const history: readonly HistoryStep[] =
    pay.attempts > 1 && pay.lastAttemptAt
      ? [
          ...hist,
          [
            `Retried by operations — attempt ${pay.attempts} of ${MAX_PAYMENT_ATTEMPTS}`,
            pay.lastAttemptAt,
            pay.status === 'Success' ? 'bg-g-600' : pay.status === 'Pending' ? 'bg-y-600' : 'bg-d-500',
          ],
        ]
      : hist;

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <div className="bg-g-100 text-g-600 flex size-14 flex-none items-center justify-center rounded-lg">
            <Icon name="indian-rupee" size={26} />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-3">
              <SectionTitle size={20}>
                <span className="tabular-nums">{pay.txn}</span>
              </SectionTitle>
              <Badge status={pay.status} />
            </div>
            <span className="text-caption text-text-muted">
              {hospName(pay)} · {pay.method} · {pay.date}
            </span>
          </div>
          <div className="flex-1"></div>
          <Button
            variant="ghost"
            onClick={() => {
              if (pay.hid && opsHospById(pay.hid)) navigate(opsHospitalDetailPath(pay.hid));
            }}
          >
            View Hospital
          </Button>
          <Button
            variant="secondary"
            icon="file-text"
            onClick={() => {
              if (linked)
                navigate(
                  `${OPS_BASE_PATH}/${OPS_VIEW_SEGMENT['invoice-detail'].replace(
                    ':id',
                    String(linked.id),
                  )}`,
                );
            }}
          >
            View Invoice
          </Button>
          {pay.status === 'Payment failed' && (
            <span
              title={
                retryable
                  ? `Retry ${pay.txn} (attempt ${pay.attempts + 1})`
                  : `${MAX_PAYMENT_ATTEMPTS} attempts have failed — collect this payment manually`
              }
            >
              <Button
                icon="rotate-ccw"
                disabled={!retryable}
                busy={busy.retry}
                onClick={() =>
                  run(
                    'retry',
                    `Retry queued for ${pay.txn} — attempt ${pay.attempts + 1} is pending with the gateway.`,
                    () => retryPayment(pay.id),
                  )
                }
              >
                Retry Payment
              </Button>
            </span>
          )}
        </div>
      </Card>
      <InfoGrid
        items={[
          { k: 'Amount', v: money(pay.amount), num: true },
          { k: 'Method', v: pay.method },
          { k: 'Reference', v: pay.txn, num: true },
          { k: 'Gateway Ref', v: `GW-${88000 + pay.id * 7}`, num: true },
          { k: 'Date', v: pay.date },
          { k: 'Linked Invoice', v: pay.inv, num: true },
          {
            k: 'Attempts',
            v: `${pay.attempts} of ${MAX_PAYMENT_ATTEMPTS}`,
            num: true,
          },
          { k: 'Last Attempt', v: pay.lastAttemptAt ?? pay.date },
        ]}
      />
      <Card>
        <SectionTitle className="mb-4">Status History</SectionTitle>
        <div className="flex flex-col">
          {history.map(([label, time, dot], i) => (
            <div
              key={label}
              className={cn(
                'flex items-center gap-3 py-2.75',
                i < history.length - 1 && 'border-border-soft border-b',
              )}
            >
              <span className={cn('size-2.5 flex-none rounded-full', dot)}></span>
              <div className="flex flex-col gap-0.5">
                <span className="text-body text-text-strong font-medium">{label}</span>
                <span className="text-caption text-text-muted">{time}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
