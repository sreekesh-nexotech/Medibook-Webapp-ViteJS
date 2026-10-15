import { useRef, useState, type ChangeEvent } from 'react';

import { acceptFor } from '@/core/api/files.rules';
import { useFileUploadMutation } from '@/shared/hooks/useFileUploadMutation';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import { toast } from '@/shared/ui/toast/toast.store';

import { isFailure } from '@/core/error/failure';

import {
  TICKET_ATTACHMENTS_MAX,
  TICKET_MESSAGE_MAX,
} from '@/features/help/domain/entities/help.types';
import { useReplyToTicketMutation } from '@/features/help/application/queries/useReplyToTicketMutation';
import { useTicketAttachmentsReady } from '@/features/help/application/queries/useTicketAttachmentsReady';

import { TicketAttachment } from './TicketAttachment';

const ATTACHMENT_PURPOSE = 'ticket_attachment';

interface TicketReplyComposerProps {
  ticketId: string;
}

/**
 * Reply box under a ticket thread (`POST …/support/tickets/{id}/messages`):
 * a message of up to 5,000 characters and up to five PDF or image files,
 * each uploaded through the shared files API and sent once its virus scan
 * comes back clean.
 */
export function TicketReplyComposer({ ticketId }: TicketReplyComposerProps) {
  const reply = useReplyToTicketMutation();
  const upload = useFileUploadMutation();
  const [body, setBody] = useState('');
  const [fileIds, setFileIds] = useState<readonly string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const attachments = useTicketAttachmentsReady(fileIds);
  const canSend =
    body.trim().length > 0 && !reply.isPending && !upload.isPending && attachments.allClean;

  const pickFile = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    upload.mutate(
      { file, purpose: ATTACHMENT_PURPOSE },
      {
        onSuccess: (stored) => setFileIds((ids) => [...ids, stored.id]),
        onError: (error) =>
          toast(isFailure(error) ? error.message : 'The file could not be uploaded.', 'error'),
      },
    );
  };

  const send = (): void => {
    if (!canSend) return;
    reply.mutate(
      { ticketId, message: { body, attachmentFileIds: fileIds } },
      {
        onSuccess: () => {
          setBody('');
          setFileIds([]);
          toast('Reply sent to Medibook', 'success');
        },
        onError: (error) =>
          toast(isFailure(error) ? error.message : 'Your reply could not be sent.', 'error'),
      },
    );
  };

  return (
    <div className="flex flex-col gap-2.5">
      <label htmlFor={`reply-${ticketId}`} className="font-ui text-label text-text-strong">
        Reply
      </label>
      <textarea
        id={`reply-${ticketId}`}
        value={body}
        maxLength={TICKET_MESSAGE_MAX}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write to the Medibook team…"
        className="rounded-input border-border text-body text-text-strong h-24 w-full resize-none border bg-white p-3"
      />
      {fileIds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {fileIds.map((id) => (
            <TicketAttachment
              key={id}
              fileId={id}
              onRemove={(gone) => setFileIds((ids) => ids.filter((x) => x !== gone))}
            />
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={acceptFor(ATTACHMENT_PURPOSE)}
            onChange={pickFile}
            className="hidden"
            aria-label="Attach a file"
          />
          <Button
            size="sm"
            variant="ghost"
            icon="upload"
            busy={upload.isPending}
            disabled={fileIds.length >= TICKET_ATTACHMENTS_MAX}
            onClick={() => inputRef.current?.click()}
          >
            Attach file
          </Button>
          <span
            className={cn(
              'text-caption',
              attachments.hasRefused ? 'text-d-700' : 'text-text-muted',
            )}
          >
            {attachments.hasRefused
              ? 'Remove the file the virus scan blocked to send.'
              : `PDF or image, up to ${TICKET_ATTACHMENTS_MAX} files`}
          </span>
        </div>
        <Button size="sm" icon="send" busy={reply.isPending} disabled={!canSend} onClick={send}>
          Send reply
        </Button>
      </div>
    </div>
  );
}
