import type { ReactNode } from 'react';

import { isFailure } from '@/core/error/failure';
import { useFileDownloadMutation } from '@/shared/hooks/useFileDownloadMutation';
import { cn } from '@/shared/lib/cn';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Drawer } from '@/shared/ui/Drawer';
import { ErrorState } from '@/shared/ui/ErrorState';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { SkeletonLine } from '@/shared/ui/Skeleton';
import { toast } from '@/shared/ui/toast/toast.store';

import { usePeriodStatementQuery } from '@/features/settlements/application/queries/usePeriodStatementQuery';
import { useSettlementPeriodQuery } from '@/features/settlements/application/queries/useSettlementPeriodQuery';
import { useStatementPdfMutation } from '@/features/settlements/application/queries/useStatementPdfMutation';
import type {
  SettlementPeriod,
  SettlementStatement,
} from '@/features/settlements/domain/entities/settlements.entities';
import {
  downloadBlob,
  effectiveRate,
  fmtDateTime,
  PAYOUT_STATUS,
  PERIOD_STATUS,
  periodLabel,
  rupees,
} from '@/features/settlements/presentation/components/settlementsFormat';

const DRAWER_WIDTH = 480;
const SKELETON_LINES = 8;

interface SettlementPeriodDrawerProps {
  /** The row that was opened; `null` closes the drawer. */
  period: SettlementPeriod | null;
  onClose: () => void;
}

function Line({ label, value, strong }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4 py-1.5">
      <span className="text-body text-text-muted">{label}</span>
      <span
        className={cn(
          'text-body text-right tabular-nums',
          strong ? 'text-text-strong font-semibold' : 'text-text-body',
        )}
      >
        {value}
      </span>
    </div>
  );
}

/** Deductions are shown signed so the column adds up to the net. */
function minus(paise: number): string {
  return paise === 0 ? rupees(0) : `− ${rupees(Math.abs(paise))}`;
}

/** Stored statement PDF via the shared files API, else rendered on demand. */
function StatementButton({ statement }: { statement: SettlementStatement }) {
  const storedDownload = useFileDownloadMutation();
  const rendered = useStatementPdfMutation();
  const filename = `${statement.statementNo}.pdf`;

  const onError = (failure: unknown): void =>
    toast(isFailure(failure) ? failure.message : 'Could not download the statement.', 'error');

  const handleDownload = (): void => {
    if (statement.pdfFileId) {
      storedDownload.mutate({ fileId: statement.pdfFileId, filename }, { onError });
      return;
    }
    rendered.mutate(statement.id, {
      onSuccess: (blob) => downloadBlob(blob, filename),
      onError,
    });
  };

  return (
    <Button
      variant="secondary"
      icon="file-down"
      onClick={handleDownload}
      busy={storedDownload.isPending || rendered.isPending}
    >
      Statement {statement.statementNo}
    </Button>
  );
}

/**
 * One settlement period: how its net payable was reached, any adjustments
 * Medibook applied, the payout that settles it and the issued statement.
 */
export function SettlementPeriodDrawer({ period, onClose }: SettlementPeriodDrawerProps) {
  const detailQuery = useSettlementPeriodQuery(period?.id ?? null);
  const statementQuery = usePeriodStatementQuery(period?.periodStart ?? null);
  const detail = detailQuery.data;
  const statement = statementQuery.data ?? null;

  let body: ReactNode;
  if (detailQuery.isPending) {
    body = (
      <div className="flex flex-col gap-3">
        {Array.from({ length: SKELETON_LINES }, (_, i) => (
          <SkeletonLine key={i} />
        ))}
      </div>
    );
  } else if (detailQuery.isError || !detail) {
    body = (
      <ErrorState
        inline
        title="This settlement didn't load"
        message={isFailure(detailQuery.error) ? detailQuery.error.message : undefined}
        onRetry={() => void detailQuery.refetch()}
      />
    );
  } else {
    const payout = detail.payout;
    body = (
      <div className="flex flex-col gap-5">
        <section>
          <SectionTitle size={15} className="mb-1.5">
            How the net was reached
          </SectionTitle>
          <Line label="Bookings in period" value={detail.breakdown.bookingsCount} />
          <Line label="Gross collected" value={rupees(detail.grossPaise)} />
          <Line label="Refunds" value={minus(detail.refundsPaise)} />
          <Line label="Gateway fees" value={minus(detail.gatewayFeesPaise)} />
          <Line
            label={`Commission (${effectiveRate(detail.commissionPaise, detail.grossPaise)})`}
            value={minus(detail.commissionPaise)}
          />
          {detail.tdsPaise !== 0 && <Line label="TDS" value={minus(detail.tdsPaise)} />}
          {detail.adjustmentsPaise !== 0 && (
            <Line label="Adjustments" value={rupees(detail.adjustmentsPaise)} />
          )}
          <div className="border-border-soft mt-1.5 border-t pt-1.5">
            <Line label="Net payable" value={rupees(detail.netPayablePaise)} strong />
          </div>
        </section>

        {detail.adjustments.length > 0 && (
          <section>
            <SectionTitle size={15} className="mb-1.5">
              Adjustments by Medibook
            </SectionTitle>
            {detail.adjustments.map((a) => (
              <Line
                key={a.id}
                label={`${a.reason} · ${fmtDateTime(a.createdAt)}`}
                value={rupees(a.amountPaise)}
              />
            ))}
          </section>
        )}

        <section>
          <SectionTitle size={15} className="mb-1.5">
            Payout
          </SectionTitle>
          {payout ? (
            <>
              <Line
                label="Status"
                value={
                  <Badge status={PAYOUT_STATUS[payout.status].badge}>
                    {PAYOUT_STATUS[payout.status].label}
                  </Badge>
                }
              />
              <Line label="Amount" value={rupees(payout.amountPaise)} strong />
              <Line
                label="To account"
                value={payout.bankAccountLast4 ? `•••• ${payout.bankAccountLast4}` : '—'}
              />
              <Line label="Transfer ref (UTR)" value={payout.utrRef ?? '—'} />
              <Line label="Released on" value={fmtDateTime(payout.releasedAt)} />
              {payout.failureReason && (
                <p className="text-caption text-d-500 m-0 mt-1.5">{payout.failureReason}</p>
              )}
              {payout.notes && (
                <p className="text-caption text-text-body m-0 mt-1.5">
                  “{payout.notes}” — Medibook
                </p>
              )}
            </>
          ) : (
            <p className="text-body text-text-muted m-0">
              {detail.status === 'open'
                ? 'This period is still accruing. Medibook creates the payout once it closes.'
                : 'No payout has been created for this period yet.'}
            </p>
          )}
        </section>
      </div>
    );
  }

  return (
    <Drawer
      open={period !== null}
      onClose={onClose}
      width={DRAWER_WIDTH}
      title={period ? periodLabel(period.periodStart, period.periodEnd) : ''}
      subtitle={
        period ? (
          <Badge status={PERIOD_STATUS[period.status].badge}>
            {PERIOD_STATUS[period.status].label}
          </Badge>
        ) : undefined
      }
      footer={
        statement ? (
          <StatementButton statement={statement} />
        ) : (
          <span className="text-caption text-text-muted">
            {statementQuery.isPending
              ? 'Looking for the statement…'
              : statementQuery.isError
                ? 'The statement could not be looked up.'
                : 'No statement has been issued for this period yet.'}
          </span>
        )
      }
    >
      {body}
    </Drawer>
  );
}
