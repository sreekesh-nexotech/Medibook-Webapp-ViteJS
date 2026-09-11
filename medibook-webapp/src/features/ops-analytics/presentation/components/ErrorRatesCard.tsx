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
} from '@/features/ops-analytics/application/store/analytics.fixtures';
import type {
  ErrorRateRow,
  UsageHealth,
} from '@/features/ops-analytics/application/store/analytics.types';
import { HEALTH_STATUS } from '@/features/ops-analytics/presentation/components/health';

const COLUMNS = [
  'Provider / surface',
  'Scope',
  'Requests',
  'Errors',
  'Error %',
  'p95 latency',
  'Peak in window',
  'Status',
] as const;

const SCOPE_OPTIONS = ['All scopes', 'Provider', 'API'] as const;

const HEALTH_LABEL: Readonly<Record<UsageHealth, string>> = {
  healthy: 'Healthy',
  warning: 'Elevated',
  critical: 'Critical',
};

interface ErrorRatesCardProps {
  rows: readonly ErrorRateRow[];
  period: string;
  scope: string;
  onScope: (scope: string) => void;
}

/**
 * "Error Rates" — request volume, failures, error share and p95 latency per
 * provider and per API surface for the selected period, with the worst bucket
 * of the window alongside so a spike inside a calm average is still visible
 * (audit 2.5 / SA-05).
 */
export function ErrorRatesCard({ rows, period, scope, onScope }: ErrorRatesCardProps) {
  const { sort, onSort, sorted } = useSort<ErrorRateRow>();
  const ordered = sorted([...rows], {
    name: (r) => r.name,
    scope: (r) => r.scope,
    requests: (r) => r.requests,
    errors: (r) => r.errors,
    errorPct: (r) => r.errorPct,
    p95: (r) => r.p95Ms,
  });
  const scoped = scope === 'All scopes' ? ordered : ordered.filter((r) => r.scope === scope);

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SectionTitle>Error Rates</SectionTitle>
        <InfoDot
          text={`Per provider integration and per API surface for ${period.toLowerCase()}. A row is flagged at ${ERROR_PCT_WARNING}% errors or ${P95_WARNING_MS}ms p95, and critical at ${ERROR_PCT_CRITICAL}% or ${P95_CRITICAL_MS}ms. "Peak in window" is the worst single bucket, so a short outage inside a healthy average still shows.`}
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
        rightCols={['Requests', 'Errors', 'Error %', 'p95 latency', 'Peak in window']}
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
          const peak = r.trend.reduce(
            (worst, p) => (p.value > worst.value ? p : worst),
            r.trend[0] ?? { label: '—', value: 0 },
          );
          return (
            <tr key={r.id}>
              <td className={cn(tdClass, 'max-w-80')}>
                <OpsEntity
                  icon={r.scope === 'API' ? 'git-branch' : 'sliders-horizontal'}
                  tint={
                    r.health === 'critical' ? 'danger' : r.health === 'warning' ? 'warning' : 'info'
                  }
                  title={r.name}
                  sub={r.scope === 'API' ? 'Medibook API surface' : 'Third-party integration'}
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
                  r.p95Ms >= P95_CRITICAL_MS
                    ? 'text-d-700'
                    : r.p95Ms >= P95_WARNING_MS
                      ? 'text-y-800'
                      : 'text-text-body',
                )}
              >
                {r.p95Ms.toLocaleString('en-IN')} ms
              </td>
              <td className={cn(tdClass, 'text-right tabular-nums')}>
                {peak.value}% <span className="text-caption text-text-muted">({peak.label})</span>
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
