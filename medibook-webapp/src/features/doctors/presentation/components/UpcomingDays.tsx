import type { ResolvedDay } from '@/features/doctors/domain/entities/doctors.types';
import { formatIsoDayLabel } from '@/features/doctors/domain/calendar';
import { cn } from '@/shared/lib/cn';
import { InfoDot } from '@/shared/ui/InfoDot';

import { hhmmToLabel } from './doctors.view';

/** Why a date differs from the weekly hours, in the desk's words. */
const SOURCE_LABEL: Readonly<Record<string, string>> = {
  holiday: 'Hospital holiday',
  leave: 'On leave',
  exception_closed: 'Closed (date exception)',
  exception_custom_sessions: 'Special hours',
  inactive: 'Doctor inactive',
};

interface UpcomingDaysProps {
  days: readonly ResolvedDay[];
}

/**
 * The next 14 days exactly as the backend will generate slots for them —
 * weekly hours with hospital holidays, leave and date exceptions applied.
 * Reflects the saved schedule, not unsaved edits above.
 */
export function UpcomingDays({ days }: UpcomingDaysProps) {
  if (days.length === 0) return null;
  return (
    <div>
      <div className="mb-2.5 flex items-center gap-2">
        <span className="text-body text-text-strong font-medium">Next 14 days</span>
        <InfoDot text="What patients can book, as saved: weekly hours with hospital holidays, leave and date exceptions applied. Unsaved changes above are not reflected until you save." />
      </div>
      <div className="flex flex-col">
        {days.map((day) => {
          const exception = SOURCE_LABEL[day.source];
          const hours = day.sessions
            .map((s) => `${s.label} ${hhmmToLabel(s.startsAt)}–${hhmmToLabel(s.endsAt)}`)
            .join(' · ');
          return (
            <div
              key={day.date}
              className="border-border-soft text-body flex flex-wrap items-center gap-3 border-b py-2 last:border-b-0"
            >
              <span className="text-text-strong w-28 font-medium">
                {formatIsoDayLabel(day.date)}
              </span>
              <span
                className={cn(
                  'flex-1',
                  day.sessions.length === 0 ? 'text-text-muted' : 'text-text-body',
                )}
              >
                {hours || 'No consultation'}
              </span>
              {exception && (
                <span className="text-caption text-y-700 bg-y-100 rounded-full px-2.5 py-0.5">
                  {exception}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
