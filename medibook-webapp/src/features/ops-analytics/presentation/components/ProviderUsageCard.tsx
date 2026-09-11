import { cn } from '@/shared/lib/cn';
import { money } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Card } from '@/shared/ui/Card';
import { InfoDot } from '@/shared/ui/InfoDot';
import { OpsEntity } from '@/shared/ui/OpsEntity';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { TableShell, tdClass } from '@/shared/ui/TableShell';

import { rupeesFromPaise } from '@/features/ops-analytics/application/store/analytics.derive';
import {
  USAGE_CRITICAL_PCT,
  USAGE_WARNING_PCT,
} from '@/features/ops-analytics/application/store/analytics.fixtures';
import type {
  ProviderUsage,
  UsageHealth,
} from '@/features/ops-analytics/application/store/analytics.types';
import { HEALTH_BAR, HEALTH_STATUS } from '@/features/ops-analytics/presentation/components/health';

const COLUMNS = [
  'Provider',
  'Used',
  'Plan allowance',
  'Credits left',
  'Usage vs plan',
  'Cost',
  'Status',
] as const;

/** Widest a meter fill is drawn, so an over-plan bar still reads as full. */
const METER_CAP_PCT = 100;

const HEALTH_LABEL: Readonly<Record<UsageHealth, string>> = {
  healthy: 'Healthy',
  warning: 'Near limit',
  critical: 'Over plan',
};

interface ProviderUsageCardProps {
  providers: readonly ProviderUsage[];
  /** The selected reporting window — every figure in the table is for it. */
  period: string;
}

/**
 * "Provider Usage" — per third-party provider: units consumed, the plan
 * allowance for this window, credits left, consumption against the allowance,
 * and spend (audit 2.5 / SA-05: provider usage had no screen at all).
 */
export function ProviderUsageCard({ providers, period }: ProviderUsageCardProps) {
  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SectionTitle>Provider Usage</SectionTitle>
        <InfoDot
          text={`Consumption and spend per third-party provider for ${period.toLowerCase()}. The plan allowance is pro-rated from the monthly entitlement, and a provider is flagged at ${USAGE_WARNING_PCT}% of it and again once it is fully spent (${USAGE_CRITICAL_PCT}%), where every further unit is billed as overage.`}
        />
        <div className="flex-1"></div>
        <span className="text-caption text-text-muted">{period.toLowerCase()}</span>
      </div>
      <TableShell
        columns={COLUMNS}
        scrollLabel="Third-party provider usage"
        rightCols={['Used', 'Plan allowance', 'Credits left', 'Cost']}
        state={
          providers.length === 0
            ? {
                kind: 'empty',
                icon: 'sliders-horizontal',
                title: 'No providers connected.',
                message: 'Connect an SMS, email, push or payment provider to see usage here.',
              }
            : undefined
        }
      >
        {providers.map((p) => (
          <tr key={p.id}>
            <td className={cn(tdClass, 'max-w-80')}>
              <OpsEntity
                icon={p.icon}
                tint={p.health === 'critical' ? 'danger' : p.health === 'warning' ? 'warning' : 'info'}
                title={p.name}
                sub={`${p.channel} · billed per ${p.unit.replace(/s$/, '')}`}
              />
            </td>
            <td className={cn(tdClass, 'text-right tabular-nums')}>
              {p.used.toLocaleString('en-IN')}
              <span className="text-caption text-text-muted"> {p.unit}</span>
            </td>
            <td className={cn(tdClass, 'text-right tabular-nums')}>
              {p.allowance.toLocaleString('en-IN')}
            </td>
            <td className={cn(tdClass, 'text-right tabular-nums')}>
              {p.overage > 0 ? (
                <span className="text-d-700">
                  0 · {p.overage.toLocaleString('en-IN')} over
                </span>
              ) : (
                p.creditsLeft.toLocaleString('en-IN')
              )}
            </td>
            <td className={cn(tdClass, 'min-w-45')}>
              <div className="flex flex-col gap-1.25">
                <span className="text-caption text-text-body tabular-nums">{p.usagePct}%</span>
                <div className="bg-grey-300 h-1.5 overflow-hidden rounded-full">
                  <div
                    className={cn('h-full rounded-full', HEALTH_BAR[p.health])}
                    style={{ width: `${Math.min(METER_CAP_PCT, p.usagePct)}%` }}
                  />
                </div>
              </div>
            </td>
            <td className={cn(tdClass, 'text-right tabular-nums')}>
              {money(rupeesFromPaise(p.costPaise))}
            </td>
            <td className={tdClass}>
              <Badge status={HEALTH_STATUS[p.health]}>{HEALTH_LABEL[p.health]}</Badge>
            </td>
          </tr>
        ))}
      </TableShell>
    </Card>
  );
}
