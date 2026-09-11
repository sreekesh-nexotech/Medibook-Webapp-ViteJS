import { BarChart } from '@/shared/ui/BarChart';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { SectionTitle } from '@/shared/ui/SectionTitle';

import {
  ERROR_PCT_CRITICAL,
  ERROR_PCT_WARNING,
} from '@/features/ops-analytics/application/store/analytics.fixtures';
import type { ErrorRateRow } from '@/features/ops-analytics/application/store/analytics.types';

interface ErrorsBySurfaceCardProps {
  /** Error rows to plot — one bar each. */
  rows: readonly ErrorRateRow[];
  title: string;
  period: string;
}

/** Bar colour per row: red past critical, amber past warning, else accent. */
function barColor(errorPct: number): string {
  if (errorPct >= ERROR_PCT_CRITICAL) return 'var(--color-d-500)';
  if (errorPct >= ERROR_PCT_WARNING) return 'var(--color-y-600)';
  return 'var(--color-blue)';
}

/** Failed-request counts side by side, so the worst surface is obvious. */
export function ErrorsBySurfaceCard({ rows, title, period }: ErrorsBySurfaceCardProps) {
  return (
    <Card>
      <div className="mb-4.5 flex items-baseline justify-between gap-3">
        <SectionTitle>{title}</SectionTitle>
        <span className="text-caption text-text-muted">
          failed requests · {period.toLowerCase()}
        </span>
      </div>
      {rows.length === 0 ? (
        <EmptyState
          compact
          icon="circle-check"
          title="Nothing failed in this window."
          message="Every request in the selected period succeeded."
        />
      ) : (
        <BarChart
          data={rows.map((r) => ({
            v: r.errors,
            l: r.name.split(' · ')[0],
            color: barColor(r.errorPct),
          }))}
        />
      )}
    </Card>
  );
}
