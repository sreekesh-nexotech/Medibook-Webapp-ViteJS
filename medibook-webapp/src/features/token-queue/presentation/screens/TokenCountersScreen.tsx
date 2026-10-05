import { useMemo, useState } from 'react';

import { useNow } from '@/shared/hooks/useNow';
import { cn } from '@/shared/lib/cn';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import { Icon } from '@/shared/ui/Icon';
import { RefreshBtn } from '@/shared/ui/RefreshBtn';
import { SkeletonCards } from '@/shared/ui/Skeleton';

import { isFailure } from '@/core/error/failure';

import { useAppointmentsQuery } from '@/features/appointments/application/queries/appointments.queries';
import { formatUpdatedAt } from '@/features/appointments/application/queries/useListRefresh';
import { useDepartmentsQuery } from '@/features/doctors/application/queries/useDepartmentsQuery';
import { useDoctorsQuery } from '@/features/doctors/application/queries/useDoctorsQuery';
import { useQueueSessionsQuery } from '@/features/token-queue/application/queries/tokenQueue.queries';
import { useQueueLive } from '@/features/token-queue/application/queries/useQueueLive';
import { DoctorQueueCard } from '@/features/token-queue/presentation/components/DoctorQueueCard';
import {
  isServing,
  minutesSince,
} from '@/features/token-queue/presentation/components/tokenQueue.view';

/** Doctor cards per row of the grid — also the shimmer count while loading. */
const CARD_COLUMNS = 2;

/** Elapsed timers tick every 30 s (design behaviour). */
const TICK_MS = 30_000;

/** Minutes after which the longest open call turns red (design threshold). */
const LONG_WAIT_MINUTES = 20;

const ALL_DEPTS = 'All Departments';
const ALL_DOCTORS = 'All Doctors';

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Live token queue (design `TokenCounters`) on the hospital API: one card per
 * doctor **session** today (the backend's queue unit), kept live over the
 * `ws/hospital/queue` socket with a refetch as the safety net. Search +
 * department / doctor filters, a Serving / Waiting / On break / Longest
 * strip, and loading / error / empty states.
 */
export function TokenCountersScreen() {
  const today = localToday();
  const sessionsQuery = useQueueSessionsQuery(today);
  const doctorsQuery = useDoctorsQuery();
  const departmentsQuery = useDepartmentsQuery();
  const appointmentsQuery = useAppointmentsQuery({ dateFrom: today, dateTo: today });
  const socketStatus = useQueueLive();
  const now = useNow(TICK_MS);

  const [q, setQ] = useState('');
  const [deptF, setDeptF] = useState(ALL_DEPTS);
  const [docF, setDocF] = useState(ALL_DOCTORS);

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
  const doctorNamesInDept = Array.from(
    new Set(
      sessions
        .map((s) => doctorsById.get(s.doctorId))
        .filter((d) => d && (deptF === ALL_DEPTS || deptNameById.get(d.departmentId) === deptF))
        .map((d) => d?.name ?? ''),
    ),
  ).filter(Boolean);

  const ql = q.trim().toLowerCase();
  const shown = sessions.filter((s) => {
    const doc = doctorsById.get(s.doctorId);
    const name = doc?.name ?? '';
    const dept = doc ? (deptNameById.get(doc.departmentId) ?? '') : '';
    if (deptF !== ALL_DEPTS && dept !== deptF) return false;
    if (docF !== ALL_DOCTORS && name !== docF) return false;
    if (ql && !`${name} ${s.label}`.toLowerCase().includes(ql)) return false;
    return true;
  });

  const servingCount = shown.filter(isServing).length;
  const waitingCount = shown.reduce((n, s) => n + s.waitingCount, 0);
  const breakCount = shown.filter((s) => s.queueState === 'on_break').length;
  const longest = shown.reduce((mx, s) => {
    const m = isServing(s) ? minutesSince(s.lastCalledAt, now) : null;
    return m == null ? mx : Math.max(mx, m);
  }, 0);

  const stats: readonly { label: string; val: number | string; color: string }[] = [
    { label: 'Serving', val: servingCount, color: 'text-blue' },
    { label: 'Waiting', val: waitingCount, color: 'text-text-strong' },
    { label: 'On break', val: breakCount, color: 'text-text-muted' },
    {
      label: 'Longest',
      val: longest ? `${longest}m` : '—',
      color: longest > LONG_WAIT_MINUTES ? 'text-d-500' : 'text-g-600',
    },
  ];

  const filtersActive = q !== '' || docF !== ALL_DOCTORS || deptF !== ALL_DEPTS;
  const clearAll = (): void => {
    setQ('');
    setDocF(ALL_DOCTORS);
    setDeptF(ALL_DEPTS);
  };

  const refresh = async (): Promise<void> => {
    await Promise.all([sessionsQuery.refetch(), appointmentsQuery.refetch()]);
  };

  const isLoading = sessionsQuery.isPending || doctorsQuery.isPending;
  const loadError = sessionsQuery.error ?? doctorsQuery.error;

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
          title={socketStatus === 'open' ? 'Live updates on' : 'Live updates reconnecting'}
        >
          <span
            className={cn('size-2 rounded-full', socketStatus === 'open' ? 'bg-g-600' : 'bg-y-700')}
          />
          {socketStatus === 'open' ? 'Live' : 'Reconnecting'} · Updated{' '}
          {sessionsQuery.dataUpdatedAt ? formatUpdatedAt(sessionsQuery.dataUpdatedAt) : '—'}
        </span>
      </Card>

      {isLoading ? (
        <SkeletonCards count={CARD_COLUMNS} lines={4} pad={16} />
      ) : loadError ? (
        <Card pad={24}>
          <ErrorState
            inline
            title="The live queue didn't load"
            message={isFailure(loadError) ? loadError.message : undefined}
            onRetry={() => {
              void sessionsQuery.refetch();
              void doctorsQuery.refetch();
            }}
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
          {shown.map((s) => {
            const doc = doctorsById.get(s.doctorId);
            return (
              <DoctorQueueCard
                key={s.id}
                session={s}
                doctorName={doc?.name ?? 'Doctor'}
                departmentName={doc ? (deptNameById.get(doc.departmentId) ?? '') : ''}
                room={doc?.room ?? null}
                appointments={appointments}
                now={now}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
