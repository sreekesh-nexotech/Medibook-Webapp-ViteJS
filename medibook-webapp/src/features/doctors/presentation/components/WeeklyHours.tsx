import { TIME_OPTS } from '@/features/doctors/application/store/catalog.fixtures';
import type { ShiftPattern, WeekDay } from '@/features/doctors/application/store/catalog.types';
import { cn } from '@/shared/lib/cn';
import { InfoDot } from '@/shared/ui/InfoDot';
import { Select } from '@/shared/ui/Select';
import { Toggle } from '@/shared/ui/Toggle';

interface WeeklyHoursProps {
  /** The grid being edited. This component is **controlled** — it holds no copy. */
  value: readonly WeekDay[];
  /** Every edit is reported upward; the owning screen decides when to commit it. */
  onChange: (week: readonly WeekDay[]) => void;
  /**
   * The hospital's shift-pattern library. When supplied, each open day can be
   * run off named patterns instead of one raw from–to window; omit it for the
   * department editor, which has no patterns.
   */
  patterns?: readonly ShiftPattern[];
  info?: string;
  disabled?: boolean;
}

/**
 * Per-day working-hours editor (design `WeeklyHours`).
 *
 * Audit 3.1.6 — "saving a doctor's weekly hours discards the edit: the
 * confirmation appears and the old hours return". The cause was here: the
 * component kept a **local copy** of the grid and, in its own words, "like the
 * prototype it does not report edits upward", while a `useEffect` re-seeded
 * that copy from props on every parent render. Both are gone. The draft now
 * lives in the owning screen, which is what Save commits.
 */
export function WeeklyHours({
  value,
  onChange,
  patterns,
  info,
  disabled = false,
}: WeeklyHoursProps) {
  const patch = (index: number, next: Partial<WeekDay>): void =>
    onChange(value.map((d, i) => (i === index ? { ...d, ...next } : d)));

  const togglePattern = (index: number, patternId: string): void => {
    const current = value[index].patternIds ?? [];
    patch(index, {
      patternIds: current.includes(patternId)
        ? current.filter((p) => p !== patternId)
        : [...current, patternId],
    });
  };

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-body text-text-strong font-medium">Working Hours</span>
        {info && <InfoDot text={info} />}
      </div>
      <div className="flex flex-col gap-2">
        {value.map((d, i) => {
          const assigned = d.patternIds ?? [];
          return (
            <div
              key={d.day}
              className="border-border-soft flex flex-wrap items-center gap-3 rounded-md border px-3 py-2"
            >
              <span className="text-body text-text-strong w-9.5 font-medium">{d.day}</span>
              <Toggle
                value={d.on}
                onChange={(v) => patch(i, { on: v })}
                label={`${d.day} open for consultation`}
                disabled={disabled}
              />
              {d.on ? (
                assigned.length > 0 ? (
                  <span className="text-caption text-text-muted ml-auto">
                    {assigned.length} shift pattern{assigned.length === 1 ? '' : 's'}
                  </span>
                ) : (
                  <div className="ml-auto flex items-center gap-2">
                    <div className="w-27.5">
                      <Select
                        value={d.from}
                        options={TIME_OPTS}
                        onChange={(v) => patch(i, { from: v })}
                        height={40}
                        disabled={disabled}
                        aria-label={`${d.day} start time`}
                      />
                    </div>
                    <span className="text-text-faint">–</span>
                    <div className="w-27.5">
                      <Select
                        value={d.to}
                        options={TIME_OPTS}
                        onChange={(v) => patch(i, { to: v })}
                        height={40}
                        disabled={disabled}
                        aria-label={`${d.day} end time`}
                      />
                    </div>
                  </div>
                )
              ) : (
                <span className="text-body text-text-muted ml-auto">Closed</span>
              )}
              {patterns && patterns.length > 0 && d.on && (
                <div className="flex w-full flex-wrap items-center gap-2">
                  <span className="text-caption text-text-muted">Shifts</span>
                  {patterns.map((p) => {
                    const on = assigned.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        aria-pressed={on}
                        disabled={disabled}
                        onClick={() => togglePattern(i, p.id)}
                        className={cn(
                          'text-caption inline-flex items-center gap-1.5 rounded-full border px-3 py-1.25',
                          on
                            ? 'border-blue bg-blue-soft-bg text-blue'
                            : 'border-border text-text-body bg-white',
                          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
                        )}
                      >
                        {p.name} · {p.from}–{p.to}
                      </button>
                    );
                  })}
                  {assigned.length === 0 && (
                    <span className="text-caption text-text-muted">
                      none assigned — the {d.from}–{d.to} window applies
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
