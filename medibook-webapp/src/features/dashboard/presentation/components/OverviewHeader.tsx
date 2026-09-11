import { Card } from '@/shared/ui/Card';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import { RefreshBtn } from '@/shared/ui/RefreshBtn';
import { SectionTitle } from '@/shared/ui/SectionTitle';

import { isPeriod, PERIOD_OPTIONS, type Period } from './period';

interface OverviewHeaderProps {
  title: string;
  period: Period;
  setPeriod: (period: Period) => void;
  /** Re-derive the dashboard. Omit to hide the refresh button. */
  onRefresh?: () => void | Promise<void>;
}

/**
 * Card header with a title + period filter (design `Dashboard.jsx`
 * `OverviewHeader`), plus a working refresh — the period select carries an
 * accessible name because it has no visible label (audit 3.3.4).
 */
export function OverviewHeader({ title, period, setPeriod, onRefresh }: OverviewHeaderProps) {
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3" pad={16}>
      <SectionTitle size={20}>{title}</SectionTitle>
      <div className="flex items-center gap-2.5">
        <FilterSelect
          value={period}
          options={PERIOD_OPTIONS}
          onChange={(value) => {
            if (isPeriod(value)) setPeriod(value);
          }}
          aria-label="Show figures for this period"
        />
        {onRefresh && <RefreshBtn onRefresh={onRefresh} title="Refresh dashboard" />}
      </div>
    </Card>
  );
}
