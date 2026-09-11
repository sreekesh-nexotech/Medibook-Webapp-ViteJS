import { useState } from 'react';

import { useSort } from '@/shared/hooks/useSort';
import { cn } from '@/shared/lib/cn';
import { downloadCsv } from '@/shared/lib/download';
import { fmtDate } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import { Icon } from '@/shared/ui/Icon';
import { InfoDot } from '@/shared/ui/InfoDot';
import { OpsEntity } from '@/shared/ui/OpsEntity';
import { Pager } from '@/shared/ui/Pager';
import { SearchField } from '@/shared/ui/SearchField';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';
import { toast } from '@/shared/ui/toast/toast.store';

import { hospName } from '@/features/ops-hospitals/application/store/hospitals.store';

import type { ConfigChange } from '@/features/ops-compliance/application/store/compliance.types';
import { ComplianceDateInput } from '@/features/ops-compliance/presentation/components/ComplianceDateInput';

const PAGE_SIZE = 8;

const COLUMNS = ['Setting', 'Actor', 'When', 'Scope', 'Before', 'After'] as const;

const ALL = 'All';

interface ConfigChangesCardProps {
  changes: readonly ConfigChange[];
}

/** What the change applied to: the platform, or one named hospital. */
function scopeLabel(c: ConfigChange): string {
  return c.scope === 'Hospital' && c.hid != null ? hospName(c.hid) : 'Platform';
}

/**
 * Configuration-change detail (audit 2.5 / SA-06) — actor, timestamp, the
 * setting, its **before → after** values and the scope it applied to.
 *
 * The before/after pair is the substance of the finding: a change log without
 * both values cannot answer "what was it before?", which is the only question
 * an auditor asks. Both values are their own sortable, exportable columns.
 */
export function ConfigChangesCard({ changes }: ConfigChangesCardProps) {
  const [q, setQ] = useState('');
  const [scopeF, setScopeF] = useState(ALL);
  const [areaF, setAreaF] = useState(ALL);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);

  const ql = q.trim().toLowerCase();
  const filtered = changes.filter(
    (c) =>
      (!ql ||
        c.setting.toLowerCase().includes(ql) ||
        c.actor.toLowerCase().includes(ql) ||
        c.before.toLowerCase().includes(ql) ||
        c.after.toLowerCase().includes(ql)) &&
      (scopeF === ALL || scopeLabel(c) === scopeF) &&
      (areaF === ALL || c.area === areaF) &&
      (!from || c.date >= from) &&
      (!to || c.date <= to),
  );

  const { sort, onSort, sorted } = useSort<ConfigChange>();
  const ordered = sorted([...filtered], {
    setting: (c) => c.setting,
    actor: (c) => c.actor,
    when: (c) => `${c.date} ${c.time}`,
    scope: (c) => scopeLabel(c),
  });
  const pg = Math.min(page, Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1));
  const rows = ordered.slice(pg * PAGE_SIZE, pg * PAGE_SIZE + PAGE_SIZE);

  const scopeOptions = [ALL, 'Platform', ...new Set(changes.filter((c) => c.scope === 'Hospital').map(scopeLabel))];
  const areaOptions = [ALL, ...new Set(changes.map((c) => c.area))];

  const reset =
    (fn: (v: string) => void) =>
    (v: string): void => {
      fn(v);
      setPage(0);
    };
  const filtersActive = Boolean(ql || scopeF !== ALL || areaF !== ALL || from || to);
  const clearAll = (): void => {
    setQ('');
    setScopeF(ALL);
    setAreaF(ALL);
    setFrom('');
    setTo('');
    setPage(0);
  };

  /** THE LAW: write the file first, then report exactly what landed. */
  const exportCsv = (): void => {
    downloadCsv('medibook-configuration-changes.csv', [
      ['Date', 'Time', 'Actor', 'Area', 'Setting', 'Before', 'After', 'Scope'],
      ...ordered.map((c) => [
        c.date,
        c.time,
        c.actor,
        c.area,
        c.setting,
        c.before,
        c.after,
        scopeLabel(c),
      ]),
    ]);
    toast(`Exported ${ordered.length} configuration changes as CSV.`, 'success');
  };

  const tableState: TableStateSpec | undefined =
    rows.length === 0
      ? {
          kind: 'empty',
          icon: 'sliders-horizontal',
          title: filtersActive ? 'No changes match your filters.' : 'No configuration changes yet.',
          message: filtersActive
            ? 'Widen the date range, or clear the filters to see the whole change log.'
            : 'Platform and hospital settings changes are recorded here with their old and new values.',
          ...(filtersActive ? { actionLabel: 'Clear filters', onAction: clearAll } : {}),
        }
      : undefined;

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SectionTitle>Configuration Changes</SectionTitle>
        <InfoDot text="Every settings change with the value on both sides of it, so a change can be read back and reversed. Platform-scoped rows come from Platform Settings, plans and roles; hospital-scoped rows from one instance's own settings. Changes you make in Platform Settings appear here immediately." />
        <div className="flex-1"></div>
        <Button size="sm" variant="secondary" icon="download" onClick={exportCsv}>
          Export CSV
        </Button>
      </div>
      <div className="mb-4">
        <SearchField
          value={q}
          onChange={reset(setQ)}
          placeholder="Search setting, actor or value"
          aria-label="Search configuration changes by setting, actor or value"
        />
      </div>
      <div className="mb-4.5 flex flex-wrap items-center gap-3">
        <FilterSelect
          value={scopeF === ALL ? 'Scope: All' : scopeF}
          aria-label="Filter by scope"
          options={scopeOptions.map((s) => (s === ALL ? 'Scope: All' : s))}
          onChange={(v) => reset(setScopeF)(v === 'Scope: All' ? ALL : v)}
        />
        <FilterSelect
          value={areaF === ALL ? 'Area: All' : areaF}
          aria-label="Filter by settings area"
          options={areaOptions.map((a) => (a === ALL ? 'Area: All' : a))}
          onChange={(v) => reset(setAreaF)(v === 'Area: All' ? ALL : v)}
        />
        <ComplianceDateInput value={from} onChange={reset(setFrom)} title="From date" />
        <ComplianceDateInput value={to} onChange={reset(setTo)} title="To date" />
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
        <span className="text-caption text-text-muted tabular-nums">
          {filtered.length} change{filtered.length === 1 ? '' : 's'}
        </span>
      </div>
      <TableShell
        columns={COLUMNS}
        scrollLabel="Configuration change log"
        sortKeys={{ Setting: 'setting', Actor: 'actor', When: 'when', Scope: 'scope' }}
        sort={sort}
        onSort={onSort}
        state={tableState}
      >
        {rows.map((c) => (
          <tr key={c.id}>
            <td className={cn(tdClass, 'max-w-80')}>
              <OpsEntity
                icon="sliders-horizontal"
                tint={c.scope === 'Platform' ? 'primary' : 'info'}
                title={c.setting}
                sub={c.area}
              />
            </td>
            <td className={tdClass}>{c.actor}</td>
            <td className={cn(tdClass, 'whitespace-nowrap tabular-nums')}>
              {fmtDate(c.date)} · {c.time}
            </td>
            <td className={tdClass}>
              <Badge status={c.scope === 'Platform' ? 'Medibook' : 'In Queue'}>
                {scopeLabel(c)}
              </Badge>
            </td>
            <td className={cn(tdClass, 'text-text-muted')}>{c.before}</td>
            <td className={cn(tdClass, 'text-text-strong font-medium')}>
              <span className="flex items-center gap-1.5">
                <Icon name="arrow-left" size={13} className="text-text-faint rotate-180" />
                {c.after}
              </span>
            </td>
          </tr>
        ))}
      </TableShell>
      <Pager
        total={filtered.length}
        page={pg}
        pageSize={PAGE_SIZE}
        onPage={setPage}
        noun="changes"
      />
    </Card>
  );
}
