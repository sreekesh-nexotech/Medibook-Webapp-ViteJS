import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { SocketStatus } from '@/core/api/socket';
import { useHospitalToday } from '@/shared/hooks/useHospitalTime';
import { useNow } from '@/shared/hooks/useNow';
import { useCan } from '@/shared/hooks/usePermission';
import { cn } from '@/shared/lib/cn';
import { formatTimeIn } from '@/shared/lib/hospitalTime';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import { Icon } from '@/shared/ui/Icon';
import { RefreshBtn } from '@/shared/ui/RefreshBtn';
import { SkeletonCards } from '@/shared/ui/Skeleton';

import { isFailure } from '@/core/error/failure';

import { TOKEN_DEPT_PARAM } from '@/app/router/paths';

import { useAppointmentsQuery } from '@/features/appointments/application/queries/appointments.queries';
import { useDepartmentsQuery } from '@/features/doctors/application/queries/useDepartmentsQuery';
import { useDoctorsQuery } from '@/features/doctors/application/queries/useDoctorsQuery';
import { useHospitalRuleSettingsQuery } from '@/features/settings/application/queries/useHospitalRuleSettingsQuery';
import type { QueueSession } from '@/features/token-queue/domain/entities/tokenQueue.entities';
import { useQueueSessionsQuery } from '@/features/token-queue/application/queries/tokenQueue.queries';
import { useQueueLive } from '@/features/token-queue/application/queries/useQueueLive';
import { DoctorQueueCard } from '@/features/token-queue/presentation/components/DoctorQueueCard';
import { SessionCallsDrawer } from '@/features/token-queue/presentation/components/SessionCallsDrawer';
import {
  isServing,
  minutesSince,
  servingSince,
} from '@/features/token-queue/presentation/components/tokenQueue.view';

/** Doctor cards per row of the grid — also the shimmer count while loading. */
const CARD_COLUMNS = 2;

/** Elapsed timers tick every 30 s (design behaviour). */
const TICK_MS = 30_000;

/**
 * The day's bookings are re-read on this interval as well as on every queue
 * push, so a cancellation an older backend never pushes still leaves "Up
 * next" (UAT-46).
 */
const APPOINTMENTS_REFETCH_MS = 30_000;

/**
 * Used only when neither the session, the doctor nor the hospital default
 * can be read (desk roles cannot read hospital settings — TOK-01).
 */
const FALLBACK_CONSULT_MINUTES = 20;

const ALL_DEPTS = 'All Departments';
const ALL_DOCTORS = 'All Doctors';

/** What the live indicator says for each socket state (T10). */
const LIVE_COPY: Readonly<
  Record<SocketStatus, { readonly label: string; readonly title: string; readonly dot: string }>
> = {
  open: { label: 'Live', title: 'Live updates on', dot: 'bg-g-600' },
  connecting: { label: 'Connecting', title: 'Connecting to live updates', dot: 'bg-y-700' },
  reconnecting: { label: 'Reconnecting', title: 'Live updates reconnecting', dot: 'bg-y-700' },
  closed: { label: 'Offline', title: 'Live updates are off', dot: 'bg-grey-300' },
  unauthorized: {
    label: 'Live updates stopped',
    title: 'Your sign-in for live updates expired — reload the page to resume them',
    dot: 'bg-d-500',
  },
  forbidden: {
    label: 'No access to live updates',
    title: 'Your role cannot receive live queue updates; the screen refreshes every minute',
    dot: 'bg-d-500',
  },
};

/**
 * Live token queue (design `TokenCounters`) on the hospital API: one card per
 * doctor **session** today (the backend's queue unit), kept live over the
 * `ws/hospital/queue` socket with a refetch as the safety net. "Today" is the
 * hospital's own day (UAT-47). Search + department / doctor filters, a
 * Serving / Waiting / On break / Longest strip, a call history per session,
 * and loading / error / empty states.
 */
export function TokenCountersScreen() {
  const { today, timeZone } = useHospitalToday();
  const range = useMemo(() => ({ dateFrom: today, dateTo: today }), [today]);
  const sessionsQuery = useQueueSessionsQuery(today);
  const doctorsQuery = useDoctorsQuery();
  const departmentsQuery = useDepartmentsQuery();
  const appointmentsQuery = useAppointmentsQuery(range, {
    refetchIntervalMs: APPOINTMENTS_REFETCH_MS,
  });
  const canViewQueue = useCan('Token Management.view');
  const socketStatus = useQueueLive(canViewQueue);
  const now = useNow(TICK_MS);
  // The backend's expected consultation time: the session's own (TOK-01),
  // the doctor's, else the hospital default (Q29). Settings need
  // `hospital_settings.view`, so other roles fall back.
  const canReadSettings = useCan('Hospital Settings.view');
  const rulesQuery = useHospitalRuleSettingsQuery(canReadSettings);
  const hospitalConsultMinutes = rulesQuery.data?.expectedConsultMinutes ?? null;
  const defaultConsultMinutes = hospitalConsultMinutes ?? FALLBACK_CONSULT_MINUTES;

  const [q, setQ] = useState('');
  // Opened from the front desk's department list with `?dept=`.
  const [searchParams] = useSearchParams();
  const [deptF, setDeptF] = useState(searchParams.get(TOKEN_DEPT_PARAM) ?? ALL_DEPTS);
  const [docF, setDocF] = useState(ALL_DOCTORS);
  const [callsFor, setCallsFor] = useState<QueueSession | null>(null);

  const doctorsById = useMemo(
    () => new Map((doctorsQuery.data ?? []).map((d) => [d.id, d])),
    [doctorsQuery.data],
  );
  const deptNameById = useMemo(
    () => new Map((departmentsQuery.data ?? []).map((d) => [d.id, d.name])),
    [departmentsQuery.data],
  );
  const departments = (departmentsQuery.data ?? []).map((d) => d.name);
  const appointments = appointmentsQuery.data ?? [];

  const sessions = sessionsQuery.data ?? [];
  const deptIdOf = (s: QueueSession): string | null =>
    s.departmentId ?? doctorsById.get(s.doctorId)?.departmentId ?? null;
  const deptNameOf = (s: QueueSession): string => {
    const id = deptIdOf(s);
    return id ? (deptNameById.get(id) ?? '') : '';
  };
  const doctorNameOf = (s: QueueSession): string => doctorsById.get(s.doctorId)?.name ?? 'Doctor';

  const doctorNamesInDept = Array.from(
    new Set(
      sessions
        .filter((s) => deptF === ALL_DEPTS || deptNameOf(s) === deptF)
        .map((s) => doctorsById.get(s.doctorId)?.name ?? ''),
    ),
  ).filter(Boolean);

  const ql = q.trim().toLowerCase();
  const shown = sessions.filter((s) => {
    const name = doctorsById.get(s.doctorId)?.name ?? '';
    if (deptF !== ALL_DEPTS && deptNameOf(s) !== deptF) return false;
    if (docF !== ALL_DOCTORS && name !== docF) return false;
    if (ql && !`${name} ${s.label}`.toLowerCase().includes(ql)) return false;
    return true;
  });

  const expectedFor = (s: QueueSession): number =>
    s.expectedMinutes ??
    doctorsById.get(s.doctorId)?.expectedConsultMinutes ??
    defaultConsultMinutes;
  const servingCount = shown.filter(isServing).length;
  const waitingCount = shown.reduce((n, s) => n + s.waitingCount, 0);
  const breakCount = shown.filter((s) => s.queueState === 'on_break').length;
  let longest = 0;
  let longestOver = false;
  for (const s of shown) {
    const appt = appointments.find((a) => a.id === s.currentAppointmentId) ?? null;
    const m = minutesSince(servingSince(s, appt), now);
    if (m != null && m > longest) {
      longest = m;
      longestOver = m > expectedFor(s);
    }
  }

  const stats: readonly { label: string; val: number | string; color: string }[] = [
    { label: 'Serving', val: servingCount, color: 'text-blue' },
    { label: 'Waiting', val: waitingCount, color: 'text-text-strong' },
    { label: 'On break', val: breakCount, color: 'text-text-muted' },
    {
      label: 'Longest',
      val: longest ? `${longest}m` : '—',
      color: longestOver ? 'text-d-500' : 'text-g-600',
    },
  ];

  const filtersActive = q !== '' || docF !== ALL_DOCTORS || deptF !== ALL_DEPTS;
  const clearAll = (): void => {
    setQ('');
    setDocF(ALL_DOCTORS);
    setDeptF(ALL_DEPTS);
  };

  const refresh = async (): Promise<void> => {
    await Promise.all([
      sessionsQuery.refetch(),
      appointmentsQuery.refetch(),
      doctorsQuery.refetch(),
      departmentsQuery.refetch(),
    ]);
  };

  // Only the sessions are essential: without the roster the cards still run
  // (doctor "Doctor"), and without the bookings they still take commands.
  const isLoading = sessionsQuery.isPending;
  const live = LIVE_COPY[socketStatus];

  return (
    <div className="flex flex-col gap-4">
      <Card pad={14} className="flex flex-wrap items-center gap-3.5">
        <div className="border-border text-text-muted flex h-10.5 min-w-55 flex-1 items-center gap-3 rounded-lg border px-3.5">
          <Icon name="search" size={18} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by doctor"
            aria-label="Search by doctor"
            className="text-body text-text-strong flex-1 border-none bg-transparent outline-none"
          />
        </div>
        <FilterSelect
          value={deptF}
          options={[ALL_DEPTS, ...departments]}
          onChange={(v) => {
            setDeptF(v);
            setDocF(ALL_DOCTORS);
          }}
          aria-label="Filter by department"
        />
        <FilterSelect
          value={docF}
          options={[ALL_DOCTORS, ...doctorNamesInDept]}
          onChange={setDocF}
          aria-label="Filter by doctor"
        />
        <RefreshBtn onRefresh={refresh} title="Refresh the live queue" />
        <div className="bg-border h-8.5 w-px" />
        <div className="flex items-center gap-5 pr-1">
          {stats.map((st) => (
            <div key={st.label} className="flex min-w-13 flex-col gap-px text-center">
              <span className={cn('text-h2 font-bold tabular-nums', st.color)}>{st.val}</span>
              <span className="text-caption text-text-muted">{st.label}</span>
            </div>
          ))}
        </div>
        <span
          className="text-caption text-text-muted inline-flex items-center gap-1.5 whitespace-nowrap"
          title={live.title}
        >
          <span className={cn('size-2 rounded-full', live.dot)} />
          {live.label} · Updated{' '}
          {sessionsQuery.dataUpdatedAt
            ? formatTimeIn(new Date(sessionsQuery.dataUpdatedAt).toISOString(), timeZone)
            : '—'}
        </span>
      </Card>

      {(doctorsQuery.isError || appointmentsQuery.isError) && sessions.length > 0 && (
        <Card pad={12} className="flex flex-wrap items-center gap-3">
          <Icon name="triangle-alert" size={16} className="text-y-700" />
          <span className="text-body text-text-body flex-1">
            {appointmentsQuery.isError
              ? 'Patient names and the up-next lists could not be loaded; the queue commands still work.'
              : 'The doctor list could not be loaded; cards show "Doctor" until it does.'}
          </span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              void appointmentsQuery.refetch();
              void doctorsQuery.refetch();
            }}
          >
            Retry
          </Button>
        </Card>
      )}

      {isLoading ? (
        <SkeletonCards count={CARD_COLUMNS} lines={4} pad={16} />
      ) : sessionsQuery.isError ? (
        <Card pad={24}>
          <ErrorState
            inline
            title="The live queue didn't load"
            message={isFailure(sessionsQuery.error) ? sessionsQuery.error.message : undefined}
            onRetry={() => void sessionsQuery.refetch()}
          />
        </Card>
      ) : sessions.length === 0 ? (
        <Card pad={24}>
          <EmptyState
            icon="calendar-days"
            title="No doctor sessions today."
            message="Sessions come from each doctor's weekly hours. Check Doctors & Departments or Slots & Availability if a doctor should be consulting today."
          />
        </Card>
      ) : shown.length === 0 ? (
        <Card pad={24}>
          <EmptyState
            icon="stethoscope"
            title="No doctors match your search."
            message="No session today matches the current filters."
            actionLabel={filtersActive ? 'Clear filters' : undefined}
            onAction={filtersActive ? clearAll : undefined}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3.5">
          {shown.map((s) => (
            <DoctorQueueCard
              key={s.id}
              session={s}
              doctorName={doctorNameOf(s)}
              departmentName={deptNameOf(s)}
              room={doctorsById.get(s.doctorId)?.room ?? null}
              appointments={appointments}
              today={today}
              now={now}
              expectedMinutes={expectedFor(s)}
              onShowCalls={() => setCallsFor(s)}
              onStale={() => void appointmentsQuery.refetch()}
            />
          ))}
        </div>
      )}
      <SessionCallsDrawer
        session={callsFor}
        doctorName={callsFor ? doctorNameOf(callsFor) : ''}
        appointments={appointments}
        timeZone={timeZone}
        onClose={() => setCallsFor(null)}
      />
    </div>
  );
}
