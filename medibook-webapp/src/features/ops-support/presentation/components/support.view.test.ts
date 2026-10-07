import { describe, expect, it } from 'vitest';

import type {
  SupportTicket,
  SupportTicketDetail,
  TicketMessage,
} from '@/features/ops-support/domain/entities/support.entities';
import {
  toTicketListParams,
  toTicketPatchBody,
  toTicketReplyBody,
} from '@/features/ops-support/infrastructure/data-sources/remote/support.request';
import { toSupportTicket } from '@/features/ops-support/infrastructure/data-sources/remote/support.response';
import {
  acceptsReplies,
  assigneeLabel,
  attachmentsState,
  attachmentStatusLabel,
  nextStatuses,
  normaliseTicketNo,
  replyProblem,
  requesterLine,
  threadEntries,
} from '@/features/ops-support/presentation/components/support.view';

const ticket = (over: Partial<SupportTicket> = {}): SupportTicket => ({
  id: 't1',
  ticketNo: 'TKT-2026-0001',
  raisedByKind: 'hospital_staff',
  raisedByName: 'Anita Menon',
  hospitalId: 'h1',
  hospitalName: 'Lakeshore Hospital',
  category: 'billing',
  subject: 'Invoice total looks wrong',
  description: 'The September invoice double-counts SMS.',
  priority: 'normal',
  status: 'open',
  assignedToId: null,
  assignedToName: null,
  allowedTransitions: null,
  resolvedAt: null,
  closedAt: null,
  createdAt: '2026-10-01T09:00:00Z',
  updatedAt: '2026-10-01T09:00:00Z',
  version: 1,
  ...over,
});

const message = (over: Partial<TicketMessage> = {}): TicketMessage => ({
  id: 'm1',
  authorKind: 'platform_staff',
  authorName: 'Kavya Iyer',
  body: 'Looking into it.',
  attachmentFileIds: [],
  isInternal: false,
  occurredAt: '2026-10-01T10:00:00Z',
  ...over,
});

const detail = (
  messages: TicketMessage[],
  over: Partial<SupportTicket> = {},
): SupportTicketDetail => ({
  ...ticket(over),
  messages,
});

describe('status moves', () => {
  it('follows the server when it lists the allowed moves', () => {
    expect(nextStatuses(ticket({ status: 'open', allowedTransitions: ['resolved'] }))).toEqual([
      'resolved',
    ]);
  });

  it('falls back to the B9 table on an older server', () => {
    expect(nextStatuses(ticket({ status: 'resolved' }))).toEqual(['in_progress', 'closed']);
    expect(nextStatuses(ticket({ status: 'closed' }))).toEqual([]);
    expect(nextStatuses(ticket({ status: 'waiting_on_requester' }))).toEqual([
      'in_progress',
      'resolved',
      'closed',
    ]);
  });

  it('takes no replies once closed', () => {
    expect(acceptsReplies(ticket({ status: 'resolved' }))).toBe(true);
    expect(acceptsReplies(ticket({ status: 'closed' }))).toBe(false);
  });
});

describe('names', () => {
  it('describes the requester with what the server sent', () => {
    expect(requesterLine(ticket())).toBe('Anita Menon · Hospital staff · Lakeshore Hospital');
    expect(
      requesterLine(ticket({ raisedByKind: 'patient', raisedByName: null, hospitalId: null })),
    ).toBe('Name unavailable · Patient');
  });

  it('names the assignee from the ticket, then the staff list', () => {
    const none = (): string | null => null;
    expect(assigneeLabel(ticket(), none)).toBe('Unassigned');
    expect(assigneeLabel(ticket({ assignedToId: 's1', assignedToName: 'Ravi' }), none)).toBe(
      'Ravi',
    );
    expect(assigneeLabel(ticket({ assignedToId: 's1' }), () => 'Kavya')).toBe('Kavya');
    expect(assigneeLabel(ticket({ assignedToId: 's1' }), none)).toBe('Assigned');
  });
});

describe('thread', () => {
  it('opens with the description, then the messages and notes', () => {
    const entries = threadEntries(
      detail([message(), message({ id: 'm2', isInternal: true, body: 'Check billing run.' })]),
    );
    expect(entries.map((e) => e.voice)).toEqual(['requester', 'staff', 'internal']);
    expect(entries[0]?.body).toBe('The September invoice double-counts SMS.');
    expect(entries[0]?.author).toBe('Anita Menon');
  });

  it('folds the copy of the description that carries the first attachments', () => {
    const entries = threadEntries(
      detail([
        message({
          authorKind: 'requester',
          authorName: 'Anita Menon',
          body: 'The September invoice double-counts SMS.',
          attachmentFileIds: ['f1'],
        }),
        message({ id: 'm2' }),
      ]),
    );
    expect(entries).toHaveLength(2);
    expect(entries[0]?.attachmentFileIds).toEqual(['f1']);
  });
});

describe('replies', () => {
  it('needs text and clean attachments', () => {
    expect(replyProblem('  ', 'ready')).toMatch(/Write/);
    expect(replyProblem('Done', 'scanning')).toMatch(/virus scan/);
    expect(replyProblem('Done', 'failed')).toMatch(/Remove/);
    expect(replyProblem('Done', 'ready')).toBeNull();
    expect(replyProblem('x'.repeat(5001), 'ready')).toMatch(/under/);
  });

  it('reads the attachments’ scan results', () => {
    expect(attachmentsState([])).toBe('ready');
    expect(attachmentsState(['clean', 'scanning'])).toBe('scanning');
    expect(attachmentsState(['clean', undefined])).toBe('scanning');
    expect(attachmentsState(['clean', 'infected'])).toBe('failed');
    expect(attachmentStatusLabel('clean')).toBe('Ready');
    expect(attachmentStatusLabel(undefined)).toBe('Scanning…');
  });

  it('upper-cases a typed ticket number', () => {
    expect(normaliseTicketNo(' tkt-2026-0001 ')).toBe('TKT-2026-0001');
  });
});

describe('ticket requests', () => {
  it('sends only the filters in use, multi-values comma-joined', () => {
    expect(
      toTicketListParams({
        page: 2,
        pageSize: 15,
        statuses: ['open', 'in_progress'],
        priorities: [],
        category: null,
        raisedByKind: 'patient',
        hospitalId: null,
        assignedToId: null,
        ticketNo: ' ',
        dateFrom: '2026-10-01',
        dateTo: null,
        sort: 'updated_at',
        sortDir: 'desc',
      }),
    ).toEqual({
      page: 2,
      page_size: 15,
      sort: '-updated_at',
      status: 'open,in_progress',
      raised_by_kind: 'patient',
      date_from: '2026-10-01',
    });
  });

  it('patches only what changed, null unassigns', () => {
    expect(toTicketPatchBody({ assignedToId: null })).toEqual({ assigned_to_id: null });
    expect(toTicketPatchBody({ status: 'resolved' })).toEqual({ status: 'resolved' });
  });

  it('sends attachments only when there are some', () => {
    expect(toTicketReplyBody({ body: ' Hi ', attachmentFileIds: [], isInternal: true })).toEqual({
      body: 'Hi',
      is_internal: true,
    });
    expect(
      toTicketReplyBody({ body: 'Hi', attachmentFileIds: ['f1'], isInternal: false })
        .attachment_file_ids,
    ).toEqual(['f1']);
  });

  it('parses a ticket from an older server without names or moves', () => {
    const t = toSupportTicket({
      id: 't1',
      ticket_no: 'TKT-2026-0001',
      raised_by_kind: 'patient',
      hospital_id: null,
      category: 'other',
      subject: 'S',
      description: 'D',
      priority: 'low',
      status: 'open',
      resolved_at: null,
      closed_at: null,
      created_at: '',
      updated_at: '',
      version: 3,
    });
    expect(t).toMatchObject({ raisedByName: null, assignedToId: null, allowedTransitions: null });
  });
});
