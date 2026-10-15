import { formatDateTimeIn } from '@/shared/lib/hospitalTime';
import { cn } from '@/shared/lib/cn';
import { Badge } from '@/shared/ui/Badge';
import { Drawer } from '@/shared/ui/Drawer';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Spinner } from '@/shared/ui/Spinner';

import { isFailure } from '@/core/error/failure';

import { useSupportTicketQuery } from '@/features/help/application/queries/useSupportTicketQuery';

import { authorLabel, canReply, CATEGORY_LABELS, STATUS_VIEW } from './help.view';
import { TicketAttachment } from './TicketAttachment';
import { TicketReplyComposer } from './TicketReplyComposer';

interface SupportTicketDrawerProps {
  /** The ticket to show; `null` = closed. */
  ticketId: string | null;
  timeZone: string;
  onClose: () => void;
}

/**
 * One support ticket with its thread (UAT-30): the original description,
 * every reply from the hospital and from the Medibook team (internal notes
 * never reach the hospital), attachments, and a reply box while the ticket
 * is not closed.
 */
export function SupportTicketDrawer({ ticketId, timeZone, onClose }: SupportTicketDrawerProps) {
  const ticket = useSupportTicketQuery(ticketId);
  const data = ticket.data;

  return (
    <Drawer
      open={ticketId !== null}
      onClose={onClose}
      title={data ? data.subject : 'Support ticket'}
      subtitle={data ? `${data.ticketNo} · ${CATEGORY_LABELS[data.category]}` : undefined}
      width={520}
      footer={
        data && canReply(data.status) ? <TicketReplyComposer ticketId={data.id} /> : undefined
      }
    >
      {ticket.isError ? (
        <ErrorState
          inline
          title="This ticket could not be loaded"
          message={isFailure(ticket.error) ? ticket.error.message : undefined}
          onRetry={() => void ticket.refetch()}
        />
      ) : !data ? (
        <div className="text-text-muted flex justify-center py-10">
          <Spinner size={26} label="Loading the ticket" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge status={STATUS_VIEW[data.status].badge}>{STATUS_VIEW[data.status].label}</Badge>
            <span className="text-caption text-text-muted">
              Raised {formatDateTimeIn(data.createdAt, timeZone)}
            </span>
          </div>
          <div className="border-border-soft rounded-md border bg-white p-4">
            <div className="text-caption text-text-muted mb-1">
              Your hospital · original request
            </div>
            <div className="text-body text-text-body whitespace-pre-wrap">{data.description}</div>
          </div>
          {data.messages.length === 0 ? (
            <div className="text-body text-text-muted">
              No replies yet. The Medibook team answers here and by email.
            </div>
          ) : (
            <ol className="flex flex-col gap-3">
              {data.messages.map((m) => {
                const fromMedibook = m.authorKind === 'platform_staff';
                return (
                  <li
                    key={m.id}
                    className={cn(
                      'rounded-md border p-4',
                      fromMedibook
                        ? 'bg-blue-soft-bg border-blue-soft-bg'
                        : 'border-border-soft bg-white',
                    )}
                  >
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-caption text-text-strong font-semibold">
                        {authorLabel(m.authorKind, m.authorName)}
                      </span>
                      <span className="text-caption text-text-muted tabular-nums">
                        {formatDateTimeIn(m.occurredAt, timeZone)}
                      </span>
                    </div>
                    <div className="text-body text-text-body whitespace-pre-wrap">{m.body}</div>
                    {m.attachmentFileIds.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {m.attachmentFileIds.map((id) => (
                          <TicketAttachment key={id} fileId={id} />
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
          {!canReply(data.status) && (
            <div className="text-caption text-text-muted">
              This ticket is closed. Raise a new ticket if you need more help.
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
