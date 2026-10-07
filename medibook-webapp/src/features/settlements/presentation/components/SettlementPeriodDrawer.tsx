import type { ReactNode } from 'react';

import { isFailure } from '@/core/error/failure';
import { cn } from '@/shared/lib/cn';
import { Badge } from '@/shared/ui/Badge';
import { Drawer } from '@/shared/ui/Drawer';
import { ErrorState } from '@/shared/ui/ErrorState';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { SkeletonLine } from '@/shared/ui/Skeleton';

import { useSettlementPeriodQuery } from '@/features/settlements/application/queries/useSettlementPeriodQuery';
import { useStatementForDateQuery } from '@/features/settlements/application/queries/useStatementForDateQuery';
import type {
  SettlementPeriod,
  SettlementPeriodDetail,
  StatementRef,
} from '@/features/settlements/domain/entities/settlements.entities';
import { StatementDownloadButton } from '@/features/settlements/presentation/components/StatementDownloadButton';
import {
  effectiveRate,
  fmtDateTime,
  PAYOUT_STATUS,
  PERIOD_STATUS,
  periodCheck,
  periodLabel,
  rupees,
  statementSpan,
} from '@/features/settlements/presentation/components/settlementsFormat';

const DRAWER_WIDTH = 480;
const SKELETON_LINES = 8;

/** What opening a period needs: the row from the periods list, or a payout's period. */
export type PeriodRef = Pick<SettlementPeriod, 'id' | 'periodStart' | 'periodEnd'> &
  Partial<Pick<SettlementPeriod, 'status'>>;

interface SettlementPeriodDrawerProps {
  /** The period that was opened; `null` closes the drawer. */
  period: PeriodRef | null;
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

/** A signed amount: "+ ₹100" / "− ₹100". */
function signed(paise: number): string {
  return paise < 0 ? minus(paise) : `+ ${rupees(paise)}`;
}

/**
 * The statements a period appears in (UAT-29). Statements are monthly and
 * periods are custom windows, so the server links every month the period
 * overlaps (backend B4); an older server is asked for the month containing
 * the period's start instead.
 */
function PeriodStatements({ detail }: { detail: SettlementPeriodDetail | undefined }) {
  const needsLookup = detail !== undefined && detail.statements === null;
  const lookup = useStatementForDateQuery(needsLookup ? detail.periodStart : null);

  let statements: readonly StatementRef[] = [];
  let pdfFileId: string | null = null;
  if (detail?.statements) statements = detail.statements;
  else if (lookup.data) {
    statements = [lookup.data];
    pdfFileId = lookup.data.pdfFileId;
  }

  if (statements.length === 0) {
    let copy = 'No statement has been issued for this period’s month yet.';
    if (detail === undefined || (needsLookup && lookup.isPending))
      copy = 'Looking for the statement…';
    else if (needsLookup && lookup.isError) copy = 'The statement could not be looked up.';
    return <span className="text-caption text-text-muted">{copy}</span>;
  }

  return (
    <div className="flex flex-col gap-2">
      {statements.length > 1 && (
        <span className="text-caption text-text-muted">
          Statements are monthly — this period falls in {statements.length} of them.
        </span>
      )}
      <div className="flex flex-wrap gap-2">
        {statements.map((st) => (
          <StatementDownloadButton
            key={st.id}
            statementId={st.id}
            statementNo={st.statementNo}
            pdfFileId={pdfFileId}
          >
            Statement {st.statementNo} · {statementSpan(st)}
          </StatementDownloadButton>
        ))}
      </div>
    </div>
  );
}

/**
 * One settlement period: how its net payable was reached, any adjustments
 * Medibook applied, the payout that settles it and the issued statement.
 */
export function SettlementPeriodDrawer({ period, onClose }: SettlementPeriodDrawerProps) {
  const detailQuery = useSettlementPeriodQuery(period?.id ?? null);
  const detail = detailQuery.data;
  const status = detail?.status ?? period?.status ?? null;
  // A payout row may not carry its period's dates; the detail always does.
  const span = detail ?? period;
  const drawerTitle =
    span && span.periodStart && span.periodEnd
      ? periodLabel(span.periodStart, span.periodEnd)
      : 'Settlement period';

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
    const b = detail.breakdown;
    // The ledger's own total plus adjustments less TDS should equal the net
    // payable; when it does not, say so (SET-01).
    const check = periodCheck(detail);
    body = (
      <div className="flex flex-col gap-5">
        <section>
          <SectionTitle size={15} className="mb-1.5">
            How the net was reached
          </SectionTitle>
          <Line label="Bookings in period" value={b.bookingsCount} />
          <Line label="Gross collected" value={rupees(b.grossPaise)} />
          <Line label="Refunds" value={minus(b.refundsPaise)} />
          <Line label="Gateway fees" value={minus(b.gatewayFeesPaise)} />
          <Line
            label={`Commission (${effectiveRate(b.commissionPaise, b.grossPaise)})`}
            value={minus(b.commissionPaise)}
          />
          {b.commissionGstPaise !== 0 && (
            <Line label="GST on commission" value={minus(b.commissionGstPaise)} />
          )}
          {b.convenienceFeesPaise !== 0 && (
            <Line
              label="Convenience fees (kept by Medibook)"
              value={minus(b.convenienceFeesPaise)}
            />
          )}
          {b.convenienceFeeGstPaise !== 0 && (
            <Line label="GST on convenience fees" value={minus(b.convenienceFeeGstPaise)} />
          )}
          {b.carriedAdjustmentsPaise !== 0 && (
            <Line
              label="Adjustments carried from a paid period"
              value={signed(b.carriedAdjustmentsPaise)}
            />
          )}
          {detail.adjustmentsPaise !== 0 && (
            <Line label="Adjustments" value={signed(detail.adjustmentsPaise)} />
          )}
          {detail.tdsPaise !== 0 && <Line label="TDS" value={minus(detail.tdsPaise)} />}
          <div className="border-border-soft mt-1.5 border-t pt-1.5">
            <Line label="Net payable" value={rupees(detail.netPayablePaise)} strong />
          </div>
          {!check.reconciled && (
            <p className="text-caption text-d-700 m-0 mt-1.5">
              Medibook&apos;s ledger for this period, with adjustments and TDS, adds up to{' '}
              {rupees(check.expectedNetPaise)} — {rupees(Math.abs(check.differencePaise))}{' '}
              {check.differencePaise > 0 ? 'less' : 'more'} than the net payable. Ask Medibook to
              explain the difference before the payout.
            </p>
          )}
          {b.lateEntries > 0 && (
            <p className="text-caption text-text-muted m-0 mt-1.5">
              Includes {b.lateEntries} ledger entr{b.lateEntries === 1 ? 'y' : 'ies'} recorded after
              an earlier period closed; they settle here instead.
            </p>
          )}
        </section>

        {detail.adjustments.length > 0 && (
          <section>
            <SectionTitle size={15} className="mb-1.5">
              Adjustments by Medibook
            </SectionTitle>
            {detail.adjustments.map((a) => (
              <div key={a.id}>
                <Line
                  label={`${a.reason} · ${fmtDateTime(a.createdAt)}`}
                  value={signed(a.amountPaise)}
                />
                {a.carriedForward && (
                  <p className="text-caption text-text-muted m-0 mb-1">
                    Made after this period was paid — it settles in your next period, not in this
                    one&apos;s net.
                  </p>
                )}
              </div>
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
              No payout has been created for this period yet. Medibook adds it to its next payout
              run.
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
      title={drawerTitle}
      subtitle={
        status ? (
          <Badge status={PERIOD_STATUS[status].badge}>{PERIOD_STATUS[status].label}</Badge>
        ) : undefined
      }
      footer={detailQuery.isError ? undefined : <PeriodStatements detail={detail} />}
    >
      {body}
    </Drawer>
  );
}
