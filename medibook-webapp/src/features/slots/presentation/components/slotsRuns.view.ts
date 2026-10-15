import { formatIsoDayLabel } from '@/features/doctors/domain/calendar';
import type {
  AffectedBooking,
  SlotGenerationRun,
  SlotRegenerateResult,
} from '@/features/slots/domain/entities/slots.entities';

/**
 * Copy for slot generation runs and manual regenerations. Pure: no React.
 * Times are shown in the hospital's zone when it is known (D-09).
 */

/** "7 Oct, 9:05 am" in `timeZone` (the browser's when `null`). */
export function runTime(iso: string, timeZone: string | null): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timeZone ?? undefined,
  });
}

/** "nightly run", "manual run", "rule change run" — how a run was started. */
export function runTriggerLabel(trigger: string): string {
  return trigger === 'nightly' ? 'nightly run' : `${trigger.replace(/_/g, ' ')} run`;
}

/** "12 created, 3 closed, 1 kept for bookings" — only the non-zero parts after "created". */
export function runChangesCopy(run: {
  readonly createdCount: number;
  readonly updatedCount: number;
  readonly closedCount: number;
  readonly preservedCount: number;
}): string {
  return [
    `${run.createdCount} created`,
    run.updatedCount ? `${run.updatedCount} updated` : '',
    run.closedCount ? `${run.closedCount} closed` : '',
    run.preservedCount ? `${run.preservedCount} kept for bookings` : '',
  ]
    .filter(Boolean)
    .join(', ');
}

/** Where a run stands: failed, still running, or done. */
export function runStatus(run: SlotGenerationRun): 'failed' | 'running' | 'done' {
  if (run.error) return 'failed';
  return run.finishedAt ? 'done' : 'running';
}

/** One line describing the latest run, for the grid header. */
export function runCopy(run: SlotGenerationRun, timeZone: string | null): string {
  const when = runTime(run.startedAt, timeZone);
  const status = runStatus(run);
  if (status === 'failed') return `Slot generation on ${when} failed: ${run.error ?? ''}`;
  if (status === 'running') return `Slots are being generated (started ${when})…`;
  const range =
    run.horizonFrom && run.horizonTo
      ? ` · covers ${formatIsoDayLabel(run.horizonFrom)} – ${formatIsoDayLabel(run.horizonTo)}`
      : '';
  return `Slots last generated ${when} (${runTriggerLabel(run.trigger)})${range} · ${runChangesCopy(run)}`;
}

/** The toast after a manual regeneration (UAT-73: preserved bookings are never hidden). */
export function regenerateCopy(result: SlotRegenerateResult): string {
  if (result.queued) {
    return 'Slot regeneration started in the background — follow it under Generation runs.';
  }
  const kept = result.affectedBookings.length;
  return `Slots regenerated — ${runChangesCopy(result)}${
    kept > 0
      ? `. ${kept} booking${kept === 1 ? ' sits' : 's sit'} on slots the rules no longer produce — review ${kept === 1 ? 'it' : 'them'}.`
      : ''
  }`;
}

/** "T-007 Asha Rao · 8 Oct, 10:30 am" for an affected booking, in the hospital zone. */
export function affectedBookingLine(b: AffectedBooking, timeZone: string | null): string {
  return `${b.tokenLabel ?? b.bookingRef} ${b.patientName} · ${runTime(b.scheduledStartAt, timeZone)}`;
}
