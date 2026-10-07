import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';

import { isFailure } from '@/core/error/failure';
import { DEFAULT_PAGE_SIZE } from '@/core/api/pagination';
import { usePermission } from '@/shared/hooks/usePermission';
import { useSort } from '@/shared/hooks/useSort';
import { cn } from '@/shared/lib/cn';
import { downloadTextFile } from '@/shared/lib/download';
import { fmtDate } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import { InfoDot } from '@/shared/ui/InfoDot';
import { OpsEntity } from '@/shared/ui/OpsEntity';
import { Pager } from '@/shared/ui/Pager';
import { RefreshBtn } from '@/shared/ui/RefreshBtn';
import { SearchField } from '@/shared/ui/SearchField';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';
import { toast } from '@/shared/ui/toast/toast.store';

import { useSessionQuery } from '@/features/auth/application/queries/useSessionQuery';
import { useAuditExportMutation } from '@/features/audit/application/queries/useAuditExportMutation';
import { useAuditLogQuery } from '@/features/audit/application/queries/useAuditLogQuery';
import type { AuditLogEntry, AuditLogFilters } from '@/features/audit/domain/entities/audit.log';
import { AuditDetailDrawer } from '@/features/audit/presentation/components/AuditDetailDrawer';
import {
  AUDIT_ACTION_OPTIONS,
  AUDIT_ENTITY_OPTIONS,
  actionCodeFor,
  actionLabel,
  actorLabel,
  entityCodeFor,
  entityLabel,
  localStamp,
  methodTint,
  shortId,
} from '@/features/audit/presentation/components/auditFormat';
import { useStaffMembersQuery } from '@/features/users-roles/application/queries/useStaffMembersQuery';

/** Rows per page — the backend's default page size. */
const AUDIT_PAGE_SIZE = DEFAULT_PAGE_SIZE;

/** How long the backend keeps `audit_log` rows (`audit/services/retention.py`). */
const RETENTION_LABEL = 'Retention: 3 years';

/** Changed fields listed per row before collapsing into "+N more". */
const MAX_CHANGES_SHOWN = 3;

/** The backend renders the export; it is saved as-is. */
const CSV_MIME = 'text/csv;charset=utf-8';

/** Filter sentinels — one per dropdown, so "all" is never a real value. */
const ANY_ACTOR = 'Actor: All staff';
const ONLY_ME = 'Actor: Only me';
const ANY_ACTION = 'Action: All';
const ENTITY_PREFIX = 'Entity: ';
const ANY_ENTITY = `${ENTITY_PREFIX}All`;
const ENTITY_FILTER_OPTIONS: readonly string[] = [
  ANY_ENTITY,
  ...AUDIT_ENTITY_OPTIONS.map((o) => `${ENTITY_PREFIX}${o.label}`),
];

const DATE_INPUT_CLASS =
  'rounded-input border-border text-body text-text-body h-11 border bg-white px-3';

const COLUMNS = [
  'Action',
  'Actor',
  'Entity',
  'Before → After',
  'IP / Request',
  'Timestamp',
] as const;

/** Only the timestamp sorts on the server (`sort=occurred_at`). */
const SORT_KEY_WHEN = 'when';
const SORT_KEYS: Readonly<Record<string, string>> = { Timestamp: SORT_KEY_WHEN };

/** The before -> after cell, from the row's masked `diff`. */
function ChangesCell({ entry }: { entry: AuditLogEntry }) {
  if (entry.changes.length === 0) return <span className="text-text-muted">—</span>;
  const shown = entry.changes.slice(0, MAX_CHANGES_SHOWN);
  const hidden = entry.changes.length - shown.length;
  return (
    <div className="flex flex-col gap-1">
      {shown.map((c) => (
        <div key={c.field} className="flex flex-col">
          <span className="text-caption text-text-muted">{c.field}</span>
          <span className="text-text-muted break-all line-through">{c.before ?? 'not set'}</span>
          <span className="text-text-strong font-medium break-all">{c.after ?? 'removed'}</span>
        </div>
      ))}
      {hidden > 0 && <span className="text-caption text-text-muted">+{hidden} more</span>}
    </div>
  );
}

/**
 * Hospital audit trail (`GET /hospital/audit/log`). Same table + toolbar
 * treatment as the operations console's compliance log (`ops-logs`), plus the
 * entity that changed and its before -> after values from the masked `diff`.
 *
 * Every filter is sent to the server, and the CSV export sends the same ones,
 * so the file holds exactly the rows the filters select. Search is exact-match
 * (the log has no text index), so it applies on Enter rather than per keystroke.
 */
export function AuditTrailScreen() {
  const { can } = usePermission();
  const mayView = can('Hospital Settings.view');
  const { data: session } = useSessionQuery('hospital');
  const myUserId = session?.user.id ?? null;
  // Staff directory (H12) to name actors and fill the actor picker. It needs
  // Users & Roles.view; without it rows fall back to a short id (05 F18).
  const mayReadStaff = can('Users & Roles.view');
  const staff = useStaffMembersQuery(mayView && mayReadStaff);
  const staffNames = useMemo(
    () =>
      new Map(
        (staff.data ?? []).map((m) => [
          m.userId,
          [m.firstName, m.lastName].filter(Boolean).join(' '),
        ]),
      ),
    [staff.data],
  );
  // Actor picker label → user id: every staff member, by name (UAT-66).
  const actorOptions = useMemo(() => {
    const byLabel = new Map<string, string>();
    for (const m of staff.data ?? []) {
      const name = [m.firstName, m.lastName].filter(Boolean).join(' ');
      const label = byLabel.has(`Actor: ${name}`)
        ? `Actor: ${name} (${m.email ?? shortId(m.userId)})`
        : `Actor: ${name}`;
      byLabel.set(label, m.userId);
    }
    return byLabel;
  }, [staff.data]);

  const [qDraft, setQDraft] = useState('');
  const [q, setQ] = useState('');
  const [actor, setActor] = useState(ANY_ACTOR);
  const [action, setAction] = useState(ANY_ACTION);
  const [entity, setEntity] = useState(ANY_ENTITY);
  const [opened, setOpened] = useState<AuditLogEntry | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);

  const { sort, onSort } = useSort<AuditLogEntry>({ key: SORT_KEY_WHEN, dir: 'desc' });

  const filters: AuditLogFilters = {
    dateFrom: from || undefined,
    dateTo: to || undefined,
    actorUserId: actor === ONLY_ME && myUserId ? myUserId : actorOptions.get(actor),
    action: actionCodeFor(action),
    resourceType: entityCodeFor(entity.slice(ENTITY_PREFIX.length)),
    q: q || undefined,
    sort: sort.dir === 'desc' ? '-occurred_at' : 'occurred_at',
  };

  const logQuery = useAuditLogQuery(
    { ...filters, page: page + 1, pageSize: AUDIT_PAGE_SIZE },
    mayView,
  );
  const exportMutation = useAuditExportMutation();

  const hasFilters =
    q !== '' ||
    actor !== ANY_ACTOR ||
    action !== ANY_ACTION ||
    entity !== ANY_ENTITY ||
    from !== '' ||
    to !== '';

  const onFilterChange = (apply: () => void): void => {
    apply();
    setPage(0);
  };

  const handleSearchChange = (value: string): void => {
    setQDraft(value);
    // Clearing the box clears the filter at once; a new term waits for Enter.
    if (value.trim() === '' && q !== '') onFilterChange(() => setQ(''));
  };

  const handleSearchSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    onFilterChange(() => setQ(qDraft.trim()));
  };

  const handleSort = (key: string): void => onFilterChange(() => onSort(key));

  const clearAll = (): void => {
    setQDraft('');
    setQ('');
    setActor(ANY_ACTOR);
    setAction(ANY_ACTION);
    setEntity(ANY_ENTITY);
    setFrom('');
    setTo('');
    setPage(0);
  };

  const refresh = async (): Promise<void> => {
    await logQuery.refetch();
  };

  const exportCsv = (): void => {
    exportMutation.mutate(filters, {
      onSuccess: (file) => {
        downloadTextFile(file.filename, file.csv, CSV_MIME);
        if (file.isTruncated) {
          toast(
            `Exported, but the server stopped at ${
              file.rowLimit ? file.rowLimit.toLocaleString('en-IN') : 'its row limit'
            } rows. Narrow the dates or filters to export the rest.`,
            'info',
          );
          return;
        }
        toast('Audit log exported as CSV', 'success');
      },
      onError: (failure) =>
        toast(isFailure(failure) ? failure.message : 'Could not export the audit log.', 'error'),
    });
  };

  if (!mayView) {
    return (
      <Card>
        <EmptyState
          icon="lock"
          title="You do not have access to the audit trail"
          message="The audit trail is limited to roles with the Hospital Settings view permission. Ask an administrator to grant it under Users & Roles."
        />
      </Card>
    );
  }

  const rows = logQuery.data?.items ?? [];
  const total = logQuery.data?.total ?? 0;
  const loadError = logQuery.error;

  const tableState: TableStateSpec | undefined = logQuery.isPending
    ? { kind: 'loading', rows: AUDIT_PAGE_SIZE }
    : logQuery.isError
      ? {
          kind: 'error',
          message: isFailure(loadError) ? loadError.message : undefined,
          onRetry: () => void logQuery.refetch(),
        }
      : rows.length === 0
        ? {
            kind: 'empty',
            icon: 'scroll-text',
            title: hasFilters ? 'No entries match your filters.' : 'Nothing has been logged yet.',
            message: hasFilters
              ? 'Widen the date range or clear a filter to see the rest of the trail.'
              : 'Every change staff make to appointments, payments, settings and users will appear here.',
            actionLabel: hasFilters ? 'Clear filters' : undefined,
            onAction: hasFilters ? clearAll : undefined,
          }
        : undefined;

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <SectionTitle>Activity Log</SectionTitle>
          <InfoDot text="Who changed what, when, and from where. The server writes an entry for every change staff make — nothing here can be edited." />
          <div className="flex-1" />
          <Button
            variant="secondary"
            icon="download"
            onClick={exportCsv}
            busy={exportMutation.isPending}
          >
            Export CSV
          </Button>
        </div>

        <form className="mb-4" onSubmit={handleSearchSubmit} role="search">
          <SearchField
            value={qDraft}
            onChange={handleSearchChange}
            placeholder="Exact action, resource type, request ID or record ID — press Enter"
            aria-label="Search the audit trail by exact value"
          />
        </form>

        <div className="mb-4.5 flex flex-wrap items-center gap-3">
          <RefreshBtn onRefresh={refresh} title="Refresh the audit trail" />
          <FilterSelect
            value={actor}
            options={[ANY_ACTOR, ONLY_ME, ...actorOptions.keys()]}
            onChange={(v) => onFilterChange(() => setActor(v))}
            aria-label="Filter by actor"
          />
          <FilterSelect
            value={entity}
            options={ENTITY_FILTER_OPTIONS}
            onChange={(v) => onFilterChange(() => setEntity(v))}
            aria-label="Filter by entity"
          />
          <FilterSelect
            value={action}
            options={[ANY_ACTION, ...AUDIT_ACTION_OPTIONS.map((o) => o.label)]}
            onChange={(v) => onFilterChange(() => setAction(v))}
            aria-label="Filter by action type"
          />
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => onFilterChange(() => setFrom(e.target.value))}
            aria-label="From date"
            title="From date"
            className={DATE_INPUT_CLASS}
          />
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => onFilterChange(() => setTo(e.target.value))}
            aria-label="To date"
            title="To date"
            className={DATE_INPUT_CLASS}
          />
          {hasFilters && (
            <button
              type="button"
              onClick={clearAll}
              className="text-body text-blue cursor-pointer border-none bg-transparent p-0"
            >
              Clear all
            </button>
          )}
          <div className="flex-1" />
          <span className="text-caption text-text-muted">{RETENTION_LABEL}</span>
        </div>

        <TableShell
          columns={COLUMNS}
          sortKeys={SORT_KEYS}
          sort={sort}
          onSort={handleSort}
          state={tableState}
          scrollLabel="Audit trail"
        >
          {rows.map((e) => {
            const who = actorLabel(e, myUserId, staffNames);
            const stamp = localStamp(e.occurredAt);
            return (
              <tr
                key={e.id}
                onClick={() => setOpened(e)}
                className="hover:bg-grey-200 cursor-pointer transition-colors duration-150"
              >
                <td className={cn(tdClass, 'max-w-85')}>
                  <OpsEntity
                    icon="scroll-text"
                    tint={methodTint(e.method)}
                    title={actionLabel(e.action)}
                    sub={e.resourceId ? shortId(e.resourceId) : e.action}
                  />
                </td>
                <td className={tdClass}>
                  <div className="flex flex-col">
                    <span className="text-text-strong font-medium">{who.name}</span>
                    <span className="text-caption text-text-muted">{who.sub}</span>
                  </div>
                </td>
                <td className={cn(tdClass, 'break-all')}>
                  {entityLabel(e.resourceType)}
                  {e.resourceId && (
                    <div className="text-caption text-text-muted">{shortId(e.resourceId)}</div>
                  )}
                </td>
                <td className={cn(tdClass, 'max-w-75')}>
                  <ChangesCell entry={e} />
                </td>
                <td className={cn(tdClass, 'max-w-75')}>
                  <div className="flex flex-col">
                    <span className="tabular-nums">{e.ip ?? '—'}</span>
                    <span className="text-caption text-text-muted break-all">
                      {e.method} {e.path}
                    </span>
                  </div>
                </td>
                <td className={cn(tdClass, 'whitespace-nowrap tabular-nums')}>
                  {stamp ? `${fmtDate(stamp.date)} · ${stamp.time}` : '—'}
                </td>
              </tr>
            );
          })}
        </TableShell>

        <Pager
          total={total}
          page={page}
          pageSize={AUDIT_PAGE_SIZE}
          onPage={setPage}
          noun="log entries"
        />
      </Card>
      <AuditDetailDrawer
        entry={opened}
        actor={opened ? actorLabel(opened, myUserId, staffNames) : null}
        onClose={() => setOpened(null)}
      />
    </div>
  );
}
