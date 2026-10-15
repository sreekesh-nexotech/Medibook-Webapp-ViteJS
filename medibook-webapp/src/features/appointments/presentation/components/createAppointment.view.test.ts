import { describe, expect, it } from 'vitest';

import type {
  DoctorServiceLink,
  PricedService,
} from '@/features/settings/domain/entities/services.entities';
import type { DoctorSlotDay, SlotLiveState } from '@/features/slots/domain/entities/slots.entities';
import {
  servicesForDoctor,
  uniqueLabels,
} from '@/features/appointments/presentation/components/createAppointment.view';
import { bookableSlots } from '@/features/appointments/presentation/components/slotPicker.view';

const KOLKATA = 'Asia/Kolkata';

function service(over: Partial<PricedService>): PricedService {
  return {
    id: 'svc',
    code: 'SVC',
    name: 'ECG',
    departmentId: null,
    description: '',
    durationMinutes: 15,
    priceRupees: 300,
    taxRateId: null,
    requiresDoctor: true,
    isActive: true,
    version: 1,
    ...over,
  };
}

describe('unique select labels', () => {
  it('keeps plain names and tells repeated names apart', () => {
    const labels = uniqueLabels(
      [
        { id: '1', name: 'Dr Rao', room: '4' },
        { id: '2', name: 'Dr Rao', room: '9' },
        { id: '3', name: 'Dr Iyer', room: '' },
      ],
      (d) => d.name,
      (d) => (d.room ? `Room ${d.room}` : ''),
    );
    expect([...labels.values()]).toEqual(['Dr Rao (Room 4)', 'Dr Rao (Room 9)', 'Dr Iyer']);
  });

  it('still separates names whose suffix is the same too', () => {
    const labels = uniqueLabels(
      [
        { id: '1', name: 'OPD' },
        { id: '2', name: 'OPD' },
      ],
      (d) => d.name,
      () => '',
    );
    expect(new Set(labels.values()).size).toBe(2);
  });
});

describe('services per consultation', () => {
  const services = [
    service({ id: 'ecg', name: 'ECG', priceRupees: 300 }),
    service({ id: 'echo', name: 'Echo', priceRupees: 1500 }),
    service({ id: 'old', name: 'Old test', isActive: false }),
  ];
  const links: DoctorServiceLink[] = [
    { id: 'l1', doctorId: 'd1', serviceId: 'echo', priceOverrideRupees: 1200 },
    { id: 'l2', doctorId: 'd1', serviceId: 'ecg', priceOverrideRupees: null },
    { id: 'l3', doctorId: 'd1', serviceId: 'old', priceOverrideRupees: null },
    { id: 'l4', doctorId: 'd2', serviceId: 'ecg', priceOverrideRupees: 250 },
  ];

  it('lists the doctor’s active services at the doctor’s price', () => {
    expect(servicesForDoctor('d1', services, links)).toEqual([
      { id: 'ecg', name: 'ECG', priceRupees: 300 },
      { id: 'echo', name: 'Echo', priceRupees: 1200 },
    ]);
  });

  it('offers nothing before a doctor is chosen or for a doctor without links', () => {
    expect(servicesForDoctor('', services, links)).toEqual([]);
    expect(servicesForDoctor('d9', services, links)).toEqual([]);
  });
});

describe('walk-in slot picker (UAT-18)', () => {
  const now = Date.parse('2026-10-07T05:20:00Z'); // 10:50 Kolkata
  const slot = (id: string, startUtc: string, endUtc: string, state: SlotLiveState = 'open') => ({
    id,
    startsAt: startUtc,
    endsAt: endUtc,
    state,
    blockReason: null,
    holdExpiresAt: null,
    booking: null,
  });
  const day = (status: string): DoctorSlotDay => ({
    doctorId: 'd1',
    doctorName: 'Dr A',
    departmentId: 'dep',
    slotLengthMin: 15,
    sessions: [
      {
        id: 's1',
        sessionCode: 'M',
        label: 'Morning',
        status,
        startsAt: '2026-10-07T04:30:00Z',
        endsAt: '2026-10-07T06:30:00Z',
        slots: [
          slot('ended', '2026-10-07T04:30:00Z', '2026-10-07T04:45:00Z'),
          slot('running', '2026-10-07T05:15:00Z', '2026-10-07T05:30:00Z'),
          slot('later', '2026-10-07T05:30:00Z', '2026-10-07T05:45:00Z'),
          slot('taken', '2026-10-07T05:45:00Z', '2026-10-07T06:00:00Z', 'booked'),
        ],
      },
    ],
  });

  it('offers open slots that have not ended, minus ones this visit already took', () => {
    const choice = bookableSlots([day('open')], 'd1', ['later'], now, KOLKATA);
    expect(choice.options.map((o) => o.id)).toEqual(['running']);
    expect(choice.options[0].label).toMatch(/^10:45\s?am · Morning$/i);
    expect(choice.emptyReason).toBeNull();
  });

  it('says why there is nothing to pick', () => {
    expect(bookableSlots([], 'd1', [], now, KOLKATA).emptyReason).toBe('no-session');
    expect(bookableSlots([day('closed')], 'd1', [], now, KOLKATA).emptyReason).toBe(
      'sessions-closed',
    );
    expect(bookableSlots([day('open')], 'd1', ['running', 'later'], now, KOLKATA).emptyReason).toBe(
      'all-taken',
    );
  });
});
