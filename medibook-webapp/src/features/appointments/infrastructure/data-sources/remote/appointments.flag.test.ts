import { describe, expect, it } from 'vitest';

import recorded from '@/test/contract/fixtures/appointments.appointmentResponseSchema.json';
import {
  appointmentResponseSchema,
  toAppointment,
} from '@/features/appointments/infrastructure/data-sources/remote/appointments.response';
import { canCheckIn } from '@/features/appointments/presentation/components/appointments.view';

function desk(flag: unknown) {
  return toAppointment(
    appointmentResponseSchema.parse({ ...recorded, patient_account_flag: flag }),
  );
}

describe('patient_account_flag on the desk appointment (UAT T10/T12/T16)', () => {
  it('reads blocked and pending_deletion', () => {
    expect(desk('blocked').patientAccountFlag).toBe('blocked');
    expect(desk('pending_deletion').patientAccountFlag).toBe('pending_deletion');
  });

  it('is null when absent (the recorded older backend), null or unknown', () => {
    expect(toAppointment(appointmentResponseSchema.parse(recorded)).patientAccountFlag).toBeNull();
    expect(desk(null).patientAccountFlag).toBeNull();
    expect(desk('something_new').patientAccountFlag).toBeNull();
  });

  it('never blocks the desk: check-in depends on status, day and payment only', () => {
    const base = desk(null);
    const today = base.scheduledDate;
    for (const flag of ['blocked', 'pending_deletion', null] as const) {
      const a = { ...base, status: 'scheduled' as const, paymentStatus: 'paid' as const };
      expect(canCheckIn({ ...a, patientAccountFlag: flag }, today)).toBe(true);
    }
  });
});
