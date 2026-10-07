import type { ReactNode } from 'react';

import { isFailure } from '@/core/error/failure';
import { useFileDownloadMutation } from '@/shared/hooks/useFileDownloadMutation';
import { downloadFromUrl } from '@/shared/lib/download';
import { Button } from '@/shared/ui/Button';
import { toast } from '@/shared/ui/toast/toast.store';

import { useStatementPdfMutation } from '@/features/settlements/application/queries/useStatementPdfMutation';
import {
  downloadBlob,
  statementFilename,
} from '@/features/settlements/presentation/components/settlementsFormat';

const FALLBACK_ERROR = 'Could not download the statement.';

interface StatementDownloadButtonProps {
  statementId: string;
  statementNo: string;
  /** The stored PDF, when the row says — a second route if the first one fails. */
  pdfFileId?: string | null;
  size?: 'sm' | 'md';
  variant?: 'primary' | 'secondary';
  children: ReactNode;
}

/**
 * Download a monthly statement's PDF (UAT-29). `GET /statements/{id}.pdf`
 * hands back a signed link (backend SET-02) — or the bytes, from an older
 * server — and renders the PDF first if it was never stored. Should that
 * fail and the statement has a stored file, the shared files API is tried
 * before the first error is shown.
 */
export function StatementDownloadButton({
  statementId,
  statementNo,
  pdfFileId = null,
  size = 'md',
  variant = 'secondary',
  children,
}: StatementDownloadButtonProps) {
  const pdf = useStatementPdfMutation();
  const stored = useFileDownloadMutation();
  const filename = statementFilename(statementNo);

  const handleDownload = (): void => {
    pdf.mutate(statementId, {
      onSuccess: (answer) => {
        if (answer.kind === 'link') downloadFromUrl(answer.url, filename);
        else downloadBlob(answer.blob, filename);
      },
      onError: (failure) => {
        const message = isFailure(failure) ? failure.message : FALLBACK_ERROR;
        if (!pdfFileId) {
          toast(message, 'error');
          return;
        }
        stored.mutate({ fileId: pdfFileId, filename }, { onError: () => toast(message, 'error') });
      },
    });
  };

  return (
    <Button
      size={size}
      variant={variant}
      icon="file-down"
      onClick={handleDownload}
      busy={pdf.isPending || stored.isPending}
    >
      {children}
    </Button>
  );
}
