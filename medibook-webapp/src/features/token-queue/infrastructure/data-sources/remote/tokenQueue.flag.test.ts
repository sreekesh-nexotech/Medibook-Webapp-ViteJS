import { describe, expect, it } from 'vitest';

import {
  queueRowSchema,
  toQueueRows,
} from '@/features/token-queue/infrastructure/data-sources/remote/tokenQueue.response';

const row = { appointment_id: 'a1', token_no: 3, status: 'scheduled', kind: 'up_next' };

describe('patient_account_flag on queue rows (UAT T10/T12/T16, proposed)', () => {
  it('reads the flag when the backend sends it', () => {
    const [r] = toQueueRows([queueRowSchema.parse({ ...row, patient_account_flag: 'blocked' })]);
    expect(r?.patientAccountFlag).toBe('blocked');
  });

  it('is null when the backend does not send it', () => {
    const [r] = toQueueRows([queueRowSchema.parse(row)]);
    expect(r?.patientAccountFlag).toBeNull();
  });
});
