import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { dashboardKeys } from '@/features/dashboard/application/queries/dashboard.keys';
import { refreshAfterPatientDecision } from '@/features/patients/application/queries/patients.cache';
import { patientsKeys } from '@/features/patients/application/queries/patients.keys';

describe('refreshAfterPatientDecision', () => {
  it('marks the patients and the dashboard stale at once, without waiting for the refetch', () => {
    const client = new QueryClient();
    client.setQueryData([...patientsKeys.all, 'approvals'], []);
    client.setQueryData([...dashboardKeys.all, 'admin'], {});
    const result: unknown = refreshAfterPatientDecision(client);
    expect(result).toBeUndefined();
    expect(client.getQueryState([...patientsKeys.all, 'approvals'])?.isInvalidated).toBe(true);
    expect(client.getQueryState([...dashboardKeys.all, 'admin'])?.isInvalidated).toBe(true);
  });
});
