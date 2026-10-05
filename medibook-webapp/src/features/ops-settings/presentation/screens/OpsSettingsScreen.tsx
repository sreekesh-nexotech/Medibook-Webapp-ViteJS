import { ErrorState } from '@/shared/ui/ErrorState';
import { SkeletonCards } from '@/shared/ui/Skeleton';

import { isFailure } from '@/core/error/failure';

import { useOpsSettingsQuery } from '@/features/ops-settings/application/queries/useOpsSettingsQuery';
import { OpsSettingsFlagsCard } from '@/features/ops-settings/presentation/components/OpsSettingsFlagsCard';
import { OpsSettingsForm } from '@/features/ops-settings/presentation/components/OpsSettingsForm';
import { OpsSettingsTaxRatesCard } from '@/features/ops-settings/presentation/components/OpsSettingsTaxRatesCard';

/** Placeholder cards while the settings record loads (one per form section). */
const SETTINGS_SECTIONS = 4;

/**
 * Platform settings (Ops.jsx OpsSettings) on the live platform API: the
 * settings record form, then feature flags and default tax rates, each with
 * its own loading / error / empty states. The settings record is a singleton,
 * so it has no empty state — a missing record is an error.
 */
export function OpsSettingsScreen() {
  const settings = useOpsSettingsQuery();

  let form;
  if (settings.isPending) {
    form = <SkeletonCards count={SETTINGS_SECTIONS} className="flex-col gap-5" />;
  } else if (settings.isError) {
    form = (
      <ErrorState
        title="Could not load platform settings"
        message={isFailure(settings.error) ? settings.error.message : undefined}
        onRetry={() => void settings.refetch()}
      />
    );
  } else {
    // Re-seed the form whenever a save (or a conflict reload) brings a new version.
    form = <OpsSettingsForm key={settings.data.version} settings={settings.data} />;
  }

  return (
    <div className="flex flex-col gap-5">
      {form}
      <OpsSettingsFlagsCard />
      <OpsSettingsTaxRatesCard />
    </div>
  );
}
