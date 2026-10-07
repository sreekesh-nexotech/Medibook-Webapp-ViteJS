import { isFailure } from '@/core/error/failure';
import { useFileDownloadMutation } from '@/shared/hooks/useFileDownloadMutation';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { IconBtn } from '@/shared/ui/IconBtn';
import { Spinner } from '@/shared/ui/Spinner';

import type { ReportExportFormat } from '@/features/reports/domain/entities/reports.entities';
import { useReportExportFileQuery } from '@/features/reports/application/queries/useReportExportFileQuery';

/** `GET /shared/files/{id}` answers 410 once an export expired (B7). */
const HTTP_GONE = 410;
const HTTP_NOT_FOUND = 404;

const FORMAT_LABEL: Readonly<Record<ReportExportFormat, string>> = {
  csv: 'CSV',
  xlsx: 'Excel',
  pdf: 'PDF',
};

interface ReportQueuedExportProps {
  exportId: string;
  format: ReportExportFormat;
  rows: number | null;
  onDismiss: () => void;
}

/**
 * One export the server is building in the background (UAT-67, 08 F13). The
 * screen keeps its `export_id` and checks `GET /shared/files/{id}` until the
 * file is ready, then downloads it with a freshly signed link; a failed or
 * expired build says so instead of "ready". The emailed link still works.
 */
export function ReportQueuedExport({ exportId, format, rows, onDismiss }: ReportQueuedExportProps) {
  const file = useReportExportFileQuery(exportId, { waitForBuild: true });
  const download = useFileDownloadMutation();
  const label = `${FORMAT_LABEL[format]} export${rows ? ` of ${rows.toLocaleString('en-IN')} rows` : ''}`;

  const errorStatus = isFailure(file.error) ? file.error.status : null;
  const status =
    file.data?.status ??
    (errorStatus === HTTP_GONE ? 'expired' : errorStatus === HTTP_NOT_FOUND ? 'pending' : null);

  let message: string;
  if (status === 'ready') message = 'Ready to download.';
  else if (status === 'failed') message = 'The export failed. Export it again.';
  else if (status === 'expired') message = 'This export has expired. Export it again.';
  else if (status === 'pending') message = 'Being prepared — this updates on its own.';
  else if (file.isError) message = isFailure(file.error) ? file.error.message : 'Status unknown.';
  else message = 'Checking…';

  return (
    <div
      className={cn(
        'border-border-soft flex flex-wrap items-center gap-3 rounded-md border px-3.5 py-2.5',
        (status === 'failed' || status === 'expired') && 'bg-d-100',
      )}
      role="status"
    >
      {status === 'pending' || (file.isPending && !file.isError) ? (
        <Spinner size={16} label="Preparing the export" />
      ) : (
        <Icon
          name={status === 'ready' ? 'file-down' : 'triangle-alert'}
          size={16}
          className={status === 'ready' ? 'text-g-600' : 'text-d-700'}
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="text-body text-text-strong font-medium">{label}</div>
        <div className="text-caption text-text-muted">{message}</div>
        {download.isError && (
          <div className="text-caption text-d-700">
            {isFailure(download.error) ? download.error.message : 'The download failed.'}
          </div>
        )}
      </div>
      {status === 'ready' && file.data && (
        <Button
          size="sm"
          icon="download"
          busy={download.isPending}
          onClick={() => download.mutate({ fileId: exportId, filename: file.data?.name })}
        >
          Download
        </Button>
      )}
      <IconBtn name="x" label="Dismiss" box={32} size={14} onClick={onDismiss} />
    </div>
  );
}
