import { BarChart, type BarChartDatum } from '@/shared/ui/BarChart';
import { Card } from '@/shared/ui/Card';
import { SectionTitle } from '@/shared/ui/SectionTitle';

import type { OpsDashboardKpis } from '@/features/ops-dashboard/domain/entities/opsDashboard.entities';

const CHART_HEIGHT = 180;

/** Bar colors from the `@theme` tokens, one per status. */
const COLOR_ACTIVE = 'var(--color-g-800)';
const COLOR_PENDING = 'var(--color-y-800)';
const COLOR_PROBLEM = 'var(--color-d-600)';
const COLOR_NEUTRAL = 'var(--color-text-muted)';
const COLOR_INFO = 'var(--color-blue)';
const COLOR_WARNING = 'var(--color-orange-strong)';

interface PlatformGlanceCardProps {
  kpis: OpsDashboardKpis;
}

/**
 * "Platform at a glance" — the hospital registry and the subscription book by
 * status, straight from `/platform/dashboard`. (Replaces the prototype's
 * seven-day bookings chart: the dashboard has no booking time series; the
 * trend belongs to Usage Analytics.)
 */
export function PlatformGlanceCard({ kpis }: PlatformGlanceCardProps) {
  const { hospitals: h, subscriptions: s } = kpis;

  const hospitalBars: readonly BarChartDatum[] = [
    { l: 'Draft', v: h.draft, color: COLOR_NEUTRAL },
    { l: 'Onboarding', v: h.onboarding, color: COLOR_PENDING },
    { l: 'Active', v: h.active, color: COLOR_ACTIVE },
    { l: 'Suspended', v: h.suspended, color: COLOR_PROBLEM },
    { l: 'Closed', v: h.closed, color: COLOR_NEUTRAL },
  ];

  const subscriptionBars: readonly BarChartDatum[] = [
    { l: 'Trial', v: s.trialing, color: COLOR_INFO },
    { l: 'Active', v: s.active, color: COLOR_ACTIVE },
    { l: 'Past due', v: s.pastDue, color: COLOR_WARNING },
    { l: 'Grace', v: s.grace, color: COLOR_PENDING },
    { l: 'Read-only', v: s.readOnly, color: COLOR_PROBLEM },
    { l: 'Cancelled', v: s.cancelled, color: COLOR_NEUTRAL },
  ];

  return (
    <Card>
      <SectionTitle className="mb-4.5">Platform at a Glance</SectionTitle>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <div className="text-caption text-text-muted mb-2 font-semibold uppercase">
            Hospitals by status
          </div>
          <BarChart data={hospitalBars} height={CHART_HEIGHT} />
        </div>
        <div>
          <div className="text-caption text-text-muted mb-2 font-semibold uppercase">
            Subscriptions by status
          </div>
          <BarChart data={subscriptionBars} height={CHART_HEIGHT} />
        </div>
      </div>
    </Card>
  );
}
