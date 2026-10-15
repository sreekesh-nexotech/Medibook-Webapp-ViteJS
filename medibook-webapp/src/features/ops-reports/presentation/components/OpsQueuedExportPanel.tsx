import type { ReactNode } from 'react';

import { isFailure } from '@/core/error/failure';
import { useFileDownloadMutation } from '@/shared/hooks/useFileDownloadMutation';
import { Button } from '@/shared/ui/Button';
import { IconBtn } from '@/shared/ui/IconBtn';
import { Spinner } from '@/shared/ui/Spinner';
import { toast } from '@/shared/ui/toast/toast.store';

import { useOpsExportFileQuery } from '@/features/ops-reports/application/queries/useOpsExportFileQuery';
import type { OpsReportFormat } from '@/features/ops-reports/domain/entities/opsReports.types';

/** A queued export the screen is waiting on. */
export interface QueuedExport {
  readonly exportId: string;
  readonly title: string;
  readonly format: OpsReportFormat;
  readonly rows: number;
  /** When it was queued (ms), to bound the polling. */
  readonly startedAt: number;
}

interface OpsQueuedExportPanelProps {
  queued: QueuedExport;
  onDismiss: () => void;
}

const EXPIRY_FORMAT = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

/**
 * A large export being built in the background (`202` from the export,
 * UAT-36): polls `GET /shared/files/{export_id}` until it is ready, then
 * offers the download. It also says when it failed or expired (B7), and that
 * the email arrives either way.
 */
export function OpsQueuedExportPanel({ queued, onDismiss }: OpsQueuedExportPanelProps) {
  const file = useOpsExportFileQuery(queued.exportId, queued.startedAt);
  const download = useFileDownloadMutation();
  const state = file.data;

  const handleDownload = (): void => {
    download.mutate(
      { fileId: queued.exportId, filename: `${queued.title}.${queued.format}` },
      {
        onError: (error) =>
          toast(
            isFailure(error) && error.status === 410
              ? 'This export has expired. Export it again.'
              : isFailure(error)
                ? error.message
                : 'The file could not be opened.',
            'error',
          ),
      },
    );
  };

  let body: ReactNode;
  if (file.isError) {
    body = (
      <span className="text-body text-d-700">
        Could not check the export: {isFailure(file.error) ? file.error.message : 'try again'}.
      </span>
    );
  } else if (!state || state.status === 'pending') {
    body = (
      <span className="text-body text-text-body flex items-center gap-2">
        <Spinner size={16} label="Preparing" /> Preparing {queued.rows.toLocaleString('en-IN')}{' '}
        rows… you can leave this page; it is also emailed to you when ready.
      </span>
    );
  } else if (state.status === 'ready') {
    body = (
      <span className="text-body text-text-body flex flex-wrap items-center gap-3">
        Ready
        {state.expiresAt
          ? ` · download until ${EXPIRY_FORMAT.format(new Date(state.expiresAt))}`
          : ''}
        <Button size="sm" icon="download" busy={download.isPending} onClick={handleDownload}>
          Download {queued.format.toUpperCase()}
        </Button>
      </span>
    );
  } else if (state.status === 'failed') {
    body = (
      <span className="text-body text-d-700">
        The export failed on the server. Narrow the filters and export again.
      </span>
    );
  } else {
    body = (
      <span className="text-body text-text-muted">This export has expired. Export it again.</span>
    );
  }

  return (
    <div className="border-border-soft bg-blue-soft-bg flex items-start gap-3 rounded-md border px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-body text-text-strong font-medium">
          {queued.title} · {queued.format.toUpperCase()}
        </span>
        {body}
      </div>
      <IconBtn name="x" box={32} size={14} label="Dismiss" onClick={onDismiss} />
    </div>
  );
}
