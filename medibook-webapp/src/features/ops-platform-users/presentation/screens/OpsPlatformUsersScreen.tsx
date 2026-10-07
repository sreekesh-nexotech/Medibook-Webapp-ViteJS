import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { opsPath } from '@/app/router/paths';
import { isFailure } from '@/core/error/failure';
import { usePlatformUserCountQuery } from '@/features/ops-platform-users/application/queries/usePlatformUserCountQuery';
import { usePlatformUsersQuery } from '@/features/ops-platform-users/application/queries/usePlatformUsersQuery';
import type {
  PlatformUserListParams,
  PlatformUserStatus,
  PlatformUserSummary,
} from '@/features/ops-platform-users/domain/entities/platformUsers.entities';
import {
  ACCOUNT_STATUS_PILLS,
  NO_VALUE,
  formatDate,
  searchHint,
  userName,
} from '@/features/ops-platform-users/presentation/components/platformUsersFormat';
import { useOpsPermission } from '@/shared/hooks/useOpsPermission';
import { useSort } from '@/shared/hooks/useSort';
import { addDaysISO, todayISO } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Card } from '@/shared/ui/Card';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import { IconBtn } from '@/shared/ui/IconBtn';
import { OpsPerson } from '@/shared/ui/OpsPerson';
import { Pager } from '@/shared/ui/Pager';
import { RefreshBtn } from '@/shared/ui/RefreshBtn';
import { SearchField } from '@/shared/ui/SearchField';
import { StatCard } from '@/shared/ui/StatCard';
import type { StatCardData } from '@/shared/ui/StatCard';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';

const OPS_PU_PAGE = 6;

/** Wait this long after the last keystroke before searching the server. */
const SEARCH_DEBOUNCE_MS = 300;

/** No City column: the backend holds no city for a patient account (13·Platform Users F1). */
const PU_COLUMNS = ['User', 'Phone', 'Bookings', 'Joined', 'Status', 'Action'] as const;

/** Columns the server sorts: registration date, and booking count (B2, BE-31). */
const JOINED_SORT_KEY = 'joined';
const BOOKINGS_SORT_KEY = 'bookings';

/** Days counted as "this week" for the New This Week tile. */
const NEW_WINDOW_DAYS = 7;

const ALL_STATUSES_LABEL = 'Status: All';

/** Filter labels → backend status, in menu order. */
const STATUS_FILTERS: readonly (readonly [string, PlatformUserStatus])[] = [
  ['Active', 'active'],
  ['Blocked', 'blocked'],
  ['Pending deletion', 'pending_deletion'],
  ['Deleted', 'deleted'],
];

/** Sub-line for tiles the backend has no figure for yet. */
const NOT_AVAILABLE_SUB = 'Not available yet';

/** A count tile's value: the number, or an em dash while loading or on error. */
function countValue(count: number | undefined): string {
  return count === undefined ? NO_VALUE : count.toLocaleString('en-IN');
}

/** Platform users — patient accounts from the Medibook mobile app (design `OpsPlatformUsers`). */
export function OpsPlatformUsersScreen() {
  const navigate = useNavigate();
  const unmasked = useOpsPermission().can('platform_users.edit');

  const [q, setQ] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [statusF, setStatusF] = useState('All');
  const [page, setPage] = useState(0);
  const { sort, onSort } = useSort<PlatformUserSummary>();

  useEffect(() => {
    const id = setTimeout(() => setSearchQ(q.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [q]);

  const status = STATUS_FILTERS.find(([label]) => label === statusF)?.[1] ?? null;
  const params: PlatformUserListParams = {
    q: searchQ,
    statuses: status ? [status] : [],
    sort:
      sort.key === JOINED_SORT_KEY
        ? sort.dir === 'asc'
          ? 'created_at'
          : '-created_at'
        : sort.key === BOOKINGS_SORT_KEY
          ? sort.dir === 'asc'
            ? 'booking_count'
            : '-booking_count'
          : null,
    page: page + 1,
    pageSize: OPS_PU_PAGE,
  };
  const list = usePlatformUsersQuery(params);
  const registered = usePlatformUserCountQuery({ status: null, createdFrom: null });
  const blockedCount = usePlatformUserCountQuery({ status: 'blocked', createdFrom: null });
  // B2's `created_from` (BE-31); an older backend answers 400 and the tile says so.
  const newThisWeek = usePlatformUserCountQuery({
    status: null,
    createdFrom: addDaysISO(todayISO(), -NEW_WINDOW_DAYS),
  });

  const kpis: readonly StatCardData[] = [
    {
      icon: 'users',
      label: 'Registered Users',
      value: countValue(registered.data),
      sub: 'All patient accounts',
      iconClass: 'bg-blue-soft-bg text-text-navy',
      valueClass: 'text-text-navy',
      subClass: 'text-text-muted',
    },
    {
      icon: 'trending-up',
      label: 'Monthly Active',
      value: NO_VALUE,
      sub: NOT_AVAILABLE_SUB,
      iconClass: 'bg-g-100 text-g-600',
      valueClass: 'text-g-600',
      subClass: 'text-text-muted',
    },
    {
      icon: 'user-plus',
      label: 'New This Week',
      value: countValue(newThisWeek.data),
      sub: newThisWeek.isError
        ? NOT_AVAILABLE_SUB
        : `Registered in the last ${NEW_WINDOW_DAYS} days`,
      iconClass: 'bg-blue-soft-bg text-blue',
      valueClass: 'text-blue',
      subClass: 'text-text-muted',
    },
    {
      icon: 'ban',
      label: 'Blocked Accounts',
      value: countValue(blockedCount.data),
      sub: 'Fraud or abuse reports',
      iconClass: 'bg-badge-noshow-bg text-orange',
      valueClass: 'text-orange',
    },
  ];

  const rows = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  // A block/unblock or refresh can shrink the result set under the current
  // page — step back to the last page that still has rows.
  const lastPage = Math.max(0, Math.ceil(total / OPS_PU_PAGE) - 1);
  if (list.data && !list.isPlaceholderData && page > lastPage) setPage(lastPage);

  const reset =
    (fn: (v: string) => void) =>
    (v: string): void => {
      fn(v);
      setPage(0);
    };
  const filtersActive = Boolean(q.trim() || statusF !== 'All');
  const clearAll = (): void => {
    setQ('');
    setSearchQ('');
    setStatusF('All');
    setPage(0);
  };
  const handleSort = (key: string): void => {
    onSort(key);
    setPage(0);
  };
  const view = (u: PlatformUserSummary): void => {
    navigate(`${opsPath('platform-users')}/${u.id}`);
  };

  const handleRefresh = async (): Promise<void> => {
    await Promise.all([
      list.refetch(),
      registered.refetch(),
      blockedCount.refetch(),
      newThisWeek.refetch(),
    ]);
  };

  const tableState: TableStateSpec | undefined = list.isPending
    ? { kind: 'loading', rows: OPS_PU_PAGE }
    : list.isError
      ? {
          kind: 'error',
          title: "Patient accounts didn't load",
          message: isFailure(list.error) ? list.error.message : undefined,
          onRetry: () => void list.refetch(),
        }
      : rows.length === 0
        ? {
            kind: 'empty',
            icon: 'users',
            title: filtersActive ? 'No results match your filters.' : 'No patient accounts yet.',
            message: filtersActive
              ? 'Search matches email and phone — clear the filters to see every account.'
              : 'Accounts appear here as people register in the Medibook patient app.',
            ...(filtersActive ? { actionLabel: 'Clear filters', onAction: clearAll } : {}),
          }
        : undefined;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-4">
        {kpis.map((k) => (
          <StatCard key={k.label} k={k} />
        ))}
      </div>
      <Card>
        <div className="mb-4 flex flex-col gap-1.5">
          <SearchField
            value={q}
            onChange={reset(setQ)}
            placeholder={unmasked ? 'Search email or phone' : 'Exact email or phone number'}
            aria-label="Search patient accounts by email or phone"
          />
          <span className="text-caption text-text-muted">{searchHint(unmasked)}</span>
        </div>
        <div className="mb-4.5 flex flex-wrap items-center gap-3">
          <RefreshBtn onRefresh={handleRefresh} title="Refresh patient accounts" />
          <FilterSelect
            value={statusF === 'All' ? ALL_STATUSES_LABEL : statusF}
            aria-label="Filter by account status"
            options={[ALL_STATUSES_LABEL, ...STATUS_FILTERS.map(([label]) => label)]}
            onChange={(v) => reset(setStatusF)(v === ALL_STATUSES_LABEL ? 'All' : v)}
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
          columns={PU_COLUMNS}
          scrollLabel="Patient accounts"
          rightCols={['Bookings']}
          sortKeys={{ Joined: JOINED_SORT_KEY, Bookings: BOOKINGS_SORT_KEY }}
          sort={sort}
          onSort={handleSort}
          state={tableState}
        >
          {rows.map((u) => {
            const name = userName(u);
            const pill = ACCOUNT_STATUS_PILLS[u.status];
            return (
              <tr
                key={u.id}
                onClick={() => view(u)}
                className="hover:bg-grey-200 cursor-pointer transition-colors duration-150"
              >
                <td className={tdClass}>
                  <OpsPerson row={{ name, email: u.email ?? NO_VALUE }} />
                </td>
                <td className={`${tdClass} tabular-nums`}>{u.phone ?? NO_VALUE}</td>
                <td className={`${tdClass} text-right tabular-nums`}>
                  {u.bookingCount === null ? NO_VALUE : u.bookingCount.toLocaleString('en-IN')}
                </td>
                <td className={tdClass}>{formatDate(u.createdAt)}</td>
                <td className={tdClass}>
                  <div className="flex flex-col items-start gap-1">
                    <Badge status={pill.badge}>{pill.label}</Badge>
                    {u.status === 'pending_deletion' && u.deletionRequestedAt && (
                      <span className="text-caption text-text-muted">
                        Requested {formatDate(u.deletionRequestedAt)}
                      </span>
                    )}
                  </div>
                </td>
                <td className={tdClass} onClick={(e) => e.stopPropagation()}>
                  <IconBtn
                    name="eye"
                    box={36}
                    size={16}
                    label="View account"
                    title={`View ${name}'s account`}
                    onClick={() => view(u)}
                  />
                </td>
              </tr>
            );
          })}
        </TableShell>
        <Pager total={total} page={page} pageSize={OPS_PU_PAGE} onPage={setPage} noun="users" />
      </Card>
    </div>
  );
}
