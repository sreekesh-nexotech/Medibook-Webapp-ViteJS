import { useState } from 'react';

import { useSort } from '@/shared/hooks/useSort';
import { cn } from '@/shared/lib/cn';
import { downloadCsv } from '@/shared/lib/download';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import { InfoDot } from '@/shared/ui/InfoDot';
import { OpsEntity } from '@/shared/ui/OpsEntity';
import { Pager } from '@/shared/ui/Pager';
import { SearchField } from '@/shared/ui/SearchField';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';
import { toast } from '@/shared/ui/toast/toast.store';

import { isFailure } from '@/core/error/failure';

import { useComplianceHospitalsQuery } from '@/features/ops-compliance/application/queries/useComplianceHospitalsQuery';
import { useComplianceLoginsQuery } from '@/features/ops-compliance/application/queries/useComplianceLoginsQuery';
import { useExportComplianceLoginsMutation } from '@/features/ops-compliance/application/queries/useExportComplianceLoginsMutation';
import {
  LOGIN_RESULTS,
  type LoginEvent,
  type LoginHistoryFilters,
} from '@/features/ops-compliance/domain/entities/compliance.entities';
import { ComplianceDateInput } from '@/features/ops-compliance/presentation/components/ComplianceDateInput';
import {
  LOGIN_RESULT_LOOK,
  deviceLabel,
  exportedMessage,
  fmtComplianceWhen,
  principalLabel,
} from '@/features/ops-compliance/presentation/components/compliance.labels';

const PAGE_SIZE = 10;

const COLUMNS = ['User', 'Instance', 'When', 'IP address', 'Device', 'Result'] as const;

const ALL_INSTANCES = 'Instance: All';
const ALL_RESULTS = 'Result: All';
const OPS_CONSOLE = 'Ops console';

/** Only the time is sortable server-side (`sort=occurred_at`). */
const SORT_KEYS: Readonly<Record<string, string>> = { When: 'when' };

/**
 * Staff login history (audit 2.5 / SA-06) on `GET /platform/compliance/
 * login-history` — who signed in, when, from which IP and device, with what
 * result, against which hospital or the operations console.
 *
 * Instance, result and date filters, the sort and the pager all run on the
 * server. The backend has no free-text search, so the search box narrows the
 * rows already on this page by identifier or IP, and says so.
 */
export function LoginHistoryCard() {
  const [q, setQ] = useState('');
  const [instF, setInstF] = useState(ALL_INSTANCES);
  const [resultF, setResultF] = useState(ALL_RESULTS);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);
  const { sort, onSort } = useSort<never>({ key: 'when', dir: 'desc' });

  const hospitalsQuery = useComplianceHospitalsQuery();
  const hospitals = hospitalsQuery.data?.items ?? [];
  const hospitalName = (id: string | null): string =>
    id == null ? OPS_CONSOLE : (hospitals.find((h) => h.id === id)?.name ?? 'Hospital instance');

  const pickedHospital = hospitals.find((h) => h.name === instF) ?? null;
  const filters: LoginHistoryFilters = {
    dateFrom: from,
    dateTo: to,
    result: LOGIN_RESULTS.find((r) => LOGIN_RESULT_LOOK[r].label === resultF) ?? null,
    hospitalId: pickedHospital?.id ?? null,
    principal: instF === OPS_CONSOLE ? 'platform' : null,
  };
  const loginsQuery = useComplianceLoginsQuery({
    ...filters,
    page: page + 1,
    pageSize: PAGE_SIZE,
    sortDirection: sort.dir,
  });
  const exportMutation = useExportComplianceLoginsMutation();

  const ql = q.trim().toLowerCase();
  const pageRows = loginsQuery.data?.items ?? [];
  const rows = ql
    ? pageRows.filter((l) => l.identifier.toLowerCase().includes(ql) || l.ip.includes(ql))
    : pageRows;
  const total = loginsQuery.data?.total ?? 0;

  const reset =
    (fn: (v: string) => void) =>
    (v: string): void => {
      fn(v);
      setPage(0);
    };
  const filtersActive = Boolean(instF !== ALL_INSTANCES || resultF !== ALL_RESULTS || from || to);
  const clearAll = (): void => {
    setQ('');
    setInstF(ALL_INSTANCES);
    setResultF(ALL_RESULTS);
    setFrom('');
    setTo('');
    setPage(0);
  };

  /** THE LAW: write the file first, then report exactly what landed. */
  const exportCsv = (): void => {
    exportMutation.mutate(filters, {
      onSuccess: ({ rows: all, truncated }) => {
        downloadCsv('medibook-staff-login-history.csv', [
          ['When (UTC)', 'User', 'Account type', 'Instance', 'IP address', 'Device', 'Result'],
          ...all.map((l: LoginEvent) => [
            l.occurredAt,
            l.identifier,
            principalLabel(l.principal),
            hospitalName(l.hospitalId),
            l.ip,
            l.userAgent ?? '',
            LOGIN_RESULT_LOOK[l.result].label,
          ]),
        ]);
        toast(exportedMessage(all.length, 'sign-in attempts', truncated), 'success');
      },
      onError: (error) =>
        toast(
          isFailure(error) ? error.message : 'The sign-in history could not be exported.',
          'error',
        ),
    });
  };

  const tableState: TableStateSpec | undefined = loginsQuery.isLoading
    ? { kind: 'loading', rows: PAGE_SIZE }
    : loginsQuery.isLoadingError
      ? {
          kind: 'error',
          title: "Sign-in history didn't load.",
          message: isFailure(loginsQuery.error) ? loginsQuery.error.message : undefined,
          onRetry: () => void loginsQuery.refetch(),
        }
      : rows.length === 0
        ? {
            kind: 'empty',
            icon: 'log-in',
            title:
              filtersActive || ql ? 'No sign-ins match your filters.' : 'No sign-in history yet.',
            message: ql
              ? 'The search only looks at this page — clear it, or narrow the filters instead.'
              : filtersActive
                ? 'Widen the date range, or clear the filters to see every attempt.'
                : 'Every sign-in to the console and to each hospital instance is recorded here.',
            ...(filtersActive || ql ? { actionLabel: 'Clear filters', onAction: clearAll } : {}),
          }
        : undefined;

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SectionTitle>Staff Login History</SectionTitle>
        <InfoDot text="Every sign-in attempt against the operations console and each hospital instance: which account, when, from which IP and device, and the result. Retained for 365 days." />
        <div className="flex-1"></div>
        <Button
          size="sm"
          variant="secondary"
          icon="download"
          onClick={exportCsv}
          busy={exportMutation.isPending}
        >
          Export CSV
        </Button>
      </div>
      <div className="mb-4">
        <SearchField
          value={q}
          onChange={setQ}
          placeholder="Search this page by email, phone or IP"
          aria-label="Search the sign-in attempts on this page by email, phone or IP"
        />
      </div>
      <div className="mb-4.5 flex flex-wrap items-center gap-3">
        <FilterSelect
          value={instF}
          aria-label="Filter by hospital or console"
          options={[ALL_INSTANCES, OPS_CONSOLE, ...hospitals.map((h) => h.name)]}
          onChange={reset(setInstF)}
        />
        <FilterSelect
          value={resultF}
          aria-label="Filter by result"
          options={[ALL_RESULTS, ...LOGIN_RESULTS.map((r) => LOGIN_RESULT_LOOK[r].label)]}
          onChange={reset(setResultF)}
        />
        <ComplianceDateInput value={from} onChange={reset(setFrom)} title="From date" />
        <ComplianceDateInput value={to} onChange={reset(setTo)} title="To date" />
        {(filtersActive || ql) && (
          <button
            type="button"
            onClick={clearAll}
            className="text-body text-blue cursor-pointer border-none bg-transparent p-0"
          >
            Clear all
          </button>
        )}
        <div className="flex-1"></div>
        <span className="text-caption text-text-muted tabular-nums">
          {total.toLocaleString('en-IN')} attempts
        </span>
      </div>
      <TableShell
        columns={COLUMNS}
        scrollLabel="Staff sign-in attempts"
        sortKeys={SORT_KEYS}
        sort={sort}
        onSort={(key) => {
          onSort(key);
          setPage(0);
        }}
        state={tableState}
      >
        {rows.map((l) => {
          const look = LOGIN_RESULT_LOOK[l.result];
          const ok = l.result === 'success';
          return (
            <tr key={l.id}>
              <td className={cn(tdClass, 'max-w-80')}>
                <OpsEntity
                  icon={ok ? 'user-check' : 'user-x'}
                  tint={ok ? 'info' : l.result === 'locked' ? 'orange' : 'danger'}
                  title={l.identifier}
                  sub={principalLabel(l.principal)}
                />
              </td>
              <td className={tdClass}>{hospitalName(l.hospitalId)}</td>
              <td className={cn(tdClass, 'whitespace-nowrap tabular-nums')}>
                {fmtComplianceWhen(l.occurredAt)}
              </td>
              <td className={cn(tdClass, 'tabular-nums')}>{l.ip}</td>
              <td className={tdClass} title={l.userAgent ?? undefined}>
                {deviceLabel(l.userAgent)}
              </td>
              <td className={tdClass}>
                <Badge status={look.token}>{look.label}</Badge>
              </td>
            </tr>
          );
        })}
      </TableShell>
      <Pager
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        onPage={setPage}
        noun="sign-in attempts"
      />
    </Card>
  );
}
