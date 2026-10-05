import { money } from '@/shared/lib/format';
import { Card } from '@/shared/ui/Card';
import { Donut } from '@/shared/ui/Donut';
import { EmptyState } from '@/shared/ui/EmptyState';
import { SectionTitle } from '@/shared/ui/SectionTitle';

import type { ProviderRow } from '@/features/ops-analytics/presentation/components/analytics.view';

interface ProviderSpendCardProps {
  providers: readonly ProviderRow[];
  /** The selected reporting window, so the total is never read out of context. */
  period: string;
}

/** "Provider Spend" — donut of third-party cost for the selected period. */
export function ProviderSpendCard({ providers, period }: ProviderSpendCardProps) {
  const spent = providers.filter((p) => p.costRupees > 0);
  const totalRupees = spent.reduce((sum, p) => sum + p.costRupees, 0);
  return (
    <Card>
      <div className="mb-4.5 flex items-baseline justify-between gap-3">
        <SectionTitle>Provider Spend</SectionTitle>
        <span className="text-caption text-text-muted">{period.toLowerCase()}</span>
      </div>
      {spent.length === 0 ? (
        <EmptyState
          compact
          icon="indian-rupee"
          title="No provider spend in this window."
          message="Spend appears once a metered provider reports a cost."
        />
      ) : (
        <div className="flex flex-wrap items-center gap-6">
          <Donut
            data={spent.map((p) => ({ v: p.costRupees, color: p.color }))}
            center={
              <>
                <span className="text-h3 text-text-strong tabular-nums">{money(totalRupees)}</span>
                <span className="text-caption text-text-muted">total</span>
              </>
            }
          />
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            {spent.map((p) => (
              <div key={p.id} className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="size-2.5 flex-none rounded-full"
                  style={{ background: p.color }}
                />
                <span className="text-body text-text-body min-w-0 flex-1 truncate">{p.label}</span>
                <span className="text-body text-text-strong flex-none font-medium tabular-nums">
                  {money(p.costRupees)}
                </span>
                <span className="text-caption text-text-muted w-12 flex-none text-right tabular-nums">
                  {Math.round((p.costRupees / totalRupees) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
