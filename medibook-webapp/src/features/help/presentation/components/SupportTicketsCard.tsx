import { useState } from 'react';

import { formatDateTimeIn } from '@/shared/lib/hospitalTime';
import { Badge } from '@/shared/ui/Badge';
import { Card } from '@/shared/ui/Card';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import { Pager } from '@/shared/ui/Pager';
import { RefreshBtn } from '@/shared/ui/RefreshBtn';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { tdClass, TableShell } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';

import { isFailure } from '@/core/error/failure';

import { useSupportTicketsQuery } from '@/features/help/application/queries/useSupportTicketsQuery';

import { CATEGORY_LABELS, STATUS_VIEW, TICKET_FILTERS } from './help.view';

const PAGE_SIZE = 8;
const COLUMNS = ['Ticket', 'Subject', 'Topic', 'Status', 'Last update'] as const;

interface SupportTicketsCardProps {
  timeZone: string;
  onOpen: (ticketId: string) => void;
  onRaise: () => void;
}

/**
 * "My tickets" (UAT-30): every ticket the hospital raised, newest activity
 * first, filtered by status (`GET /hospital/support/tickets`). A row opens the
 * thread with Medibook's replies.
 */
export function SupportTicketsCard({ timeZone, onOpen, onRaise }: SupportTicketsCardProps) {
  const [filter, setFilter] = useState(TICKET_FILTERS[0].label);
  const [page, setPage] = useState(0);
  const status = TICKET_FILTERS.find((f) => f.label === filter)?.status ?? null;
  const tickets = useSupportTicketsQuery({ status, page: page + 1, pageSize: PAGE_SIZE });
  const rows = tickets.data?.items ?? [];

  const state: TableStateSpec | undefined = tickets.isPending
    ? { kind: 'loading', rows: 3 }
    : tickets.isError
      ? {
          kind: 'error',
          message: isFailure(tickets.error)
            ? tickets.error.message
            : 'Could not load your tickets.',
          onRetry: () => void tickets.refetch(),
        }
      : rows.length === 0
        ? status
          ? {
              kind: 'empty',
              title: 'No tickets with this status.',
              message: 'Pick another status to see the rest.',
              actionLabel: 'Show all',
              onAction: () => {
                setFilter(TICKET_FILTERS[0].label);
                setPage(0);
              },
            }
          : {
              kind: 'empty',
              icon: 'ticket',
              title: 'No tickets yet.',
              message: 'Raise a ticket and the Medibook team will answer here and by email.',
              actionLabel: 'Raise a Ticket',
              onAction: onRaise,
            }
        : undefined;

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SectionTitle size={16}>My tickets</SectionTitle>
        <div className="flex items-center gap-2.5">
          <FilterSelect
            value={filter}
            options={TICKET_FILTERS.map((f) => f.label)}
            onChange={(v) => {
              setFilter(v);
              setPage(0);
            }}
            aria-label="Filter tickets by status"
          />
          <RefreshBtn
            onRefresh={async () => {
              await tickets.refetch();
            }}
            title="Refresh your tickets"
          />
        </div>
      </div>
      <TableShell columns={COLUMNS} state={state} scrollLabel="Support tickets">
        {rows.map((t) => (
          <tr
            key={t.id}
            tabIndex={0}
            onClick={() => onOpen(t.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpen(t.id);
              }
            }}
            className="hover:bg-grey-200 cursor-pointer transition-colors duration-150"
          >
            <td className={tdClass}>
              <span className="text-text-strong font-medium">{t.ticketNo}</span>
            </td>
            <td className={tdClass}>{t.subject}</td>
            <td className={tdClass}>{CATEGORY_LABELS[t.category]}</td>
            <td className={tdClass}>
              <Badge status={STATUS_VIEW[t.status].badge}>{STATUS_VIEW[t.status].label}</Badge>
            </td>
            <td className={tdClass}>
              <span className="tabular-nums">{formatDateTimeIn(t.updatedAt, timeZone)}</span>
            </td>
          </tr>
        ))}
      </TableShell>
      {tickets.data && tickets.data.total > 0 && (
        <Pager
          total={tickets.data.total}
          page={page}
          pageSize={PAGE_SIZE}
          onPage={setPage}
          noun="tickets"
        />
      )}
    </Card>
  );
}
