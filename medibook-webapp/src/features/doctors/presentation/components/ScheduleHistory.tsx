import { isFailure } from '@/core/error/failure';
import { useDoctorScheduleHistoryQuery } from '@/features/doctors/application/queries/useDoctorScheduleHistoryQuery';
import { todayIso } from '@/features/doctors/domain/calendar';
import { fmtDate } from '@/shared/lib/format';
import { ErrorState } from '@/shared/ui/ErrorState';
import { InfoDot } from '@/shared/ui/InfoDot';
import { SkeletonLine } from '@/shared/ui/Skeleton';

import { hhmmToLabel, LEAVE_KIND_LABEL } from './doctors.view';

interface HistoryLine {
  readonly key: string;
  /** ISO date the entry ended — the list is newest first. */
  readonly sortDate: string;
  readonly when: string;
  readonly what: string;
}

interface ScheduleHistoryProps {
  doctorId: string;
}

/**
 * Leave and date exceptions that are over. The schedule read (and so the
 * panels above) returns only current and future entries; the backend keeps
 * the rest, listed here read-only so the desk can see when a doctor was away.
 */
export function ScheduleHistory({ doctorId }: ScheduleHistoryProps) {
  const query = useDoctorScheduleHistoryQuery(doctorId);
  const today = todayIso();

  if (query.isPending) return <SkeletonLine />;
  if (query.isError) {
    return (
      <ErrorState
        inline
        title="Past leave and exceptions could not be loaded"
        message={isFailure(query.error) ? query.error.message : undefined}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const lines: HistoryLine[] = [
    ...query.data.leaves
      .filter((l) => l.dateTo < today)
      .map((l) => ({
        key: `leave:${l.id}`,
        sortDate: l.dateTo,
        when:
          l.dateFrom === l.dateTo
            ? fmtDate(l.dateFrom)
            : `${fmtDate(l.dateFrom)} – ${fmtDate(l.dateTo)}`,
        what: `${LEAVE_KIND_LABEL[l.kind]} leave${l.reason ? ` · ${l.reason}` : ''}`,
      })),
    ...query.data.dateExceptions
      .filter((e) => e.date < today)
      .map((e) => ({
        key: `exception:${e.id}`,
        sortDate: e.date,
        when: fmtDate(e.date),
        what: `${
          e.kind === 'closed'
            ? 'Closed all day'
            : e.sessions
                .map((w) => `${hhmmToLabel(w.startsAt)} – ${hhmmToLabel(w.endsAt)}`)
                .join(', ')
        }${e.note ? ` · ${e.note}` : ''}`,
      })),
  ].sort((a, b) => b.sortDate.localeCompare(a.sortDate));

  return (
    <div>
      <div className="mb-2.5 flex items-center gap-2">
        <span className="text-body text-text-strong font-medium">Past leave & exceptions</span>
        <InfoDot text="Leave and one-off date changes that are over. Kept for the record; they no longer affect booking." />
      </div>
      {lines.length === 0 ? (
        <span className="text-caption text-text-muted">None on record.</span>
      ) : (
        <div className="flex flex-col">
          {lines.map((line) => (
            <div
              key={line.key}
              className="border-border-soft text-body flex flex-wrap gap-3 border-b py-2 last:border-b-0"
            >
              <span className="text-text-strong w-48 font-medium">{line.when}</span>
              <span className="text-text-muted flex-1">{line.what}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
