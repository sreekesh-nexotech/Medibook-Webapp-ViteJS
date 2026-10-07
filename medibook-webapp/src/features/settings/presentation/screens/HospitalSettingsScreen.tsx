import { usePermission } from '@/shared/hooks/usePermission';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { SkeletonBlock, SkeletonCards } from '@/shared/ui/Skeleton';

import { useBankAccountsQuery } from '@/features/settings/application/queries/useBankAccountsQuery';
import { useHospitalHoursQuery } from '@/features/settings/application/queries/useHospitalHoursQuery';
import { useHospitalProfileQuery } from '@/features/settings/application/queries/useHospitalProfileQuery';
import { useHospitalRuleSettingsQuery } from '@/features/settings/application/queries/useHospitalRuleSettingsQuery';
import { useNumberingQuery } from '@/features/settings/application/queries/useNumberingQuery';
import { useTokenPolicyQuery } from '@/features/settings/application/queries/useTokenPolicyQuery';
import { payoutAccountOf } from '@/features/settings/application/store/settings.form';

import { type BankAccountsState, SettingsEditor } from '../components/SettingsEditor';

/** Skeleton geometry: the section nav column and the first section card. */
const NAV_SKELETON_WIDTH = 240;
const NAV_SKELETON_HEIGHT = 280;
const CARD_SKELETON_LINES = 8;
const CARD_SKELETON_PAD = 28;

/**
 * Hospital Settings (module H2) — loads the hospital's profile, rulebook,
 * working hours, token policy and number series from the API, then hands them to
 * `SettingsEditor`. The payout account loads on its own (it needs the
 * Billing & Settlements permission), so a refusal there never blocks the
 * rest of the screen.
 */
export function HospitalSettingsScreen() {
  const { can } = usePermission();
  const canView = can('Hospital Settings.view');
  const canViewBank = canView && can('Billing & Settlements.view');

  const profile = useHospitalProfileQuery(canView);
  const rules = useHospitalRuleSettingsQuery(canView);
  const hours = useHospitalHoursQuery(canView);
  const tokenPolicy = useTokenPolicyQuery(canView);
  const numbering = useNumberingQuery(canView);
  const bankAccounts = useBankAccountsQuery(canViewBank);

  if (!canView) {
    return (
      <Card>
        <EmptyState
          icon="lock"
          title="You do not have access to hospital settings"
          message="Hospital settings are limited to roles with the Hospital Settings view permission. Ask an administrator to grant it under Users & Roles."
        />
      </Card>
    );
  }

  const core = [profile, rules, hours, tokenPolicy, numbering];
  const failed = core.find((q) => q.isLoadingError);
  if (failed) {
    return (
      <ErrorState
        error={failed.error}
        title="Hospital settings did not load"
        message="Nothing has changed. Retry to load the settings again."
        onRetry={() => {
          for (const q of core) if (q.isLoadingError) void q.refetch();
        }}
      />
    );
  }

  if (!profile.data || !rules.data || !hours.data || !tokenPolicy.data || !numbering.data) {
    return (
      <div className="flex items-start gap-5" aria-busy="true">
        <SkeletonBlock w={NAV_SKELETON_WIDTH} h={NAV_SKELETON_HEIGHT} className="flex-none" />
        <div className="min-w-0 flex-1">
          <SkeletonCards count={1} lines={CARD_SKELETON_LINES} pad={CARD_SKELETON_PAD} />
        </div>
      </div>
    );
  }

  const bank: BankAccountsState = !canViewBank
    ? { status: 'hidden' }
    : bankAccounts.isLoadingError
      ? { status: 'error', error: bankAccounts.error, retry: () => void bankAccounts.refetch() }
      : bankAccounts.data
        ? { status: 'ready', account: payoutAccountOf(bankAccounts.data) }
        : { status: 'loading' };

  return (
    <SettingsEditor
      profile={profile.data}
      rules={rules.data}
      hours={hours.data}
      tokenPolicy={tokenPolicy.data}
      numbering={numbering.data}
      bank={bank}
    />
  );
}
