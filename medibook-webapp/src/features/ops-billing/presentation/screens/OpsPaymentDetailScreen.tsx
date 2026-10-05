import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { MAX_PAGE_SIZE } from '@/core/api/pagination';
import { cn } from '@/shared/lib/cn';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Icon } from '@/shared/ui/Icon';
import { InfoGrid } from '@/shared/ui/InfoGrid';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { SkeletonCards } from '@/shared/ui/Skeleton';

import { OPS_BASE_PATH, OPS_VIEW_SEGMENT, opsPath } from '@/app/router/paths';

import { usePaymentsQuery } from '@/features/ops-billing/application/queries/usePaymentsQuery';
import type {
  PaymentListParams,
  SubscriptionPayment,
} from '@/features/ops-billing/domain/entities/billing.entities';
import { BillingHospitalName } from '@/features/ops-billing/presentation/components/BillingHospitalName';
import {
  METHOD_LABELS,
  PAYMENT_STATUS_BADGES,
  failureText,
  fmtDateTime,
  rupees,
} from '@/features/ops-billing/presentation/components/billingView';

/** One status-history row: label, timestamp, and the dot's token bg class. */
type HistoryStep = readonly [string, string, string];

/** Router state the billing screens pass, so the payment can be found by its invoice. */
function invoiceIdFrom(state: unknown): string | null {
  if (typeof state !== 'object' || state === null || !('invoiceId' in state)) return null;
  const { invoiceId } = state;
  return typeof invoiceId === 'string' ? invoiceId : null;
}

function historyOf(pay: SubscriptionPayment): readonly HistoryStep[] {
  const steps: HistoryStep[] = [
    [
      pay.attemptNo > 1 ? `Payment attempt ${pay.attemptNo} started` : 'Payment started',
      fmtDateTime(pay.attemptedAt),
      'bg-text-faint',
    ],
  ];
  if (pay.status === 'captured' || pay.status === 'refunded') {
    steps.push(['Payment received', fmtDateTime(pay.capturedAt ?? pay.attemptedAt), 'bg-g-600']);
  }
  if (pay.status === 'refunded') steps.push(['Refunded', '—', 'bg-d-500']);
  if (pay.status === 'failed') {
    steps.push([
      pay.failureReason ? `Failed — ${pay.failureReason}` : 'Payment failed',
      fmtDateTime(pay.attemptedAt),
      'bg-d-500',
    ]);
  }
  if (pay.status === 'created') steps.push(['Awaiting confirmation', 'In progress', 'bg-y-600']);
  return steps;
}

/**
 * Ops payment detail (design `Ops.jsx` `OpsPaymentDetail`). The API has no
 * single-payment read, so the payment is found among its invoice's payments
 * (the billing screens pass the invoice id in router state); a bare link
 * searches the newest 100 payments instead.
 */
export function OpsPaymentDetailScreen() {
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const invoiceId = invoiceIdFrom(useLocation().state);

  const params: PaymentListParams = {
    page: 1,
    pageSize: MAX_PAGE_SIZE,
    statuses: [],
    method: null,
    invoiceId,
    sortField: 'attempted_at',
    sortDirection: 'desc',
  };
  const paymentsQuery = usePaymentsQuery(params);
  const pay = paymentsQuery.data?.items.find((p) => p.id === id);

  if (paymentsQuery.isPending) return <SkeletonCards count={1} lines={4} pad={24} />;
  if (paymentsQuery.isError) {
    return (
      <Card pad={32}>
        <ErrorState
          inline
          title="This payment didn't load"
          message={failureText(paymentsQuery.error, 'Please try again.')}
          onRetry={() => void paymentsQuery.refetch()}
        />
      </Card>
    );
  }
  if (!pay) {
    return (
      <Card pad={32}>
        <EmptyState
          icon="indian-rupee"
          title="Payment not found."
          message={
            invoiceId
              ? 'It is no longer recorded against its invoice.'
              : 'Only the newest payments can be opened from a link. Open it from the Payments tab or its invoice.'
          }
          actionLabel="Back to payments"
          onAction={() => navigate(`${opsPath('billing')}?tab=Payments`)}
        />
      </Card>
    );
  }

  const badge = PAYMENT_STATUS_BADGES[pay.status];
  const history = historyOf(pay);
  const reference = pay.gatewayPaymentId ?? pay.referenceNote ?? 'Manual payment';

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
                <span className="tabular-nums">{reference}</span>
              </SectionTitle>
              <Badge status={badge.status}>{badge.label}</Badge>
            </div>
            <span className="text-caption text-text-muted">
              <BillingHospitalName hospitalId={pay.hospitalId} /> · {METHOD_LABELS[pay.method]} ·{' '}
              {fmtDateTime(pay.attemptedAt)}
            </span>
          </div>
          <div className="flex-1"></div>
          <Button
            variant="ghost"
            onClick={() =>
              navigate(`${opsPath('hospitals')}/${encodeURIComponent(pay.hospitalId)}`)
            }
          >
            View Hospital
          </Button>
          <Button
            variant="secondary"
            icon="file-text"
            onClick={() =>
              navigate(
                `${OPS_BASE_PATH}/${OPS_VIEW_SEGMENT['invoice-detail'].replace(':id', pay.invoiceId)}`,
              )
            }
          >
            View Invoice
          </Button>
        </div>
      </Card>
      {pay.status === 'failed' && (
        <Card pad={14} className="flex flex-wrap items-center gap-2">
          <Icon name="triangle-alert" size={16} className="text-y-700" />
          <span className="text-body text-text-body">
            Gateway retries aren&apos;t available yet. If the hospital paid another way, record it
            with Mark as Paid on the invoice.
          </span>
        </Card>
      )}
      <InfoGrid
        items={[
          { k: 'Amount', v: rupees(pay.amountPaise), num: true },
          { k: 'Method', v: METHOD_LABELS[pay.method] },
          { k: 'Reference', v: pay.referenceNote ?? '—', num: Boolean(pay.referenceNote) },
          { k: 'Gateway Ref', v: pay.gatewayPaymentId ?? '—', num: Boolean(pay.gatewayPaymentId) },
          { k: 'Attempted', v: fmtDateTime(pay.attemptedAt) },
          { k: 'Received', v: fmtDateTime(pay.capturedAt) },
          { k: 'Linked Invoice', v: pay.invoiceNo, num: true },
          { k: 'Attempt', v: pay.attemptNo, num: true },
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
