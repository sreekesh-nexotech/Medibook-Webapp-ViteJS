import { useState } from 'react';

import { useSort } from '@/shared/hooks/useSort';
import { cn } from '@/shared/lib/cn';
import { downloadCsv } from '@/shared/lib/download';
import { fmtDate } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import { InfoDot } from '@/shared/ui/InfoDot';
import { OpsEntity } from '@/shared/ui/OpsEntity';
import { Pager } from '@/shared/ui/Pager';
import { SearchField } from '@/shared/ui/SearchField';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';
import { toast } from '@/shared/ui/toast/toast.store';

import { hospName } from '@/features/ops-hospitals/application/store/hospitals.store';

import type {
  LoginResult,
  StaffLogin,
} from '@/features/ops-compliance/application/store/compliance.types';
import { ComplianceDateInput } from '@/features/ops-compliance/presentation/components/ComplianceDateInput';

const PAGE_SIZE = 10;

const COLUMNS = ['User', 'Instance', 'When', 'IP address', 'Device', 'Result'] as const;

const ALL = 'All';
const OPS_CONSOLE = 'Ops console';

/** Result → the status token whose tint already means that, plus the glyph. */
const RESULT_STATUS: Readonly<Record<LoginResult, string>> = {
  Success: 'Success',
  Failed: 'Failed',
  'Locked out': 'On Hold',
};

interface LoginHistoryCardProps {
  logins: readonly StaffLogin[];
}

/** Where a sign-in happened: one hospital instance, or the ops console. */
function instanceLabel(hid: number | null): string {
  return hid == null ? OPS_CONSOLE : hospName(hid);
}

/**
 * Staff login history (audit 2.5 / SA-06) — who signed in, when, from which
 * IP and device, with what result, and against which hospital or the
 * operations console. Filterable by date range, user, instance and result;
 * the filtered view exports as a real CSV.
 *
 * Deliberately the same toolbar/table treatment as `OpsLogsScreen`, so the
 * two log screens read as one product.
 */
export function LoginHistoryCard({ logins }: LoginHistoryCardProps) {
  const [q, setQ] = useState('');
  const [userF, setUserF] = useState(ALL);
  const [instF, setInstF] = useState(ALL);
  const [resultF, setResultF] = useState(ALL);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);

  const ql = q.trim().toLowerCase();
  const filtered = logins.filter(
    (l) =>
      (!ql ||
        l.user.toLowerCase().includes(ql) ||
        l.name.toLowerCase().includes(ql) ||
        l.ip.includes(ql) ||
        l.device.toLowerCase().includes(ql)) &&
      (userF === ALL || l.user === userF) &&
      (instF === ALL || instanceLabel(l.hid) === instF) &&
      (resultF === ALL || l.result === resultF) &&
      (!from || l.date >= from) &&
      (!to || l.date <= to),
  );

  const { sort, onSort, sorted } = useSort<StaffLogin>();
  const ordered = sorted([...filtered], {
    user: (l) => l.user,
    instance: (l) => instanceLabel(l.hid),
    when: (l) => `${l.date} ${l.time}`,
    ip: (l) => l.ip,
    result: (l) => l.result,
  });
  const pg = Math.min(page, Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1));
  const rows = ordered.slice(pg * PAGE_SIZE, pg * PAGE_SIZE + PAGE_SIZE);

  const userOptions = [ALL, ...new Set(logins.map((l) => l.user))];
  const instOptions = [ALL, ...new Set(logins.map((l) => instanceLabel(l.hid)))];

  const reset =
    (fn: (v: string) => void) =>
    (v: string): void => {
      fn(v);
      setPage(0);
    };
  const filtersActive = Boolean(
    ql || userF !== ALL || instF !== ALL || resultF !== ALL || from || to,
  );
  const clearAll = (): void => {
    setQ('');
    setUserF(ALL);
    setInstF(ALL);
    setResultF(ALL);
    setFrom('');
    setTo('');
    setPage(0);
  };

  const counts = {
    success: filtered.filter((l) => l.result === 'Success').length,
    failed: filtered.filter((l) => l.result === 'Failed').length,
    locked: filtered.filter((l) => l.result === 'Locked out').length,
  };

  /** THE LAW: write the file first, then report exactly what landed. */
  const exportCsv = (): void => {
    downloadCsv('medibook-staff-login-history.csv', [
      [
        'Date',
        'Time',
        'User',
        'Name',
        'Role',
        'Instance',
        'IP address',
        'Device',
        'Result',
        'Reason',
      ],
      ...ordered.map((l) => [
        l.date,
        l.time,
        l.user,
        l.name,
        l.role,
        instanceLabel(l.hid),
        l.ip,
        l.device,
        l.result,
        l.reason ?? '',
      ]),
    ]);
    toast(`Exported ${ordered.length} sign-in attempts as CSV.`, 'success');
  };

  const tableState: TableStateSpec | undefined =
    rows.length === 0
      ? {
          kind: 'empty',
          icon: 'log-in',
          title: filtersActive ? 'No sign-ins match your filters.' : 'No sign-in history yet.',
          message: filtersActive
            ? 'Widen the date range, or clear the filters to see every attempt.'
            : 'Every sign-in to the console and to each hospital instance is recorded here.',
          ...(filtersActive ? { actionLabel: 'Clear filters', onAction: clearAll } : {}),
        }
      : undefined;

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SectionTitle>Staff Login History</SectionTitle>
        <InfoDot text="Every sign-in attempt against the operations console and each hospital instance: who, when, from which IP and device, and whether it succeeded, failed or locked the account out. Retained for 365 days." />
        <div className="flex-1"></div>
        <Button size="sm" variant="secondary" icon="download" onClick={exportCsv}>
          Export CSV
        </Button>
      </div>
      <div className="mb-4">
        <SearchField
          value={q}
          onChange={reset(setQ)}
          placeholder="Search user, name, IP or device"
          aria-label="Search sign-in attempts by user, name, IP or device"
        />
      </div>
      <div className="mb-4.5 flex flex-wrap items-center gap-3">
        <FilterSelect
          value={userF === ALL ? 'User: All' : userF}
          aria-label="Filter by user"
          options={userOptions.map((u) => (u === ALL ? 'User: All' : u))}
          onChange={(v) => reset(setUserF)(v === 'User: All' ? ALL : v)}
        />
        <FilterSelect
          value={instF === ALL ? 'Instance: All' : instF}
          aria-label="Filter by hospital or console"
          options={instOptions.map((h) => (h === ALL ? 'Instance: All' : h))}
          onChange={(v) => reset(setInstF)(v === 'Instance: All' ? ALL : v)}
        />
        <FilterSelect
          value={resultF === ALL ? 'Result: All' : resultF}
          aria-label="Filter by result"
          options={['Result: All', 'Success', 'Failed', 'Locked out']}
          onChange={(v) => reset(setResultF)(v === 'Result: All' ? ALL : v)}
        />
        <ComplianceDateInput value={from} onChange={reset(setFrom)} title="From date" />
        <ComplianceDateInput value={to} onChange={reset(setTo)} title="To date" />
        {filtersActive && (
          <button
            type="button"
            onClick={clearAll}
            className="text-body text-blue cursor-pointer border-none bg-transparent p-0"
          >
            Clear all
          </button>
        )}
        <div className="flex-1"></div>
        <span className="text-caption text-text-muted tabular-nums">
          {filtered.length} attempts · {counts.success} successful · {counts.failed} failed ·{' '}
          {counts.locked} locked out
        </span>
      </div>
      <TableShell
        columns={COLUMNS}
        scrollLabel="Staff sign-in attempts"
        sortKeys={{
          User: 'user',
          Instance: 'instance',
          When: 'when',
          'IP address': 'ip',
          Result: 'result',
        }}
        sort={sort}
        onSort={onSort}
        state={tableState}
      >
        {rows.map((l) => (
          <tr key={l.id}>
            <td className={cn(tdClass, 'max-w-80')}>
              <OpsEntity
                icon={l.result === 'Success' ? 'user-check' : 'user-x'}
                tint={l.result === 'Success' ? 'info' : l.result === 'Failed' ? 'danger' : 'orange'}
                title={l.user}
                sub={`${l.name} · ${l.role}`}
              />
            </td>
            <td className={tdClass}>{instanceLabel(l.hid)}</td>
            <td className={cn(tdClass, 'whitespace-nowrap tabular-nums')}>
              {fmtDate(l.date)} · {l.time}
            </td>
            <td className={cn(tdClass, 'tabular-nums')}>{l.ip}</td>
            <td className={tdClass}>{l.device}</td>
            <td className={tdClass}>
              <div className="flex flex-col items-start gap-1">
                <Badge status={RESULT_STATUS[l.result]}>{l.result}</Badge>
                {l.reason && <span className="text-caption text-text-muted">{l.reason}</span>}
              </div>
            </td>
          </tr>
        ))}
      </TableShell>
      <Pager
        total={filtered.length}
        page={pg}
        pageSize={PAGE_SIZE}
        onPage={setPage}
        noun="sign-in attempts"
      />
    </Card>
  );
}
