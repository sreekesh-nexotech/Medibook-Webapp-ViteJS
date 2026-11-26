import { describe, expect, it } from 'vitest';

import {
  displayQueueResponseSchema,
  toDisplayBoard,
} from '@/features/display/infrastructure/data-sources/remote/display.response';
import fixture from '@/test/contract/fixtures/display.displayQueueResponseSchema.json';

describe('display board department (point 8)', () => {
  it('names the department a screen is tied to', () => {
    const board = toDisplayBoard(
      displayQueueResponseSchema.parse({
        ...fixture,
        department: { id: 'card', name: 'Cardiology' },
      }),
    );
    expect(board.departmentName).toBe('Cardiology');
  });

  it('reads a screen for every department, and an older backend without the field', () => {
    expect(
      toDisplayBoard(displayQueueResponseSchema.parse({ ...fixture, department: null }))
        .departmentName,
    ).toBeNull();
    const older: Record<string, unknown> = { ...fixture };
    delete older.department;
    expect(toDisplayBoard(displayQueueResponseSchema.parse(older)).departmentName).toBeNull();
  });
});

describe('display board header and off-today doctors (point 7)', () => {
  it('reads the hospital logo, and leaves it out when either part is missing', () => {
    const withLogo = toDisplayBoard(
      displayQueueResponseSchema.parse({
        ...fixture,
        hospital: {
          ...fixture.hospital,
          logo_file_id: 'f-1',
          logo_url: 'https://storage.example/logo.png?sig=1',
          logo_url_expires_at: '2026-11-26T10:00:00Z',
        },
      }),
    );
    expect(withLogo.logo).toEqual({ fileId: 'f-1', url: 'https://storage.example/logo.png?sig=1' });
    const none = displayQueueResponseSchema.parse({
      ...fixture,
      hospital: { ...fixture.hospital, logo_file_id: null, logo_url: null },
    });
    expect(toDisplayBoard(none).logo).toBeNull();
    expect(toDisplayBoard(displayQueueResponseSchema.parse(fixture)).logo).toBeNull();
  });

  it('reads the doctors off today, and an older backend without them', () => {
    const board = toDisplayBoard(
      displayQueueResponseSchema.parse({
        ...fixture,
        doctors_off_today: [
          { id: 'd-1', name: 'Dr. Off', room: '449', department_id: 'x', status: 'on_leave' },
          { id: 'd-2', name: null, room: null, department_id: 'x', status: null },
        ],
      }),
    );
    expect(board.doctorsOffToday).toEqual([
      { id: 'd-1', name: 'Dr. Off', room: '449', status: 'on_leave' },
      { id: 'd-2', name: '', room: null, status: 'active' },
    ]);
    const older: Record<string, unknown> = { ...fixture };
    delete older.doctors_off_today;
    expect(toDisplayBoard(displayQueueResponseSchema.parse(older)).doctorsOffToday).toEqual([]);
  });

  it('carries the plain token number and the doctor id for one row per doctor', () => {
    const [row] = fixture.sessions;
    const board = toDisplayBoard(
      displayQueueResponseSchema.parse({
        ...fixture,
        sessions: [{ ...row, current_token: { token_no: 3, label: 'A003' } }],
      }),
    );
    expect(board.sessions[0]).toMatchObject({
      currentToken: 'A003',
      currentTokenNo: 3,
      doctorId: row?.doctor.id,
    });
  });
});
