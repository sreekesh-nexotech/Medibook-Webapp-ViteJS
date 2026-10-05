import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import {
  SETTINGS_STALE_TIME_MS,
  settingsKeys,
} from '@/features/settings/application/queries/settings.keys';
import { fetchBankAccounts } from '@/features/settings/application/usecases/fetchBankAccounts';

/**
 * The hospital's payout accounts (numbers masked to the last 4). Needs
 * `Billing & Settlements.view` — pass `enabled: false` without it.
 */
export function useBankAccountsQuery(enabled = true) {
  return useQuery({
    queryKey: settingsKeys.bankAccounts(),
    queryFn: async () => unwrap(await fetchBankAccounts()),
    staleTime: SETTINGS_STALE_TIME_MS,
    enabled,
  });
}
