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
  userName,
} from '@/features/ops-platform-users/presentation/components/platformUsersFormat';
import { useSort } from '@/shared/hooks/useSort';
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

const PU_COLUMNS = ['User', 'Phone', 'City', 'Bookings', 'Joined', 'Status', 'Action'] as const;

/** The one column the server can sort — registration date. */
const JOINED_SORT_KEY = 'joined';

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
    sort: sort.key === JOINED_SORT_KEY ? (sort.dir === 'asc' ? 'created_at' : '-created_at') : null,
    page: page + 1,
    pageSize: OPS_PU_PAGE,
  };
  const list = usePlatformUsersQuery(params);
  const registered = usePlatformUserCountQuery(null);
  const blockedCount = usePlatformUserCountQuery('blocked');

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
      value: NO_VALUE,
      sub: NOT_AVAILABLE_SUB,
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
    await Promise.all([list.refetch(), registered.refetch(), blockedCount.refetch()]);
  };

  const tableState: TableStateSpec | undefined = list.isPending
    ? { kind: 'loading', rows: OPS_PU_PAGE }
    : list.isLoadingError
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
        <div className="mb-4">
          <SearchField
            value={q}
            onChange={reset(setQ)}
            placeholder="Search email or phone"
            aria-label="Search patient accounts by email or phone"
          />
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
          sortKeys={{ Joined: JOINED_SORT_KEY }}
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
                <td className={tdClass}>{NO_VALUE}</td>
                <td className={`${tdClass} text-right tabular-nums`}>{NO_VALUE}</td>
                <td className={tdClass}>{formatDate(u.createdAt)}</td>
                <td className={tdClass}>
                  <Badge status={pill.badge}>{pill.label}</Badge>
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
