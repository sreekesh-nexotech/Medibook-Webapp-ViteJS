import { useState } from 'react';

import { useLogsStore } from '@/features/ops-logs/application/store/logs.store';
import type { LogEntry, LogSeverity } from '@/features/ops-logs/application/store/logs.types';
import { useSort } from '@/shared/hooks/useSort';
import { opsTime } from '@/shared/lib/format';
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

const OPS_LOG_PAGE = 7;

/** Last ms of a day, for the inclusive "to date" filter bound. */
const END_OF_DAY_MS = 86399999;

/**
 * How long the re-derive keeps the table in its loading state. The seed store
 * answers instantly, so without this the shared loading rows would flash —
 * same fake-latency convention as `useOpsAct`.
 */
const REFRESH_SETTLE_MS = 420;

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
  const logs = useLogsStore((s) => s.logs);
  const refreshedAt = useLogsStore((s) => s.refreshedAt);
  const refreshLogs = useLogsStore((s) => s.refresh);

  const [q, setQ] = useState('');
  const [sevF, setSevF] = useState('All');
  const [modF, setModF] = useState('All');
  const [dateF, setDateF] = useState('');
  const [dateT, setDateT] = useState('');
  const [page, setPage] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const ql = q.trim().toLowerCase();
  const filtered = logs.filter(
    (l) =>
      (!ql || l.action.toLowerCase().includes(ql) || l.actor.toLowerCase().includes(ql)) &&
      (sevF === 'All' || l.sev === sevF) &&
      (modF === 'All' || l.module === modF) &&
      (!dateF || opsTime(l.time) >= Date.parse(dateF)) &&
      (!dateT || opsTime(l.time) <= Date.parse(dateT) + END_OF_DAY_MS),
  );
  const { sort, onSort, sorted } = useSort<LogEntry>();
  const orderedLogs = sorted([...filtered], {
    module: (l) => l.module,
    ip: (l) => l.ip,
    time: (l) => opsTime(l.time),
    sev: (l) => l.sev,
  });
  const pg = Math.min(page, Math.max(0, Math.ceil(filtered.length / OPS_LOG_PAGE) - 1));
  const rows = orderedLogs.slice(pg * OPS_LOG_PAGE, pg * OPS_LOG_PAGE + OPS_LOG_PAGE);

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

  /**
   * Audit 3.1.1 — a real re-derive, not a toast: the store re-runs the
   * derivation behind `logs` (picking up every entry other screens have
   * written since), the list returns to page 1, and the "updated" stamp moves.
   */
  const handleRefresh = async (): Promise<void> => {
    setRefreshing(true);
    refreshLogs();
    setPage(0);
    await new Promise<void>((resolve) => setTimeout(resolve, REFRESH_SETTLE_MS));
    setRefreshing(false);
  };

  const tableState: TableStateSpec | undefined = refreshing
    ? { kind: 'loading', rows: OPS_LOG_PAGE }
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
            {new Date(refreshedAt).toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </span>
        </div>
        <TableShell
          columns={LOG_COLUMNS}
          scrollLabel="Compliance log entries"
          sortKeys={{
            Module: 'module',
            'IP Address': 'ip',
            Timestamp: 'time',
            Severity: 'sev',
          }}
          sort={sort}
          onSort={onSort}
          state={tableState}
        >
          {rows.map((l) => (
            <tr key={l.id}>
              <td className={`${tdClass} max-w-90`}>
                <OpsEntity
                  icon="scroll-text"
                  tint={SEV_TINT[l.sev] || 'neutral'}
                  title={l.action}
                  sub={l.actor}
                />
              </td>
              <td className={tdClass}>{l.module}</td>
              <td className={`${tdClass} tabular-nums`}>{l.ip}</td>
              <td className={tdClass}>{l.time}</td>
              <td className={tdClass}>
                <Badge status={l.sev} />
              </td>
            </tr>
          ))}
        </TableShell>
        <Pager
          total={filtered.length}
          page={pg}
          pageSize={OPS_LOG_PAGE}
          onPage={setPage}
          noun="log entries"
        />
      </Card>
    </div>
  );
}
