import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useSort } from '@/shared/hooks/useSort';
import { money } from '@/shared/lib/format';
import { Avatar } from '@/shared/ui/Avatar';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Can } from '@/shared/ui/Can';
import { Card } from '@/shared/ui/Card';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import { IconBtn } from '@/shared/ui/IconBtn';
import { Pager } from '@/shared/ui/Pager';
import { RefreshBtn } from '@/shared/ui/RefreshBtn';
import { SearchField } from '@/shared/ui/SearchField';
import { tdClass, TableShell } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';
import { Tabs } from '@/shared/ui/Tabs';
import { toast } from '@/shared/ui/toast/toast.store';

import { isFailure } from '@/core/error/failure';

import {
  hospitalPath,
  HOSPITAL_VIEW_SEGMENT,
  isHospitalRole,
  type HospitalRole,
} from '@/app/router/paths';

import { formatUpdatedAt } from '@/features/appointments/application/queries/useListRefresh';
import {
  useApproveMutation,
  useCheckInMutation,
} from '@/features/appointments/application/queries/appointments.mutations';
import { useAppointmentsQuery } from '@/features/appointments/application/queries/appointments.queries';
import type { DeskAppointment } from '@/features/appointments/domain/entities/appointments.entities';
import { AppointmentDrawer } from '@/features/appointments/presentation/components/AppointmentDrawer';
import { AppointmentPaymentModal } from '@/features/appointments/presentation/components/AppointmentPaymentModal';
import { AppointmentReceiptModal } from '@/features/appointments/presentation/components/AppointmentReceiptModal';
import {
  DATE_WINDOWS,
  isInQueue,
  localIso,
  needsApproval,
  needsPayment,
  paymentBadge,
  PRIMARY_ACTION_PERMISSION,
  primaryAction,
  rangeFor,
  SOURCE_LABEL,
  STATUS_FILTER_OPTIONS,
  STATUS_LABEL,
  dayOf,
  timeOf,
  type DateWindow,
} from '@/features/appointments/presentation/components/appointments.view';
import { useDepartmentsQuery } from '@/features/doctors/application/queries/useDepartmentsQuery';
import { useDoctorsQuery } from '@/features/doctors/application/queries/useDoctorsQuery';

function failureText(error: unknown, fallback: string): string {
  return isFailure(error) ? error.message : fallback;
}

const APPT_TABS = ['All', 'Online', 'Walk-in', 'Pending Payment', 'In Queue', 'Needs Approval'];
const APPT_PAGE = 8;

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

/**
 * Appointments list — tabs, filters, sortable table, drawer + payment and
 * receipt chain (design `Screens.jsx` `Appointments`), on the hospital API.
 * The selected date window (Today / Tomorrow / This Week / an exact date) is
 * fetched in full; tabs, search and the other filters work on it locally so
 * the tab counts stay exact.
 */
export function AppointmentsScreen() {
  const navigate = useNavigate();
  const roleParam = useParams().role;
  const role: HospitalRole = isHospitalRole(roleParam) ? roleParam : 'receptionist';

  const [tab, setTab] = useState('All');
  const [q, setQ] = useState('');
  const [dateF, setDateF] = useState<DateWindow>('Today');
  const [docF, setDocF] = useState('All Doctors');
  const [statusF, setStatusF] = useState('All Status');
  const [deptF, setDeptF] = useState('All Departments');
  const [exact, setExact] = useState('');
  const [page, setPage] = useState(0);
  const { sort, onSort, sorted } = useSort<DeskAppointment>();
  const [drawer, setDrawer] = useState<string | null>(null);
  const [pay, setPay] = useState<DeskAppointment | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);

  const today = localIso(new Date());
  const range = rangeFor(dateF, exact, today);
  const query = useAppointmentsQuery(range);
  const appts = useMemo(() => query.data ?? [], [query.data]);
  const approve = useApproveMutation();
  const checkIn = useCheckInMutation();
  // Department and doctor filters follow the hospital's own catalogue (H1).
  const departments = (useDepartmentsQuery().data ?? []).map((d) => d.name);
  const doctorNames = (useDoctorsQuery().data ?? []).map((d) => d.name);

  const byTab = (a: DeskAppointment) => {
    if (tab === 'Online') return a.source === 'online';
    if (tab === 'Walk-in') return a.source === 'walk_in';
    if (tab === 'Pending Payment') return needsPayment(a);
    if (tab === 'In Queue') return isInQueue(a);
    if (tab === 'Needs Approval') return needsApproval(a);
    return true;
  };
  const counts: Record<string, number> = {
    Online: appts.filter((a) => a.source === 'online').length,
    'Walk-in': appts.filter((a) => a.source === 'walk_in').length,
    'Pending Payment': appts.filter(needsPayment).length,
    'In Queue': appts.filter(isInQueue).length,
    'Needs Approval': appts.filter(needsApproval).length,
  };
  const ql = q.trim().toLowerCase();
  const filtered = appts.filter((a) => {
    if (!byTab(a)) return false;
    const hay = `${a.patient?.fullName ?? ''} ${a.patient?.mrn ?? ''} ${a.tokenLabel ?? ''} ${a.bookingRef}`;
    if (ql && !hay.toLowerCase().includes(ql)) return false;
    if (deptF !== 'All Departments' && a.department.name !== deptF) return false;
    if (docF !== 'All Doctors' && a.doctor.name !== docF) return false;
    if (statusF !== 'All Status' && STATUS_LABEL[a.status] !== statusF) return false;
    return true;
  });
  const ordered = sorted(filtered, {
    mrn: (a) => a.patient?.mrn ?? '',
    name: (a) => a.patient?.fullName ?? '',
    doctor: (a) => a.doctor.name,
    source: (a) => a.source,
    time: (a) => a.scheduledStartAt,
    payment: (a) => a.paymentStatus,
    status: (a) => STATUS_LABEL[a.status],
  });
  const pages = Math.max(1, Math.ceil(ordered.length / APPT_PAGE));
  const pg = Math.min(page, pages - 1);
  const rows = ordered.slice(pg * APPT_PAGE, pg * APPT_PAGE + APPT_PAGE);

  const refresh = async (): Promise<void> => {
    await query.refetch();
  };

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

  const doPrimary = (a: DeskAppointment) => {
    const p = primaryAction(a, today);
    if (!p) return;
    const fail = (fallback: string) => (error: unknown) =>
      toast(failureText(error, fallback), 'error');
    if (p.key === 'approve') {
      approve.mutate(
        { id: a.id },
        {
          onSuccess: () => toast('Booking approved', 'success'),
          onError: fail('Could not approve.'),
        },
      );
    } else if (p.key === 'pay') setPay(a);
    else if (p.key === 'checkin') {
      checkIn.mutate(
        { id: a.id },
        { onSuccess: () => toast('Checked in', 'success'), onError: fail('Could not check in.') },
      );
    } else if (p.key === 'receipt') setReceipt(a.id);
    else if (p.key === 'queue') navigate(hospitalPath(role, 'token'));
  };

  /** Loading / empty / error live inside the table body so the header stays put. */
  const tableState: TableStateSpec | undefined = query.isPending
    ? { kind: 'loading', rows: APPT_PAGE }
    : query.isError
      ? {
          kind: 'error',
          message: failureText(query.error, 'Could not load appointments.'),
          onRetry: () => void refresh(),
        }
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
            options={DATE_WINDOWS}
            onChange={reset((v: string) => setDateF(DATE_WINDOWS.find((w) => w === v) ?? 'Today'))}
            aria-label="Filter by date"
          />
          <input
            type="date"
            value={exact}
            onChange={(e) => reset(setExact)(e.target.value)}
            title="Pick a specific date, past or future"
            aria-label="Filter by a specific date"
            className="rounded-input border-border text-body text-text-body h-11 border bg-white px-3"
          />
          <FilterSelect
            value={deptF}
            options={['All Departments', ...departments]}
            onChange={reset(setDeptF)}
            aria-label="Filter by department"
          />
          <FilterSelect
            value={docF}
            options={['All Doctors', ...doctorNames]}
            onChange={reset(setDocF)}
            aria-label="Filter by doctor"
          />
          <FilterSelect
            value={statusF}
            options={['All Status', ...STATUS_FILTER_OPTIONS]}
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
            Updated {query.dataUpdatedAt ? formatUpdatedAt(query.dataUpdatedAt) : '—'}
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
            const p = primaryAction(a, today);
            const payBadge = paymentBadge(a);
            return (
              <tr
                key={a.id}
                onClick={() => setDrawer(a.id)}
                className="hover:bg-grey-200 cursor-pointer transition-colors duration-150"
              >
                <td className={tdClass}>{a.patient?.mrn ?? '—'}</td>
                <td className={tdClass}>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={a.patient?.fullName ?? '?'} size={30} />
                    <span className="text-text-strong font-medium">
                      {a.patient?.fullName ?? 'Unknown patient'}
                    </span>
                  </div>
                </td>
                <td className={tdClass}>
                  <div className="text-body">{a.doctor.name}</div>
                  <div className="text-caption text-text-muted">{a.department.name}</div>
                </td>
                <td className={tdClass}>
                  <Badge status={SOURCE_LABEL[a.source]} />
                </td>
                <td className={tdClass}>
                  <div>{timeOf(a.scheduledStartAt)}</div>
                  <div className="text-caption text-text-muted">{dayOf(a.scheduledDate)}</div>
                </td>
                <td className={tdClass}>
                  <div className="flex flex-col items-start gap-0.75">
                    <Badge status={payBadge.status}>{payBadge.label}</Badge>
                    <span className="text-caption text-text-muted tabular-nums">
                      {money(a.totalRupees)}
                    </span>
                  </div>
                </td>
                <td className={tdClass}>
                  <div className="flex flex-col items-start gap-0.75">
                    <Badge status={STATUS_LABEL[a.status]} />
                    {needsApproval(a) ? (
                      <span className="text-caption text-y-700 font-semibold">Needs approval</span>
                    ) : (
                      a.tokenLabel && (
                        <span className="text-caption text-blue font-semibold">{a.tokenLabel}</span>
                      )
                    )}
                  </div>
                </td>
                <td className={tdClass} onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    {p && p.key !== 'queue' ? (
                      <Can
                        perm={PRIMARY_ACTION_PERMISSION[p.key]}
                        fallback={<span className="w-1"></span>}
                      >
                        <Button
                          size="sm"
                          variant={p.variant}
                          icon={p.icon}
                          busy={
                            (p.key === 'approve' &&
                              approve.isPending &&
                              approve.variables.id === a.id) ||
                            (p.key === 'checkin' &&
                              checkIn.isPending &&
                              checkIn.variables.id === a.id)
                          }
                          onClick={() => doPrimary(a)}
                        >
                          {p.label}
                        </Button>
                      </Can>
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
        onViewPatient={(mrn) => navigate(`/${role}/${HOSPITAL_VIEW_SEGMENT.patients}/${mrn}`)}
      />
      <AppointmentPaymentModal
        appt={pay}
        onClose={() => setPay(null)}
        onPaid={() => {
          const paidId = pay?.id ?? null;
          setPay(null);
          setReceipt(paidId);
        }}
      />
      <AppointmentReceiptModal appointmentId={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}
