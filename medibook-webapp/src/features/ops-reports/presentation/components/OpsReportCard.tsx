import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { OPS_TINTS } from '@/shared/ui/OpsConfirm';
import { SectionTitle } from '@/shared/ui/SectionTitle';

import type { OpsReportSummary } from '@/features/ops-reports/domain/entities/opsReports.types';
import {
  OPS_REPORT_CARD_FALLBACK,
  OPS_REPORT_CARD_META,
} from '@/features/ops-reports/presentation/components/opsReportCardMeta';

interface OpsReportCardProps {
  report: OpsReportSummary;
  onOpen: (code: string) => void;
}

/**
 * One report in the catalogue: what it covers, its filters and formats, and
 * a way in to filter, preview and export it.
 */
export function OpsReportCard({ report, onOpen }: OpsReportCardProps) {
  const meta = OPS_REPORT_CARD_META[report.code] ?? OPS_REPORT_CARD_FALLBACK;
  const t = OPS_TINTS[meta.tint];
  const filterNames = report.filters.map((f) => f.label).join(', ');

  return (
    <Card className="flex flex-col gap-2.5" hover onClick={() => onOpen(report.code)}>
      <div className={cn('flex size-10 items-center justify-center rounded-md', t[0], t[1])}>
        <Icon name={meta.icon} size={20} />
      </div>
      <SectionTitle size={16}>{report.title}</SectionTitle>
      <span className="text-body text-text-muted">{meta.desc}</span>
      <span className="text-caption text-text-muted">
        {report.columns.length} columns · {report.formats.map((f) => f.toUpperCase()).join(', ')}
      </span>
      {filterNames && <span className="text-caption text-text-faint">Filters: {filterNames}</span>}
      <div className="mt-1.5">
        <Button
          size="sm"
          variant="secondary"
          iconRight="chevron-right"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(report.code);
          }}
        >
          Open report
        </Button>
      </div>
    </Card>
  );
}
