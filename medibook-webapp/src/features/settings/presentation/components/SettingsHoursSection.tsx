import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { Select } from '@/shared/ui/Select';
import { Toggle } from '@/shared/ui/Toggle';

import {
  END_OF_DAY_LABEL,
  TIME_OPTS,
  timeLabelToMinutes,
} from '@/features/doctors/domain/calendar';
import type {
  HospitalHoursDay,
  HospitalRuleSettings,
} from '@/features/settings/domain/entities/settings.entities';
import type { HoursDayForm, HoursForm } from '@/features/settings/application/store/settings.form';

import { SettingsHead } from './SettingsHead';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Closing times also offer 11:59 pm, so a 24-hour hospital can be set up. */
const CLOSE_OPTS: readonly string[] = [...TIME_OPTS, END_OF_DAY_LABEL];

/** The 15-minute grid plus a stored time that is off that grid. */
function optionsWith(grid: readonly string[], current: string): readonly string[] {
  if (grid.includes(current) || timeLabelToMinutes(current) === null) return grid;
  return [...grid, current].sort(
    (a, b) => (timeLabelToMinutes(a) ?? 0) - (timeLabelToMinutes(b) ?? 0),
  );
}

interface SettingsHoursSectionProps {
  value: HoursForm;
  onChange: (next: HoursForm) => void;
  /** Per-day problems, keyed by weekday index. */
  errors: Readonly<Record<number, string>>;
  /** What the server holds, for the "not set yet" note. */
  hours: readonly HospitalHoursDay[];
  rules: HospitalRuleSettings;
  mayEdit: boolean;
}

/**
 * Settings › Working Hours — the hospital's opening hours per weekday
 * (`PUT /hospital/hours` takes one row per day; UAT-50, 07·F14), any time
 * of day in 15-minute steps. Doctors' sessions fall inside these hours;
 * saving re-generates slots in the background.
 */
export function SettingsHoursSection({
  value,
  onChange,
  errors,
  hours,
  rules,
  mayEdit,
}: SettingsHoursSectionProps) {
  const patch = (index: number, next: Partial<HoursDayForm>): void =>
    onChange({ days: value.days.map((d, i) => (i === index ? { ...d, ...next } : d)) });
  const openDays = value.days.filter((d) => d.open).length;
  const firstOpen = value.days.find((d) => d.open);
  const copyFirst = (): void => {
    if (!firstOpen) return;
    onChange({
      days: value.days.map((d) => (d.open ? { ...d, from: firstOpen.from, to: firstOpen.to } : d)),
    });
  };
  const estimate = rules.derived.slotsPerSessionEstimate;

  return (
    <Card pad={28}>
      <SettingsHead info="Hospital-level opening hours. Each doctor's weekly sessions (Doctors & Departments) must fall inside them; slot generation reads both.">
        Hospital Working Hours
      </SettingsHead>
      {hours.length === 0 && (
        <div className="text-caption text-text-muted bg-y-100 mb-4 flex items-center gap-2 rounded-md px-3 py-2.5">
          <Icon name="info" size={15} className="text-y-700 flex-none" />
          Working hours have not been set yet — every day reads Closed until you save.
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="text-caption text-text-muted">
          {openDays} open {openDays === 1 ? 'day' : 'days'} a week
          {estimate ? ` · doctors' sessions hold ≈ ${estimate.avg} slots each` : ''}
        </span>
        <span className="flex-1" />
        {mayEdit && firstOpen && (
          <Button size="sm" variant="ghost" icon="repeat" onClick={copyFirst}>
            Use {firstOpen.from}–{firstOpen.to} for every open day
          </Button>
        )}
      </div>
      <div className="flex flex-col gap-3">
        {DAYS.map((name, i) => {
          const day = value.days[i];
          if (!day) return null;
          const error = errors[i];
          return (
            <div
              key={name}
              className={cn(
                'flex flex-wrap items-center gap-4 rounded-md border px-4 py-3',
                error ? 'border-d-300' : 'border-border-soft',
              )}
            >
              <span className="text-body text-text-strong w-27.5 font-medium">{name}</span>
              <Toggle
                value={day.open}
                onChange={(v) => patch(i, { open: v })}
                label={`${name} open`}
                disabled={!mayEdit}
              />
              <span className="flex-1" />
              {day.open ? (
                <div className="flex items-center gap-2">
                  <div className="w-30">
                    <Select
                      value={day.from}
                      options={optionsWith(TIME_OPTS, day.from)}
                      onChange={(v) => patch(i, { from: v })}
                      height={40}
                      aria-label={`${name} opening time`}
                      disabled={!mayEdit}
                    />
                  </div>
                  <span className="text-text-faint">–</span>
                  <div className="w-30">
                    <Select
                      value={day.to}
                      options={optionsWith(CLOSE_OPTS, day.to)}
                      onChange={(v) => patch(i, { to: v })}
                      height={40}
                      aria-label={`${name} closing time`}
                      invalid={Boolean(error)}
                      disabled={!mayEdit}
                    />
                  </div>
                </div>
              ) : (
                <span className="text-body text-text-muted">Closed</span>
              )}
              {error && (
                <span className="text-caption text-d-700 flex w-full items-center gap-1.5">
                  <Icon name="triangle-alert" size={13} /> {error}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="text-caption text-text-muted mt-4">
        One-off closures (holidays, maintenance, department closures) live on the Holiday Calendar
        in Hospital Profile. Saving new hours re-generates slots in the background; existing
        bookings are never cancelled by it.
      </div>
    </Card>
  );
}
