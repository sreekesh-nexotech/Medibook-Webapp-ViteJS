import type { ReactNode } from 'react';

import { isFailure } from '@/core/error/failure';
import { money } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Drawer } from '@/shared/ui/Drawer';
import { ErrorState } from '@/shared/ui/ErrorState';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { SkeletonLine } from '@/shared/ui/Skeleton';

import { usePaymentDetailQuery } from '@/features/payments/application/queries/usePaymentDetailQuery';
import {
  LINE_STATUS_LABEL,
  METHOD_LABEL,
  REFUND_STATUS_BADGE,
  dateTimeCopy,
} from '@/features/payments/presentation/components/payments.view';

const DRAWER_WIDTH = 480;
const SKELETON_LINES = 8;

interface PaymentsDetailDrawerProps {
  /** The line to show; `null` closes the drawer. */
  paymentId: string | null;
  onClose: () => void;
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="border-border-soft flex justify-between gap-4 border-b py-2">
      <span className="text-body text-text-muted">{label}</span>
      <span className="text-body text-text-strong text-right font-medium break-all">{value}</span>
    </div>
  );
}

/**
 * One payment line in full (`GET /payments/{id}`, appendix 04 R1): order and
 * gateway references, who took it and where, the drawer it went into, and
 * every refund against it with its status and any failure reason.
 */
export function PaymentsDetailDrawer({ paymentId, onClose }: PaymentsDetailDrawerProps) {
  const query = usePaymentDetailQuery(paymentId);
  const detail = query.data;

  let body: ReactNode;
  if (query.isPending) {
    body = (
      <div className="flex flex-col gap-3" aria-busy="true">
        {Array.from({ length: SKELETON_LINES }, (_, i) => (
          <SkeletonLine key={i} />
        ))}
      </div>
    );
  } else if (query.isError || !detail) {
    body = (
      <ErrorState
        inline
        title="This payment didn’t load"
        message={isFailure(query.error) ? query.error.message : undefined}
        onRetry={() => void query.refetch()}
      />
    );
  } else {
    const { line, refunds } = detail;
    body = (
      <div className="flex flex-col gap-5">
        <section>
          <Row
            label="Patient"
            value={line.patient ? `${line.patient.fullName} · ${line.patient.mrn}` : '—'}
          />
          <Row label="Booking" value={line.bookingRefs.join(', ') || '—'} />
          {(line.doctorName || line.departmentName) && (
            <Row
              label="Doctor"
              value={[line.doctorName, line.departmentName].filter(Boolean).join(' · ')}
            />
          )}
          <Row label="Amount" value={money(line.amountRupees)} />
          <Row label="Status" value={<Badge status={LINE_STATUS_LABEL[line.status]} />} />
          <Row
            label="Method"
            value={
              line.channel === 'online'
                ? `Online · ${METHOD_LABEL[line.method]}`
                : METHOD_LABEL[line.method]
            }
          />
          <Row label="Paid at" value={dateTimeCopy(line.capturedAt)} />
          {line.receiptNo && <Row label="Receipt" value={line.receiptNo} />}
          {line.collectedByName && (
            <Row
              label="Taken by"
              value={`${line.collectedByName}${line.counterCode ? ` · Counter ${line.counterCode}` : ''}`}
            />
          )}
          {line.referenceNote && <Row label="Reference" value={line.referenceNote} />}
          {line.gatewayPaymentId && <Row label="Gateway payment" value={line.gatewayPaymentId} />}
          {line.orderId && <Row label="Payment order" value={line.orderId} />}
          {line.cashSessionId && <Row label="Cash drawer" value={line.cashSessionId} />}
        </section>
        <section>
          <SectionTitle size={15} className="mb-1.5">
            Refunds
          </SectionTitle>
          {refunds.length === 0 ? (
            <p className="text-body text-text-muted m-0">No refund has been asked for.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {refunds.map((r) => {
                const badge = REFUND_STATUS_BADGE[r.status];
                return (
                  <div key={r.id} className="border-border-soft rounded-md border px-3.5 py-2.5">
                    <div className="flex items-center gap-2">
                      <Badge status={badge.status}>{badge.label}</Badge>
                      <span className="flex-1" />
                      <span className="text-body text-text-strong font-semibold tabular-nums">
                        {money(r.amountRupees)}
                      </span>
                    </div>
                    <div className="text-caption text-text-muted mt-1">
                      Asked {dateTimeCopy(r.requestedAt)}
                      {r.processedAt ? ` · done ${dateTimeCopy(r.processedAt)}` : ''}
                    </div>
                    <div className="text-caption text-text-body mt-1">“{r.reason}”</div>
                    {r.failureReason && (
                      <div className="text-caption text-d-700 mt-1">{r.failureReason}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <Drawer
      open={paymentId !== null}
      onClose={onClose}
      width={DRAWER_WIDTH}
      title="Payment"
      subtitle={detail ? money(detail.line.amountRupees) : undefined}
    >
      {body}
    </Drawer>
  );
}
