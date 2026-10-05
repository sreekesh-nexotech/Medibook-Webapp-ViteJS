import { useState } from 'react';

import { isFailure } from '@/core/error/failure';
import { useSort } from '@/shared/hooks/useSort';
import { Badge } from '@/shared/ui/Badge';
import { Card } from '@/shared/ui/Card';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import type { OpsTint } from '@/shared/ui/OpsConfirm';
import { OpsEntity } from '@/shared/ui/OpsEntity';
import { Pager } from '@/shared/ui/Pager';
import { RefreshBtn } from '@/shared/ui/RefreshBtn';
import { SearchField } from '@/shared/ui/SearchField';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';

import type { LogSeverity } from '@/features/ops-logs/application/store/logs.types';
import { useLogsQuery } from '@/features/ops-logs/application/queries/useLogsQuery';
import { useRefreshLogs } from '@/features/ops-logs/application/queries/useRefreshLogs';
import type { AuditLogEntry } from '@/features/ops-logs/domain/entities/logs.types';
import { actorLabel, formatLogTime } from '@/features/ops-logs/presentation/components/logs.format';
import { useLogsDebouncedValue } from '@/features/ops-logs/presentation/hooks/useLogsDebouncedValue';

const OPS_LOG_PAGE = 7;

/** Typing pause before the search box is sent as `?q=`. */
const SEARCH_DEBOUNCE_MS = 350;

/**
 * The audit trail carries no severity yet (backend gap, flagged in P9): every
 * row reads as Info until `audit_log` gains one. The Severity filter is kept
 * on screen but cannot narrow the trail.
 */
const INTERIM_SEVERITY: LogSeverity = 'Info';

/** Shown for a missing IP or an unknown refresh time. */
const NONE = '—';

const SEV_TINT: Record<LogSeverity, OpsTint> = {
  Critical: 'danger',
  Warning: 'warning',
  Info: 'info',
};

const LOG_COLUMNS = ['Action', 'Module', 'IP Address', 'Timestamp', 'Severity'] as const;

const SEVERITY_OPTIONS = ['All', 'Info', 'Warning', 'Critical'] as const;

const MODULE_OPTIONS = [
  'All',
  'Hospitals',
  'Settlements',
  'Billing',
  'Subscription Plans',
  'Users & Roles',
  'Platform Users',
  'Reports',
  'Settings',
  'Auth',
  'Media',
  'Notifications',
  'Compliance',
] as const;

const dateInputClass =
  'rounded-input border-border text-body text-text-body h-11 border bg-white px-3';

/** Compliance logs — the platform audit trail (design `OpsLogs`, Ops.jsx). */
export function OpsLogsScreen() {
  const [q, setQ] = useState('');
  const [sevF, setSevF] = useState('All');
  const [modF, setModF] = useState('All');
  const [dateF, setDateF] = useState('');
  const [dateT, setDateT] = useState('');
  const [page, setPage] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const { sort, onSort } = useSort<AuditLogEntry>();
  const refreshLogs = useRefreshLogs();

  const ql = q.trim();
  const debouncedQ = useLogsDebouncedValue(ql, SEARCH_DEBOUNCE_MS);
  const logsQuery = useLogsQuery({
    page: page + 1,
    pageSize: OPS_LOG_PAGE,
    ...(dateF ? { dateFrom: dateF } : {}),
    ...(dateT ? { dateTo: dateT } : {}),
    ...(debouncedQ ? { q: debouncedQ } : {}),
    ...(sort.key === 'time' ? { sortDir: sort.dir } : {}),
  });
  const total = logsQuery.data?.total ?? 0;
  const rows = logsQuery.data?.items ?? [];
  const pg = Math.min(page, Math.max(0, Math.ceil(total / OPS_LOG_PAGE) - 1));

  const reset =
    (fn: (v: string) => void) =>
    (v: string): void => {
      fn(v);
      setPage(0);
    };
  const filtersActive = Boolean(ql || sevF !== 'All' || modF !== 'All' || dateF || dateT);
  const clearAll = (): void => {
    setQ('');
    setSevF('All');
    setModF('All');
    setDateF('');
    setDateT('');
    setPage(0);
  };

  /** Re-fetch the trail from the server and return to page 1. */
  const handleRefresh = async (): Promise<void> => {
    setRefreshing(true);
    setPage(0);
    await refreshLogs();
    setRefreshing(false);
  };

  const tableState: TableStateSpec | undefined =
    logsQuery.isPending || refreshing
      ? { kind: 'loading', rows: OPS_LOG_PAGE }
      : logsQuery.isError
        ? {
            kind: 'error',
            message: isFailure(logsQuery.error) ? logsQuery.error.message : undefined,
            onRetry: () => void logsQuery.refetch(),
          }
        : rows.length === 0
          ? {
              kind: 'empty',
              icon: 'scroll-text',
              title: filtersActive ? 'No results match your filters.' : 'No audit entries yet.',
              message: filtersActive
                ? 'Widen the date range, or clear the filters to see the whole trail.'
                : 'Sensitive actions across the platform are written here as they happen.',
              ...(filtersActive ? { actionLabel: 'Clear filters', onAction: clearAll } : {}),
            }
          : undefined;

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <div className="mb-4">
          <SearchField
            value={q}
            onChange={reset(setQ)}
            placeholder="Search action or user"
            aria-label="Search audit trail by action or user"
          />
        </div>
        <div className="mb-4.5 flex flex-wrap items-center gap-3">
          <RefreshBtn onRefresh={handleRefresh} title="Refresh audit trail" />
          <FilterSelect
            value={sevF === 'All' ? 'Severity: All' : sevF}
            aria-label="Filter by severity"
            options={SEVERITY_OPTIONS.map((x) => (x === 'All' ? 'Severity: All' : x))}
            onChange={(v) => reset(setSevF)(v === 'Severity: All' ? 'All' : v)}
          />
          <FilterSelect
            value={modF === 'All' ? 'Module: All' : modF}
            aria-label="Filter by module"
            options={MODULE_OPTIONS.map((x) => (x === 'All' ? 'Module: All' : x))}
            onChange={(v) => reset(setModF)(v === 'Module: All' ? 'All' : v)}
          />
          <input
            type="date"
            value={dateF}
            onChange={(e) => reset(setDateF)(e.target.value)}
            title="From date"
            aria-label="From date"
            className={dateInputClass}
          />
          <input
            type="date"
            value={dateT}
            onChange={(e) => reset(setDateT)(e.target.value)}
            title="To date"
            aria-label="To date"
            className={dateInputClass}
          />
          {filtersActive && (
            <button
              type="button"
              onClick={clearAll}
              className="text-body text-blue cursor-pointer border-none bg-transparent p-0"
            >
              Clear all
            </button>
          )}
          <div className="flex-1"></div>
          <span className="text-caption text-text-muted">
            Retention: 365 days · updated{' '}
            {logsQuery.dataUpdatedAt
              ? new Date(logsQuery.dataUpdatedAt).toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })
              : NONE}
          </span>
        </div>
        <TableShell
          columns={LOG_COLUMNS}
          scrollLabel="Compliance log entries"
          sortKeys={{ Timestamp: 'time' }}
          sort={sort}
          onSort={onSort}
          state={tableState}
        >
          {rows.map((l) => (
            <tr key={l.id}>
              <td className={`${tdClass} max-w-90`}>
                <OpsEntity
                  icon="scroll-text"
                  tint={SEV_TINT[INTERIM_SEVERITY]}
                  title={l.action}
                  sub={actorLabel(l)}
                />
              </td>
              <td className={tdClass}>{l.resourceType}</td>
              <td className={`${tdClass} tabular-nums`}>{l.ip ?? NONE}</td>
              <td className={tdClass}>{formatLogTime(l.occurredAt)}</td>
              <td className={tdClass}>
                <Badge status={INTERIM_SEVERITY} />
              </td>
            </tr>
          ))}
        </TableShell>
        <Pager
          total={total}
          page={pg}
          pageSize={OPS_LOG_PAGE}
          onPage={setPage}
          noun="log entries"
        />
      </Card>
    </div>
  );
}
