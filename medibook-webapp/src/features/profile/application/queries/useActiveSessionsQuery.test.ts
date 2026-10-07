import { afterEach, describe, expect, it } from 'vitest';

import { clearTokens, setTokens } from '@/core/api/tokens';

import { activeSessionsQueryOptions } from '@/features/profile/application/queries/useActiveSessionsQuery';

const GRANT = { access: 'access-token', refresh: 'refresh-token', accessExpiresIn: 900 };

describe('activeSessionsQueryOptions', () => {
  afterEach(() => clearTokens('hospital'));

  it('reads the device list while this browser is signed in', () => {
    setTokens('hospital', GRANT);
    expect(activeSessionsQueryOptions('hospital').enabled).toBe(true);
  });

  it('stays idle once the tokens are gone (after "sign out everywhere")', () => {
    setTokens('hospital', GRANT);
    clearTokens('hospital');
    expect(activeSessionsQueryOptions('hospital').enabled).toBe(false);
  });
});
