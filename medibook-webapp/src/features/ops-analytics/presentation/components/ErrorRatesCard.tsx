import { useSort } from '@/shared/hooks/useSort';
import { cn } from '@/shared/lib/cn';
import { Badge } from '@/shared/ui/Badge';
import { Card } from '@/shared/ui/Card';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import { InfoDot } from '@/shared/ui/InfoDot';
import { OpsEntity } from '@/shared/ui/OpsEntity';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { TableShell, tdClass } from '@/shared/ui/TableShell';

import {
  ERROR_PCT_CRITICAL,
  ERROR_PCT_WARNING,
  P95_CRITICAL_MS,
  P95_WARNING_MS,
} from '@/features/ops-analytics/domain/entities/analytics.entities';
import type {
  ErrorRow,
  Health,
} from '@/features/ops-analytics/presentation/components/analytics.view';
import { HEALTH_STATUS } from '@/features/ops-analytics/presentation/components/health';

const COLUMNS = [
  'Provider / surface',
  'Scope',
  'Requests',
  'Errors',
  'Error %',
  'p95 latency',
  'Status',
] as const;

const SCOPE_OPTIONS = ['All scopes', 'Provider', 'API'] as const;

const HEALTH_LABEL: Readonly<Record<Health, string>> = {
  healthy: 'Healthy',
  warning: 'Elevated',
  critical: 'Critical',
};

interface ErrorRatesCardProps {
  rows: readonly ErrorRow[];
  period: string;
  scope: string;
  onScope: (scope: string) => void;
}

/**
 * "Error Rates" — request volume, failures, error share and p95 latency per
 * provider and per API surface + endpoint group for the selected period
 * (audit 2.5 / SA-05). Latency is measured for our own API only; p95 is the
 * worst daily p95 in the window.
 */
export function ErrorRatesCard({ rows, period, scope, onScope }: ErrorRatesCardProps) {
  const { sort, onSort, sorted } = useSort<ErrorRow>();
  const ordered = sorted([...rows], {
    name: (r) => r.name,
    scope: (r) => r.scope,
    requests: (r) => r.requests,
    errors: (r) => r.errors,
    errorPct: (r) => r.errorPct,
    p95: (r) => r.p95Ms ?? null,
  });
  const scoped = scope === 'All scopes' ? ordered : ordered.filter((r) => r.scope === scope);

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SectionTitle>Error Rates</SectionTitle>
        <InfoDot
          text={`Per provider integration and per API surface for ${period.toLowerCase()}. A row is flagged at ${ERROR_PCT_WARNING}% errors or ${P95_WARNING_MS}ms p95, and critical at ${ERROR_PCT_CRITICAL}% or ${P95_CRITICAL_MS}ms. p95 latency is the worst daily p95 in the window.`}
        />
        <div className="flex-1"></div>
        <FilterSelect
          value={scope}
          options={SCOPE_OPTIONS}
          aria-label="Filter by scope"
          onChange={onScope}
        />
      </div>
      <TableShell
        columns={COLUMNS}
        scrollLabel="Error rates by provider and API surface"
        rightCols={['Requests', 'Errors', 'Error %', 'p95 latency']}
        sortKeys={{
          'Provider / surface': 'name',
          Scope: 'scope',
          Requests: 'requests',
          Errors: 'errors',
          'Error %': 'errorPct',
          'p95 latency': 'p95',
        }}
        sort={sort}
        onSort={onSort}
        state={
          scoped.length === 0
            ? {
                kind: 'empty',
                icon: 'activity',
                title: 'No rows for this scope.',
                message: 'Providers and our own API surfaces are measured separately.',
                actionLabel: 'Show all scopes',
                onAction: () => onScope('All scopes'),
              }
            : undefined
        }
      >
        {scoped.map((r) => {
          return (
            <tr key={r.id}>
              <td className={cn(tdClass, 'max-w-80')}>
                <OpsEntity
                  icon={r.scope === 'API' ? 'git-branch' : 'sliders-horizontal'}
                  tint={
                    r.health === 'critical' ? 'danger' : r.health === 'warning' ? 'warning' : 'info'
                  }
                  title={r.name}
                  sub={r.sub}
                />
              </td>
              <td className={tdClass}>{r.scope}</td>
              <td className={cn(tdClass, 'text-right tabular-nums')}>
                {r.requests.toLocaleString('en-IN')}
              </td>
              <td className={cn(tdClass, 'text-right tabular-nums')}>
                {r.errors.toLocaleString('en-IN')}
              </td>
              <td
                className={cn(
                  tdClass,
                  'text-right font-medium tabular-nums',
                  r.errorPct >= ERROR_PCT_CRITICAL
                    ? 'text-d-700'
                    : r.errorPct >= ERROR_PCT_WARNING
                      ? 'text-y-800'
                      : 'text-text-body',
                )}
              >
                {r.errorPct}%
              </td>
              <td
                className={cn(
                  tdClass,
                  'text-right tabular-nums',
                  (r.p95Ms ?? 0) >= P95_CRITICAL_MS
                    ? 'text-d-700'
                    : (r.p95Ms ?? 0) >= P95_WARNING_MS
                      ? 'text-y-800'
                      : 'text-text-body',
                )}
              >
                {r.p95Ms === null ? '—' : `${r.p95Ms.toLocaleString('en-IN')} ms`}
              </td>
              <td className={tdClass}>
                <Badge status={HEALTH_STATUS[r.health]}>{HEALTH_LABEL[r.health]}</Badge>
              </td>
            </tr>
          );
        })}
      </TableShell>
    </Card>
  );
}
