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

/**
 * The catalogue's one-line hours summary, e.g. "Mon–Sat · 9am–6pm" — derived
 * from the grid rather than stored beside it, so an edited week can never
 * disagree with the caption on the card.
 */
export function summariseWeekHours(week: readonly ScheduleDay[]): string {
  const open = week.filter((d) => d.on);
  if (open.length === 0) return 'Closed all week';
  const days = open.length === 1 ? open[0].day : `${open[0].day}–${open[open.length - 1].day}`;
  return `${days} · ${compactTime(open[0].from)}–${compactTime(open[0].to)}`;
}
