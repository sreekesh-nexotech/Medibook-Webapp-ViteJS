import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { opsPath } from '@/app/router/paths';
import { usePlatformUsersStore } from '@/features/ops-platform-users/application/store/platformUsers.store';
import type { PlatformUser } from '@/features/ops-platform-users/application/store/platformUsers.types';
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

/**
 * How long the re-derive keeps the table in its loading state. The seed store
 * answers instantly, so without this the shared loading rows would flash —
 * same fake-latency convention as `useOpsAct`.
 */
const REFRESH_SETTLE_MS = 420;

const PU_COLUMNS = ['User', 'Phone', 'City', 'Bookings', 'Joined', 'Status', 'Action'] as const;

/** Platform-users KPI tiles (design `OpsPlatformUsers.KPIS`, Ops.jsx). */
const KPIS: readonly StatCardData[] = [
  {
    icon: 'users',
    label: 'Registered Users',
    value: '2,41,300',
    sub: '+8.2% vs last week',
    iconClass: 'bg-blue-soft-bg text-text-navy',
    valueClass: 'text-text-navy',
    subClass: 'text-g-600',
  },
  {
    icon: 'trending-up',
    label: 'Monthly Active',
    value: '86,400',
    sub: '+4.6% vs last week',
    iconClass: 'bg-g-100 text-g-600',
    valueClass: 'text-g-600',
    subClass: 'text-g-600',
  },
  {
    icon: 'user-plus',
    label: 'New This Week',
    value: '4,120',
    sub: '+8.2% vs last week',
    iconClass: 'bg-blue-soft-bg text-blue',
    valueClass: 'text-blue',
    subClass: 'text-g-600',
  },
  {
    icon: 'ban',
    label: 'Blocked Accounts',
    value: '214',
    sub: 'Fraud or abuse reports',
    iconClass: 'bg-badge-noshow-bg text-orange',
    valueClass: 'text-orange',
  },
];

/** Platform users — patient accounts from the Medibook mobile app (design `OpsPlatformUsers`). */
export function OpsPlatformUsersScreen() {
  const users = usePlatformUsersStore((s) => s.users);
  const logView = usePlatformUsersStore((s) => s.logView);
  const refreshUsers = usePlatformUsersStore((s) => s.refresh);
  const navigate = useNavigate();

  const [q, setQ] = useState('');
  const [statusF, setStatusF] = useState('All');
  const [page, setPage] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const ql = q.trim().toLowerCase();
  const filtered = users.filter(
    (u) =>
      (!ql ||
        u.name.toLowerCase().includes(ql) ||
        u.email.toLowerCase().includes(ql) ||
        u.city.toLowerCase().includes(ql)) &&
      (statusF === 'All' || u.status === statusF),
  );
  const pg = Math.min(page, Math.max(0, Math.ceil(filtered.length / OPS_PU_PAGE) - 1));
  const { sort, onSort, sorted } = useSort<PlatformUser>();
  const orderedPu = sorted([...filtered], {
    name: (u) => u.name,
    phone: (u) => u.phone,
    city: (u) => u.city,
    bookings: (u) => u.bookings,
    joined: (u) => Date.parse(u.joined) || 0,
    status: (u) => u.status,
  });
  const rows = orderedPu.slice(pg * OPS_PU_PAGE, pg * OPS_PU_PAGE + OPS_PU_PAGE);

  const reset =
    (fn: (v: string) => void) =>
    (v: string): void => {
      fn(v);
      setPage(0);
    };
  const filtersActive = Boolean(ql || statusF !== 'All');
  const clearAll = (): void => {
    setQ('');
    setStatusF('All');
    setPage(0);
  };
  const view = (u: PlatformUser): void => {
    logView(u.email);
    navigate(`${opsPath('platform-users')}/${u.id}`);
  };

  /**
   * Audit 3.1.1 — a real re-derive, not a toast: the store rebuilds the
   * roster from the seed plus every block/unblock recorded here, the list
   * returns to page 1, and the table shows the shared loading state while it
   * runs.
   */
  const handleRefresh = async (): Promise<void> => {
    setRefreshing(true);
    refreshUsers();
    setPage(0);
    await new Promise<void>((resolve) => setTimeout(resolve, REFRESH_SETTLE_MS));
    setRefreshing(false);
  };

  const tableState: TableStateSpec | undefined = refreshing
    ? { kind: 'loading', rows: OPS_PU_PAGE }
    : rows.length === 0
      ? {
          kind: 'empty',
          icon: 'users',
          title: filtersActive ? 'No results match your filters.' : 'No patient accounts yet.',
          message: filtersActive
            ? 'Search matches name, email and city — clear the filters to see every account.'
            : 'Accounts appear here as people register in the Medibook patient app.',
          ...(filtersActive ? { actionLabel: 'Clear filters', onAction: clearAll } : {}),
        }
      : undefined;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-4">
        {KPIS.map((k) => (
          <StatCard key={k.label} k={k} />
        ))}
      </div>
      <Card>
        <div className="mb-4">
          <SearchField
            value={q}
            onChange={reset(setQ)}
            placeholder="Search user, email or city"
            aria-label="Search patient accounts by user, email or city"
          />
        </div>
        <div className="mb-4.5 flex flex-wrap items-center gap-3">
          <RefreshBtn onRefresh={handleRefresh} title="Refresh patient accounts" />
          <FilterSelect
            value={statusF === 'All' ? 'Status: All' : statusF}
            aria-label="Filter by account status"
            options={['All', 'Active', 'Blocked'].map((x) => (x === 'All' ? 'Status: All' : x))}
            onChange={(v) => reset(setStatusF)(v === 'Status: All' ? 'All' : v)}
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
          sortKeys={{
            User: 'name',
            Phone: 'phone',
            City: 'city',
            Bookings: 'bookings',
            Joined: 'joined',
            Status: 'status',
          }}
          sort={sort}
          onSort={onSort}
          state={tableState}
        >
          {rows.map((u) => (
            <tr
              key={u.id}
              onClick={() => view(u)}
              className="hover:bg-grey-200 cursor-pointer transition-colors duration-150"
            >
              <td className={tdClass}>
                <OpsPerson row={u} />
              </td>
              <td className={`${tdClass} tabular-nums`}>{u.phone}</td>
              <td className={tdClass}>{u.city}</td>
              <td className={`${tdClass} text-right tabular-nums`}>{u.bookings}</td>
              <td className={tdClass}>{u.joined}</td>
              <td className={tdClass}>
                <Badge status={u.status} />
              </td>
              <td className={tdClass} onClick={(e) => e.stopPropagation()}>
                <IconBtn
                  name="eye"
                  box={36}
                  size={16}
                  label="View account (logged)"
                  title={`View ${u.name}'s account — this view is written to Compliance Logs`}
                  onClick={() => view(u)}
                />
              </td>
            </tr>
          ))}
        </TableShell>
        <Pager
          total={filtered.length}
          page={pg}
          pageSize={OPS_PU_PAGE}
          onPage={setPage}
          noun="users"
        />
      </Card>
    </div>
  );
}
