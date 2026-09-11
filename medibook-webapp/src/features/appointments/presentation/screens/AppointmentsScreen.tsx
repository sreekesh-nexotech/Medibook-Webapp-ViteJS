import { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useSort } from '@/shared/hooks/useSort';
import { money, timeToMinutes } from '@/shared/lib/format';
import { Avatar } from '@/shared/ui/Avatar';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import { IconBtn } from '@/shared/ui/IconBtn';
import { Pager } from '@/shared/ui/Pager';
import { RefreshBtn } from '@/shared/ui/RefreshBtn';
import { SearchField } from '@/shared/ui/SearchField';
import { tdClass, TableShell } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';
import { Tabs } from '@/shared/ui/Tabs';

import {
  hospitalPath,
  HOSPITAL_VIEW_SEGMENT,
  isHospitalRole,
  type HospitalRole,
} from '@/app/router/paths';

import {
  formatUpdatedAt,
  useListRefresh,
} from '@/features/appointments/application/queries/useListRefresh';
import { useAppointmentsStore } from '@/features/appointments/application/store/appointments.store';
import {
  isoToRelLocal,
  primaryAction,
  todayISO,
} from '@/features/appointments/application/store/appointments.logic';
import { DEPARTMENTS, DOCTORS } from '@/features/appointments/application/store/appointments.types';
import type { Appointment } from '@/features/appointments/application/store/appointments.types';
import { AppointmentDrawer } from '@/features/appointments/presentation/components/AppointmentDrawer';
import { MarkPaymentModal } from '@/features/appointments/presentation/components/MarkPaymentModal';
import { ReceiptModal } from '@/features/appointments/presentation/components/ReceiptModal';

const APPT_TABS = ['All', 'Online', 'Walk-in', 'Pending Payment', 'In Queue', 'Needs Approval'];
const APPT_PAGE = 8;

/** Grey pill for the `Waived` payment state, which the shared status map predates. */
const WAIVED_PILL_CLASS = 'bg-grey-300 text-text-muted';

const SORT_KEYS: Readonly<Record<string, string | undefined>> = {
  'MR Number': 'mrn',
  Patient: 'name',
  'Doctor / Dept': 'doctor',
  Source: 'source',
  Time: 'time',
  Payment: 'payment',
  Status: 'status',
};

const COLUMNS = [
  'MR Number',
  'Patient',
  'Doctor / Dept',
  'Source',
  'Time',
  'Payment',
  'Status',
  'Action',
];

/** Appointments list — tabs, filters, sortable table, drawer + receipt chain (design `Screens.jsx` `Appointments`). */
export function AppointmentsScreen() {
  const navigate = useNavigate();
  const roleParam = useParams().role;
  const role: HospitalRole = isHospitalRole(roleParam) ? roleParam : 'receptionist';

  const appts = useAppointmentsStore((s) => s.appts);
  const checkIn = useAppointmentsStore((s) => s.checkIn);
  const approve = useAppointmentsStore((s) => s.approve);
  const ensureReceiptNo = useAppointmentsStore((s) => s.ensureReceiptNo);

  const [tab, setTab] = useState('All');
  const [q, setQ] = useState('');
  const [dateF, setDateF] = useState('Today');
  const [docF, setDocF] = useState('All Doctors');
  const [statusF, setStatusF] = useState('All Status');
  const [deptF, setDeptF] = useState('All Departments');
  const [exact, setExact] = useState('');
  const [page, setPage] = useState(0);
  const { sort, onSort, sorted } = useSort<Appointment>();
  const [drawer, setDrawer] = useState<string | null>(null);
  const [pay, setPay] = useState<Appointment | null>(null);
  const [receipt, setReceipt] = useState<Appointment | null>(null);

  /**
   * Audit 3.1.1 — Refresh re-reads the appointment list out of the store and
   * the table below re-derives from it, with the shared loading state while it
   * runs. No toast: the refreshed list is the acknowledgement.
   */
  const reload = useCallback((): void => {
    const fresh = useAppointmentsStore.getState().appts;
    if (!Array.isArray(fresh)) throw new Error('The appointment list is unavailable.');
  }, []);
  const { loading, error, updatedAt, refresh } = useListRefresh(reload);

  const byTab = (a: Appointment) => {
    if (tab === 'Online') return a.source === 'Online';
    if (tab === 'Walk-in') return a.source === 'Walk-in';
    if (tab === 'Pending Payment') return a.payment === 'Pending';
    if (tab === 'In Queue') return a.status === 'In Queue';
    if (tab === 'Needs Approval') return a.needsApproval === true;
    return true;
  };
  const counts: Record<string, number> = {
    Online: appts.filter((a) => a.source === 'Online').length,
    'Walk-in': appts.filter((a) => a.source === 'Walk-in').length,
    'Pending Payment': appts.filter((a) => a.payment === 'Pending').length,
    'In Queue': appts.filter((a) => a.status === 'In Queue').length,
    'Needs Approval': appts.filter((a) => a.needsApproval === true).length,
  };
  const ql = q.trim().toLowerCase();
  const filtered = appts.filter((a) => {
    if (!byTab(a)) return false;
    if (ql && !(a.name + ' ' + a.mrn + ' ' + (a.token || '')).toLowerCase().includes(ql))
      return false;
    if (exact) {
      if (a.date !== isoToRelLocal(exact)) return false;
    } else if (dateF !== 'This Week' && a.date !== dateF) return false;
    if (deptF !== 'All Departments' && a.dept !== deptF) return false;
    if (docF !== 'All Doctors' && a.doctor !== docF) return false;
    if (statusF !== 'All Status' && a.status !== statusF) return false;
    return true;
  });
  const ordered = sorted(filtered, {
    mrn: (a) => a.mrn,
    name: (a) => a.name,
    doctor: (a) => a.doctor,
    source: (a) => a.source,
    time: (a) => timeToMinutes(a.time),
    payment: (a) => a.payment,
    status: (a) => a.status,
  });
  const pages = Math.max(1, Math.ceil(ordered.length / APPT_PAGE));
  const pg = Math.min(page, pages - 1);
  const rows = ordered.slice(pg * APPT_PAGE, pg * APPT_PAGE + APPT_PAGE);

  const reset =
    <T,>(fn: (v: T) => void) =>
    (v: T) => {
      fn(v);
      setPage(0);
    };
  const tabLabel = (t: string) => {
    const c = counts[t];
    return c != null ? `${t} (${c})` : t;
  };
  const filtersActive =
    ql !== '' ||
    exact !== '' ||
    dateF !== 'Today' ||
    deptF !== 'All Departments' ||
    docF !== 'All Doctors' ||
    statusF !== 'All Status';
  const clearAll = () => {
    setQ('');
    setExact('');
    setDateF('Today');
    setDeptF('All Departments');
    setDocF('All Doctors');
    setStatusF('All Status');
    setPage(0);
  };

  /** Minting on the way in keeps the receipt number out of render and stable. */
  const openReceipt = (a: Appointment): void => {
    ensureReceiptNo(a.id);
    setReceipt(useAppointmentsStore.getState().appts.find((x) => x.id === a.id) ?? a);
  };

  const doPrimary = (a: Appointment) => {
    const p = primaryAction(a);
    if (!p) return;
    if (p.key === 'approve') approve(a.id);
    else if (p.key === 'pay') setPay(a);
    else if (p.key === 'checkin') checkIn(a.id);
    else if (p.key === 'receipt') openReceipt(a);
    else if (p.key === 'queue') navigate(hospitalPath(role, 'token'));
  };

  /** Loading / empty / error live inside the table body so the header stays put. */
  const tableState: TableStateSpec | undefined = loading
    ? { kind: 'loading', rows: APPT_PAGE }
    : error
      ? { kind: 'error', message: error, onRetry: () => void refresh() }
      : rows.length === 0
        ? filtersActive
          ? {
              kind: 'empty',
              title: 'No appointments match your filters.',
              message: 'Nothing is booked for this combination of date, doctor and status.',
              actionLabel: 'Clear filters',
              onAction: clearAll,
            }
          : {
              kind: 'empty',
              icon: 'calendar-plus',
              title: 'No appointments yet.',
              message: 'Book the first one and it will appear here with its token.',
              actionLabel: 'Create appointment',
              onAction: () => navigate(hospitalPath(role, 'create')),
            }
        : undefined;

  return (
    <div className="flex flex-col gap-5">
      <Card pad={14} className="flex flex-wrap items-center justify-between gap-4">
        <Tabs
          tabs={APPT_TABS.map(tabLabel)}
          value={tabLabel(tab)}
          onChange={(v) => reset(setTab)(v.split(' (')[0] ?? v)}
        />
        <Button icon="plus" onClick={() => navigate(hospitalPath(role, 'create'))}>
          New Appointment
        </Button>
      </Card>
      <Card pad={20}>
        <div className="mb-4">
          <SearchField
            value={q}
            onChange={reset(setQ)}
            placeholder="Search by patient name, MR number or token"
          />
        </div>
        <div className="mb-4.5 flex flex-wrap items-center gap-3">
          <RefreshBtn onRefresh={refresh} title="Refresh appointments" />
          <FilterSelect
            value={dateF}
            options={['Today', 'Tomorrow', 'This Week']}
            onChange={reset(setDateF)}
            aria-label="Filter by date"
          />
          <input
            type="date"
            value={exact}
            min={todayISO()}
            onChange={(e) => reset(setExact)(e.target.value)}
            title="Pick a specific date"
            aria-label="Filter by a specific date"
            className="rounded-input border-border text-body text-text-body h-11 border bg-white px-3"
          />
          <FilterSelect
            value={deptF}
            options={['All Departments', ...DEPARTMENTS]}
            onChange={reset(setDeptF)}
            aria-label="Filter by department"
          />
          <FilterSelect
            value={docF}
            options={['All Doctors', ...Object.values(DOCTORS).flat()]}
            onChange={reset(setDocF)}
            aria-label="Filter by doctor"
          />
          <FilterSelect
            value={statusF}
            options={['All Status', 'Scheduled', 'In Queue', 'Completed', 'Cancelled', 'No-show']}
            onChange={reset(setStatusF)}
            aria-label="Filter by status"
          />
          {filtersActive && (
            <button type="button" onClick={clearAll} className="text-body text-blue cursor-pointer">
              Clear all
            </button>
          )}
          <span className="flex-1"></span>
          <span className="text-caption text-text-muted whitespace-nowrap">
            Updated {formatUpdatedAt(updatedAt)}
          </span>
        </div>
        <TableShell
          columns={COLUMNS}
          sortKeys={SORT_KEYS}
          sort={sort}
          onSort={onSort}
          state={tableState}
          scrollLabel="Appointments"
        >
          {rows.map((a) => {
            const p = primaryAction(a);
            return (
              <tr
                key={a.id}
                onClick={() => setDrawer(a.id)}
                className="hover:bg-grey-200 cursor-pointer transition-colors duration-150"
              >
                <td className={tdClass}>{a.mrn}</td>
                <td className={tdClass}>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={a.name} size={30} />
                    <span className="text-text-strong font-medium">{a.name}</span>
                  </div>
                </td>
                <td className={tdClass}>
                  <div className="text-body">{a.doctor}</div>
                  <div className="text-caption text-text-muted">{a.dept}</div>
                </td>
                <td className={tdClass}>
                  <Badge status={a.source} />
                </td>
                <td className={tdClass}>
                  <div>{a.time}</div>
                  <div className="text-caption text-text-muted">{a.date}</div>
                </td>
                <td className={tdClass}>
                  <div className="flex flex-col items-start gap-0.75">
                    <Badge
                      status={a.payment}
                      className={a.payment === 'Waived' ? WAIVED_PILL_CLASS : undefined}
                    />
                    <span className="text-caption text-text-muted tabular-nums">
                      {money(a.amount)}
                    </span>
                  </div>
                </td>
                <td className={tdClass}>
                  <div className="flex flex-col items-start gap-0.75">
                    <Badge status={a.status} />
                    {a.needsApproval ? (
                      <span className="text-caption text-y-700 font-semibold">Needs approval</span>
                    ) : (
                      a.token && (
                        <span className="text-caption text-blue font-semibold">{a.token}</span>
                      )
                    )}
                  </div>
                </td>
                <td className={tdClass} onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    {p && p.key !== 'queue' ? (
                      <Button
                        size="sm"
                        variant={p.variant}
                        icon={p.icon}
                        onClick={() => doPrimary(a)}
                      >
                        {p.label}
                      </Button>
                    ) : (
                      <span className="w-1"></span>
                    )}
                    <IconBtn
                      name="eye"
                      label="Details"
                      box={36}
                      size={16}
                      onClick={() => setDrawer(a.id)}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </TableShell>
        <Pager
          total={filtered.length}
          page={pg}
          pageSize={APPT_PAGE}
          onPage={setPage}
          noun="appointments"
        />
      </Card>
      <AppointmentDrawer
        id={drawer}
        onClose={() => setDrawer(null)}
        onViewPatient={(a) => navigate(`/${role}/${HOSPITAL_VIEW_SEGMENT.patients}/${a.mrn}`)}
      />
      <MarkPaymentModal
        appt={pay}
        onClose={() => setPay(null)}
        onPaid={() => {
          const fresh = pay
            ? (useAppointmentsStore.getState().appts.find((x) => x.id === pay.id) ?? null)
            : null;
          setPay(null);
          setReceipt(fresh);
        }}
      />
      <ReceiptModal appt={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}
