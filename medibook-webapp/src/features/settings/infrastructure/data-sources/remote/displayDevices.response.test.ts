import { describe, expect, it } from 'vitest';

import {
  displayDevicePageSchema,
  toDisplayDevice,
} from '@/features/settings/infrastructure/data-sources/remote/displayDevices.response';
import fixture from '@/test/contract/fixtures/settings.displayDevicePageSchema.json';

const ROW = fixture.results[0];

describe('display device department (point 8)', () => {
  it('reads the department a screen is tied to', () => {
    const page = displayDevicePageSchema.parse({
      ...fixture,
      results: [{ ...ROW, selected_department_id: 'card' }],
    });
    const row = page.results[0];
    if (!row) throw new Error('expected a row');
    expect(toDisplayDevice(row).selectedDepartmentId).toBe('card');
  });

  it('reads no department as every department, also from an older backend', () => {
    const older: Record<string, unknown> = { ...ROW };
    delete older.selected_department_id;
    const page = displayDevicePageSchema.parse({ ...fixture, results: [older] });
    const row = page.results[0];
    if (!row) throw new Error('expected a row');
    expect(toDisplayDevice(row).selectedDepartmentId).toBeNull();
  });
});
