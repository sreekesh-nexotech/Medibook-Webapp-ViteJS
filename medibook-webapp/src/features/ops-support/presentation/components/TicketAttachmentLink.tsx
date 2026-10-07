import { isFailure } from '@/core/error/failure';
import { useFileDownloadMutation } from '@/shared/hooks/useFileDownloadMutation';
import { useFileQuery } from '@/shared/hooks/useFileQuery';
import { Icon } from '@/shared/ui/Icon';
import { toast } from '@/shared/ui/toast/toast.store';

interface TicketAttachmentLinkProps {
  fileId: string;
  /** "Attachment 2" until the file's own name is known. */
  fallbackName: string;
}

/**
 * One file on a ticket message: its original name, downloaded through a
 * short-lived signed link (`support.view` may read every ticket attachment,
 * B6 L-34).
 */
export function TicketAttachmentLink({ fileId, fallbackName }: TicketAttachmentLinkProps) {
  const file = useFileQuery(fileId);
  const download = useFileDownloadMutation();
  const name = file.data?.originalName ?? fallbackName;

  return (
    <button
      type="button"
      disabled={download.isPending}
      onClick={() =>
        download.mutate(
          { fileId, filename: name },
          {
            onError: (error) =>
              toast(
                isFailure(error) && error.kind === 'notFound'
                  ? 'This attachment is no longer available.'
                  : isFailure(error)
                    ? error.message
                    : 'Could not open the attachment.',
                'error',
              ),
          },
        )
      }
      className="border-border-soft text-caption text-blue inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-md border bg-white px-2.5 py-1 disabled:cursor-wait"
      aria-label={`Download ${name}`}
    >
      <Icon name="file-text" size={14} />
      <span className="truncate">{name}</span>
    </button>
  );
}
