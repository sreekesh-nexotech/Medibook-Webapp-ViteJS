import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { SectionTitle } from '@/shared/ui/SectionTitle';

import type { SeriesPoint } from '@/features/ops-analytics/application/store/analytics.types';

/** Headroom above the tallest bar, so the peak never touches the card edge. */
const BAR_HEADROOM = 1.12;

interface BookingsTrendCardProps {
  /** One point per bucket of the selected period. */
  series: readonly SeriesPoint[];
  /** What the buckets are — "Per day", "Per week", "Per month". */
  bucketLabel: string;
  /** The selected reporting window, shown as the card's caption. */
  period: string;
}

/**
 * Bookings over the selected period — the prototype's inline bar chart, now
 * driven by the derived series instead of a hardcoded 12-month array. Each
 * column reveals its value on hover (the design's `hover === i` swap, as CSS
 * group-hover).
 */
export function BookingsTrendCard({ series, bucketLabel, period }: BookingsTrendCardProps) {
  const max = Math.max(...series.map((d) => d.value), 1) * BAR_HEADROOM;
  return (
    <Card>
      <div className="mb-4.5 flex items-baseline justify-between gap-3">
        <SectionTitle>Bookings Trend</SectionTitle>
        <span className="text-caption text-text-muted">
          {bucketLabel} · {period.toLowerCase()}
        </span>
      </div>
      {series.length === 0 ? (
        <EmptyState
          compact
          icon="calendar-check"
          title="No bookings in this window."
          message="Pick a longer reporting period to see the trend."
        />
      ) : (
        <div className="flex h-52.5 items-end gap-2.5 px-1">
          {series.map((d, i) => (
            <div
              key={`${d.label}-${i}`}
              className="group relative flex h-full flex-1 cursor-default flex-col items-center justify-end gap-2"
            >
              <span
                className="text-caption bg-text-strong pointer-events-none absolute z-[5] hidden rounded-sm px-2.5 py-1 whitespace-nowrap text-white group-hover:block"
                style={{ bottom: `calc(${(d.value / max) * 100}% + 26px)` }}
              >
                {d.value.toLocaleString('en-IN')} bookings
              </span>
              <div
                className="bg-p-500 group-hover:bg-p-600 min-h-1 w-full max-w-7.5 rounded-t-sm transition-all duration-150"
                style={{ height: `${(d.value / max) * 100}%` }}
              />
              <span className="text-caption text-text-muted">{d.label}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
