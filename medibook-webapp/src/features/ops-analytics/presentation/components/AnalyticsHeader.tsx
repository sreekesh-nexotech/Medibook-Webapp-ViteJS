import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import { SegTabs } from '@/shared/ui/SegTabs';

import { ANALYTICS_PERIODS } from '@/features/ops-analytics/application/store/analytics.fixtures';
import type {
  AnalyticsPeriod,
  AnalyticsTab,
} from '@/features/ops-analytics/application/store/analytics.types';

const TABS: readonly AnalyticsTab[] = ['Bookings', 'Providers', 'Error Rates'];

interface AnalyticsHeaderProps {
  tab: AnalyticsTab;
  onTab: (tab: AnalyticsTab) => void;
  period: AnalyticsPeriod;
  onPeriod: (period: AnalyticsPeriod) => void;
  /** Export the section on screen as a real CSV. */
  onExport: () => void;
  /** How many rows that export will contain — stated next to the button. */
  exportRows: number;
  /** Nothing loaded to export yet (loading or failed). */
  exportDisabled?: boolean;
}

/** Narrow a raw select value back to the closed `AnalyticsPeriod` set. */
function isPeriod(value: string): value is AnalyticsPeriod {
  return (ANALYTICS_PERIODS as readonly string[]).includes(value);
}

/** Narrow a raw tab value back to the closed `AnalyticsTab` set. */
function isTab(value: string): value is AnalyticsTab {
  return (TABS as readonly string[]).includes(value);
}

/**
 * Analytics toolbar: section tabs, the reporting window, and the export.
 *
 * The period select is the screen's only data input — every figure below is
 * fetched for it (audit 2.5).
 */
export function AnalyticsHeader({
  tab,
  onTab,
  period,
  onPeriod,
  onExport,
  exportRows,
  exportDisabled = false,
}: AnalyticsHeaderProps) {
  return (
    <Card pad={16} className="flex flex-wrap items-center gap-3">
      <SegTabs
        tabs={TABS}
        value={tab}
        onChange={(v) => {
          if (isTab(v)) onTab(v);
        }}
      />
      <div className="flex-1"></div>
      <FilterSelect
        value={period}
        options={ANALYTICS_PERIODS}
        aria-label="Reporting period"
        onChange={(v) => {
          if (isPeriod(v)) onPeriod(v);
        }}
      />
      <span className="text-caption text-text-muted tabular-nums">{exportRows} rows</span>
      <Button
        size="sm"
        variant="secondary"
        icon="download"
        onClick={onExport}
        disabled={exportDisabled || exportRows === 0}
      >
        Export CSV
      </Button>
    </Card>
  );
}
