import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { hospitalsKeys } from '@/features/ops-hospitals/application/queries/hospitals.keys';
import { fetchBankAccounts } from '@/features/ops-hospitals/application/usecases/fetchBankAccounts';

/** A hospital's payout accounts (`billing.view`). */
export function useBankAccountsQuery(hospitalId: string, enabled = true) {
  return useQuery({
    queryKey: hospitalsKeys.bankAccounts(hospitalId),
    queryFn: async () => unwrap(await fetchBankAccounts(hospitalId)),
    enabled,
  });
}
