import { Card } from '@/shared/ui/Card';
import { SectionTitle } from '@/shared/ui/SectionTitle';

import type { DeptShare } from '@/features/ops-analytics/application/store/analytics.types';

interface DepartmentSplitCardProps {
  /** Department mix for the selected period, highest share first. */
  depts: readonly DeptShare[];
}

/**
 * "Department Split" — labelled progress bars per department, derived from the
 * selected period (the shares used to be a frozen array in this file). Bars
 * are scaled to the largest share, as in the design.
 */
export function DepartmentSplitCard({ depts }: DepartmentSplitCardProps) {
  const max = Math.max(...depts.map((d) => d.pct), 1);
  return (
    <Card>
      <SectionTitle className="mb-4.5">Department Split</SectionTitle>
      <div className="flex flex-col gap-3.5">
        {depts.map((d) => (
          <div key={d.dept} className="flex flex-col gap-1.25">
            <div className="flex justify-between gap-3">
              <span className="text-body text-text-body truncate">{d.dept}</span>
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
    </Card>
  );
}
