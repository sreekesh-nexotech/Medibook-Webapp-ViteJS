import { describe, expect, it } from 'vitest';

import { reportExportQueuedResponseSchema } from '@/features/reports/infrastructure/data-sources/remote/reports.response';
import { exportStatusOf } from '@/features/reports/infrastructure/repositories/reports.repository.impl';

const NOW = Date.parse('2026-10-07T10:00:00Z');

describe('queued export status (UAT-67)', () => {
  it('reads a built file as ready until it expires', () => {
    expect(exportStatusOf('clean', '2026-10-14T10:00:00Z', NOW)).toBe('ready');
    expect(exportStatusOf('clean', null, NOW)).toBe('ready');
    expect(exportStatusOf('clean', '2026-10-07T09:59:59Z', NOW)).toBe('expired');
  });

  it('keeps waiting while it is built, and says when the build failed (B7)', () => {
    expect(exportStatusOf('pending', '2026-10-14T10:00:00Z', NOW)).toBe('pending');
    expect(exportStatusOf('failed', null, NOW)).toBe('failed');
    expect(exportStatusOf('sealed', null, NOW)).toBe('expired');
  });

  it('parses the 202 body with and without the fields B9 types', () => {
    expect(
      reportExportQueuedResponseSchema.parse({
        status: 'processing',
        export_id: 'f-1',
        file_url: '/api/v1/shared/files/f-1',
        rows: 61000,
        max_sync_rows: 50000,
      }).export_id,
    ).toBe('f-1');
    expect(
      reportExportQueuedResponseSchema.parse({ status: 'processing', export_id: 'f-2' }).rows,
    ).toBeUndefined();
  });
});
