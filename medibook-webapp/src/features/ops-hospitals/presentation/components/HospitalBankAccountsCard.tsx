import { isFailure } from '@/core/error/failure';

import { useOpsPermission } from '@/shared/hooks/useOpsPermission';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Icon } from '@/shared/ui/Icon';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { Spinner } from '@/shared/ui/Spinner';
import { toast } from '@/shared/ui/toast/toast.store';

import type { PayoutBankAccount } from '@/features/ops-hospitals/domain/entities/hospitals.entity';
import { useBankAccountsQuery } from '@/features/ops-hospitals/application/queries/useBankAccountsQuery';
import { useVerifyBankAccountMutation } from '@/features/ops-hospitals/application/queries/useVerifyBankAccountMutation';
import { longDateFromTimestamp } from '@/features/ops-hospitals/presentation/components/hospitals.dates';

interface HospitalBankAccountsCardProps {
  hospitalId: string;
}

/**
 * The hospital's payout accounts as platform finance sees them (M-45,
 * decision 4): masked numbers, which one is primary, and whether it was
 * verified. Payout runs skip an unverified primary, so finance verifies it
 * here (`billing.edit`) after checking it outside the system. A later number
 * change un-verifies it. Only the hospital admin can switch the primary.
 */
export function HospitalBankAccountsCard({ hospitalId }: HospitalBankAccountsCardProps) {
  const { can } = useOpsPermission();
  const accounts = useBankAccountsQuery(hospitalId);
  const verify = useVerifyBankAccountMutation();

  const handleVerify = (account: PayoutBankAccount) =>
    verify.mutate(
      { hospitalId, accountId: account.id, version: account.version },
      {
        onSuccess: () => toast(`${account.bankName} ${account.accountNumberMasked} verified.`),
        onError: (failure) =>
          toast(isFailure(failure) ? failure.message : 'The account was not verified.', 'error'),
      },
    );

  return (
    <Card>
      <SectionTitle>Payout accounts</SectionTitle>
      <div className="text-caption text-text-muted mt-1 mb-3">
        Settlements are paid to the primary account. Verify it once you have confirmed it with the
        bank (penny drop or cancelled cheque) — payout runs skip unverified accounts.
      </div>
      {accounts.isPending ? (
        <div className="text-text-muted flex justify-center py-4">
          <Spinner size={20} label="Loading payout accounts" />
        </div>
      ) : accounts.isError ? (
        <ErrorState
          inline
          title="The payout accounts didn't load"
          message={isFailure(accounts.error) ? accounts.error.message : undefined}
          onRetry={() => void accounts.refetch()}
        />
      ) : accounts.data.length === 0 ? (
        <EmptyState
          compact
          icon="landmark"
          title="No payout account yet"
          message="The hospital administrator adds one under Settings › Bank accounts."
        />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {accounts.data.map((a) => (
            <li
              key={a.id}
              className="border-border-soft flex flex-wrap items-center gap-3 rounded-md border px-3.5 py-3"
            >
              <Icon name="landmark" size={18} className="text-text-muted flex-none" />
              <div className="min-w-50 flex-1">
                <div className="text-body text-text-strong font-medium">
                  {a.bankName} · <span className="tabular-nums">{a.accountNumberMasked}</span>
                </div>
                <div className="text-caption text-text-muted">
                  {a.accountHolder} · IFSC {a.ifsc}
                  {a.verifiedAt ? ` · verified ${longDateFromTimestamp(a.verifiedAt)}` : ''}
                </div>
              </div>
              {a.isPrimary && <Badge status="Info">Primary</Badge>}
              <Badge status={a.verifiedAt ? 'Verified' : 'Pending'}>
                {a.verifiedAt ? 'Verified' : 'Not verified'}
              </Badge>
              {!a.verifiedAt && can('billing.edit') && (
                <Button
                  size="sm"
                  variant="secondary"
                  icon="shield-check"
                  busy={verify.isPending && verify.variables.accountId === a.id}
                  onClick={() => handleVerify(a)}
                >
                  Mark verified
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
