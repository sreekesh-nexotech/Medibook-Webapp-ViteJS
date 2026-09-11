import { useMemo, useState } from 'react';

import { usePermission } from '@/shared/hooks/usePermission';
import { useSort } from '@/shared/hooks/useSort';
import { cn } from '@/shared/lib/cn';
import { downloadCsv } from '@/shared/lib/download';
import { fmtDate } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import { InfoDot } from '@/shared/ui/InfoDot';
import { OpsEntity } from '@/shared/ui/OpsEntity';
import type { OpsTint } from '@/shared/ui/OpsConfirm';
import { Pager } from '@/shared/ui/Pager';
import { RefreshBtn } from '@/shared/ui/RefreshBtn';
import { SearchField } from '@/shared/ui/SearchField';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';
import { toast } from '@/shared/ui/toast/toast.store';

import { AUDIT_ACTORS } from '@/features/audit/application/store/audit.fixtures';
import { useAuditStore } from '@/features/audit/application/store/audit.store';
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITIES,
  type AuditEntry,
  type AuditSeverity,
} from '@/features/audit/application/store/audit.types';

/** Rows per page — same rhythm as the ops compliance log. */
const AUDIT_PAGE_SIZE = 8;

/** How long the simulated re-fetch shimmers before the rows come back. */
const REFRESH_MS = 420;

/** Filter sentinels — one per dropdown, so "all" is never a real value. */
const ANY_ACTOR = 'Actor: All';
const ANY_ACTION = 'Action: All';
const ANY_ENTITY = 'Entity: All';

/** Severity → the shared ops tint used on the entity glyph (same as ops-logs). */
const SEV_TINT: Readonly<Record<AuditSeverity, OpsTint>> = {
  Critical: 'danger',
  Warning: 'warning',
  Info: 'info',
};

const DATE_INPUT_CLASS =
  'rounded-input border-border text-body text-text-body h-11 border bg-white px-3';

const COLUMNS = [
  'Action',
  'Actor',
  'Entity',
  'Before → After',
  'IP / Device',
  'Timestamp',
  'Severity',
] as const;

const SORT_KEYS: Readonly<Record<string, string>> = {
  Action: 'action',
  Actor: 'actor',
  Entity: 'entity',
  Timestamp: 'when',
  Severity: 'sev',
};

/** Sortable, comparable stamp for one entry: `yyyy-mm-dd HH:MM`. */
function stampOf(e: AuditEntry): string {
  return `${e.date} ${e.time}`;
}

/**
 * Hospital audit trail — audit X-05: "The hospital app has no log screen at
 * all." Deliberately the same table + toolbar treatment as the operations
 * console's compliance log (`ops-logs`), so the two trails read as one
 * product, plus the two columns a hospital admin needs and ops does not
 * carry: the entity that changed and its before -> after values.
 *
 * Every filter narrows the same row set the CSV export writes, so what you
 * see is exactly what you get in the file.
 */
export function AuditTrailScreen() {
  const entries = useAuditStore((s) => s.entries);
  const { can } = usePermission();

  const [q, setQ] = useState('');
  const [actor, setActor] = useState(ANY_ACTOR);
  const [action, setAction] = useState(ANY_ACTION);
  const [entity, setEntity] = useState(ANY_ENTITY);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);

  const { sort, onSort, sorted } = useSort<AuditEntry>({ key: 'when', dir: 'desc' });

  const ql = q.trim().toLowerCase();
  const hasFilters =
    ql !== '' ||
    actor !== ANY_ACTOR ||
    action !== ANY_ACTION ||
    entity !== ANY_ENTITY ||
    from !== '' ||
    to !== '';

  const filtered = useMemo(
    () =>
      entries.filter(
        (e) =>
          (ql === '' ||
            e.summary.toLowerCase().includes(ql) ||
            e.actor.toLowerCase().includes(ql) ||
            e.entityId.toLowerCase().includes(ql) ||
            (e.before ?? '').toLowerCase().includes(ql) ||
            (e.after ?? '').toLowerCase().includes(ql)) &&
          (actor === ANY_ACTOR || e.actor === actor) &&
          (action === ANY_ACTION || e.action === action) &&
          (entity === ANY_ENTITY || e.entity === entity) &&
          (from === '' || e.date >= from) &&
          (to === '' || e.date <= to),
      ),
    [entries, ql, actor, action, entity, from, to],
  );

  const ordered = sorted([...filtered], {
    action: (e) => e.action,
    actor: (e) => e.actor,
    entity: (e) => e.entity,
    when: (e) => stampOf(e),
    sev: (e) => e.sev,
  });

  const pageCount = Math.max(1, Math.ceil(ordered.length / AUDIT_PAGE_SIZE));
  const pg = Math.min(page, pageCount - 1);
  const rows = ordered.slice(pg * AUDIT_PAGE_SIZE, (pg + 1) * AUDIT_PAGE_SIZE);

  const onFilterChange = (apply: () => void): void => {
    apply();
    setPage(0);
  };

  const clearAll = (): void => {
    setQ('');
    setActor(ANY_ACTOR);
    setAction(ANY_ACTION);
    setEntity(ANY_ENTITY);
    setFrom('');
    setTo('');
    setPage(0);
  };

  const refresh = async (): Promise<void> => {
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, REFRESH_MS));
    setLoading(false);
  };

  const exportCsv = (): void => {
    downloadCsv('medibook-audit-trail.csv', [
      [
        'Date',
        'Time',
        'Actor',
        'Role',
        'Action',
        'Summary',
        'Entity',
        'Entity ID',
        'Before',
        'After',
        'IP',
        'Device',
        'Severity',
      ],
      ...ordered.map((e) => [
        e.date,
        e.time,
        e.actor,
        e.actorRole,
        e.action,
        e.summary,
        e.entity,
        e.entityId,
        e.before ?? '',
        e.after ?? '',
        e.ip,
        e.device,
        e.sev,
      ]),
    ]);
    toast(`Exported ${ordered.length} audit entries as CSV`, 'success');
  };

  if (!can('Hospital Settings.view')) {
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

  const tableState: TableStateSpec | undefined = loading
    ? { kind: 'loading', rows: AUDIT_PAGE_SIZE }
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
          <InfoDot text="Who changed what, when, and from where. Entries are written automatically by every screen that changes a record — nothing here can be edited." />
          <div className="flex-1" />
          <Button variant="secondary" icon="download" onClick={exportCsv}>
            Export CSV
          </Button>
        </div>

        <div className="mb-4">
          <SearchField
            value={q}
            onChange={(v) => onFilterChange(() => setQ(v))}
            placeholder="Search action, user, record id or changed value"
            aria-label="Search the audit trail"
          />
        </div>

        <div className="mb-4.5 flex flex-wrap items-center gap-3">
          <RefreshBtn onRefresh={refresh} title="Refresh the audit trail" />
          <FilterSelect
            value={actor}
            options={[ANY_ACTOR, ...AUDIT_ACTORS]}
            onChange={(v) => onFilterChange(() => setActor(v))}
            aria-label="Filter by actor"
          />
          <FilterSelect
            value={action}
            options={[ANY_ACTION, ...AUDIT_ACTIONS]}
            onChange={(v) => onFilterChange(() => setAction(v))}
            aria-label="Filter by action type"
          />
          <FilterSelect
            value={entity}
            options={[ANY_ENTITY, ...AUDIT_ENTITIES]}
            onChange={(v) => onFilterChange(() => setEntity(v))}
            aria-label="Filter by entity type"
          />
          <input
            type="date"
            value={from}
            onChange={(e) => onFilterChange(() => setFrom(e.target.value))}
            aria-label="From date"
            title="From date"
            className={DATE_INPUT_CLASS}
          />
          <input
            type="date"
            value={to}
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
          <span className="text-caption text-text-muted">Retention: 365 days</span>
        </div>

        <TableShell
          columns={COLUMNS}
          sortKeys={SORT_KEYS}
          sort={sort}
          onSort={onSort}
          state={tableState}
          scrollLabel="Audit trail"
        >
          {rows.map((e) => (
            <tr key={e.id}>
              <td className={cn(tdClass, 'max-w-85')}>
                <OpsEntity
                  icon="scroll-text"
                  tint={SEV_TINT[e.sev]}
                  title={e.summary}
                  sub={`${e.action} · ${e.entityId}`}
                />
              </td>
              <td className={tdClass}>
                <div className="flex flex-col">
                  <span className="text-text-strong font-medium">{e.actor}</span>
                  <span className="text-caption text-text-muted">{e.actorRole}</span>
                </div>
              </td>
              <td className={tdClass}>{e.entity}</td>
              <td className={cn(tdClass, 'max-w-75')}>
                {e.before == null && e.after == null ? (
                  <span className="text-text-muted">—</span>
                ) : (
                  <div className="flex flex-col">
                    <span className="text-text-muted line-through">{e.before ?? 'not set'}</span>
                    <span className="text-text-strong font-medium">{e.after ?? 'removed'}</span>
                  </div>
                )}
              </td>
              <td className={tdClass}>
                <div className="flex flex-col">
                  <span className="tabular-nums">{e.ip}</span>
                  <span className="text-caption text-text-muted">{e.device}</span>
                </div>
              </td>
              <td className={cn(tdClass, 'whitespace-nowrap tabular-nums')}>
                {fmtDate(e.date)} · {e.time}
              </td>
              <td className={tdClass}>
                <Badge status={e.sev} />
              </td>
            </tr>
          ))}
        </TableShell>

        <Pager
          total={ordered.length}
          page={pg}
          pageSize={AUDIT_PAGE_SIZE}
          onPage={setPage}
          noun="log entries"
        />
      </Card>
    </div>
  );
}
