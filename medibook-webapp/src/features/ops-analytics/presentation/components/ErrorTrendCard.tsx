import { Card } from '@/shared/ui/Card';
import { InfoDot } from '@/shared/ui/InfoDot';
import { LineChart } from '@/shared/ui/LineChart';
import { SectionTitle } from '@/shared/ui/SectionTitle';

import {
  ERROR_PCT_CRITICAL,
  ERROR_PCT_WARNING,
} from '@/features/ops-analytics/application/store/analytics.fixtures';
import type { SeriesPoint } from '@/features/ops-analytics/application/store/analytics.types';

interface ErrorTrendCardProps {
  /** Aggregate error percentage per bucket of the selected period. */
  trend: readonly SeriesPoint[];
  period: string;
  /** Worst bucket in the window, so the peak is stated and not just drawn. */
  peakPct: number;
}

/**
 * "Error Rate Trend" — request failures across every provider and API surface
 * over the selected period, weighted by request volume (audit 2.5 / SA-05:
 * error rates had no screen).
 *
 * The line is red once the window's peak crosses the critical threshold, amber
 * past the warning threshold, and the accent blue while everything is healthy.
 */
export function ErrorTrendCard({ trend, period, peakPct }: ErrorTrendCardProps) {
  const color =
    peakPct >= ERROR_PCT_CRITICAL
      ? 'var(--color-d-500)'
      : peakPct >= ERROR_PCT_WARNING
        ? 'var(--color-y-600)'
        : 'var(--color-blue)';
  return (
    <Card>
      <div className="mb-4.5 flex flex-wrap items-center gap-2">
        <SectionTitle>Error Rate Trend</SectionTitle>
        <InfoDot
          text={`Failed requests as a share of all requests, weighted by volume, per bucket of ${period.toLowerCase()}. Anything at or above ${ERROR_PCT_WARNING}% is flagged, and ${ERROR_PCT_CRITICAL}% or more is critical.`}
        />
        <div className="flex-1"></div>
        <span className="text-caption text-text-muted tabular-nums">
          peak {peakPct}% · {period.toLowerCase()}
        </span>
      </div>
      <LineChart data={trend.map((p) => ({ v: p.value, l: p.label }))} color={color} />
    </Card>
  );
}
