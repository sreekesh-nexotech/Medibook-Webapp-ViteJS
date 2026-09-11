import { money } from '@/shared/lib/format';
import { Card } from '@/shared/ui/Card';
import { Donut } from '@/shared/ui/Donut';
import { SectionTitle } from '@/shared/ui/SectionTitle';

import {
  rupeesFromPaise,
  totalSpendPaise,
} from '@/features/ops-analytics/application/store/analytics.derive';
import type { ProviderUsage } from '@/features/ops-analytics/application/store/analytics.types';

interface ProviderSpendCardProps {
  providers: readonly ProviderUsage[];
  /** The selected reporting window, so the total is never read out of context. */
  period: string;
}

/** "Provider Spend" — donut of third-party cost for the selected period. */
export function ProviderSpendCard({ providers, period }: ProviderSpendCardProps) {
  const totalPaise = totalSpendPaise(providers);
  const total = Math.max(1, totalPaise);
  return (
    <Card>
      <div className="mb-4.5 flex items-baseline justify-between gap-3">
        <SectionTitle>Provider Spend</SectionTitle>
        <span className="text-caption text-text-muted">{period.toLowerCase()}</span>
      </div>
      <div className="flex flex-wrap items-center gap-6">
        <Donut
          data={providers.map((p) => ({ v: p.costPaise, color: p.color }))}
          center={
            <>
              <span className="text-h3 text-text-strong tabular-nums">
                {money(rupeesFromPaise(totalPaise))}
              </span>
              <span className="text-caption text-text-muted">total</span>
            </>
          }
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          {providers.map((p) => (
            <div key={p.id} className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="size-2.5 flex-none rounded-full"
                style={{ background: p.color }}
              />
              <span className="text-body text-text-body min-w-0 flex-1 truncate">{p.channel}</span>
              <span className="text-body text-text-strong flex-none font-medium tabular-nums">
                {money(rupeesFromPaise(p.costPaise))}
              </span>
              <span className="text-caption text-text-muted w-12 flex-none text-right tabular-nums">
                {Math.round((p.costPaise / total) * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
