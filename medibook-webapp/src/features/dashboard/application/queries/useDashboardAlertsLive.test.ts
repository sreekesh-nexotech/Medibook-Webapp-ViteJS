import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { appointmentsKeys } from '@/features/appointments/application/queries/appointments.keys';
import { dashboardKeys } from '@/features/dashboard/application/queries/dashboard.keys';
import { refreshAfterAlert } from '@/features/dashboard/application/queries/useDashboardAlertsLive';

describe('refreshAfterAlert', () => {
  it('marks the dashboard and the desk appointment reads stale', () => {
    const client = new QueryClient();
    const dayList = [...appointmentsKeys.lists(), 'day', 'x'] as const;
    client.setQueryData(dashboardKeys.reception(), { ok: true });
    client.setQueryData(dayList, []);
    client.setQueryData(appointmentsKeys.detail('a1'), { id: 'a1' });
    client.setQueryData(appointmentsKeys.receipt('a1'), { no: 'R1' });

    refreshAfterAlert(client);

    const stale = (key: readonly unknown[]) => client.getQueryState(key)?.isInvalidated;
    expect(stale(dashboardKeys.reception())).toBe(true);
    expect(stale(dayList)).toBe(true);
    expect(stale(appointmentsKeys.detail('a1'))).toBe(true);
    // A receipt does not change when a payment lands elsewhere.
    expect(stale(appointmentsKeys.receipt('a1'))).toBe(false);
  });
});
