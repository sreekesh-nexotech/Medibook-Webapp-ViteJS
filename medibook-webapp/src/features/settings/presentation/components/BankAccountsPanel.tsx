import { useState } from 'react';

import { fmtDate } from '@/shared/lib/format';
import { describeFailure } from '@/shared/lib/serverErrors';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Can } from '@/shared/ui/Can';
import { Card } from '@/shared/ui/Card';
import { ConfirmModal } from '@/shared/ui/ConfirmModal';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Icon } from '@/shared/ui/Icon';
import { IconBtn } from '@/shared/ui/IconBtn';
import { SkeletonLine } from '@/shared/ui/Skeleton';
import { toast } from '@/shared/ui/toast/toast.store';

import type { BankAccount } from '@/features/settings/domain/entities/settings.entities';
import {
  useDeleteBankAccountMutation,
  useMakeBankAccountPrimaryMutation,
} from '@/features/settings/application/queries/useBankAccountMutations';

import { BankAccountModal } from './BankAccountModal';
import { SettingsHead } from './SettingsHead';

/** The bank section's data, which loads (and may be refused) separately. */
export type BankAccountsState =
  | { readonly status: 'hidden' }
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly retry: () => void }
  | { readonly status: 'ready'; readonly accounts: readonly BankAccount[] };

interface BankAccountsPanelProps {
  bank: BankAccountsState;
  /** Only the hospital admin role may switch the payout account (decision 4). */
  isAdmin: boolean;
}

/**
 * Settings › Bank & Payouts — every payout account (07·F13): add, edit,
 * remove, set the primary one payouts go to, and whether Medibook finance
 * has verified it. Payout runs skip an unverified primary account.
 */
export function BankAccountsPanel({ bank, isAdmin }: BankAccountsPanelProps) {
  const remove = useDeleteBankAccountMutation();
  const makePrimary = useMakeBankAccountPrimaryMutation();
  const [editing, setEditing] = useState<{ account: BankAccount | null } | null>(null);
  const [deleting, setDeleting] = useState<BankAccount | null>(null);
  const [promoting, setPromoting] = useState<BankAccount | null>(null);

  const confirmDelete = (): void => {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    remove.mutate(
      { id: target.id, version: target.version },
      {
        onSuccess: () => toast(`Account ending ${target.accountLast4} removed`, 'info'),
        onError: (error) =>
          toast(describeFailure(error, 'The account could not be removed.'), 'error'),
      },
    );
  };

  const confirmPrimary = (): void => {
    if (!promoting) return;
    const target = promoting;
    setPromoting(null);
    makePrimary.mutate(target.id, {
      onSuccess: () =>
        toast(`Payouts now go to the account ending ${target.accountLast4}`, 'success'),
      onError: (error) =>
        toast(describeFailure(error, 'The payout account could not be changed.'), 'error'),
    });
  };

  return (
    <Card pad={28}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1">
          <SettingsHead info="Medibook releases online-booking settlements to the primary account once Medibook finance has verified it. Every change notifies the hospital admins and Medibook finance.">
            Bank &amp; Payouts
          </SettingsHead>
        </div>
        {bank.status === 'ready' && (
          <Can perm="Billing & Settlements.edit">
            <Button icon="plus" onClick={() => setEditing({ account: null })}>
              Add Account
            </Button>
          </Can>
        )}
      </div>

      {bank.status === 'hidden' && (
        <div className="text-body text-text-muted flex items-center gap-2.5">
          <Icon name="lock" size={16} className="flex-none" /> Bank details are limited to roles
          with the Billing &amp; Settlements view permission.
        </div>
      )}
      {bank.status === 'loading' && (
        <div className="flex flex-col gap-4">
          <SkeletonLine w="60%" />
          <SkeletonLine w="80%" />
        </div>
      )}
      {bank.status === 'error' && (
        <ErrorState
          inline
          title="Bank accounts did not load"
          message="The rest of the settings are fine. Retry to load the payout accounts."
          onRetry={bank.retry}
        />
      )}
      {bank.status === 'ready' &&
        (bank.accounts.length === 0 ? (
          <EmptyState
            compact
            icon="landmark"
            title="No payout account yet"
            message="Add the account Medibook should pay online-booking settlements into."
          />
        ) : (
          <ul className="divide-border-soft border-border-soft divide-y rounded-md border">
            {bank.accounts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                <div className="min-w-60 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-body text-text-strong font-medium">
                      {a.bankName} •••• {a.accountLast4}
                    </span>
                    {a.isPrimary && <Badge status="Active">Primary</Badge>}
                    {a.verifiedAt ? (
                      <Badge status="Completed">
                        Verified {fmtDate(a.verifiedAt.slice(0, 10))}
                      </Badge>
                    ) : (
                      <Badge status="Pending">Not verified</Badge>
                    )}
                  </div>
                  <div className="text-caption text-text-muted">
                    {a.accountHolder} · IFSC {a.ifsc}
                    {a.upiId ? ` · UPI ${a.upiId}` : ''}
                  </div>
                  {a.isPrimary && !a.verifiedAt && (
                    <div className="text-caption text-y-700 mt-0.5">
                      Payouts wait until Medibook finance verifies this account.
                    </div>
                  )}
                </div>
                {!a.isPrimary && isAdmin && (
                  <Can perm="Billing & Settlements.edit">
                    <Button size="sm" variant="secondary" onClick={() => setPromoting(a)}>
                      Make primary
                    </Button>
                  </Can>
                )}
                <Can perm="Billing & Settlements.edit">
                  <IconBtn
                    name="pencil"
                    label={`Edit account ending ${a.accountLast4}`}
                    box={34}
                    size={15}
                    onClick={() => setEditing({ account: a })}
                  />
                  <IconBtn
                    name="trash-2"
                    label={`Remove account ending ${a.accountLast4}`}
                    box={34}
                    size={15}
                    color="var(--color-d-500)"
                    onClick={() => setDeleting(a)}
                  />
                </Can>
              </li>
            ))}
          </ul>
        ))}
      {bank.status === 'ready' && !isAdmin && bank.accounts.length > 1 && (
        <p className="text-caption text-text-muted mt-3">
          Only the hospital admin can change which account is primary.
        </p>
      )}
      <div className="text-caption text-text-muted bg-y-100 mt-4.5 flex items-center gap-2 rounded-md px-3 py-2.5">
        <Icon name="lock" size={15} className="text-y-700 flex-none" /> Settlement payouts pause if
        the primary account is missing or unverified — keep it current.
      </div>

      {editing && (
        <BankAccountModal
          key={editing.account?.id ?? 'new-account'}
          account={editing.account}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmModal
        open={deleting !== null}
        danger
        title="Remove this bank account?"
        confirmLabel="Remove"
        body={
          deleting
            ? `The account ending ${deleting.accountLast4} is removed.${
                deleting.isPrimary
                  ? ' It is the primary account: payouts pause until another account is made primary and verified.'
                  : ''
              }`
            : ''
        }
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
      <ConfirmModal
        open={promoting !== null}
        title="Pay settlements into this account?"
        confirmLabel="Make primary"
        body={
          promoting
            ? `Future payouts go to ${promoting.bankName} •••• ${promoting.accountLast4}.${
                promoting.verifiedAt
                  ? ''
                  : ' It is not verified yet, so payouts wait until Medibook finance verifies it.'
              }`
            : ''
        }
        onClose={() => setPromoting(null)}
        onConfirm={confirmPrimary}
      />
    </Card>
  );
}
