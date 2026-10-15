import { useState } from 'react';

import { DEFAULT_PAGE_SIZE } from '@/core/api/pagination';
import { useOpsPermission } from '@/shared/hooks/useOpsPermission';
import { fmtDate, money, todayISO } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { Drawer } from '@/shared/ui/Drawer';
import { FormModal } from '@/shared/ui/FormModal';
import { IconBtn } from '@/shared/ui/IconBtn';
import { InfoGrid } from '@/shared/ui/InfoGrid';
import { OpsField } from '@/shared/ui/OpsField';
import { Pager } from '@/shared/ui/Pager';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import { useIssueStatementsMutation } from '@/features/ops-settlements/application/queries/useIssueStatementsMutation';
import { useStatementPdfMutation } from '@/features/ops-settlements/application/queries/useSettlementFileMutations';
import { useStatementsQuery } from '@/features/ops-settlements/application/queries/useStatementsQuery';
import type {
  PlatformStatement,
  StatementListParams,
} from '@/features/ops-settlements/domain/entities/opsSettlements.entities';
import {
  datePart,
  failureText,
  isNotImplemented,
  openStatementPdf,
  previousMonth,
} from '@/features/ops-settlements/presentation/components/opsSettlements.viewModel';

const COLUMNS = ['Statement', 'Hospital', 'Month', 'Bookings', 'Gross', 'Net payable', ''] as const;
const LOADING_ROWS = 4;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

interface StatementsPanelProps {
  /** Scope to one hospital (the screen's hospital filter), or every hospital. */
  hospitalId: string | null;
  /** Name lookup for rows whose snapshot has none. */
  hospitalName: (id: string) => string | null;
}

/**
 * Monthly platform statements (UAT-37, 09·R5; `billing.view`): the list,
 * one statement's figures, its PDF (a signed link, or the server's 501 when
 * it cannot render), and issuing a month for every hospital (`billing.edit`,
 * Idempotency-Key per dialog).
 */
export function StatementsPanel({ hospitalId, hospitalName }: StatementsPanelProps) {
  const canIssue = useOpsPermission().can('billing.edit');
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<PlatformStatement | null>(null);
  const [issuing, setIssuing] = useState(false);
  const pdf = useStatementPdfMutation();

  const params: StatementListParams = {
    page: page + 1,
    pageSize: DEFAULT_PAGE_SIZE,
    hospitalId,
    dateFrom: null,
    dateTo: null,
  };
  const query = useStatementsQuery(params);
  const rows = query.data?.items ?? [];

  const nameOf = (s: PlatformStatement): string =>
    s.hospitalName ?? hospitalName(s.hospitalId) ?? 'Hospital';

  const savePdf = (statement: PlatformStatement): void =>
    pdf.mutate(statement, {
      onSuccess: openStatementPdf,
      onError: (error) =>
        toast(
          isNotImplemented(error)
            ? 'This server cannot render statement PDFs yet. The figures are on screen.'
            : failureText(error, 'The statement PDF could not be opened.'),
          'error',
        ),
    });

  const state: TableStateSpec | undefined = query.isPending
    ? { kind: 'loading', rows: LOADING_ROWS }
    : query.isError
      ? {
          kind: 'error',
          message: failureText(query.error, 'The statements could not be loaded.'),
          onRetry: () => void query.refetch(),
        }
      : rows.length === 0
        ? {
            kind: 'empty',
            icon: 'file-text',
            title: 'No statements yet.',
            message: 'Statements are issued monthly for every hospital with activity.',
            ...(canIssue
              ? { actionLabel: 'Issue statements', onAction: () => setIssuing(true) }
              : {}),
          }
        : undefined;

  return (
    <>
      {canIssue && (
        <div className="mb-4 flex justify-end">
          <Button size="sm" icon="file-text" onClick={() => setIssuing(true)}>
            Issue Statements
          </Button>
        </div>
      )}
      <TableShell
        columns={COLUMNS}
        rightCols={['Bookings', 'Gross', 'Net payable']}
        scrollLabel="Platform statements"
        state={state}
      >
        {rows.map((s) => (
          <tr
            key={s.id}
            onClick={() => setOpen(s)}
            className="hover:bg-grey-200 cursor-pointer transition-colors duration-150"
          >
            <td className={`${tdClass} text-text-strong font-medium tabular-nums`}>
              {s.statementNo}
            </td>
            <td className={tdClass}>{nameOf(s)}</td>
            <td className={tdClass}>
              {fmtDate(s.periodStart)} – {fmtDate(s.periodEnd)}
            </td>
            <td className={`${tdClass} text-right tabular-nums`}>{s.bookingsCount}</td>
            <td className={`${tdClass} text-right tabular-nums`}>{money(s.grossRupees)}</td>
            <td className={`${tdClass} text-right tabular-nums`}>{money(s.netPayableRupees)}</td>
            <td className={tdClass} onClick={(e) => e.stopPropagation()}>
              <IconBtn
                name="download"
                label={`PDF of ${s.statementNo}`}
                box={36}
                size={16}
                disabled={pdf.isPending}
                onClick={() => savePdf(s)}
              />
            </td>
          </tr>
        ))}
      </TableShell>
      {(query.data?.total ?? 0) > DEFAULT_PAGE_SIZE && (
        <Pager
          total={query.data?.total ?? 0}
          page={page}
          pageSize={DEFAULT_PAGE_SIZE}
          onPage={setPage}
          noun="statements"
        />
      )}
      {open && (
        <Drawer
          open
          onClose={() => setOpen(null)}
          title={open.statementNo}
          subtitle={`${nameOf(open)} · ${fmtDate(open.periodStart)} – ${fmtDate(open.periodEnd)}`}
          width={560}
          footer={
            <div className="flex justify-end">
              <Button icon="download" busy={pdf.isPending} onClick={() => savePdf(open)}>
                Statement PDF
              </Button>
            </div>
          }
        >
          <InfoGrid
            items={[
              { k: 'Issued', v: open.issuedAt ? fmtDate(datePart(open.issuedAt)) : '—' },
              { k: 'Bookings', v: open.bookingsCount, num: true },
              { k: 'Gross collected', v: money(open.grossRupees), num: true },
              { k: 'Refunds', v: money(open.refundsRupees), num: true },
              { k: 'Gateway fees', v: money(open.gatewayFeesRupees), num: true },
              { k: 'Commission', v: money(open.commissionRupees), num: true },
              { k: 'GST on commission', v: money(open.commissionGstRupees), num: true },
              { k: 'Convenience fees', v: money(open.convenienceFeesRupees), num: true },
              { k: 'GST on convenience fees', v: money(open.convenienceFeeGstRupees), num: true },
              { k: 'Net payable', v: money(open.netPayableRupees), num: true },
            ]}
          />
        </Drawer>
      )}
      {issuing && <IssueStatementsModal onClose={() => setIssuing(false)} />}
    </>
  );
}

function IssueStatementsModal({ onClose }: { onClose: () => void }) {
  const issue = useIssueStatementsMutation();
  const [month, setMonth] = useState(() => previousMonth(todayISO()));
  const [error, setError] = useState<string | null>(null);

  const submit = (): void => {
    if (!MONTH_RE.test(month)) {
      setError('Pick a month.');
      return;
    }
    issue.mutate(month, {
      onSuccess: (result) => {
        const n = result.issued.length;
        toast(
          n === 0
            ? 'No new statements: every hospital with activity already has this month.'
            : `${n} statement${n === 1 ? '' : 's'} issued${
                result.skippedCount > 0 ? `, ${result.skippedCount} already issued` : ''
              }.`,
          n === 0 ? 'info' : 'success',
        );
        onClose();
      },
      onError: (failure) => setError(failureText(failure, 'The statements were not issued.')),
    });
  };

  return (
    <FormModal
      open
      onClose={onClose}
      title="Issue Statements"
      width={460}
      onSubmit={submit}
      submitLabel={issue.isPending ? 'Issuing…' : 'Issue Statements'}
      busy={issue.isPending}
    >
      <div className="flex flex-col gap-4">
        <OpsField
          label="Month"
          required
          error={error}
          hint="Every hospital with ledger activity that month gets its statement. Hospitals already issued are skipped, so issuing twice is safe."
        >
          <TextInput
            type="month"
            value={month}
            onChange={(v) => {
              setMonth(v);
              setError(null);
            }}
            height={44}
          />
        </OpsField>
      </div>
    </FormModal>
  );
}
