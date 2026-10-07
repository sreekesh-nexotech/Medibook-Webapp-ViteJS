import { useMemo, useState } from 'react';

import { useSort } from '@/shared/hooks/useSort';
import { cn } from '@/shared/lib/cn';
import { downloadCsv } from '@/shared/lib/download';
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

import { isFailure } from '@/core/error/failure';

import { useComplianceConfigChangesQuery } from '@/features/ops-compliance/application/queries/useComplianceConfigChangesQuery';
import { useComplianceHospitalsQuery } from '@/features/ops-compliance/application/queries/useComplianceHospitalsQuery';
import { useExportComplianceConfigChangesMutation } from '@/features/ops-compliance/application/queries/useExportComplianceConfigChangesMutation';
import type {
  ConfigChangeFilters,
  ConfigChangeRecord,
  ConfigChangeSortField,
} from '@/features/ops-compliance/domain/entities/compliance.entities';
import { ComplianceDateInput } from '@/features/ops-compliance/presentation/components/ComplianceDateInput';
import {
  CONFIG_AREAS,
  configAreaOf,
  exportedMessage,
  fmtComplianceWhen,
  fmtConfigValue,
  principalLabel,
} from '@/features/ops-compliance/presentation/components/compliance.labels';
import { useOpsStaffQuery } from '@/features/ops-users/application/queries/useOpsStaffQuery';

const PAGE_SIZE = 8;

const COLUMNS = ['Setting', 'Actor', 'When', 'Scope', 'Before', 'After'] as const;

const ALL_SCOPES = 'Scope: All';
const PLATFORM = 'Platform';
const ALL_HOSPITALS = 'All hospitals';
const ALL_AREAS = 'Area: All';

/** Column → server sort field. */
const SORT_FIELDS: Readonly<Record<string, ConfigChangeSortField>> = {
  setting: 'setting_key',
  when: 'occurred_at',
};

const SORT_KEYS: Readonly<Record<string, string>> = { Setting: 'setting', When: 'when' };

/**
 * Configuration-change detail (audit 2.5 / SA-06) on `GET /platform/
 * compliance/config-changes` — the setting, who made it, when, the scope, and
 * its **before → after** values.
 *
 * Scope, area (setting-key prefix), date filters, sort and paging run on the
 * server. The record carries the actor's account id: platform staff are named
 * from the ops staff directory (P10); anyone else shows which kind of staff
 * made the change. The search box
 * narrows the rows on this page by setting or value.
 */
export function ConfigChangesCard() {
  const staff = useOpsStaffQuery();
  const staffNames = useMemo(
    () => new Map((staff.data?.items ?? []).map((m) => [m.userId, m.name])),
    [staff.data],
  );
  const [q, setQ] = useState('');
  const [scopeF, setScopeF] = useState(ALL_SCOPES);
  const [areaF, setAreaF] = useState(ALL_AREAS);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);
  const { sort, onSort } = useSort<never>({ key: 'when', dir: 'desc' });

  const hospitalsQuery = useComplianceHospitalsQuery();
  const hospitals = hospitalsQuery.data?.items ?? [];
  const scopeLabel = (c: ConfigChangeRecord): string =>
    c.scope === 'platform'
      ? PLATFORM
      : (hospitals.find((h) => h.id === c.hospitalId)?.name ?? 'Hospital instance');

  const filters: ConfigChangeFilters = {
    dateFrom: from,
    dateTo: to,
    scope: scopeF === PLATFORM ? 'platform' : scopeF === ALL_HOSPITALS ? 'hospital' : null,
    settingKeyPrefix: CONFIG_AREAS.find((a) => a.label === areaF)?.prefix ?? null,
  };
  const changesQuery = useComplianceConfigChangesQuery({
    ...filters,
    page: page + 1,
    pageSize: PAGE_SIZE,
    sortField: SORT_FIELDS[sort.key ?? 'when'] ?? 'occurred_at',
    sortDirection: sort.dir,
  });
  const exportMutation = useExportComplianceConfigChangesMutation();

  const ql = q.trim().toLowerCase();
  const pageRows = changesQuery.data?.items ?? [];
  const rows = ql
    ? pageRows.filter(
        (c) =>
          c.settingKey.toLowerCase().includes(ql) ||
          fmtConfigValue(c.beforeValue).toLowerCase().includes(ql) ||
          fmtConfigValue(c.afterValue).toLowerCase().includes(ql),
      )
    : pageRows;
  const total = changesQuery.data?.total ?? 0;

  const reset =
    (fn: (v: string) => void) =>
    (v: string): void => {
      fn(v);
      setPage(0);
    };
  const filtersActive = Boolean(scopeF !== ALL_SCOPES || areaF !== ALL_AREAS || from || to);
  const clearAll = (): void => {
    setQ('');
    setScopeF(ALL_SCOPES);
    setAreaF(ALL_AREAS);
    setFrom('');
    setTo('');
    setPage(0);
  };

  /** THE LAW: write the file first, then report exactly what landed. */
  const exportCsv = (): void => {
    exportMutation.mutate(filters, {
      onSuccess: ({ rows: all, truncated }) => {
        downloadCsv('medibook-configuration-changes.csv', [
          [
            'When (UTC)',
            'Actor account',
            'Actor type',
            'Area',
            'Setting',
            'Before',
            'After',
            'Scope',
          ],
          ...all.map((c) => [
            c.occurredAt,
            c.actorUserId,
            staffNames.get(c.actorUserId) ?? principalLabel(c.scope),
            configAreaOf(c.settingKey),
            c.settingKey,
            fmtConfigValue(c.beforeValue),
            fmtConfigValue(c.afterValue),
            scopeLabel(c),
          ]),
        ]);
        toast(exportedMessage(all.length, 'configuration changes', truncated), 'success');
      },
      onError: (error) =>
        toast(
          isFailure(error) ? error.message : 'The configuration changes could not be exported.',
          'error',
          error,
        ),
    });
  };

  const tableState: TableStateSpec | undefined = changesQuery.isLoading
    ? { kind: 'loading', rows: PAGE_SIZE }
    : changesQuery.isLoadingError
      ? {
          kind: 'error',
          error: changesQuery.error,
          title: "Configuration changes didn't load.",
          message: isFailure(changesQuery.error) ? changesQuery.error.message : undefined,
          onRetry: () => void changesQuery.refetch(),
        }
      : rows.length === 0
        ? {
            kind: 'empty',
            icon: 'sliders-horizontal',
            title:
              filtersActive || ql
                ? 'No changes match your filters.'
                : 'No configuration changes yet.',
            message: ql
              ? 'The search only looks at this page — clear it, or narrow the filters instead.'
              : filtersActive
                ? 'Widen the date range, or clear the filters to see the whole change log.'
                : 'Platform and hospital settings changes are recorded here with their old and new values.',
            ...(filtersActive || ql ? { actionLabel: 'Clear filters', onAction: clearAll } : {}),
          }
        : undefined;

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SectionTitle>Configuration Changes</SectionTitle>
        <InfoDot text="Every settings change with the value on both sides of it, so a change can be read back and reversed. Platform-scoped rows come from Platform Settings, feature flags, plans and roles; hospital-scoped rows from one instance's own settings. The server records each change as it is saved." />
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
          placeholder="Search this page by setting or value"
          aria-label="Search the configuration changes on this page by setting or value"
        />
      </div>
      <div className="mb-4.5 flex flex-wrap items-center gap-3">
        <FilterSelect
          value={scopeF}
          aria-label="Filter by scope"
          options={[ALL_SCOPES, PLATFORM, ALL_HOSPITALS]}
          onChange={reset(setScopeF)}
        />
        <FilterSelect
          value={areaF}
          aria-label="Filter by settings area"
          options={[ALL_AREAS, ...CONFIG_AREAS.map((a) => a.label)]}
          onChange={reset(setAreaF)}
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
          {total.toLocaleString('en-IN')} change{total === 1 ? '' : 's'}
        </span>
      </div>
      <TableShell
        columns={COLUMNS}
        scrollLabel="Configuration change log"
        sortKeys={SORT_KEYS}
        sort={sort}
        onSort={(key) => {
          onSort(key);
          setPage(0);
        }}
        state={tableState}
      >
        {rows.map((c) => (
          <tr key={c.id}>
            <td className={cn(tdClass, 'max-w-80')}>
              <OpsEntity
                icon="sliders-horizontal"
                tint={c.scope === 'platform' ? 'primary' : 'info'}
                title={c.settingKey}
                sub={configAreaOf(c.settingKey)}
              />
            </td>
            <td className={tdClass} title={c.actorUserId}>
              {staffNames.get(c.actorUserId) ??
                principalLabel(c.scope === 'platform' ? 'platform' : 'hospital')}
            </td>
            <td className={cn(tdClass, 'whitespace-nowrap tabular-nums')}>
              {fmtComplianceWhen(c.occurredAt)}
            </td>
            <td className={tdClass}>
              <Badge status={c.scope === 'platform' ? 'Medibook' : 'In Queue'}>
                {scopeLabel(c)}
              </Badge>
            </td>
            <td className={cn(tdClass, 'text-text-muted max-w-60 break-words')}>
              {fmtConfigValue(c.beforeValue)}
            </td>
            <td className={cn(tdClass, 'text-text-strong max-w-60 font-medium break-words')}>
              <span className="flex items-center gap-1.5">
                <Icon
                  name="arrow-left"
                  size={13}
                  className="text-text-faint flex-none rotate-180"
                />
                {fmtConfigValue(c.afterValue)}
              </span>
            </td>
          </tr>
        ))}
      </TableShell>
      <Pager total={total} page={page} pageSize={PAGE_SIZE} onPage={setPage} noun="changes" />
    </Card>
  );
}
