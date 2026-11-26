export interface ScheduleDay {
  readonly day: string;
  readonly on: boolean;
  readonly from: string;
  readonly to: string;
  readonly patternIds?: readonly string[];
}

/** "9:00 am" → "9am", "4:30 pm" → "4:30pm" — the catalogue's compact summary form. */
function compactTime(label: string): string {
  return label.replace(':00', '').replace(' ', '');
}

/** "09:00" → "9am", "17:30" → "5:30pm" — a backend session time. */
function compactHhmm(time: string): string {
  const [hourText = '0', minute = '00'] = time.split(':');
  const hour = Number(hourText);
  const suffix = hour < 12 ? 'am' : 'pm';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}${minute === '00' ? '' : `:${minute}`}${suffix}`;
}

/** The actual session windows of one weekday, e.g. "9am–12pm, 5pm–7pm". */
function sessionRanges(
  sessions: readonly { readonly startsAt: string; readonly endsAt: string }[],
): string {
  return [...sessions]
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .map((s) => `${compactHhmm(s.startsAt)}–${compactHhmm(s.endsAt)}`)
    .join(', ');
}

/**
 * The catalogue's one-line hours summary, e.g. "Mon–Sat · 9am–6pm" or
 * "Mon–Fri · 9am–12pm, 5pm–7pm" — derived from the actual sessions when they
 * are supplied, so split shifts are not flattened into one range.
 */
export function summariseWeekHours(
  week: readonly ScheduleDay[],
  sessions: readonly {
    readonly weekday: number;
    readonly startsAt: string;
    readonly endsAt: string;
  }[] = [],
): string {
  const open = week.filter((d) => d.on);
  if (open.length === 0) return 'Closed all week';
  const days = open.length === 1 ? open[0].day : `${open[0].day}–${open[open.length - 1].day}`;
  if (sessions.length > 0) {
    const byDay = new Map<number, { startsAt: string; endsAt: string }[]>();
    for (const s of sessions) byDay.set(s.weekday, [...(byDay.get(s.weekday) ?? []), s]);
    const ranges = [...byDay.values()].map(sessionRanges);
    const unique = new Set(ranges);
    if (unique.size === 1) return `${days} · ${ranges[0]}`;
  }
  return `${days} · ${compactTime(open[0].from)}–${compactTime(open[0].to)}`;
}
