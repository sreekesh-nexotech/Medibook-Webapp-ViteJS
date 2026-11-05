import { describe, expect, it } from 'vitest';

import {
  doctorReviewResponseSchema,
  scheduleChangeResponseSchema,
  scheduleResponseSchema,
  toAffectedBookings,
  toDoctorReview,
  toMovedBookings,
  toNotCancellableBookings,
  toSchedule,
  toWallClockHhmm,
} from '@/features/doctors/infrastructure/data-sources/remote/doctors.response';

describe('toWallClockHhmm (UAT-19)', () => {
  it('reads plain DRF times', () => {
    expect(toWallClockHhmm('09:00:00')).toBe('09:00');
    expect(toWallClockHhmm('17:30')).toBe('17:30');
  });

  it('reads the clock part of a date-time as written (hospital offset), not via the browser zone', () => {
    expect(toWallClockHhmm('2026-10-07T09:00:00+05:30')).toBe('09:00');
    expect(toWallClockHhmm('2026-10-07T21:15:00-04:00')).toBe('21:15');
  });

  it('returns null for anything else', () => {
    expect(toWallClockHhmm('')).toBeNull();
    expect(toWallClockHhmm('2026-')).toBeNull();
    expect(toWallClockHhmm(null)).toBeNull();
  });
});

describe('resolved next-14-days sessions', () => {
  const base = {
    doctor_id: 'd1',
    version: 3,
    slot_length_min: 15,
    weekly_sessions: [],
    leaves: [],
    date_exceptions: [],
  };

  it('turns ISO date-times into HH:MM instead of "2026-"', () => {
    const dto = scheduleResponseSchema.parse({
      ...base,
      resolved: [
        {
          date: '2026-10-07',
          source: 'weekly',
          sessions: [
            {
              session_code: 'morning',
              label: 'Morning',
              starts_at: '2026-10-07T09:00:00+05:30',
              ends_at: '2026-10-07T13:00:00+05:30',
            },
          ],
        },
      ],
    });
    expect(toSchedule(dto).upcoming[0]?.sessions[0]).toMatchObject({
      startsAt: '09:00',
      endsAt: '13:00',
    });
  });

  it('prefers the backend’s own HH:MM when it sends start_time/end_time', () => {
    const dto = scheduleResponseSchema.parse({
      ...base,
      resolved: [
        {
          date: '2026-10-07',
          source: 'weekly',
          sessions: [
            {
              session_code: 'evening',
              label: 'Evening',
              starts_at: '2026-10-07T12:30:00Z',
              ends_at: '2026-10-07T14:30:00Z',
              start_time: '18:00',
              end_time: '20:00',
            },
          ],
        },
      ],
    });
    expect(toSchedule(dto).upcoming[0]?.sessions[0]).toMatchObject({
      startsAt: '18:00',
      endsAt: '20:00',
    });
  });
});

const row = (id: string, status: string) => ({
  appointment_id: id,
  booking_ref: `BK-${id}`,
  token_label: null,
  status,
  scheduled_start_at: '2026-10-08T04:30:00Z',
  scheduled_date: '2026-10-08',
  start_time: '10:00',
  patient_name: `Patient ${id}`,
  doctor_id: 'd-1',
});

describe('schedule-change envelope (B5: L-17, L-21)', () => {
  it('reads the preview token and the bookings it keeps', () => {
    const dto = scheduleChangeResponseSchema.parse({
      dry_run: true,
      result: null,
      affected_bookings: [row('a', 'confirmed')],
      not_cancellable_bookings: [row('b', 'in_consultation')],
      preview_token: 'tok-1',
      created_count: 0,
      updated_count: 0,
      closed_count: 1,
      preserved_count: 0,
      rematerialisation_queued: false,
    });
    expect(dto.preview_token).toBe('tok-1');
    expect(toAffectedBookings(dto).map((b) => b.appointmentId)).toEqual(['a']);
    expect(toNotCancellableBookings(dto).map((b) => b.appointmentId)).toEqual(['b']);
  });

  it('treats an older envelope without the kept list as keeping nothing', () => {
    const dto = scheduleChangeResponseSchema.parse({
      dry_run: false,
      result: null,
      affected_bookings: [],
    });
    expect(toNotCancellableBookings(dto)).toEqual([]);
  });
});

describe('moved_bookings (UAT T07, proposed field)', () => {
  const env = { dry_run: true, result: null, affected_bookings: [] };

  it('is empty when the backend does not send the field', () => {
    expect(toMovedBookings(scheduleChangeResponseSchema.parse(env))).toEqual([]);
  });

  it('reads the moved bookings with their departments', () => {
    const dto = scheduleChangeResponseSchema.parse({
      ...env,
      moved_bookings: [
        {
          appointment_id: 'a1',
          booking_ref: 'BK-1',
          patient_name: 'Asha Rao',
          token_label: 'A-04',
          scheduled_start_at: '2026-11-06T04:30:00Z',
          from_department: 'Cardiology',
          to_department: 'Neurology',
        },
      ],
    });
    expect(toMovedBookings(dto)).toEqual([
      {
        appointmentId: 'a1',
        bookingRef: 'BK-1',
        patientName: 'Asha Rao',
        tokenLabel: 'A-04',
        scheduledStartAt: '2026-11-06T04:30:00Z',
        fromDepartment: 'Cardiology',
        toDepartment: 'Neurology',
      },
    ]);
  });

  it('keeps only the fields it can read and never throws on a malformed item', () => {
    const dto = scheduleChangeResponseSchema.parse({
      ...env,
      moved_bookings: [
        { booking_ref: 'BK-2' },
        { booking_ref: 7 },
        'junk',
        null,
        { appointment_id: 'a3', booking_ref: 'BK-3', to_department: null },
      ],
    });
    expect(toMovedBookings(dto).map((b) => b.bookingRef)).toEqual(['BK-2', 'BK-3']);
    expect(toMovedBookings(dto)[0]).toMatchObject({ patientName: '', toDepartment: null });
  });

  it('does not fail the whole envelope when the field is not a list', () => {
    const dto = scheduleChangeResponseSchema.parse({ ...env, moved_bookings: 'oops' });
    expect(toMovedBookings(dto)).toEqual([]);
  });

  it('drops a moved booking that the same change also cancels', () => {
    const dto = scheduleChangeResponseSchema.parse({
      ...env,
      affected_bookings: [row('a', 'confirmed')],
      moved_bookings: [
        { appointment_id: 'a', booking_ref: 'BK-a' },
        { appointment_id: 'b', booking_ref: 'BK-b' },
      ],
    });
    expect(toMovedBookings(dto).map((b) => b.appointmentId)).toEqual(['b']);
  });
});

describe('doctor reviews (DOC-01)', () => {
  it('names the patient by initials only', () => {
    const review = toDoctorReview(
      doctorReviewResponseSchema.parse({
        id: 'r-1',
        doctor_id: 'd-1',
        rating: 4,
        comment: null,
        patient_initials: 'A.R.',
        reviewed_at: '2026-10-06T20:00:00Z',
      }),
    );
    expect(review).toEqual({
      id: 'r-1',
      rating: 4,
      comment: '',
      reviewedAt: '2026-10-06T20:00:00Z',
      patientInitials: 'A.R.',
    });
  });
});
