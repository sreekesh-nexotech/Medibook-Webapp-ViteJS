import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import type { SocketStatus } from '@/core/api/socket';
import { useActionKeys } from '@/shared/hooks/useActionKeys';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { useHospitalToday } from '@/shared/hooks/useHospitalTime';
import { useCan } from '@/shared/hooks/usePermission';
import { useSort, type SortState } from '@/shared/hooks/useSort';
import { cn } from '@/shared/lib/cn';
import { money } from '@/shared/lib/format';
import { formatTimeIn } from '@/shared/lib/hospitalTime';
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
  APPOINTMENT_PARAM,
  APPOINTMENTS_TAB_PARAM,
  hospitalPath,
  hospitalTokenForDeptPath,
  HOSPITAL_VIEW_SEGMENT,
  isHospitalRole,
  type HospitalRole,
} from '@/app/router/paths';

import {
  useApproveMutation,
  useCheckInMutation,
} from '@/features/appointments/application/queries/appointments.mutations';
import {
  useAppointmentsPageQuery,
  useAppointmentTabCountsQuery,
} from '@/features/appointments/application/queries/appointments.queries';
import {
  APPOINTMENT_TABS,
  combineFilters,
  isAppointmentTab,
  isStatusChoice,
  STATUS_CHOICE_LABELS,
  TAB_SLUGS,
  tabFromSlug,
  type AppointmentTab,
  type CountedTab,
  type StatusChoice,
} from '@/features/appointments/domain/appointments.listFilters';
import type {
  AppointmentListParams,
  AppointmentSort,
  DeskAppointment,
} from '@/features/appointments/domain/entities/appointments.entities';
import { AppointmentDrawer } from '@/features/appointments/presentation/components/AppointmentDrawer';
import { AppointmentPaymentModal } from '@/features/appointments/presentation/components/AppointmentPaymentModal';
import { AppointmentReceiptModal } from '@/features/appointments/presentation/components/AppointmentReceiptModal';
import {
  DATE_WINDOWS,
  dayOf,
  deskErrorText,
  isDateWindow,
  needsApproval,
  paymentBadge,
  PRIMARY_ACTION_PERMISSION,
  primaryAction,
  rangeFor,
  sourceBadge,
  statusBadge,
  timeOf,
  type DateWindow,
} from '@/features/appointments/presentation/components/appointments.view';
import { uniqueLabels } from '@/features/appointments/presentation/components/createAppointment.view';
import { useDepartmentsQuery } from '@/features/doctors/application/queries/useDepartmentsQuery';
import { useDoctorsQuery } from '@/features/doctors/application/queries/useDoctorsQuery';
import { useQueueLive } from '@/features/token-queue/application/queries/useQueueLive';

function failureText(error: unknown, fallback: string): string {
  return isFailure(error) ? deskErrorText(error, fallback) : fallback;
}

const APPT_PAGE = 8;
const SEARCH_DEBOUNCE_MS = 300;

/** With live pushes the poll is only a safety net; without them it is the update path. */
const LIVE_REFETCH_MS = 60_000;
const POLL_REFETCH_MS = 30_000;

const ALL_DEPTS = 'All Departments';
const ALL_DOCTORS = 'All Doctors';
const ALL_STATUS = 'All Status';

/** The only column the backend sorts on (`hospital_appointment_list.py` allowlist). */
const TIME_SORT_KEY = 'time';
const SORT_KEYS: Readonly<Record<string, string | undefined>> = { Time: TIME_SORT_KEY };
const DEFAULT_SORT: SortState = { key: TIME_SORT_KEY, dir: 'asc' };

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

/** "Needs Approval" links from the dashboards cover every upcoming day (BE-26). */
function initialWindow(tab: AppointmentTab): DateWindow {
  return tab === 'Needs Approval' ? 'Upcoming' : 'Today';
}

/** What the update caption says: live over the queue socket, or polling. */
function liveCaption(canQueue: boolean, socket: SocketStatus) {
  if (canQueue && socket === 'open') {
    return { label: 'Live', title: 'Updates arrive as they happen', dot: 'bg-g-600' };
  }
  return {
    label: 'Auto-refresh',
    title: `The list refreshes every ${POLL_REFETCH_MS / 1000} seconds`,
    dot: 'bg-y-700',
  };
}

/**
 * Appointments list — tabs, filters, table, drawer + payment and receipt
 * chain (design `Screens.jsx` `Appointments`), on the hospital API. Tabs,
 * status, department, doctor, search, sort and paging are all applied by the
 * server, so the list is complete however many bookings a day holds, and
 * each tab's count is the server's own total. The list follows the live
 * queue socket when the role has it and polls otherwise, with the state
 * shown next to the refresh button. `?tab=` and `?appointment=` deep-link a
 * tab or one booking's drawer. Days and times are the hospital's (UAT-47).
 */
export function AppointmentsScreen() {
  const navigate = useNavigate();
  const roleParam = useParams().role;
  const role: HospitalRole = isHospitalRole(roleParam) ? roleParam : 'receptionist';
  const { today, timeZone } = useHospitalToday();
  const canBook = useCan('Appointments.add');
  const canCollect = useCan('Payments.add');
  const canQueue = useCan('Token Management.view');

  const [searchParams, setSearchParams] = useSearchParams();
  const tab = tabFromSlug(searchParams.get(APPOINTMENTS_TAB_PARAM));
  const drawer = searchParams.get(APPOINTMENT_PARAM);
  const setParam = (name: string, value: string | null) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(name, value);
        else next.delete(name);
        return next;
      },
      { replace: true },
    );

  const [q, setQ] = useState('');
  const [dateF, setDateF] = useState<DateWindow>(() => initialWindow(tab));
  const [deptId, setDeptId] = useState<string | null>(null);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [statusF, setStatusF] = useState<StatusChoice | null>(null);
  const [exact, setExact] = useState('');
  const [page, setPage] = useState(0);
  const { sort, onSort } = useSort<DeskAppointment>(DEFAULT_SORT);
  const [pay, setPay] = useState<DeskAppointment | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const debouncedQ = useDebouncedValue(q.trim(), SEARCH_DEBOUNCE_MS);

  const socket = useQueueLive(canQueue);
  const refetchIntervalMs = canQueue && socket === 'open' ? LIVE_REFETCH_MS : POLL_REFETCH_MS;

  // Department and doctor filters follow the hospital's own catalogue (H1), by id.
  const departmentsQuery = useDepartmentsQuery();
  const doctorsQuery = useDoctorsQuery();
  const departments = useMemo(() => departmentsQuery.data ?? [], [departmentsQuery.data]);
  const doctors = useMemo(
    () => (doctorsQuery.data ?? []).filter((d) => !deptId || d.departmentId === deptId),
    [doctorsQuery.data, deptId],
  );
  const deptLabels = uniqueLabels(
    departments,
    (d) => d.name,
    (d) => d.code,
  );
  const doctorLabels = uniqueLabels(
    doctors,
    (d) => d.name,
    (d) => (d.room ? `Room ${d.room}` : d.slug),
  );

  const range = rangeFor(dateF, exact, today);
  const serverSort: AppointmentSort = {
    field: 'scheduled_start_at',
    direction: sort.key === TIME_SORT_KEY && sort.dir === 'desc' ? 'desc' : 'asc',
  };
  const filter = combineFilters(tab, statusF);
  const base: AppointmentListParams = {
    ...range,
    statuses: [],
    source: null,
    paymentStatus: null,
    departmentId: deptId,
    doctorId,
    q: debouncedQ,
    sort: serverSort,
    page: page + 1,
    pageSize: APPT_PAGE,
  };
  const params: AppointmentListParams = filter ? { ...base, ...filter } : base;
  const query = useAppointmentsPageQuery(params, { enabled: filter !== null, refetchIntervalMs });
  const counts = useAppointmentTabCountsQuery(
    { ...base, sort: { field: 'scheduled_start_at', direction: 'asc' }, page: 1 },
    { refetchIntervalMs },
  );
  const rows = filter && query.data ? query.data.items : [];
  const total = filter && query.data ? query.data.total : 0;

  // A live update can shrink the list under the current page: step back to its last page.
  const lastPage = Math.max(0, Math.ceil(total / APPT_PAGE) - 1);
  const isPastEnd =
    filter !== null && !query.isPlaceholderData && query.isSuccess && page > lastPage;
  // Adjusting state from the previous render's data (React's documented pattern).
  if (isPastEnd) setPage(lastPage);

  const approve = useApproveMutation();
  const checkIn = useCheckInMutation();
  const actionKeys = useActionKeys();

  const refresh = async (): Promise<void> => {
    await Promise.all([filter ? query.refetch() : null, counts.refetch()]);
  };

  const reset =
    <T,>(fn: (v: T) => void) =>
    (v: T) => {
      fn(v);
      setPage(0);
    };
  const setTab = (next: AppointmentTab) => {
    setParam(APPOINTMENTS_TAB_PARAM, next === 'All' ? null : TAB_SLUGS[next]);
    setPage(0);
  };
  const tabLabel = (t: AppointmentTab) => {
    const c = t === 'All' ? undefined : counts.data?.[t as CountedTab];
    return c !== undefined ? `${t} (${c})` : t;
  };
  const filtersActive =
    q.trim() !== '' ||
    exact !== '' ||
    dateF !== 'Today' ||
    deptId !== null ||
    doctorId !== null ||
    statusF !== null;
  const clearAll = () => {
    setQ('');
    setExact('');
    setDateF('Today');
    setDeptId(null);
    setDoctorId(null);
    setStatusF(null);
    setPage(0);
  };

  const doPrimary = (a: DeskAppointment) => {
    const p = primaryAction(a, today, canCollect);
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
      const scope = `check-in:${a.id}`;
      checkIn.mutate(
        { id: a.id, idempotencyKey: actionKeys.keyFor(scope) },
        {
          onSuccess: () => {
            actionKeys.settle(scope);
            toast('Checked in', 'success');
          },
          onError: fail('Could not check in.'),
        },
      );
    } else if (p.key === 'receipt') setReceipt(a.id);
    else if (p.key === 'queue') navigate(hospitalTokenForDeptPath(role, a.department.name));
  };

  const caption = liveCaption(canQueue, socket);
  const updatedAt = query.dataUpdatedAt
    ? formatTimeIn(new Date(query.dataUpdatedAt).toISOString(), timeZone)
    : '—';

  /** Loading / empty / error live inside the table body so the header stays put. */
  const tableState: TableStateSpec | undefined =
    filter && query.isPending
      ? { kind: 'loading', rows: APPT_PAGE }
      : filter && query.isError
        ? {
            kind: 'error',
            message: failureText(query.error, 'Could not load appointments.'),
            onRetry: () => void refresh(),
          }
        : rows.length === 0
          ? filtersActive || tab !== 'All'
            ? {
                kind: 'empty',
                title: 'No appointments match your filters.',
                message: 'Nothing is booked for this combination of tab, date, doctor and status.',
                actionLabel: 'Clear filters',
                onAction: () => {
                  clearAll();
                  setTab('All');
                },
              }
            : {
                kind: 'empty',
                icon: 'calendar-plus',
                title: 'No appointments yet.',
                message: 'Book the first one and it will appear here with its token.',
                ...(canBook
                  ? {
                      actionLabel: 'Create appointment',
                      onAction: () => navigate(hospitalPath(role, 'create')),
                    }
                  : {}),
              }
          : undefined;

  return (
    <div className="flex flex-col gap-5">
      <Card pad={14} className="flex flex-wrap items-center justify-between gap-4">
        <Tabs
          tabs={APPOINTMENT_TABS.map(tabLabel)}
          value={tabLabel(tab)}
          onChange={(v) => {
            const name = v.split(' (')[0] ?? v;
            if (isAppointmentTab(name)) setTab(name);
          }}
        />
        <Can perm="Appointments.add">
          <Button icon="plus" onClick={() => navigate(hospitalPath(role, 'create'))}>
            New Appointment
          </Button>
        </Can>
      </Card>
      <Card pad={20}>
        <div className="mb-4">
          <SearchField
            value={q}
            onChange={reset(setQ)}
            placeholder="Search by patient name, phone, MR number, token or booking ref"
          />
        </div>
        <div className="mb-4.5 flex flex-wrap items-center gap-3">
          <RefreshBtn onRefresh={refresh} title="Refresh appointments" />
          <FilterSelect
            value={exact ? 'Exact date' : dateF}
            options={exact ? ['Exact date', ...DATE_WINDOWS] : DATE_WINDOWS}
            onChange={reset((v: string) => {
              if (!isDateWindow(v)) return;
              setExact('');
              setDateF(v);
            })}
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
            value={(deptId && deptLabels.get(deptId)) || ALL_DEPTS}
            options={[ALL_DEPTS, ...departments.map((d) => deptLabels.get(d.id) ?? d.name)]}
            onChange={reset((label: string) => {
              const next = departments.find((d) => deptLabels.get(d.id) === label)?.id ?? null;
              setDeptId(next);
              const doctor = (doctorsQuery.data ?? []).find((d) => d.id === doctorId);
              if (next && doctor && doctor.departmentId !== next) setDoctorId(null);
            })}
            aria-label="Filter by department"
          />
          <FilterSelect
            value={(doctorId && doctorLabels.get(doctorId)) || ALL_DOCTORS}
            options={[ALL_DOCTORS, ...doctors.map((d) => doctorLabels.get(d.id) ?? d.name)]}
            onChange={reset((label: string) =>
              setDoctorId(doctors.find((d) => doctorLabels.get(d.id) === label)?.id ?? null),
            )}
            aria-label="Filter by doctor"
          />
          <FilterSelect
            value={statusF ?? ALL_STATUS}
            options={[ALL_STATUS, ...STATUS_CHOICE_LABELS]}
            onChange={reset((v: string) => setStatusF(isStatusChoice(v) ? v : null))}
            aria-label="Filter by status"
          />
          {filtersActive && (
            <button type="button" onClick={clearAll} className="text-body text-blue cursor-pointer">
              Clear all
            </button>
          )}
          <span className="flex-1"></span>
          <span
            className="text-caption text-text-muted flex items-center gap-1.5 whitespace-nowrap"
            title={caption.title}
          >
            <span className={cn('size-2 rounded-full', caption.dot)} aria-hidden="true"></span>
            {caption.label} · Updated {updatedAt}
          </span>
        </div>
        <div
          className={cn(
            'transition-opacity duration-150',
            filter !== null && query.isPlaceholderData && 'opacity-60',
          )}
          aria-busy={query.isFetching}
        >
          <TableShell
            columns={COLUMNS}
            sortKeys={SORT_KEYS}
            sort={sort}
            onSort={(key) => {
              onSort(key);
              setPage(0);
            }}
            state={tableState}
            scrollLabel="Appointments"
          >
            {rows.map((a) => {
              const p = primaryAction(a, today, canCollect);
              const payBadge = paymentBadge(a);
              const source = sourceBadge(a.source);
              const status = statusBadge(a.status);
              return (
                <tr
                  key={a.id}
                  onClick={() => setParam(APPOINTMENT_PARAM, a.id)}
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
                    <Badge status={source.status}>{source.label}</Badge>
                  </td>
                  <td className={tdClass}>
                    <div>{timeOf(a.scheduledStartAt, timeZone)}</div>
                    <div className="text-caption text-text-muted">
                      {dayOf(a.scheduledDate, timeZone)}
                    </div>
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
                      <Badge status={status.status}>{status.label}</Badge>
                      {needsApproval(a) ? (
                        <span className="text-caption text-y-700 font-semibold">
                          Needs approval
                        </span>
                      ) : (
                        a.tokenLabel && (
                          <span className="text-caption text-blue font-semibold">
                            {a.tokenLabel}
                          </span>
                        )
                      )}
                    </div>
                  </td>
                  <td className={tdClass} onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      {p ? (
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
                        onClick={() => setParam(APPOINTMENT_PARAM, a.id)}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </TableShell>
        </div>
        <Pager
          total={total}
          page={page}
          pageSize={APPT_PAGE}
          onPage={setPage}
          noun="appointments"
        />
      </Card>
      <AppointmentDrawer
        id={drawer}
        onClose={() => setParam(APPOINTMENT_PARAM, null)}
        onViewPatient={(mrn) =>
          navigate(`/${role}/${HOSPITAL_VIEW_SEGMENT.patients}/${encodeURIComponent(mrn)}`)
        }
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
