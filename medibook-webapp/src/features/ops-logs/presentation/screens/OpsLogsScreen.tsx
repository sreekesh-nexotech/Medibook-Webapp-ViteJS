import { useState } from 'react';
import { formatInstant } from '@/shared/lib/format';

import { isFailure } from '@/core/error/failure';
import { useSort } from '@/shared/hooks/useSort';
import { Card } from '@/shared/ui/Card';
import { ClearChip } from '@/shared/ui/ClearChip';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import { OpsEntity } from '@/shared/ui/OpsEntity';
import { Pager } from '@/shared/ui/Pager';
import { RefreshBtn } from '@/shared/ui/RefreshBtn';
import { SearchField } from '@/shared/ui/SearchField';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';

import { useLogsQuery } from '@/features/ops-logs/application/queries/useLogsQuery';
import { useRefreshLogs } from '@/features/ops-logs/application/queries/useRefreshLogs';
import type { AuditLogEntry } from '@/features/ops-logs/domain/entities/logs.types';
import { LogActor, type PickedActor } from '@/features/ops-logs/presentation/components/LogActor';
import {
  RESOURCE_MENU,
  isListedResource,
  resourceName,
  resourceTypeOf,
} from '@/features/ops-logs/presentation/components/logResources';
import { formatLogTime, requestOf } from '@/features/ops-logs/presentation/components/logs.format';
import { useLogsDebouncedValue } from '@/features/ops-logs/presentation/hooks/useLogsDebouncedValue';

const OPS_LOG_PAGE = 7;

/** Typing pause before the search box is sent as `?q=`. */
const SEARCH_DEBOUNCE_MS = 350;

/** Shown for a missing IP or an unknown refresh time. */
const NONE = '—';

/**
 * The trail records no severity, so there is no severity column: every row is
 * a change that succeeded (the backend records nothing for refused requests).
 */
const LOG_COLUMNS = ['Action', 'Who', 'Resource', 'IP Address', 'Timestamp'] as const;

/** Who acted (`principal` on the server), in menu order. */
const WHO_FILTERS: readonly (readonly [string, string])[] = [
  ['Medibook staff', 'platform'],
  ['Hospital staff', 'hospital'],
  ['Patients', 'patient'],
  ['Display screens', 'display'],
  ['System', 'system'],
];
const WHO_ALL = 'Who: All';
const RESOURCE_ALL = 'Resource: All';

const dateInputClass =
  'rounded-input border-border-control text-body text-text-body h-11 border bg-white px-3';

/**
 * Compliance logs — the platform audit trail (design `OpsLogs`, Ops.jsx). Every
 * filter is sent to `/platform/logs` (PRD-08): who acted, one person (picked
 * from a row), one resource type, dates and an exact-match search.
 */
export function OpsLogsScreen() {
  const [q, setQ] = useState('');
  const [whoF, setWhoF] = useState(WHO_ALL);
  const [actor, setActor] = useState<PickedActor | null>(null);
  /** One resource type, from the menu or a row. */
  const [resource, setResource] = useState<string | null>(null);
  const [dateF, setDateF] = useState('');
  const [dateT, setDateT] = useState('');
  const [page, setPage] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const { sort, onSort } = useSort<AuditLogEntry>();
  const refreshLogs = useRefreshLogs();

  const ql = q.trim();
  const debouncedQ = useLogsDebouncedValue(ql, SEARCH_DEBOUNCE_MS);
  const principal = WHO_FILTERS.find(([label]) => label === whoF)?.[1];
  const logsQuery = useLogsQuery({
    page: page + 1,
    pageSize: OPS_LOG_PAGE,
    ...(dateF ? { dateFrom: dateF } : {}),
    ...(dateT ? { dateTo: dateT } : {}),
    ...(debouncedQ ? { q: debouncedQ } : {}),
    ...(sort.key === 'time' ? { sortDir: sort.dir } : {}),
    ...(principal ? { principal } : {}),
    ...(actor ? { actorUserId: actor.id } : {}),
    ...(resource ? { resourceType: resource } : {}),
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
  const pickActor = (picked: PickedActor | null): void => {
    setActor(picked);
    setPage(0);
  };
  const pickResource = (type: string | null): void => {
    setResource(type);
    setPage(0);
  };
  const filtersActive = Boolean(ql || whoF !== WHO_ALL || actor || resource || dateF || dateT);
  const clearAll = (): void => {
    setQ('');
    setWhoF(WHO_ALL);
    setActor(null);
    setResource(null);
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

  // A request row's resource (a view name) isn't in the menu; list it while it is picked.
  const resourceOptions =
    resource && !isListedResource(resource)
      ? [RESOURCE_ALL, resourceName(resource)]
      : [RESOURCE_ALL];

  const tableState: TableStateSpec | undefined =
    logsQuery.isPending || refreshing
      ? { kind: 'loading', rows: OPS_LOG_PAGE }
      : logsQuery.isLoadingError
        ? {
            kind: 'error',
            error: logsQuery.error,
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
            placeholder="Exact action, request ID or user ID"
            aria-label="Search the audit trail by exact action code, request ID or user ID"
          />
        </div>
        <div className="mb-4.5 flex flex-wrap items-center gap-3">
          <RefreshBtn onRefresh={handleRefresh} title="Refresh audit trail" />
          <FilterSelect
            value={whoF}
            aria-label="Filter by who acted"
            options={[WHO_ALL, ...WHO_FILTERS.map(([label]) => label)]}
            onChange={reset(setWhoF)}
          />
          <FilterSelect
            value={resource ? resourceName(resource) : RESOURCE_ALL}
            aria-label="Filter by resource"
            options={resourceOptions}
            groups={RESOURCE_MENU}
            onChange={(label) => {
              if (label === RESOURCE_ALL) pickResource(null);
              else pickResource(resourceTypeOf(label) ?? resource);
            }}
          />
          {actor && <ClearChip label={`Actor: ${actor.name}`} onClick={() => pickActor(null)} />}
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
              ? formatInstant(logsQuery.dataUpdatedAt, {
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
          {rows.map((l) => {
            const request = requestOf(l.method, l.path);
            return (
              <tr key={l.id}>
                <td className={`${tdClass} max-w-90`}>
                  <OpsEntity
                    icon="scroll-text"
                    title={l.action}
                    sub={<span title={request}>{request}</span>}
                  />
                </td>
                <td className={tdClass}>
                  <LogActor entry={l} onPick={pickActor} />
                </td>
                <td className={tdClass}>
                  <button
                    type="button"
                    title="Show only this resource"
                    onClick={() => pickResource(l.resourceType)}
                    className="text-text-body hover:text-blue cursor-pointer text-left underline-offset-2 hover:underline"
                  >
                    {resourceName(l.resourceType)}
                  </button>
                </td>
                <td className={`${tdClass} tabular-nums`}>{l.ip ?? NONE}</td>
                <td className={tdClass}>{formatLogTime(l.occurredAt)}</td>
              </tr>
            );
          })}
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
