import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { SectionTitle } from '@/shared/ui/SectionTitle';

import type { DeptRow } from '@/features/ops-analytics/presentation/components/analytics.view';

interface DepartmentSplitCardProps {
  /** Department mix for the selected period, highest share first. */
  depts: readonly DeptRow[];
}

/**
 * "Department Split" — labelled progress bars per department code across every
 * hospital for the selected period. Department codes are per hospital, so the
 * label is the code made readable. Bars are scaled to the largest share.
 */
export function DepartmentSplitCard({ depts }: DepartmentSplitCardProps) {
  const max = Math.max(...depts.map((d) => d.pct), 1);
  return (
    <Card>
      <SectionTitle className="mb-4.5">Department Split</SectionTitle>
      {depts.length === 0 ? (
        <EmptyState
          compact
          icon="layout-grid"
          title="No department bookings in this window."
          message="Pick a longer reporting period."
        />
      ) : (
        <div className="flex flex-col gap-3.5">
          {depts.map((d) => (
            <div key={d.code} className="flex flex-col gap-1.25">
              <div className="flex justify-between gap-3">
                <span className="text-body text-text-body truncate">{d.label}</span>
                <span className="text-body text-text-strong flex-none font-medium tabular-nums">
                  {d.pct}%
                </span>
              </div>
              <div className="bg-grey-300 h-1.5 overflow-hidden rounded-full">
                <div
                  className="bg-blue h-full rounded-full"
                  style={{ width: `${(d.pct / max) * 100}%` }}
                />
              </div>
              <span className="text-caption text-text-muted tabular-nums">
                {d.bookings.toLocaleString('en-IN')} bookings
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
