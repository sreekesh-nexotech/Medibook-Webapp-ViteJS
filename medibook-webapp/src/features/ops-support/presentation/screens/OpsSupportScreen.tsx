import { useState } from 'react';

import { isFailure } from '@/core/error/failure';
import { useOpsPermission } from '@/shared/hooks/useOpsPermission';
import { useSort } from '@/shared/hooks/useSort';
import { Badge } from '@/shared/ui/Badge';
import { Card } from '@/shared/ui/Card';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import { OpsEntity } from '@/shared/ui/OpsEntity';
import { Pager } from '@/shared/ui/Pager';
import { SearchField } from '@/shared/ui/SearchField';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';
import { ToggleChip } from '@/shared/ui/ToggleChip';

import { useHospitalOptionsQuery } from '@/features/ops-hospitals/application/queries/useHospitalOptionsQuery';
import { useTicketsQuery } from '@/features/ops-support/application/queries/useTicketsQuery';
import type {
  SupportTicket,
  TicketCategory,
  TicketPriority,
  TicketRaisedByKind,
  TicketStatus,
} from '@/features/ops-support/domain/entities/support.entities';
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_RAISERS,
  TICKET_STATUSES,
} from '@/features/ops-support/domain/entities/support.entities';
import {
  TicketDrawer,
  type AssigneeOption,
} from '@/features/ops-support/presentation/components/TicketDrawer';
import {
  ACTIVE_STATUSES,
  assigneeLabel,
  CATEGORY_LABEL,
  normaliseTicketNo,
  PRIORITY_LOOK,
  RAISER_LABEL,
  requesterLine,
  STATUS_LOOK,
} from '@/features/ops-support/presentation/components/support.view';
import { useSupportDebouncedValue } from '@/features/ops-support/presentation/hooks/useSupportDebouncedValue';
import { useOpsStaffQuery } from '@/features/ops-users/application/queries/useOpsStaffQuery';

const PAGE_SIZE = 15;
const SEARCH_DEBOUNCE_MS = 350;

const COLUMNS = ['Ticket', 'Raised by', 'Category', 'Priority', 'Status', 'Assignee', 'Updated'];

const ALL_CATEGORIES = 'Category: All';
const ALL_RAISERS = 'Raised by: Anyone';
const ALL_HOSPITALS = 'Hospital: All';
const ALL_ASSIGNEES = 'Assignee: Anyone';

const DATE_TIME = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

const dateInputClass =
  'rounded-input border-border text-body text-text-body h-11 border bg-white px-3';

const toggle = <T,>(list: readonly T[], value: T, on: boolean): readonly T[] =>
  on ? [...list, value] : list.filter((x) => x !== value);

/**
 * The support desk (UAT-30, ops side): every ticket hospitals and patients
 * raise, filtered by status, priority, category, requester, hospital,
 * assignee, ticket number and date; a ticket opens in a drawer with its
 * conversation, controls and reply box. `support.view`.
 */
export function OpsSupportScreen() {
  const { can } = useOpsPermission();
  const [statuses, setStatuses] = useState<readonly TicketStatus[]>(ACTIVE_STATUSES);
  const [priorities, setPriorities] = useState<readonly TicketPriority[]>([]);
  const [category, setCategory] = useState<TicketCategory | null>(null);
  const [raisedBy, setRaisedBy] = useState<TicketRaisedByKind | null>(null);
  const [hospitalId, setHospitalId] = useState<string | null>(null);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [ticketNo, setTicketNo] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const { sort, onSort } = useSort<SupportTicket>({ key: 'updated', dir: 'desc' });
  const hospitals = useHospitalOptionsQuery();
  const staff = useOpsStaffQuery();
  const debouncedTicketNo = useSupportDebouncedValue(
    normaliseTicketNo(ticketNo),
    SEARCH_DEBOUNCE_MS,
  );

  const assignees: readonly AssigneeOption[] | null =
    can('staff.view') && staff.data
      ? staff.data.items
          .filter((s) => s.status === 'active')
          .map((s) => ({ id: s.id, name: s.name }))
      : null;
  const staffName = (id: string): string | null =>
    staff.data?.items.find((s) => s.id === id)?.name ?? null;

  const tickets = useTicketsQuery({
    page: page + 1,
    pageSize: PAGE_SIZE,
    statuses,
    priorities,
    category,
    raisedByKind: raisedBy,
    hospitalId,
    assignedToId: assigneeId,
    ticketNo: debouncedTicketNo || null,
    dateFrom: dateFrom || null,
    dateTo: dateTo || null,
    sort: sort.key === 'raised' ? 'created_at' : 'updated_at',
    sortDir: sort.dir,
  });
  const rows = tickets.data?.items ?? [];
  const total = tickets.data?.total ?? 0;

  const reset =
    <T,>(fn: (v: T) => void) =>
    (v: T): void => {
      fn(v);
      setPage(0);
    };

  const filtersActive = Boolean(
    priorities.length > 0 ||
    category ||
    raisedBy ||
    hospitalId ||
    assigneeId ||
    ticketNo.trim() ||
    dateFrom ||
    dateTo,
  );
  const clearAll = (): void => {
    setStatuses([]);
    setPriorities([]);
    setCategory(null);
    setRaisedBy(null);
    setHospitalId(null);
    setAssigneeId(null);
    setTicketNo('');
    setDateFrom('');
    setDateTo('');
    setPage(0);
  };

  const tableState: TableStateSpec | undefined = tickets.isPending
    ? { kind: 'loading', rows: 6 }
    : tickets.isError
      ? {
          kind: 'error',
          message: isFailure(tickets.error) ? tickets.error.message : undefined,
          onRetry: () => void tickets.refetch(),
        }
      : rows.length === 0
        ? {
            kind: 'empty',
            icon: 'life-buoy',
            title: filtersActive ? 'No tickets match your filters.' : 'No tickets here.',
            message: filtersActive
              ? 'The ticket number must match exactly. Widen the dates or clear the filters.'
              : 'Tickets hospitals and patients raise appear here.',
            ...(filtersActive || statuses.length > 0
              ? { actionLabel: 'Show every ticket', onAction: clearAll }
              : {}),
          }
        : undefined;

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-caption text-text-muted mr-1">Status</span>
          {TICKET_STATUSES.map((s) => (
            <ToggleChip
              key={s}
              pressed={statuses.includes(s)}
              onChange={(on) => reset(setStatuses)(toggle(statuses, s, on))}
            >
              {STATUS_LOOK[s].label}
            </ToggleChip>
          ))}
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-caption text-text-muted mr-1">Priority</span>
          {TICKET_PRIORITIES.map((p) => (
            <ToggleChip
              key={p}
              pressed={priorities.includes(p)}
              onChange={(on) => reset(setPriorities)(toggle(priorities, p, on))}
            >
              {PRIORITY_LOOK[p].label}
            </ToggleChip>
          ))}
        </div>
        <div className="mb-4.5 flex flex-wrap items-center gap-3">
          <div className="w-64">
            <SearchField
              value={ticketNo}
              onChange={reset(setTicketNo)}
              placeholder="Ticket no., e.g. TKT-2026-0001"
              aria-label="Find a ticket by its exact number"
            />
          </div>
          <FilterSelect
            value={category ? CATEGORY_LABEL[category] : ALL_CATEGORIES}
            options={[ALL_CATEGORIES, ...TICKET_CATEGORIES.map((c) => CATEGORY_LABEL[c])]}
            onChange={(v) =>
              reset(setCategory)(TICKET_CATEGORIES.find((c) => CATEGORY_LABEL[c] === v) ?? null)
            }
            aria-label="Filter by category"
          />
          <FilterSelect
            value={raisedBy ? RAISER_LABEL[raisedBy] : ALL_RAISERS}
            options={[ALL_RAISERS, ...TICKET_RAISERS.map((r) => RAISER_LABEL[r])]}
            onChange={(v) =>
              reset(setRaisedBy)(TICKET_RAISERS.find((r) => RAISER_LABEL[r] === v) ?? null)
            }
            aria-label="Filter by who raised the ticket"
          />
          {hospitals.canView && (
            <FilterSelect
              value={hospitals.options.find((h) => h.id === hospitalId)?.name ?? ALL_HOSPITALS}
              options={[ALL_HOSPITALS, ...hospitals.options.map((h) => h.name)]}
              onChange={(v) =>
                reset(setHospitalId)(hospitals.options.find((h) => h.name === v)?.id ?? null)
              }
              aria-label="Filter by hospital"
            />
          )}
          {assignees && (
            <FilterSelect
              value={assignees.find((a) => a.id === assigneeId)?.name ?? ALL_ASSIGNEES}
              options={[ALL_ASSIGNEES, ...assignees.map((a) => a.name)]}
              onChange={(v) =>
                reset(setAssigneeId)(assignees.find((a) => a.name === v)?.id ?? null)
              }
              aria-label="Filter by assignee"
            />
          )}
          <input
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(e) => reset(setDateFrom)(e.target.value)}
            title="Raised on or after"
            aria-label="Raised from"
            className={dateInputClass}
          />
          <input
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => reset(setDateTo)(e.target.value)}
            title="Raised on or before"
            aria-label="Raised to"
            className={dateInputClass}
          />
          {(filtersActive || statuses.length > 0) && (
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
          sortKeys={{ Updated: 'updated', Ticket: 'raised' }}
          sort={sort}
          onSort={(key) => {
            onSort(key);
            setPage(0);
          }}
          state={tableState}
        >
          {rows.map((t) => (
            <tr
              key={t.id}
              onClick={() => setOpenId(t.id)}
              className="hover:bg-grey-200 cursor-pointer transition-colors duration-150"
            >
              <td className={`${tdClass} max-w-90`}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenId(t.id);
                  }}
                  className="w-full cursor-pointer border-none bg-transparent p-0 text-left"
                  aria-label={`Open ticket ${t.ticketNo}`}
                >
                  <OpsEntity
                    icon="life-buoy"
                    tint={t.priority === 'urgent' ? 'danger' : 'info'}
                    title={t.subject}
                    sub={`${t.ticketNo} · raised ${DATE_TIME.format(new Date(t.createdAt))}`}
                  />
                </button>
              </td>
              <td className={tdClass}>{requesterLine(t)}</td>
              <td className={tdClass}>{CATEGORY_LABEL[t.category]}</td>
              <td className={tdClass}>
                <Badge status={PRIORITY_LOOK[t.priority].badge}>
                  {PRIORITY_LOOK[t.priority].label}
                </Badge>
              </td>
              <td className={tdClass}>
                <Badge status={STATUS_LOOK[t.status].badge}>{STATUS_LOOK[t.status].label}</Badge>
              </td>
              <td className={tdClass}>{assigneeLabel(t, staffName)}</td>
              <td className={tdClass}>{DATE_TIME.format(new Date(t.updatedAt))}</td>
            </tr>
          ))}
        </TableShell>
        <Pager total={total} page={page} pageSize={PAGE_SIZE} onPage={setPage} noun="tickets" />
      </Card>
      <TicketDrawer ticketId={openId} assignees={assignees} onClose={() => setOpenId(null)} />
    </div>
  );
}
