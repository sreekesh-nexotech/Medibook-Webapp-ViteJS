import type { ReactNode } from 'react';

import { isFailure, type Failure } from '@/core/error/failure';
import { useOpsPermission } from '@/shared/hooks/useOpsPermission';
import { cn } from '@/shared/lib/cn';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { CanOps } from '@/shared/ui/CanOps';
import { Drawer } from '@/shared/ui/Drawer';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Icon } from '@/shared/ui/Icon';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { Select } from '@/shared/ui/Select';
import { SkeletonCards } from '@/shared/ui/Skeleton';
import { toast } from '@/shared/ui/toast/toast.store';

import { useTicketQuery } from '@/features/ops-support/application/queries/useTicketQuery';
import { useUpdateTicketMutation } from '@/features/ops-support/application/queries/useUpdateTicketMutation';
import type {
  SupportTicketDetail,
  TicketChanges,
} from '@/features/ops-support/domain/entities/support.entities';
import { TICKET_PRIORITIES } from '@/features/ops-support/domain/entities/support.entities';
import { TicketAttachmentLink } from '@/features/ops-support/presentation/components/TicketAttachmentLink';
import { TicketComposer } from '@/features/ops-support/presentation/components/TicketComposer';
import {
  acceptsReplies,
  assigneeLabel,
  CATEGORY_LABEL,
  nextStatuses,
  PRIORITY_LOOK,
  requesterLine,
  STATUS_LOOK,
  threadEntries,
  type ThreadVoice,
} from '@/features/ops-support/presentation/components/support.view';

const UNASSIGNED = 'Unassigned';
const NONE = '—';

const DATE_TIME = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

const when = (iso: string | null): string => (iso ? DATE_TIME.format(new Date(iso)) : NONE);

const VOICE_CLASS: Readonly<Record<ThreadVoice, string>> = {
  requester: 'bg-white border-border-soft',
  staff: 'bg-blue-soft-bg border-blue-soft-bg',
  internal: 'bg-y-100 border-border-soft',
};

/** An active platform staff member the ticket can be assigned to. */
export interface AssigneeOption {
  readonly id: string;
  readonly name: string;
}

interface TicketDrawerProps {
  ticketId: string | null;
  /** Active staff (`staff.view`); `null` when this role cannot list them. */
  assignees: readonly AssigneeOption[] | null;
  /** Names a hospital the server did not name (the console's hospital list). */
  hospitalNameOf: (hospitalId: string) => string | null;
  onClose: () => void;
}

function conflictMessage(error: Failure): string {
  return error.code === 'CONFLICT_VERSION'
    ? 'Someone else changed this ticket a moment ago. It has been reloaded — check it and try again.'
    : error.message;
}

interface FactProps {
  label: string;
  children: ReactNode;
}

function Fact({ label, children }: FactProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-caption text-text-faint">{label}</span>
      <span className="text-body text-text-strong font-medium break-words">{children}</span>
    </div>
  );
}

function TicketControls({
  ticket,
  assignees,
}: {
  ticket: SupportTicketDetail;
  assignees: readonly AssigneeOption[] | null;
}) {
  const update = useUpdateTicketMutation();
  const statusOptions = [ticket.status, ...nextStatuses(ticket)];
  const assigned = assigneeLabel(ticket, (id) => assignees?.find((a) => a.id === id)?.name ?? null);

  const change = (changes: TicketChanges, done: string): void => {
    update.mutate(
      { id: ticket.id, changes, version: ticket.version },
      {
        onSuccess: () => toast(done, 'success'),
        onError: (error) =>
          toast(isFailure(error) ? conflictMessage(error) : 'The ticket was not updated.', 'error'),
      },
    );
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-caption text-text-faint">Status</span>
        <Select
          value={STATUS_LOOK[ticket.status].label}
          options={statusOptions.map((s) => STATUS_LOOK[s].label)}
          disabled={update.isPending || statusOptions.length === 1}
          aria-label="Ticket status"
          onChange={(label) => {
            const next = statusOptions.find((s) => STATUS_LOOK[s].label === label);
            if (next && next !== ticket.status) {
              change({ status: next }, `Ticket ${ticket.ticketNo} is now ${label.toLowerCase()}.`);
            }
          }}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-caption text-text-faint">Priority</span>
        <Select
          value={PRIORITY_LOOK[ticket.priority].label}
          options={TICKET_PRIORITIES.map((p) => PRIORITY_LOOK[p].label)}
          disabled={update.isPending || ticket.status === 'closed'}
          aria-label="Ticket priority"
          onChange={(label) => {
            const next = TICKET_PRIORITIES.find((p) => PRIORITY_LOOK[p].label === label);
            if (next && next !== ticket.priority) {
              change({ priority: next }, `Priority set to ${label.toLowerCase()}.`);
            }
          }}
        />
      </label>
      <div className="flex flex-col gap-1.5">
        <span className="text-caption text-text-faint">Assignee</span>
        {assignees ? (
          <Select
            value={ticket.assignedToId === null ? UNASSIGNED : assigned}
            options={[UNASSIGNED, ...assignees.map((a) => a.name)]}
            disabled={update.isPending}
            aria-label="Assign the ticket"
            onChange={(name) => {
              const id = assignees.find((a) => a.name === name)?.id ?? null;
              if (id !== ticket.assignedToId) {
                change(
                  { assignedToId: id },
                  id === null ? 'Ticket unassigned.' : `Assigned to ${name}.`,
                );
              }
            }}
          />
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-body text-text-strong font-medium">{assigned}</span>
            {ticket.assignedToId !== null && (
              <Button
                size="sm"
                variant="ghost"
                disabled={update.isPending}
                onClick={() => change({ assignedToId: null }, 'Ticket unassigned.')}
              >
                Unassign
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TicketBody({
  ticket,
  assignees,
  hospitalNameOf,
}: {
  ticket: SupportTicketDetail;
  assignees: readonly AssigneeOption[] | null;
  hospitalNameOf: (hospitalId: string) => string | null;
}) {
  const { can } = useOpsPermission();
  const entries = threadEntries(ticket);
  const assigned = assigneeLabel(ticket, (id) => assignees?.find((a) => a.id === id)?.name ?? null);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge status={STATUS_LOOK[ticket.status].badge}>{STATUS_LOOK[ticket.status].label}</Badge>
        <Badge status={PRIORITY_LOOK[ticket.priority].badge}>
          {PRIORITY_LOOK[ticket.priority].label}
        </Badge>
        <span className="text-caption text-text-muted">{CATEGORY_LABEL[ticket.category]}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Fact label="Raised by">{requesterLine(ticket, hospitalNameOf)}</Fact>
        <Fact label="Raised">{when(ticket.createdAt)}</Fact>
        <Fact label="Last activity">{when(ticket.updatedAt)}</Fact>
        {!can('support.edit') && <Fact label="Assignee">{assigned}</Fact>}
        {ticket.resolvedAt && <Fact label="Resolved">{when(ticket.resolvedAt)}</Fact>}
        {ticket.closedAt && <Fact label="Closed">{when(ticket.closedAt)}</Fact>}
      </div>

      <CanOps perm="support.edit">
        <TicketControls ticket={ticket} assignees={assignees} />
      </CanOps>

      <div className="flex flex-col gap-3">
        <SectionTitle size={15}>Conversation</SectionTitle>
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {entries.map((e) => (
            <li key={e.key} className={cn('rounded-lg border p-4', VOICE_CLASS[e.voice])}>
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                {e.voice === 'internal' && <Icon name="lock" size={13} className="text-y-800" />}
                <span className="text-caption text-text-strong font-semibold">{e.author}</span>
                <span className="text-caption text-text-muted">
                  {e.voice === 'internal'
                    ? 'Internal note'
                    : e.voice === 'staff'
                      ? 'Medibook support'
                      : 'Requester'}{' '}
                  · {when(e.at)}
                </span>
              </div>
              <p className="text-body text-text-body m-0 break-words whitespace-pre-wrap">
                {e.body}
              </p>
              {e.attachmentFileIds.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {e.attachmentFileIds.map((id, i) => (
                    <TicketAttachmentLink
                      key={id}
                      fileId={id}
                      fallbackName={`Attachment ${i + 1}`}
                    />
                  ))}
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>

      <CanOps perm="support.add">
        {acceptsReplies(ticket) ? (
          <TicketComposer key={ticket.id} ticketId={ticket.id} />
        ) : (
          <p className="text-caption text-text-muted m-0">
            This ticket is closed, so it takes no more replies. The requester can raise a new one.
          </p>
        )}
      </CanOps>
    </div>
  );
}

/**
 * One support ticket (UAT-30): who raised it, its status, priority and
 * assignee (`support.edit`, guarded by the ticket's version — B9 L-25), the
 * conversation with internal notes, and the reply box (`support.add`).
 */
export function TicketDrawer({ ticketId, assignees, hospitalNameOf, onClose }: TicketDrawerProps) {
  const ticket = useTicketQuery(ticketId);
  if (ticketId === null) return null;
  const data = ticket.data;

  return (
    <Drawer
      open
      onClose={onClose}
      width={680}
      title={data ? data.subject : 'Support ticket'}
      subtitle={data ? data.ticketNo : undefined}
      ariaLabel="Support ticket"
    >
      {ticket.isPending ? (
        <SkeletonCards count={2} lines={3} />
      ) : ticket.isError ? (
        <ErrorState
          title="This ticket didn't load"
          message={isFailure(ticket.error) ? ticket.error.message : undefined}
          onRetry={() => void ticket.refetch()}
        />
      ) : (
        <TicketBody ticket={ticket.data} assignees={assignees} hospitalNameOf={hospitalNameOf} />
      )}
    </Drawer>
  );
}
