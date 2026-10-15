import { useFileDownloadMutation } from '@/shared/hooks/useFileDownloadMutation';
import { useFileQuery } from '@/shared/hooks/useFileQuery';
import { Icon } from '@/shared/ui/Icon';
import { toast } from '@/shared/ui/toast/toast.store';

import { isFailure } from '@/core/error/failure';

const BYTES_PER_KB = 1024;

function sizeLabel(bytes: number): string {
  if (bytes < BYTES_PER_KB) return `${bytes} B`;
  const kb = bytes / BYTES_PER_KB;
  return kb < BYTES_PER_KB ? `${Math.round(kb)} KB` : `${(kb / BYTES_PER_KB).toFixed(1)} MB`;
}

interface TicketAttachmentProps {
  fileId: string;
  /** Called with the file id when the desk removes it from a draft reply. */
  onRemove?: (fileId: string) => void;
}

/**
 * One file on a ticket thread or a draft reply: its name and size from the
 * shared files API, and a download through a short-lived signed link. A file
 * still being virus-scanned says so; one that failed the scan cannot be sent.
 */
export function TicketAttachment({ fileId, onRemove }: TicketAttachmentProps) {
  const file = useFileQuery(fileId);
  const download = useFileDownloadMutation();
  const meta = file.data;
  const name = meta?.originalName ?? (file.isError ? 'Attachment' : 'Loading…');
  const scanning =
    meta && (meta.status === 'pending' || meta.status === 'uploaded' || meta.status === 'scanning');
  const refused = meta && (meta.status === 'infected' || meta.status === 'scan_failed');

  return (
    <span className="border-border-soft text-caption text-text-body inline-flex max-w-full items-center gap-1.5 rounded-md border bg-white px-2.5 py-1.5">
      <Icon name="file-text" size={14} className="text-text-muted flex-none" />
      <button
        type="button"
        disabled={!meta || Boolean(scanning) || Boolean(refused) || download.isPending}
        onClick={() =>
          download.mutate(
            { fileId, filename: meta?.originalName },
            {
              onError: (error) =>
                toast(
                  isFailure(error) ? error.message : 'The attachment could not be opened.',
                  'error',
                ),
            },
          )
        }
        className="text-blue disabled:text-text-muted max-w-56 cursor-pointer truncate border-0 bg-transparent p-0 text-left disabled:cursor-default"
        title={meta ? `Download ${meta.originalName}` : undefined}
      >
        {name}
      </button>
      {meta && (
        <span className="text-text-muted flex-none">
          {scanning
            ? 'checking…'
            : refused
              ? 'blocked by the virus scan'
              : sizeLabel(meta.sizeBytes)}
        </span>
      )}
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${name}`}
          onClick={() => onRemove(fileId)}
          className="text-text-muted hover:text-text-strong flex-none cursor-pointer border-0 bg-transparent p-0"
        >
          <Icon name="x" size={13} />
        </button>
      )}
    </span>
  );
}
