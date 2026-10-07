import { useRef, useState, type ChangeEvent } from 'react';

import { acceptFor } from '@/core/api/files.rules';
import { isFailure } from '@/core/error/failure';
import { useFileUploadMutation } from '@/shared/hooks/useFileUploadMutation';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import { IconBtn } from '@/shared/ui/IconBtn';
import { TextArea } from '@/shared/ui/TextArea';
import { Toggle } from '@/shared/ui/Toggle';
import { toast } from '@/shared/ui/toast/toast.store';

import { useAttachmentScansQuery } from '@/features/ops-support/application/queries/useAttachmentScansQuery';
import { useReplyTicketMutation } from '@/features/ops-support/application/queries/useReplyTicketMutation';
import {
  TICKET_ATTACHMENTS_MAX,
  TICKET_MESSAGE_MAX,
} from '@/features/ops-support/domain/entities/support.entities';
import {
  attachmentsState,
  attachmentStatusLabel,
  replyProblem,
} from '@/features/ops-support/presentation/components/support.view';

const ATTACHMENT_PURPOSE = 'ticket_attachment';

interface PendingAttachment {
  readonly id: string;
  readonly name: string;
}

interface TicketComposerProps {
  ticketId: string;
}

/**
 * Reply to the requester, or leave an internal note for the team. A reply
 * notifies the requester (email for hospital staff, SMS/push for patients,
 * Q127); an internal note is never shown or sent to them. Attachments upload first and must pass the virus scan
 * before the message can go (backend `usable_attachment`).
 */
export function TicketComposer({ ticketId }: TicketComposerProps) {
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);
  const [attachments, setAttachments] = useState<readonly PendingAttachment[]>([]);
  const [uploading, setUploading] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = useFileUploadMutation();
  const reply = useReplyTicketMutation();
  const scans = useAttachmentScansQuery(attachments.map((a) => a.id));
  const state = uploading > 0 ? 'scanning' : attachmentsState(attachments.map((a) => scans[a.id]));
  const problem = replyProblem(body, state);
  const room = TICKET_ATTACHMENTS_MAX - attachments.length - uploading;

  const onFiles = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (picked.length > room) {
      toast(`A message can carry up to ${TICKET_ATTACHMENTS_MAX} files.`, 'error');
    }
    const files = picked.slice(0, Math.max(0, room));
    setUploading((n) => n + files.length);
    await Promise.all(
      files.map(async (file) => {
        try {
          const stored = await upload.mutateAsync({ file, purpose: ATTACHMENT_PURPOSE });
          setAttachments((current) => [...current, { id: stored.id, name: file.name }]);
        } catch (error) {
          toast(
            isFailure(error) ? `${file.name}: ${error.message}` : `${file.name} did not upload.`,
            'error',
          );
        } finally {
          setUploading((n) => n - 1);
        }
      }),
    );
  };

  const send = (): void => {
    if (problem) return;
    reply.mutate(
      {
        id: ticketId,
        reply: { body, isInternal: internal, attachmentFileIds: attachments.map((a) => a.id) },
      },
      {
        onSuccess: () => {
          toast(
            internal ? 'Internal note added.' : 'Reply sent. The requester is notified.',
            'success',
          );
          setBody('');
          setAttachments([]);
          setInternal(false);
        },
        onError: (error) =>
          toast(isFailure(error) ? error.message : 'The message was not sent.', 'error'),
      },
    );
  };

  return (
    <div
      className={cn(
        'border-border-soft flex flex-col gap-3 rounded-lg border p-4',
        internal ? 'bg-y-100' : 'bg-white',
      )}
    >
      <TextArea
        value={body}
        onChange={setBody}
        rows={4}
        maxLength={TICKET_MESSAGE_MAX}
        placeholder={
          internal
            ? 'A note for the Medibook team — the requester never sees it.'
            : 'Write a reply to the requester.'
        }
        aria-label={internal ? 'Internal note' : 'Reply'}
      />
      {attachments.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {attachments.map((a) => {
            const status = scans[a.id];
            return (
              <li key={a.id} className="text-caption flex items-center gap-2">
                <span className="text-text-strong truncate">{a.name}</span>
                <span
                  className={cn(
                    status === 'clean'
                      ? 'text-g-700'
                      : attachmentsState([status]) === 'failed'
                        ? 'text-d-500'
                        : 'text-text-muted',
                  )}
                >
                  {attachmentStatusLabel(status)}
                </span>
                <IconBtn
                  name="x"
                  size={14}
                  box={24}
                  label={`Remove ${a.name}`}
                  onClick={() => setAttachments((current) => current.filter((x) => x.id !== a.id))}
                />
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          multiple
          accept={acceptFor(ATTACHMENT_PURPOSE)}
          onChange={(e) => void onFiles(e)}
          className="hidden"
        />
        <Button
          size="sm"
          variant="ghost"
          icon="upload"
          busy={uploading > 0}
          disabled={room <= 0}
          onClick={() => fileRef.current?.click()}
        >
          Attach PDF or image
        </Button>
        <Toggle value={internal} onChange={setInternal} label="Internal note" />
        <span className="text-caption text-text-muted">Internal note</span>
        <div className="flex-1"></div>
        {problem && body.trim() !== '' && (
          <span className="text-caption text-text-muted">{problem}</span>
        )}
        <Button
          size="sm"
          icon={internal ? 'lock' : 'send'}
          busy={reply.isPending}
          disabled={problem !== null}
          onClick={send}
        >
          {internal ? 'Add note' : 'Send reply'}
        </Button>
      </div>
    </div>
  );
}
