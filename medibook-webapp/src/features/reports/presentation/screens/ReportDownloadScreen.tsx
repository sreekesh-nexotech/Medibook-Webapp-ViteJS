import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { isFailure } from '@/core/error/failure';
import { useFileDownloadMutation } from '@/shared/hooks/useFileDownloadMutation';
import { cn } from '@/shared/lib/cn';
import { fmtDate, toLocalISO } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Icon } from '@/shared/ui/Icon';
import { Spinner } from '@/shared/ui/Spinner';

import { useReportExportFileQuery } from '@/features/reports/application/queries/useReportExportFileQuery';
import { fileSizeCopy } from '@/features/reports/presentation/components/reportsFormat';

/** The files API answers 404 for a file that is gone, expired or not this account's. */
const NOT_FOUND_STATUS = 404;

const DOWNLOAD_FAILED = 'The download could not be started. Please try again.';

/** ISO timestamp → "13 Oct 2026" in the viewer's time zone. */
function dayCopy(iso: string): string {
  return fmtDate(toLocalISO(new Date(iso)));
}

interface ReportDownloadScreenProps {
  /** The signed-in session's dashboard. */
  homePath: string;
}

/**
 * Landing page for an emailed report link (`…/reports/downloads/:fileId`). A
 * large export or a scheduled report is built in the background and emailed;
 * the email links here rather than to the file, because signed file links
 * live only 10 minutes. After the guard has checked the session, this reads
 * the file (`GET /shared/files/{id}`), starts the download with a freshly
 * signed link, and offers to download it again.
 */
export function ReportDownloadScreen({ homePath }: ReportDownloadScreenProps) {
  const { fileId = '' } = useParams();
  const navigate = useNavigate();
  const file = useReportExportFileQuery(fileId);
  const download = useFileDownloadMutation();
  const { mutate: startDownload } = download;
  const startedFor = useRef<string | null>(null);

  // Download once per file as soon as it is confirmed (StrictMode runs effects twice).
  useEffect(() => {
    if (!file.data || startedFor.current === file.data.id) return;
    startedFor.current = file.data.id;
    startDownload({ fileId: file.data.id, filename: file.data.name });
  }, [file.data, startDownload]);

  const home = (
    <Button variant="secondary" icon="house" onClick={() => navigate(homePath, { replace: true })}>
      Back to Dashboard
    </Button>
  );

  let content;
  if (file.isPending) {
    content = <Spinner size={32} label="Finding your report" />;
  } else if (file.isLoadingError) {
    const gone = isFailure(file.error) && file.error.status === NOT_FOUND_STATUS;
    content = gone ? (
      <ErrorState
        icon="file-text"
        title="This download link is no longer valid"
        message="The report may have expired or been removed, or it was prepared for a different account. Export it again from Reports."
      >
        {home}
      </ErrorState>
    ) : (
      <ErrorState
        error={file.error}
        title="Your report didn’t load"
        message={isFailure(file.error) ? file.error.message : undefined}
        onRetry={() => void file.refetch()}
      >
        {home}
      </ErrorState>
    );
  } else {
    const f = file.data;
    content = (
      <Card pad={32} className="w-115 max-w-full text-center">
        <div className="bg-g-100 text-g-800 mx-auto mb-4 flex size-14 items-center justify-center rounded-lg">
          <Icon name="file-down" size={26} />
        </div>
        <div className="text-h2 text-text-strong mb-2">Your report is ready</div>
        <div className="text-body text-text-strong font-medium break-all">{f.name}</div>
        <div className="text-caption text-text-muted mb-4">
          {fileSizeCopy(f.sizeBytes)} · prepared {dayCopy(f.createdAt)}
          {f.expiresAt ? ` · available until ${dayCopy(f.expiresAt)}` : ''}
        </div>
        <p
          role={download.isError ? 'alert' : 'status'}
          className={cn('text-body mb-5.5', download.isError ? 'text-danger' : 'text-text-muted')}
        >
          {download.isPending
            ? 'Starting your download…'
            : download.isError
              ? isFailure(download.error)
                ? download.error.message
                : DOWNLOAD_FAILED
              : 'Your download has started. If nothing arrived, download it again.'}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button
            icon="download"
            busy={download.isPending}
            onClick={() => startDownload({ fileId: f.id, filename: f.name })}
          >
            Download Again
          </Button>
          {home}
        </div>
      </Card>
    );
  }

  return (
    <div className="bg-bg-app flex h-full items-center justify-center overflow-y-auto p-5">
      {content}
    </div>
  );
}
