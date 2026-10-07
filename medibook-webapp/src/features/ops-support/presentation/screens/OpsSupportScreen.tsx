import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { opsSupportTicketPath } from '@/app/router/paths';
import { isFailure } from '@/core/error/failure';
import { useSupportTicketCountQuery } from '@/features/ops-support/application/queries/useSupportTicketCountQuery';
import { useSupportTicketsQuery } from '@/features/ops-support/application/queries/useSupportTicketsQuery';
import type {
  SupportTicket,
  TicketCategory,
  TicketListParams,
  TicketPriority,
  TicketStatus,
} from '@/features/ops-support/domain/entities/support.entities';
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  UNRESOLVED_STATUSES,
} from '@/features/ops-support/domain/entities/support.entities';
import {
  CATEGORY_LABELS,
  NO_VALUE,
  PRIORITY_PILLS,
  STATUS_PILLS,
  formatDateTime,
} from '@/features/ops-support/presentation/components/supportFormat';
import { TicketRequester } from '@/features/ops-support/presentation/components/TicketRequester';
import { useSort } from '@/shared/hooks/useSort';
import { Badge } from '@/shared/ui/Badge';
import { Card } from '@/shared/ui/Card';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import { IconBtn } from '@/shared/ui/IconBtn';
import { Pager } from '@/shared/ui/Pager';
import { RefreshBtn } from '@/shared/ui/RefreshBtn';
import { SearchField } from '@/shared/ui/SearchField';
import { StatCard } from '@/shared/ui/StatCard';
import type { StatCardData } from '@/shared/ui/StatCard';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';

const PAGE_SIZE = 20;

/** Wait this long after the last keystroke before looking a ticket number up. */
const SEARCH_DEBOUNCE_MS = 300;

const COLUMNS = ['Ticket', 'From', 'Topic', 'Priority', 'Status', 'Updated', 'Action'] as const;

/** Columns the server can sort, and the field each sorts by. */
const SORT_FIELDS: Readonly<Record<string, string>> = { Updated: 'updated_at' };
const DEFAULT_SORT = '-updated_at';

const UNRESOLVED_LABEL = 'Status: Unresolved';
const ALL_STATUSES_LABEL = 'Status: All';
const ALL_PRIORITIES_LABEL = 'Priority: All';
const ALL_TOPICS_LABEL = 'Topic: All';

const OPEN_ONLY: readonly TicketStatus[] = ['open'];
const IN_PROGRESS_ONLY: readonly TicketStatus[] = ['in_progress'];
const WAITING_ONLY: readonly TicketStatus[] = ['waiting_on_requester'];

function countValue(count: number | undefined): string {
  return count === undefined ? NO_VALUE : count.toLocaleString('en-IN');
}

function statusesFor(filter: string): readonly TicketStatus[] {
  if (filter === UNRESOLVED_LABEL) return UNRESOLVED_STATUSES;
  return TICKET_STATUSES.filter((s) => STATUS_PILLS[s].label === filter);
}

/**
 * Support inbox (OBS-02): every ticket raised from a hospital's Help & Support
 * screen or the patient app. Unresolved tickets first; a ticket opens to its
 * thread, where ops replies (emailed to the requester) and sets its status.
 */
export function OpsSupportScreen() {
  const navigate = useNavigate();
  const [statusF, setStatusF] = useState(UNRESOLVED_LABEL);
  const [priorityF, setPriorityF] = useState(ALL_PRIORITIES_LABEL);
  const [topicF, setTopicF] = useState(ALL_TOPICS_LABEL);
  const [ticketNo, setTicketNo] = useState('');
  const [searchNo, setSearchNo] = useState('');
  const [page, setPage] = useState(0);
  const { sort, onSort } = useSort<SupportTicket>();

  useEffect(() => {
    const id = setTimeout(() => setSearchNo(ticketNo.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [ticketNo]);

  const sortField = sort.key ? SORT_FIELDS[sort.key] : undefined;
  const priority: TicketPriority | null =
    TICKET_PRIORITIES.find((p) => PRIORITY_PILLS[p].label === priorityF) ?? null;
  const category: TicketCategory | null =
    TICKET_CATEGORIES.find((c) => CATEGORY_LABELS[c] === topicF) ?? null;
  const params: TicketListParams = {
    statuses: statusesFor(statusF),
    priority,
    category,
    ticketNo: searchNo,
    sort: sortField ? `${sort.dir === 'asc' ? '' : '-'}${sortField}` : DEFAULT_SORT,
    page: page + 1,
    pageSize: PAGE_SIZE,
  };
  const list = useSupportTicketsQuery(params);
  const open = useSupportTicketCountQuery(OPEN_ONLY);
  const inProgress = useSupportTicketCountQuery(IN_PROGRESS_ONLY);
  const waiting = useSupportTicketCountQuery(WAITING_ONLY);

  const kpis: readonly StatCardData[] = [
    {
      icon: 'life-buoy',
      label: 'New',
      value: countValue(open.data),
      sub: 'Not picked up yet',
      iconClass: 'bg-badge-queue-bg text-badge-queue-fg',
      valueClass: 'text-text-navy',
      subClass: 'text-text-muted',
    },
    {
      icon: 'headset',
      label: 'In progress',
      value: countValue(inProgress.data),
      sub: 'Being worked on',
      iconClass: 'bg-blue-soft-bg text-blue',
      valueClass: 'text-blue',
      subClass: 'text-text-muted',
    },
    {
      icon: 'hourglass',
      label: 'Waiting on requester',
      value: countValue(waiting.data),
      sub: 'Back to us when they reply',
      iconClass: 'bg-grey-200 text-text-muted',
      valueClass: 'text-text-strong',
      subClass: 'text-text-muted',
    },
  ];

  const rows = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  // A status change elsewhere can shrink the list under the current page.
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
  if (list.data && !list.isPlaceholderData && page > lastPage) setPage(lastPage);

  const reset =
    (fn: (v: string) => void) =>
    (v: string): void => {
      fn(v);
      setPage(0);
    };
  const filtersActive =
    statusF !== UNRESOLVED_LABEL ||
    priorityF !== ALL_PRIORITIES_LABEL ||
    topicF !== ALL_TOPICS_LABEL ||
    ticketNo.trim() !== '';
  const clearAll = (): void => {
    setStatusF(UNRESOLVED_LABEL);
    setPriorityF(ALL_PRIORITIES_LABEL);
    setTopicF(ALL_TOPICS_LABEL);
    setTicketNo('');
    setSearchNo('');
    setPage(0);
  };
  const handleSort = (key: string): void => {
    onSort(key);
    setPage(0);
  };
  const view = (t: SupportTicket): void => {
    void navigate(opsSupportTicketPath(t.id));
  };
  const handleRefresh = async (): Promise<void> => {
    await Promise.all([list.refetch(), open.refetch(), inProgress.refetch(), waiting.refetch()]);
  };

  const tableState: TableStateSpec | undefined = list.isPending
    ? { kind: 'loading', rows: 6 }
    : list.isLoadingError
      ? {
          kind: 'error',
          error: list.error,
          title: "Support tickets didn't load",
          message: isFailure(list.error) ? list.error.message : undefined,
          onRetry: () => void list.refetch(),
        }
      : rows.length === 0
        ? {
            kind: 'empty',
            icon: 'life-buoy',
            title: filtersActive ? 'No tickets match your filters.' : 'No tickets waiting.',
            message: filtersActive
              ? 'Clear the filters to see every unresolved ticket.'
              : 'New tickets from hospitals and the patient app appear here.',
            ...(filtersActive ? { actionLabel: 'Clear filters', onAction: clearAll } : {}),
          }
        : undefined;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-4">
        {kpis.map((k) => (
          <StatCard key={k.label} k={k} />
        ))}
      </div>
      <Card>
        <div className="mb-4">
          <SearchField
            value={ticketNo}
            onChange={reset(setTicketNo)}
            placeholder="Find a ticket number, e.g. TKT-2026-0042"
            aria-label="Find a support ticket by its number"
          />
        </div>
        <div className="mb-4.5 flex flex-wrap items-center gap-3">
          <RefreshBtn onRefresh={handleRefresh} title="Refresh support tickets" />
          <FilterSelect
            value={statusF}
            aria-label="Filter by status"
            options={[
              UNRESOLVED_LABEL,
              ALL_STATUSES_LABEL,
              ...TICKET_STATUSES.map((s) => STATUS_PILLS[s].label),
            ]}
            onChange={reset(setStatusF)}
          />
          <FilterSelect
            value={priorityF}
            aria-label="Filter by priority"
            options={[
              ALL_PRIORITIES_LABEL,
              ...TICKET_PRIORITIES.map((p) => PRIORITY_PILLS[p].label),
            ]}
            onChange={reset(setPriorityF)}
          />
          <FilterSelect
            value={topicF}
            aria-label="Filter by topic"
            options={[ALL_TOPICS_LABEL, ...TICKET_CATEGORIES.map((c) => CATEGORY_LABELS[c])]}
            onChange={reset(setTopicF)}
          />
          {filtersActive && (
            <button
              type="button"
              onClick={clearAll}
              className="text-body text-blue cursor-pointer border-none bg-transparent p-0"
            >
              Clear all
            </button>
          )}
        </div>
        <TableShell
          columns={COLUMNS}
          scrollLabel="Support tickets"
          sortKeys={{ Updated: 'Updated' }}
          sort={sort}
          onSort={handleSort}
          state={tableState}
          busy={list.isPlaceholderData}
        >
          {rows.map((t) => {
            const status = STATUS_PILLS[t.status];
            const prio = PRIORITY_PILLS[t.priority];
            return (
              <tr
                key={t.id}
                onClick={() => view(t)}
                className="hover:bg-grey-200 cursor-pointer transition-colors duration-150"
              >
                <td className={tdClass}>
                  <div className="text-text-strong font-semibold tabular-nums">{t.ticketNo}</div>
                  <div className="text-caption text-text-muted max-w-80 truncate">{t.subject}</div>
                </td>
                <td className={tdClass}>
                  <TicketRequester ticket={t} />
                </td>
                <td className={tdClass}>{CATEGORY_LABELS[t.category]}</td>
                <td className={tdClass}>
                  <Badge status={prio.badge}>{prio.label}</Badge>
                </td>
                <td className={tdClass}>
                  <Badge status={status.badge}>{status.label}</Badge>
                </td>
                <td className={`${tdClass} whitespace-nowrap`}>{formatDateTime(t.updatedAt)}</td>
                <td className={tdClass} onClick={(e) => e.stopPropagation()}>
                  <IconBtn
                    name="eye"
                    box={36}
                    size={16}
                    label={`Open ticket ${t.ticketNo}`}
                    title={`Open ticket ${t.ticketNo}`}
                    onClick={() => view(t)}
                  />
                </td>
              </tr>
            );
          })}
        </TableShell>
        <Pager total={total} page={page} pageSize={PAGE_SIZE} onPage={setPage} noun="tickets" />
      </Card>
    </div>
  );
}
