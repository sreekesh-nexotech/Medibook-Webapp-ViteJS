import { isFailure } from '@/core/error/failure';
import { useDoctorScheduleHistoryQuery } from '@/features/doctors/application/queries/useDoctorScheduleHistoryQuery';
import { useHospitalToday } from '@/shared/hooks/useHospitalTime';
import { ErrorState } from '@/shared/ui/ErrorState';
import { InfoDot } from '@/shared/ui/InfoDot';
import { SkeletonLine } from '@/shared/ui/Skeleton';

import { pastScheduleLines } from './doctors.view';

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
  // "Over" means before the hospital's today, not the PC's (D-09, UAT-47).
  const { today } = useHospitalToday();

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

  const lines = pastScheduleLines(query.data, today);

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
