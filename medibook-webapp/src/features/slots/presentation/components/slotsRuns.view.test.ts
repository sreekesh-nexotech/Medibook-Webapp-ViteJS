import { describe, expect, it } from 'vitest';

import type {
  SlotGenerationRun,
  SlotRegenerateResult,
} from '@/features/slots/domain/entities/slots.entities';
import {
  affectedBookingLine,
  regenerateCopy,
  runCopy,
  runStatus,
} from '@/features/slots/presentation/components/slotsRuns.view';

const run = (patch: Partial<SlotGenerationRun> = {}): SlotGenerationRun => ({
  id: 'r1',
  doctorId: null,
  trigger: 'rule_change',
  horizonFrom: null,
  horizonTo: null,
  startedAt: '2026-10-07T03:35:00Z',
  finishedAt: '2026-10-07T03:36:00Z',
  createdCount: 12,
  updatedCount: 0,
  closedCount: 3,
  preservedCount: 1,
  error: null,
  ...patch,
});

const result = (patch: Partial<SlotRegenerateResult> = {}): SlotRegenerateResult => ({
  runId: 'r1',
  queued: false,
  createdCount: 4,
  updatedCount: 1,
  closedCount: 2,
  preservedCount: 1,
  affectedBookings: [],
  ...patch,
});

describe('generation runs', () => {
  it('describes a finished run in the hospital zone with every non-zero change', () => {
    expect(runCopy(run(), 'Asia/Kolkata')).toBe(
      'Slots last generated 7 Oct, 9:05 am (rule change run) · 12 created, 3 closed, 1 kept for bookings',
    );
  });

  it('tells running and failed runs apart', () => {
    expect(runStatus(run({ finishedAt: null }))).toBe('running');
    expect(runStatus(run({ error: 'boom' }))).toBe('failed');
  });
});

describe('regenerate result (UAT-73)', () => {
  it('names the bookings left on slots the rules no longer produce', () => {
    const copy = regenerateCopy(
      result({
        affectedBookings: [
          {
            appointmentId: 'a',
            bookingRef: 'BK-1',
            tokenLabel: 'A001',
            patientName: 'Asha Rao',
            scheduledStartAt: '2026-10-08T05:00:00Z',
          },
        ],
      }),
    );
    expect(copy).toBe(
      'Slots regenerated — 4 created, 1 updated, 2 closed, 1 kept for bookings. 1 booking sits on slots the rules no longer produce — review it.',
    );
  });

  it('says a background regeneration started instead of reporting zero counts', () => {
    expect(regenerateCopy(result({ queued: true }))).toMatch(/background/);
  });

  it('formats booking times in the hospital zone', () => {
    expect(
      affectedBookingLine(
        {
          appointmentId: 'a',
          bookingRef: 'BK-1',
          tokenLabel: null,
          patientName: 'Asha Rao',
          scheduledStartAt: '2026-10-08T05:00:00Z',
        },
        'Asia/Kolkata',
      ),
    ).toBe('BK-1 Asha Rao · 8 Oct, 10:30 am');
  });
});
