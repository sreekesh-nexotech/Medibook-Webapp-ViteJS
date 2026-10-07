import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { isFailure } from '@/core/error/failure';
import { useSort } from '@/shared/hooks/useSort';
import { downloadTextFile } from '@/shared/lib/download';
import { todayISO } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import { InfoDot } from '@/shared/ui/InfoDot';
import type { OpsTint } from '@/shared/ui/OpsConfirm';
import { OpsEntity } from '@/shared/ui/OpsEntity';
import { Pager } from '@/shared/ui/Pager';
import { RefreshBtn } from '@/shared/ui/RefreshBtn';
import { SearchField } from '@/shared/ui/SearchField';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';
import { TextInput } from '@/shared/ui/TextInput';
import { ToggleChip } from '@/shared/ui/ToggleChip';
import { toast } from '@/shared/ui/toast/toast.store';

import { OPS_LOGS_HOSPITAL_PARAM } from '@/app/router/paths';

import { useHospitalOptionsQuery } from '@/features/ops-hospitals/application/queries/useHospitalOptionsQuery';
import {
  AUDIT_PRINCIPALS,
  LOG_SEVERITIES,
  type LogSeverity,
} from '@/features/ops-logs/application/store/logs.types';
import { useExportLogsMutation } from '@/features/ops-logs/application/queries/useExportLogsMutation';
import { useLogRetentionQuery } from '@/features/ops-logs/application/queries/useLogRetentionQuery';
import { useLogsQuery } from '@/features/ops-logs/application/queries/useLogsQuery';
import { useRefreshLogs } from '@/features/ops-logs/application/queries/useRefreshLogs';
import type {
  AuditLogEntry,
  AuditLogFilters,
  AuditPrincipal,
} from '@/features/ops-logs/domain/entities/logs.types';
import { LogEntryDrawer } from '@/features/ops-logs/presentation/components/LogEntryDrawer';
import {
  actorLabel,
  formatLogTime,
  isUuid,
  LOG_MODULE_LABEL,
  LOG_SEARCH_HINT,
  logRetentionText,
  logsExportFileName,
  logsExportMessage,
  moduleLabel,
  narrowingPrincipals,
  PRINCIPAL_LABEL,
  SEVERITY_LABEL,
} from '@/features/ops-logs/presentation/components/logs.format';
import { useLogsDebouncedValue } from '@/features/ops-logs/presentation/hooks/useLogsDebouncedValue';

const OPS_LOG_PAGE = 10;

/** Typing pause before the search, actor and action boxes are sent. */
const SEARCH_DEBOUNCE_MS = 350;

/** Shown for a missing value or an unknown refresh time. */
const NONE = '—';

const SEV_TINT: Record<LogSeverity, OpsTint> = {
  critical: 'danger',
  warning: 'warning',
  info: 'info',
};

const LOG_COLUMNS = [
  'Action',
  'Module',
  'Hospital',
  'IP Address',
  'Timestamp',
  'Severity',
] as const;

const ALL_SEVERITIES = 'Severity: All';
const ALL_MODULES = 'Module: All';
const ALL_HOSPITALS = 'Hospital: All';

const MODULE_CODES = Object.keys(LOG_MODULE_LABEL);

const dateInputClass =
  'rounded-input border-border text-body text-text-body h-11 border bg-white px-3';

const refreshedAt = (at: number): string =>
  at
    ? new Date(at).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : NONE;

/** Compliance logs — the platform audit trail (design `OpsLogs`, Ops.jsx; UAT-53). */
export function OpsLogsScreen() {
  const [searchParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [severity, setSeverity] = useState<LogSeverity | ''>('');
  const [module, setModule] = useState('');
  const [principals, setPrincipals] = useState<readonly AuditPrincipal[]>([]);
  const [hospitalId, setHospitalId] = useState(searchParams.get(OPS_LOGS_HOSPITAL_PARAM) ?? '');
  const [actor, setActor] = useState('');
  const [action, setAction] = useState('');
  const [dateF, setDateF] = useState('');
  const [dateT, setDateT] = useState('');
  const [page, setPage] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [openEntry, setOpenEntry] = useState<AuditLogEntry | null>(null);
  const { sort, onSort } = useSort<AuditLogEntry>();
  const refreshLogs = useRefreshLogs();
  const exportLogs = useExportLogsMutation();
  const hospitals = useHospitalOptionsQuery();
  const retention = useLogRetentionQuery();

  const debouncedQ = useLogsDebouncedValue(q.trim(), SEARCH_DEBOUNCE_MS);
  const debouncedActor = useLogsDebouncedValue(actor.trim(), SEARCH_DEBOUNCE_MS);
  const debouncedAction = useLogsDebouncedValue(action.trim(), SEARCH_DEBOUNCE_MS);
  const actorInvalid = debouncedActor !== '' && !isUuid(debouncedActor);

  const filters: AuditLogFilters = {
    ...(dateF ? { dateFrom: dateF } : {}),
    ...(dateT ? { dateTo: dateT } : {}),
    ...(debouncedQ ? { q: debouncedQ } : {}),
    ...(debouncedActor && !actorInvalid ? { actorUserId: debouncedActor } : {}),
    ...(debouncedAction ? { action: debouncedAction } : {}),
    ...(hospitalId ? { hospitalId } : {}),
    ...(module ? { module } : {}),
    ...(severity ? { severity } : {}),
    principals: narrowingPrincipals(principals, AUDIT_PRINCIPALS),
  };
  const logsQuery = useLogsQuery({
    ...filters,
    page: page + 1,
    pageSize: OPS_LOG_PAGE,
    ...(sort.key === 'time' ? { sortDir: sort.dir } : {}),
  });
  const total = logsQuery.data?.total ?? 0;
  const rows = logsQuery.data?.items ?? [];
  const pg = Math.min(page, Math.max(0, Math.ceil(total / OPS_LOG_PAGE) - 1));
  const hospitalName = (id: string | null, fromRow: string | null): string =>
    fromRow ?? (id ? (hospitals.options.find((h) => h.id === id)?.name ?? NONE) : 'Platform');

  const reset =
    <T,>(fn: (v: T) => void) =>
    (v: T): void => {
      fn(v);
      setPage(0);
    };
  const filtersActive = Boolean(
    q.trim() ||
    severity ||
    module ||
    principals.length > 0 ||
    hospitalId ||
    actor.trim() ||
    action.trim() ||
    dateF ||
    dateT,
  );
  const clearAll = (): void => {
    setQ('');
    setSeverity('');
    setModule('');
    setPrincipals([]);
    setHospitalId('');
    setActor('');
    setAction('');
    setDateF('');
    setDateT('');
    setPage(0);
  };

  const togglePrincipal = (p: AuditPrincipal, on: boolean): void => {
    setPrincipals((current) => (on ? [...current, p] : current.filter((x) => x !== p)));
    setPage(0);
  };

  /** Re-fetch the trail from the server and return to page 1. */
  const handleRefresh = async (): Promise<void> => {
    setRefreshing(true);
    setPage(0);
    await refreshLogs();
    setRefreshing(false);
  };

  const handleExport = (): void => {
    exportLogs.mutate(filters, {
      onSuccess: ({ csv, truncated, rowLimit }) => {
        downloadTextFile(logsExportFileName(todayISO()), csv, 'text/csv;charset=utf-8');
        toast(logsExportMessage(truncated, rowLimit), truncated ? 'info' : 'success');
      },
      onError: (failure) =>
        toast(
          isFailure(failure) && failure.kind === 'notFound'
            ? 'Log export is not available on this server yet.'
            : isFailure(failure)
              ? failure.message
              : 'The export failed. Please try again.',
          'error',
        ),
    });
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
                ? 'Search matches exact codes and ids only. Widen the date range, or clear the filters to see the whole trail.'
                : 'Sensitive actions across the platform are written here as they happen.',
              ...(filtersActive ? { actionLabel: 'Clear filters', onAction: clearAll } : {}),
            }
          : undefined;

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="min-w-72 flex-1">
            <SearchField
              value={q}
              onChange={reset(setQ)}
              placeholder="Exact action code, request id or UUID"
              aria-label="Search the audit trail by exact action code, request id or UUID"
            />
          </div>
          <InfoDot text={LOG_SEARCH_HINT} />
          <Button
            variant="secondary"
            icon="download"
            busy={exportLogs.isPending}
            onClick={handleExport}
          >
            Export CSV
          </Button>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <RefreshBtn onRefresh={handleRefresh} title="Refresh audit trail" />
          <FilterSelect
            value={severity ? SEVERITY_LABEL[severity] : ALL_SEVERITIES}
            aria-label="Filter by severity"
            options={[ALL_SEVERITIES, ...LOG_SEVERITIES.map((s) => SEVERITY_LABEL[s])]}
            onChange={(v) =>
              reset(setSeverity)(LOG_SEVERITIES.find((s) => SEVERITY_LABEL[s] === v) ?? '')
            }
          />
          <FilterSelect
            value={module ? moduleLabel(module) : ALL_MODULES}
            aria-label="Filter by module"
            options={[ALL_MODULES, ...MODULE_CODES.map((m) => moduleLabel(m))]}
            onChange={(v) => reset(setModule)(MODULE_CODES.find((m) => moduleLabel(m) === v) ?? '')}
          />
          {hospitals.canView && (
            <FilterSelect
              value={hospitals.options.find((h) => h.id === hospitalId)?.name ?? ALL_HOSPITALS}
              aria-label="Filter by hospital"
              options={[ALL_HOSPITALS, ...hospitals.options.map((h) => h.name)]}
              onChange={(v) =>
                reset(setHospitalId)(hospitals.options.find((h) => h.name === v)?.id ?? '')
              }
            />
          )}
          <input
            type="date"
            value={dateF}
            max={dateT || undefined}
            onChange={(e) => reset(setDateF)(e.target.value)}
            title="From date (IST)"
            aria-label="From date"
            className={dateInputClass}
          />
          <input
            type="date"
            value={dateT}
            min={dateF || undefined}
            onChange={(e) => reset(setDateT)(e.target.value)}
            title="To date (IST)"
            aria-label="To date"
            className={dateInputClass}
          />
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-caption text-text-muted mr-1">Account type</span>
          {AUDIT_PRINCIPALS.map((p) => (
            <ToggleChip
              key={p}
              pressed={principals.includes(p)}
              onChange={(on) => togglePrincipal(p, on)}
            >
              {PRINCIPAL_LABEL[p]}
            </ToggleChip>
          ))}
        </div>
        <div className="mb-4.5 flex flex-wrap items-start gap-3">
          <div className="w-80">
            <TextInput
              value={actor}
              onChange={reset(setActor)}
              placeholder="Actor user id (UUID)"
              aria-label="Filter by actor user id"
              invalid={actorInvalid}
            />
            {actorInvalid && (
              <span className="text-caption text-d-500">Paste the full user id (a UUID).</span>
            )}
          </div>
          <div className="w-72">
            <TextInput
              value={action}
              onChange={reset(setAction)}
              placeholder="Exact action, e.g. user.blocked"
              aria-label="Filter by exact action code"
            />
          </div>
          {filtersActive && (
            <button
              type="button"
              onClick={clearAll}
              className="text-body text-blue mt-3 cursor-pointer border-none bg-transparent p-0"
            >
              Clear all
            </button>
          )}
          <div className="flex-1"></div>
          <span className="text-caption text-text-muted mt-3">
            {logRetentionText(retention.data)} · updated {refreshedAt(logsQuery.dataUpdatedAt)}
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
            <tr
              key={l.id}
              onClick={() => setOpenEntry(l)}
              className="hover:bg-grey-200 cursor-pointer transition-colors duration-150"
            >
              <td className={`${tdClass} max-w-90`}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenEntry(l);
                  }}
                  className="w-full cursor-pointer border-none bg-transparent p-0 text-left"
                  aria-label={`Open entry ${l.action}`}
                >
                  <OpsEntity
                    icon="scroll-text"
                    tint={l.severity ? SEV_TINT[l.severity] : 'neutral'}
                    title={l.action}
                    sub={actorLabel(l)}
                  />
                </button>
              </td>
              <td className={tdClass}>{l.module ? moduleLabel(l.module) : l.resourceType}</td>
              <td className={tdClass}>{hospitalName(l.hospitalId, l.hospitalName)}</td>
              <td className={`${tdClass} tabular-nums`}>{l.ip ?? NONE}</td>
              <td className={tdClass}>{formatLogTime(l.occurredAt)}</td>
              <td className={tdClass}>
                {l.severity ? <Badge status={SEVERITY_LABEL[l.severity]} /> : NONE}
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
      <LogEntryDrawer
        entry={openEntry}
        onClose={() => setOpenEntry(null)}
        onFilterActor={(id) => {
          setActor(id);
          setPage(0);
          setOpenEntry(null);
        }}
        {...(hospitals.canView
          ? {
              onFilterHospital: (id: string) => {
                setHospitalId(id);
                setPage(0);
                setOpenEntry(null);
              },
            }
          : {})}
      />
    </div>
  );
}
