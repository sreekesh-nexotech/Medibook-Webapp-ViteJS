import { useNavigate } from 'react-router-dom';

import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { SectionTitle } from '@/shared/ui/SectionTitle';

import { opsHospitalDetailPath, opsPath } from '@/app/router/paths';

import { hospName } from '@/features/ops-hospitals/application/store/hospitals.store';
import type { HospitalUsage } from '@/features/ops-analytics/application/store/analytics.types';

interface TopHospitalsByUsageCardProps {
  /** Leaderboard for the selected period, busiest first. */
  hospitals: readonly HospitalUsage[];
}

/**
 * "Top Hospitals by Usage" — leaderboard bars for the selected period, each
 * row opening that hospital's ops profile; "View All" opens the registry.
 *
 * Rows carry tenant ids, so the display name comes from the live registry via
 * `hospName()` and cannot drift from it.
 */
export function TopHospitalsByUsageCard({ hospitals }: TopHospitalsByUsageCardProps) {
  const navigate = useNavigate();
  const max = Math.max(...hospitals.map((h) => h.bookings), 1);
  return (
    <Card>
      <div className="mb-4.5 flex items-center justify-between gap-3">
        <SectionTitle>Top Hospitals by Usage</SectionTitle>
        <button
          type="button"
          onClick={() => navigate(opsPath('hospitals'))}
          className="text-body text-blue cursor-pointer font-medium"
        >
          View All
        </button>
      </div>
      {hospitals.length === 0 ? (
        <EmptyState
          compact
          icon="building-2"
          title="No hospital usage in this window."
          message="Onboard a hospital to start seeing usage here."
          actionLabel="Open hospital registry"
          onAction={() => navigate(opsPath('hospitals'))}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {hospitals.map((h) => (
            <div key={h.hid} className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => navigate(opsHospitalDetailPath(h.hid))}
                className="text-body text-text-strong w-57.5 flex-none cursor-pointer truncate text-left font-medium"
                title={`Open ${hospName(h.hid)}`}
              >
                {hospName(h.hid)}
              </button>
              <div className="bg-grey-300 h-2 min-w-25 flex-1 overflow-hidden rounded-full">
                <div
                  className="bg-p-500 h-full rounded-full"
                  style={{ width: `${Math.round((h.bookings / max) * 100)}%` }}
                />
              </div>
              <span className="text-caption text-text-muted w-40 flex-none text-right tabular-nums">
                {h.bookings.toLocaleString('en-IN')} bookings · {h.pct}%
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
