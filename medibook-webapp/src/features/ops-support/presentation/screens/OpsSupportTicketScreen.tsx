import { useId, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { opsHospitalDetailPath, opsPath, opsPlatformUserDetailPath } from '@/app/router/paths';
import { isFailure } from '@/core/error/failure';
import { useOpsStaffQuery } from '@/features/ops-users/application/queries/useOpsStaffQuery';
import { useReplyToSupportTicketMutation } from '@/features/ops-support/application/queries/useReplyToSupportTicketMutation';
import { useSupportTicketQuery } from '@/features/ops-support/application/queries/useSupportTicketQuery';
import { useTicketAttachmentMutation } from '@/features/ops-support/application/queries/useTicketAttachmentMutation';
import { useUpdateSupportTicketMutation } from '@/features/ops-support/application/queries/useUpdateSupportTicketMutation';
import type {
  SupportTicketDetail,
  TicketChanges,
  TicketMessage,
} from '@/features/ops-support/domain/entities/support.entities';
import {
  TICKET_PRIORITIES,
  TICKET_STATUSES,
} from '@/features/ops-support/domain/entities/support.entities';
import {
  CATEGORY_LABELS,
  NO_VALUE,
  PRIORITY_PILLS,
  STATUS_PILLS,
  formatDateTime,
  requesterKindLabel,
} from '@/features/ops-support/presentation/components/supportFormat';
import { TicketRequester } from '@/features/ops-support/presentation/components/TicketRequester';
import { useOpsPermission } from '@/shared/hooks/useOpsPermission';
import { cn } from '@/shared/lib/cn';
import { downloadFromUrl } from '@/shared/lib/download';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Icon } from '@/shared/ui/Icon';
import { OpsField } from '@/shared/ui/OpsField';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { Select } from '@/shared/ui/Select';
import { Spinner } from '@/shared/ui/Spinner';
import { toast } from '@/shared/ui/toast/toast.store';
import { Toggle } from '@/shared/ui/Toggle';

/** `TicketMessageSerializer.body` max length. */
const REPLY_MAX = 5000;

const UNASSIGNED = 'Unassigned';

/** One ticket with its thread, its reply box and its status controls (OBS-02). */
export function OpsSupportTicketScreen() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const ticket = useSupportTicketQuery(id);

  if (ticket.isPending) {
    return (
      <div className="text-text-muted flex justify-center py-16">
        <Spinner size={28} label="Loading the ticket" />
      </div>
    );
  }
  if (ticket.isLoadingError) {
    const notFound = isFailure(ticket.error) && ticket.error.kind === 'notFound';
    return (
      <ErrorState
        error={notFound ? undefined : ticket.error}
        title={notFound ? 'This ticket does not exist' : "This ticket didn't load"}
        message={
          notFound
            ? 'The link may be wrong.'
            : isFailure(ticket.error)
              ? ticket.error.message
              : undefined
        }
        onRetry={notFound ? undefined : () => void ticket.refetch()}
      >
        <Button variant="secondary" onClick={() => navigate(opsPath('support'))}>
          Back to Support Tickets
        </Button>
      </ErrorState>
    );
  }
  return <TicketBody ticket={ticket.data} />;
}

function TicketBody({ ticket }: { ticket: SupportTicketDetail }) {
  const status = STATUS_PILLS[ticket.status];
  const priority = PRIORITY_PILLS[ticket.priority];
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-caption text-text-muted font-semibold tabular-nums">
              {ticket.ticketNo}
            </div>
            <h2 className="text-h2 text-text-strong mt-1 break-words">{ticket.subject}</h2>
            <div className="text-body text-text-muted mt-1.5">
              {CATEGORY_LABELS[ticket.category]} · <TicketRequester ticket={ticket} /> · raised{' '}
              {formatDateTime(ticket.createdAt)}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge status={priority.badge}>{priority.label}</Badge>
            <Badge status={status.badge}>{status.label}</Badge>
          </div>
        </div>
      </Card>
      <div className="flex flex-col items-start gap-5 lg:flex-row">
        <div className="flex w-full min-w-0 flex-col gap-5 lg:flex-2">
          <TicketThread ticket={ticket} />
          <ReplyBox ticket={ticket} />
        </div>
        <div className="flex w-full flex-col gap-5 lg:flex-1">
          <TicketControls ticket={ticket} />
          <RequesterCard ticket={ticket} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ thread */

function TicketThread({ ticket }: { ticket: SupportTicketDetail }) {
  const opening: TicketMessage = {
    id: 'opening',
    authorKind: 'requester',
    authorName: null,
    body: ticket.description,
    attachmentIds: [],
    occurredAt: ticket.createdAt,
    isInternal: false,
  };
  // A ticket raised with attachments repeats its description as the first message.
  const rest = ticket.messages.filter(
    (m, i) => !(i === 0 && m.authorKind === 'requester' && m.body === ticket.description),
  );
  const first = ticket.messages[0];
  const openingFiles =
    first && first.authorKind === 'requester' && first.body === ticket.description
      ? first.attachmentIds
      : [];
  return (
    <Card>
      <SectionTitle size={16} className="mb-4">
        Conversation
      </SectionTitle>
      <ol className="flex flex-col gap-3.5">
        <ThreadEntry ticket={ticket} message={{ ...opening, attachmentIds: openingFiles }} />
        {rest.map((m) => (
          <ThreadEntry key={m.id} ticket={ticket} message={m} />
        ))}
      </ol>
    </Card>
  );
}

function ThreadEntry({ ticket, message }: { ticket: SupportTicketDetail; message: TicketMessage }) {
  const fromUs = message.authorKind === 'platform_staff';
  const author = fromUs
    ? `${message.authorName ?? 'Medibook'} · Medibook`
    : (message.authorName ?? requesterKindLabel(ticket));
  return (
    <li
      className={cn(
        'rounded-md border p-4',
        message.isInternal
          ? 'bg-badge-queue-bg border-badge-queue-border'
          : fromUs
            ? 'bg-blue-soft-bg border-border-soft'
            : 'border-border-soft bg-white',
      )}
    >
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <span className="text-body text-text-strong font-semibold">
          {author}
          {message.isInternal && (
            <span className="text-caption text-badge-queue-fg ml-2 font-semibold">
              Internal note — only Medibook staff see this
            </span>
          )}
        </span>
        <span className="text-caption text-text-muted">{formatDateTime(message.occurredAt)}</span>
      </div>
      <p className="text-body text-text-body break-words whitespace-pre-wrap">{message.body}</p>
      {message.attachmentIds.length > 0 && <Attachments ids={message.attachmentIds} />}
    </li>
  );
}

function Attachments({ ids }: { ids: readonly string[] }) {
  const open = useTicketAttachmentMutation();
  const download = (fileId: string): void =>
    open.mutate(fileId, {
      onSuccess: (url) => downloadFromUrl(url),
      onError: (failure) =>
        toast(
          isFailure(failure) ? failure.message : 'The attachment could not be opened.',
          'error',
          failure,
        ),
    });
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {ids.map((fileId, i) => (
        <Button
          key={fileId}
          size="sm"
          variant="secondary"
          icon="download"
          busy={open.isPending && open.variables === fileId}
          onClick={() => download(fileId)}
        >
          Attachment {i + 1}
        </Button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------- reply */

function ReplyBox({ ticket }: { ticket: SupportTicketDetail }) {
  const mayReply = useOpsPermission().can('support.add');
  const reply = useReplyToSupportTicketMutation();
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Set the moment Send is pressed, so a double click sends one reply. */
  const sending = useRef(false);
  const fieldId = useId();
  const noteId = useId();

  if (!mayReply) return null;
  if (ticket.status === 'closed') {
    return (
      <Card>
        <p className="text-body text-text-muted">
          This ticket is closed. Change its status to reply again.
        </p>
      </Card>
    );
  }

  const send = (): void => {
    if (sending.current) return;
    const text = body.trim();
    if (!text) {
      setError('Write a reply first.');
      return;
    }
    setError(null);
    sending.current = true;
    reply.mutate(
      { id: ticket.id, reply: { body: text, internal } },
      {
        onSettled: () => {
          sending.current = false;
        },
        onSuccess: () => {
          setBody('');
          toast(
            internal
              ? 'Internal note added.'
              : `Reply sent — ${ticket.ticketNo}'s requester is emailed.`,
            'success',
          );
          setInternal(false);
        },
        onError: (failure) =>
          setError(isFailure(failure) ? failure.message : 'The reply could not be sent.'),
      },
    );
  };

  return (
    <Card>
      <label htmlFor={fieldId} className="text-body text-text-strong mb-2 block font-semibold">
        {internal ? 'Internal note' : 'Reply to the requester'}
      </label>
      <textarea
        id={fieldId}
        value={body}
        maxLength={REPLY_MAX}
        onChange={(e) => setBody(e.target.value)}
        placeholder={
          internal ? 'Only Medibook staff see internal notes.' : 'The requester gets this by email.'
        }
        aria-invalid={error ? true : undefined}
        className={cn(
          'rounded-input text-body-lg text-text-strong h-32 w-full resize-y border p-3',
          error ? 'border-d-500' : 'border-border',
          internal && 'bg-badge-queue-bg',
        )}
      />
      {error && (
        <div role="alert" className="text-caption text-danger mt-2">
          {error}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Toggle value={internal} onChange={setInternal} aria-labelledby={noteId} />
          <span id={noteId} className="text-body text-text-body">
            Internal note
          </span>
        </div>
        <Button icon="send" busy={reply.isPending} onClick={send}>
          {internal ? 'Add note' : 'Send reply'}
        </Button>
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------------- controls */

function TicketControls({ ticket }: { ticket: SupportTicketDetail }) {
  const checks = useOpsPermission();
  const mayEdit = checks.can('support.edit');
  const update = useUpdateSupportTicketMutation();

  const change = (changes: TicketChanges, done: string): void =>
    update.mutate(
      { id: ticket.id, changes, version: ticket.version },
      {
        onSuccess: () => toast(done, 'success'),
        onError: (failure) =>
          toast(
            isFailure(failure) && failure.kind === 'conflict'
              ? 'Someone else changed this ticket first. The latest version is now shown; make your change again if it is still needed.'
              : isFailure(failure)
                ? failure.message
                : 'The ticket could not be changed.',
            'error',
            failure,
          ),
      },
    );

  return (
    <Card>
      <SectionTitle size={16} className="mb-4">
        Ticket
      </SectionTitle>
      <div className="flex flex-col gap-4">
        <OpsField label="Status">
          <Select
            value={STATUS_PILLS[ticket.status].label}
            options={TICKET_STATUSES.map((s) => STATUS_PILLS[s].label)}
            disabled={!mayEdit || update.isPending}
            height={44}
            onChange={(label) => {
              const next = TICKET_STATUSES.find((s) => STATUS_PILLS[s].label === label);
              if (next && next !== ticket.status) {
                change({ status: next }, `${ticket.ticketNo} is now ${label.toLowerCase()}.`);
              }
            }}
          />
        </OpsField>
        <OpsField label="Priority">
          <Select
            value={PRIORITY_PILLS[ticket.priority].label}
            options={TICKET_PRIORITIES.map((p) => PRIORITY_PILLS[p].label)}
            disabled={!mayEdit || update.isPending}
            height={44}
            onChange={(label) => {
              const next = TICKET_PRIORITIES.find((p) => PRIORITY_PILLS[p].label === label);
              if (next && next !== ticket.priority) {
                change({ priority: next }, `${ticket.ticketNo} priority set to ${label}.`);
              }
            }}
          />
        </OpsField>
        {checks.can('staff.view') ? (
          <AssigneeField
            ticket={ticket}
            disabled={!mayEdit || update.isPending}
            onAssign={(assigneeId, name) =>
              change(
                { assigneeId },
                assigneeId
                  ? `${ticket.ticketNo} assigned to ${name}.`
                  : `${ticket.ticketNo} unassigned.`,
              )
            }
          />
        ) : (
          <OpsField label="Assigned to">
            <div className="text-body text-text-body">
              {ticket.assigneeId ? 'A Medibook team member' : UNASSIGNED}
            </div>
          </OpsField>
        )}
        {!mayEdit && (
          <p className="text-caption text-text-muted">
            Your role can read tickets but not change them.
          </p>
        )}
      </div>
    </Card>
  );
}

interface AssigneeFieldProps {
  ticket: SupportTicketDetail;
  disabled: boolean;
  onAssign: (assigneeId: string | null, name: string) => void;
}

/** Shown to roles that can list Medibook staff (`staff.view`). */
function AssigneeField({ ticket, disabled, onAssign }: AssigneeFieldProps) {
  const staff = useOpsStaffQuery();
  const active = (staff.data?.items ?? []).filter((m) => m.status === 'active');
  const current = active.find((m) => m.id === ticket.assigneeId);
  const value = current?.name ?? (ticket.assigneeId ? 'A Medibook team member' : UNASSIGNED);
  return (
    <OpsField label="Assigned to">
      <Select
        value={value}
        options={[UNASSIGNED, ...active.map((m) => m.name)]}
        disabled={disabled || staff.isPending || staff.isLoadingError}
        height={44}
        onChange={(name) => {
          if (name === value) return;
          if (name === UNASSIGNED) {
            onAssign(null, name);
            return;
          }
          const member = active.find((m) => m.name === name);
          if (member) onAssign(member.id, member.name);
        }}
      />
    </OpsField>
  );
}

/* --------------------------------------------------------------- requester */

function RequesterCard({ ticket }: { ticket: SupportTicketDetail }) {
  const checks = useOpsPermission();
  const rows: readonly (readonly [string, string])[] = [
    ['Raised', formatDateTime(ticket.createdAt)],
    ['Last update', formatDateTime(ticket.updatedAt)],
    ['Resolved', formatDateTime(ticket.resolvedAt)],
    ['Closed', formatDateTime(ticket.closedAt)],
  ];
  return (
    <Card>
      <SectionTitle size={16} className="mb-4">
        Raised by
      </SectionTitle>
      <div className="text-body text-text-strong font-medium">
        <TicketRequester ticket={ticket} />
      </div>
      <div className="text-caption text-text-muted mb-3">{requesterKindLabel(ticket)}</div>
      {ticket.hospitalId && checks.can('hospitals.view') && (
        <Link
          to={opsHospitalDetailPath(ticket.hospitalId)}
          className="text-body text-blue mb-4 inline-flex items-center gap-1.5 font-medium"
        >
          <Icon name="building-2" size={15} /> Open the hospital&apos;s profile
        </Link>
      )}
      {!ticket.hospitalId && ticket.requesterId && checks.can('platform_users.view') && (
        <Link
          to={opsPlatformUserDetailPath(ticket.requesterId)}
          className="text-body text-blue mb-4 inline-flex items-center gap-1.5 font-medium"
        >
          <Icon name="user" size={15} /> Open the patient&apos;s account
        </Link>
      )}
      <dl className="flex flex-col gap-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4">
            <dt className="text-caption text-text-muted">{k}</dt>
            <dd
              className={cn(
                'text-caption text-right',
                v === NO_VALUE ? 'text-text-muted' : 'text-text-body',
              )}
            >
              {v}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
