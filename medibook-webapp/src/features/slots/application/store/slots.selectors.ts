import { useMemo } from 'react';

import { relToISOLocal } from '@/features/appointments/application/store/appointments.logic';
import { useAppointmentsStore } from '@/features/appointments/application/store/appointments.store';
import { useCatalogStore } from '@/features/doctors/application/store/catalog.store';
import type { Doctor } from '@/features/doctors/application/store/catalog.types';
import {
  isoWeekdayIndex,
  minutesNow,
  timeLabelToMinutes,
  todayIso,
} from '@/features/doctors/domain/calendar';
import {
  parseDurationMinutes,
  parseTimeLabelMinutes,
} from '@/features/settings/application/store/settings.rules';
import { useSettingsStore } from '@/features/settings/application/store/settings.store';
import {
  buildSlotGrid,
  type SlotBooking,
  type SlotGridDoctor,
  type SlotGridResult,
  type SlotRules,
} from '@/features/slots/domain/slot-grid';

import { useSlotsStore } from './slots.store';

/**
 * The slot grid, composed from the four stores that actually own its inputs:
 * the **catalogue** (doctors, weekly hours, shift patterns, leave, date
 * exceptions), **hospital settings** (slot length, buffer, opening hours),
 * **appointments** (which slots are taken) and the **slots** store (what an
 * admin has blocked). The generation itself is the pure `buildSlotGrid` —
 * this module only gathers and normalises.
 *
 * Nothing here is stored: change a doctor's hours or the hospital's slot
 * length and the next render regenerates the grid.
 */

/** Statuses that no longer hold their slot. */
const RELEASED_STATUSES: readonly string[] = ['Cancelled'];

/** Fallbacks used when a hospital rule is missing, so the grid still renders. */
const FALLBACK_SLOT_MINUTES = 15;
const FALLBACK_BUFFER_MINUTES = 0;
const FALLBACK_OPEN_MINUTES = 8 * 60;
const FALLBACK_CLOSE_MINUTES = 20 * 60;
/** The hospital week has 7 open flags; a missing flag counts as open. */
const WEEK_LENGTH = 7;

/**
 * TRANSITIONAL — the seeded appointments still carry the design's abbreviated
 * doctor names ("Dr. Thomas K."), while the catalogue now carries the
 * canonical full names ("Dr. Thomas Kurian"). Until the appointment fixtures
 * are re-pointed onto the catalogue (the orchestrator's integration step), a
 * booking is matched to a doctor by exact name first and then by
 * first-name + surname-initial, which is precisely what the abbreviation is.
 * Delete this the day the two seeds agree.
 */
function matchesDoctorName(apptDoctor: string, canonicalName: string): boolean {
  if (apptDoctor === canonicalName) return true;
  const parts = (value: string): readonly string[] =>
    value
      .toLowerCase()
      .replace(/^dr\.?\s*/, '')
      .replace(/\./g, '')
      .split(/\s+/)
      .filter(Boolean);
  const a = parts(apptDoctor);
  const b = parts(canonicalName);
  if (a.length < 2 || b.length < 2) return false;
  return a[0] === b[0] && a[1].charAt(0) === b[1].charAt(0);
}

/** The catalogue record, reduced to what the generator needs. */
function toGridDoctor(d: Doctor): SlotGridDoctor {
  return {
    id: d.id,
    name: d.name,
    depts: d.depts,
    room: d.room,
    week: d.week,
    leave: d.leave,
    exceptions: d.exceptions,
  };
}

export interface SlotGridFilters {
  /** Department name, or `null` for every department. */
  readonly dept?: string | null;
  /** Doctor id, or `null` for every doctor. */
  readonly doctorId?: string | null;
  /**
   * Bumped by the screen's Refresh control: it re-runs the generation, which
   * is what moves the "past" cut-off to the current minute.
   */
  readonly nonce?: number;
}

export interface UseSlotGridOptions extends SlotGridFilters {
  /** ISO `yyyy-mm-dd` the grid is for. */
  readonly date: string;
}

/**
 * Grids for several dates in one pass — what the bulk update needs when it
 * repeats across a weekday, so the confirmation can count real slots on every
 * date it will touch rather than guessing.
 */
export function useSlotGrids(
  dates: readonly string[],
  { dept = null, doctorId = null, nonce = 0 }: SlotGridFilters = {},
): readonly SlotGridResult[] {
  const docs = useCatalogStore((s) => s.docs);
  const patterns = useCatalogStore((s) => s.patterns);
  const settings = useSettingsStore((s) => s.settings);
  const appts = useAppointmentsStore((s) => s.appts);
  const blocked = useSlotsStore((s) => s.blocked);
  // Joined, so a fresh array literal from the caller does not re-run the memo.
  const datesKey = dates.join(',');

  return useMemo(() => {
    void nonce;
    const rules: SlotRules = {
      slotMinutes: parseDurationMinutes(settings.rules.duration, FALLBACK_SLOT_MINUTES),
      bufferMinutes: parseDurationMinutes(settings.rules.buffer, FALLBACK_BUFFER_MINUTES),
      openMinutes: parseTimeLabelMinutes(settings.hoursOpen, FALLBACK_OPEN_MINUTES),
      closeMinutes: parseTimeLabelMinutes(settings.hoursClose, FALLBACK_CLOSE_MINUTES),
      openWeekdays: Array.from({ length: WEEK_LENGTH }, (_, i) => settings.hoursDays[i] !== false),
    };

    const roster = docs
      .filter((d) => d.status !== 'Inactive')
      .filter((d) => !dept || d.depts.includes(dept))
      .filter((d) => !doctorId || d.id === doctorId);
    const gridDoctors = roster.map(toGridDoctor);
    const blockedKeys = new Set(Object.keys(blocked));
    const nowMinutes = minutesNow();
    const today = todayIso();

    return datesKey
      .split(',')
      .filter(Boolean)
      .map((date) => {
        const bookings: SlotBooking[] = [];
        for (const a of appts) {
          if (RELEASED_STATUSES.includes(a.status)) continue;
          if (relToISOLocal(a.date) !== date) continue;
          const startMinutes = timeLabelToMinutes(a.time);
          if (startMinutes == null) continue;
          const doctor = roster.find((d) => matchesDoctorName(a.doctor, d.name));
          if (!doctor) continue;
          bookings.push({
            doctorId: doctor.id,
            startMinutes,
            label: `${a.token ?? 'No token'} · ${a.name}`,
          });
        }
        return buildSlotGrid({
          date,
          weekdayIndex: isoWeekdayIndex(date),
          doctors: gridDoctors,
          patterns,
          rules,
          bookings,
          blocked: blockedKeys,
          nowMinutes,
          today,
        });
      });
  }, [datesKey, dept, doctorId, docs, patterns, settings, appts, blocked, nonce]);
}

/** The grid for one date, or the reason it cannot be generated. */
export function useSlotGrid({ date, ...filters }: UseSlotGridOptions): SlotGridResult {
  const dates = useMemo(() => [date], [date]);
  return useSlotGrids(dates, filters)[0];
}
