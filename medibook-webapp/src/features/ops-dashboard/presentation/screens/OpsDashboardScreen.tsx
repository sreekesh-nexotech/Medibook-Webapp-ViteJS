import { useNavigate } from 'react-router-dom';

import { isFailure } from '@/core/error/failure';
import { useOpsPermission } from '@/shared/hooks/useOpsPermission';
import { Card } from '@/shared/ui/Card';
import { ErrorState } from '@/shared/ui/ErrorState';
import { KpiStrip } from '@/shared/ui/KpiStrip';
import { SkeletonCards, SkeletonKpiStrip, SkeletonTable } from '@/shared/ui/Skeleton';
import type { StatCardData } from '@/shared/ui/StatCard';

import { canOpenOpsView } from '@/app/router/opsAccess';
import { type OpsStaticView, opsPath } from '@/app/router/paths';

import { useOpsDashboardQuery } from '@/features/ops-dashboard/application/queries/useOpsDashboardQuery';
import type { OpsDashboardKpis } from '@/features/ops-dashboard/domain/entities/opsDashboard.entities';
import { CriticalAlertsCard } from '@/features/ops-dashboard/presentation/components/CriticalAlertsCard';
import { PlatformGlanceCard } from '@/features/ops-dashboard/presentation/components/PlatformGlanceCard';
import { RecentOnboardingsCard } from '@/features/ops-dashboard/presentation/components/RecentOnboardingsCard';
import {
  plural,
  rupeesShort,
} from '@/features/ops-dashboard/presentation/components/opsDashboardFormat';

const KPI_COUNT = 4;
const RECENT_ROWS = 5;
const RECENT_COLS = 4;

/** A dashboard KPI tile plus the ops view it navigates to (design `k.go`). */
interface OpsKpi extends StatCardData {
  readonly go: OpsStaticView;
}

function toKpis(k: OpsDashboardKpis): readonly OpsKpi[] {
  const h = k.hospitals;
  const totalHospitals = h.draft + h.onboarding + h.active + h.suspended + h.closed;
  return [
    {
      icon: 'building-2',
      label: 'Total Hospitals',
      value: totalHospitals.toLocaleString('en-IN'),
      sub: `${h.active} active · ${h.draft + h.onboarding} onboarding`,
      iconClass: 'bg-blue-soft-bg text-text-navy',
      valueClass: 'text-text-navy',
      subClass: 'text-text-muted',
      go: 'hospitals',
    },
    {
      icon: 'indian-rupee',
      label: 'Monthly Recurring Revenue',
      value: rupeesShort(k.mrrPaise),
      sub: plural(k.subscriptions.active, 'active subscription'),
      iconClass: 'bg-g-100 text-g-600',
      valueClass: 'text-g-600',
      subClass: 'text-text-muted',
      go: 'billing',
    },
    {
      icon: 'receipt',
      label: 'Outstanding Invoices',
      value: rupeesShort(k.invoicesOutstandingPaise),
      sub: `${plural(k.invoicesUnpaidCount, 'invoice')} unpaid`,
      iconClass: 'bg-d-100 text-d-500',
      valueClass: 'text-d-500',
      subClass: 'text-text-muted',
      go: 'billing',
    },
    {
      icon: 'calendar-check',
      label: 'Bookings (30 days)',
      value: k.appointmentsLast30Days.toLocaleString('en-IN'),
      sub: 'All hospitals · unpaid online checkouts excluded',
      iconClass: 'bg-badge-noshow-bg text-orange',
      valueClass: 'text-orange',
      subClass: 'text-text-muted',
      go: 'analytics',
    },
  ];
}

/**
 * Ops console dashboard (`GET /platform/dashboard`) — KPI row, "Platform at a
 * glance", "Critical Alerts" and "Recent Hospital Onboardings".
 */
export function OpsDashboardScreen() {
  const navigate = useNavigate();
  const checks = useOpsPermission();
  const dashboardQuery = useOpsDashboardQuery();

  if (dashboardQuery.isPending) {
    return (
      <div className="flex flex-col gap-5" aria-busy="true">
        <SkeletonKpiStrip count={KPI_COUNT} />
        <div className="grid grid-cols-[2fr_1fr] items-stretch gap-5">
          <SkeletonCards count={1} lines={6} />
          <SkeletonCards count={1} lines={6} />
        </div>
        <SkeletonTable rows={RECENT_ROWS} cols={RECENT_COLS} />
      </div>
    );
  }

  if (dashboardQuery.isError) {
    return (
      <Card>
        <ErrorState
          title="The dashboard didn't load"
          message={isFailure(dashboardQuery.error) ? dashboardQuery.error.message : undefined}
          onRetry={() => void dashboardQuery.refetch()}
        />
      </Card>
    );
  }

  const dashboard = dashboardQuery.data;

  return (
    <div className="flex flex-col gap-5">
      <KpiStrip
        items={toKpis(dashboard.kpis)}
        onItem={(k) => {
          // A tile only leads to a screen the role can open (UAT-35).
          if (canOpenOpsView(k.go, checks)) navigate(opsPath(k.go));
        }}
      />
      <div className="grid grid-cols-[2fr_1fr] items-stretch gap-5">
        <PlatformGlanceCard kpis={dashboard.kpis} />
        <CriticalAlertsCard alerts={dashboard.alerts} />
      </div>
      <RecentOnboardingsCard rows={dashboard.recentOnboardings} />
    </div>
  );
}
