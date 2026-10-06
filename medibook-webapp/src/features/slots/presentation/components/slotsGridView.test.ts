import { describe, expect, it } from 'vitest';

import type { DoctorSlotDay } from '@/features/slots/domain/entities/slots.entities';
import {
  toSlotGridView,
  zonedMinutes,
} from '@/features/slots/presentation/components/slotsGridView';

const KOLKATA = 'Asia/Kolkata';

/** Shapes from the live grid: Morning OPD 9:00–12:00 IST is 03:30–06:30 UTC. */
const morning = (status: string): DoctorSlotDay => ({
  doctorId: 'doc-1',
  doctorName: 'Dr. Harish Menon',
  departmentId: 'dept-1',
  slotLengthMin: 20,
  sessions: [
    {
      id: 'sess-1',
      sessionCode: 'morning',
      label: 'Morning OPD',
      status,
      startsAt: '2026-10-06T03:30:00+00:00',
      endsAt: '2026-10-06T06:30:00+00:00',
      slots: [
        {
          id: 'slot-1',
          startsAt: '2026-10-06T03:30:00+00:00',
          endsAt: '2026-10-06T03:50:00+00:00',
          state: 'held',
          blockReason: null,
          holdExpiresAt: '2026-10-06T03:35:00+00:00',
          booking: null,
        },
      ],
    },
  ],
});

const context = {
  deptNames: new Map([['dept-1', 'Cardiology']]),
  rooms: new Map<string, string>(),
  timeZone: KOLKATA,
  holidays: [],
};

describe('slot grid view', () => {
  it('reads times in the hospital time zone, whatever the browser zone', () => {
    expect(zonedMinutes('2026-10-06T03:30:00+00:00', KOLKATA)).toBe(9 * 60);
    expect(zonedMinutes('2026-10-06T11:30:00+00:00', KOLKATA)).toBe(17 * 60);
  });

  it('labels sessions with their hours and flags a closed one', () => {
    const view = toSlotGridView('2026-10-06', [morning('closed')], context);
    expect(view.columns).toEqual([9 * 60]);
    expect(view.rows[0].sessions).toEqual([
      { id: 'sess-1', label: 'Morning OPD 9:00 am–12:00 pm', statusLabel: 'Closed' },
    ]);
    expect(view.rows[0].slots[0].detail).toBe('held for payment until 9:05 am');
  });

  it('leaves a normally running session unflagged', () => {
    const view = toSlotGridView('2026-10-06', [morning('scheduled')], context);
    expect(view.rows[0].sessions[0].statusLabel).toBeNull();
  });

  it('says a holiday is why a doctor has no slots', () => {
    const empty: DoctorSlotDay = { ...morning('scheduled'), sessions: [] };
    const holidays = [
      { name: 'Foundation day', from: '2026-10-08', to: '2026-10-08', departmentId: null },
    ];
    const onHoliday = toSlotGridView('2026-10-08', [empty], { ...context, holidays });
    expect(onHoliday.rows[0].closedReason).toBe('Hospital holiday — Foundation day');
    const otherDay = toSlotGridView('2026-10-11', [empty], { ...context, holidays });
    expect(otherDay.rows[0].closedReason).toBe('No sessions on this date');
  });
});
