import { cn } from '@/shared/lib/cn';
import { money } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Card } from '@/shared/ui/Card';
import { InfoDot } from '@/shared/ui/InfoDot';
import { OpsEntity } from '@/shared/ui/OpsEntity';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { TableShell, tdClass } from '@/shared/ui/TableShell';

import {
  ERROR_PCT_CRITICAL,
  ERROR_PCT_WARNING,
} from '@/features/ops-analytics/domain/entities/analytics.entities';
import type {
  Health,
  ProviderRow,
} from '@/features/ops-analytics/presentation/components/analytics.view';
import { HEALTH_STATUS } from '@/features/ops-analytics/presentation/components/health';

const COLUMNS = [
  'Provider',
  'Requests',
  'Messages',
  'Errors',
  'Error %',
  'Cost',
  'Status',
] as const;

const HEALTH_LABEL: Readonly<Record<Health, string>> = {
  healthy: 'Healthy',
  warning: 'Elevated errors',
  critical: 'Failing',
};

interface ProviderUsageCardProps {
  providers: readonly ProviderRow[];
  /** The selected reporting window — every figure in the table is for it. */
  period: string;
}

/**
 * "Provider Usage" — per metered third-party provider: requests made,
 * messages sent, failures and spend for the window (audit 2.5 / SA-05:
 * provider usage had no screen at all). Plan allowances are not tracked by
 * the backend, so a provider is flagged on its error share.
 */
export function ProviderUsageCard({ providers, period }: ProviderUsageCardProps) {
  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SectionTitle>Provider Usage</SectionTitle>
        <InfoDot
          text={`Metered calls and spend per third-party provider for ${period.toLowerCase()}, from the nightly rollup. A provider is flagged at ${ERROR_PCT_WARNING}% failed requests and critical at ${ERROR_PCT_CRITICAL}%.`}
        />
        <div className="flex-1"></div>
        <span className="text-caption text-text-muted">{period.toLowerCase()}</span>
      </div>
      <TableShell
        columns={COLUMNS}
        scrollLabel="Third-party provider usage"
        rightCols={['Requests', 'Messages', 'Errors', 'Error %', 'Cost']}
        state={
          providers.length === 0
            ? {
                kind: 'empty',
                icon: 'sliders-horizontal',
                title: 'No provider usage in this window.',
                message:
                  'SMS, email, push, payment and storage calls appear here after the nightly rollup.',
              }
            : undefined
        }
      >
        {providers.map((p) => (
          <tr key={p.id}>
            <td className={cn(tdClass, 'max-w-80')}>
              <OpsEntity
                icon={p.icon}
                tint={
                  p.health === 'critical' ? 'danger' : p.health === 'warning' ? 'warning' : 'info'
                }
                title={p.label}
                sub={p.id}
              />
            </td>
            <td className={cn(tdClass, 'text-right tabular-nums')}>
              {p.requests.toLocaleString('en-IN')}
            </td>
            <td className={cn(tdClass, 'text-right tabular-nums')}>
              {p.messages.toLocaleString('en-IN')}
            </td>
            <td className={cn(tdClass, 'text-right tabular-nums')}>
              {p.errors.toLocaleString('en-IN')}
            </td>
            <td
              className={cn(
                tdClass,
                'text-right font-medium tabular-nums',
                p.health === 'critical'
                  ? 'text-d-700'
                  : p.health === 'warning'
                    ? 'text-y-800'
                    : 'text-text-body',
              )}
            >
              {p.errorPct}%
            </td>
            <td className={cn(tdClass, 'text-right tabular-nums')}>{money(p.costRupees)}</td>
            <td className={tdClass}>
              <Badge status={HEALTH_STATUS[p.health]}>{HEALTH_LABEL[p.health]}</Badge>
            </td>
          </tr>
        ))}
      </TableShell>
    </Card>
  );
}
