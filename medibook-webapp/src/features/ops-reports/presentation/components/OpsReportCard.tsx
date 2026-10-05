import { isFailure } from '@/core/error/failure';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { OPS_TINTS } from '@/shared/ui/OpsConfirm';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { toast } from '@/shared/ui/toast/toast.store';

import { useExportOpsReportMutation } from '@/features/ops-reports/application/queries/useExportOpsReportMutation';
import type { OpsReportSummary } from '@/features/ops-reports/domain/entities/opsReports.types';
import {
  OPS_REPORT_CARD_FALLBACK,
  OPS_REPORT_CARD_META,
} from '@/features/ops-reports/presentation/components/opsReportCardMeta';

const EXPORT_FAILED_MESSAGE = 'The export failed. Please try again.';

interface OpsReportCardProps {
  report: OpsReportSummary;
}

/**
 * One exportable report. Each card owns its export mutation, so two reports
 * can export at once and each button shows its own busy state. Success is
 * claimed only once the server has returned the file and the browser has
 * been handed it; a large export is queued server-side and emailed.
 */
export function OpsReportCard({ report }: OpsReportCardProps) {
  const exportReport = useExportOpsReportMutation();
  const meta = OPS_REPORT_CARD_META[report.code] ?? OPS_REPORT_CARD_FALLBACK;
  const t = OPS_TINTS[meta.tint];
  const isBusy = exportReport.isPending;

  const handleExport = (): void => {
    if (isBusy) return;
    exportReport.mutate(report.code, {
      onSuccess: (result) => {
        if (result.status === 'file') {
          toast(`Exported ${report.title}.`, 'success');
        } else {
          toast(
            `${report.title} has ${result.rows.toLocaleString('en-IN')} rows — it is being prepared and will be emailed to you.`,
            'info',
          );
        }
      },
      onError: (error) => toast(isFailure(error) ? error.message : EXPORT_FAILED_MESSAGE, 'error'),
    });
  };

  return (
    <Card className="flex flex-col gap-2.5">
      <div className={cn('flex size-10 items-center justify-center rounded-md', t[0], t[1])}>
        <Icon name={meta.icon} size={20} />
      </div>
      <SectionTitle size={16}>{report.title}</SectionTitle>
      <span className="text-body text-text-muted">{meta.desc}</span>
      <span className="text-caption text-text-muted">{report.columns.length} columns · CSV</span>
      <div className="mt-1.5">
        <Button size="sm" variant="secondary" icon="download" busy={isBusy} onClick={handleExport}>
          {isBusy ? 'Exporting…' : 'Download CSV'}
        </Button>
      </div>
    </Card>
  );
}
