import { useOpsPermission } from '@/shared/hooks/useOpsPermission';
import { Badge } from '@/shared/ui/Badge';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { SkeletonLine } from '@/shared/ui/Skeleton';
import { Toggle } from '@/shared/ui/Toggle';
import { toast } from '@/shared/ui/toast/toast.store';

import { isFailure } from '@/core/error/failure';

import { useOpsFeatureFlagsQuery } from '@/features/ops-settings/application/queries/useOpsFeatureFlagsQuery';
import { useSetOpsFeatureFlagMutation } from '@/features/ops-settings/application/queries/useSetOpsFeatureFlagMutation';

/** Shimmer rows while the flags load. */
const LOADING_ROWS = 3;

/**
 * Platform feature flags — each toggle saves on its own through
 * `PATCH /platform/feature-flags/{key}` (logged to the config change trail).
 */
export function OpsSettingsFlagsCard() {
  const flags = useOpsFeatureFlagsQuery();
  const setFlag = useSetOpsFeatureFlagMutation();
  // SEC-05: switching a flag needs settings.edit.
  const canEdit = useOpsPermission().can('settings.edit');

  const handleToggle = (key: string, enabled: boolean) => {
    setFlag.mutate(
      { key, enabled },
      {
        onSuccess: (flag) =>
          toast(`${flag.key} ${flag.enabled ? 'switched on' : 'switched off'}.`, 'success'),
        onError: (failure) =>
          toast(
            isFailure(failure) ? failure.message : 'Could not change that flag.',
            'error',
            failure,
          ),
      },
    );
  };

  let body;
  if (flags.isPending) {
    body = (
      <div role="status" aria-label="Loading feature flags" className="flex flex-col gap-4.5">
        {Array.from({ length: LOADING_ROWS }, (_, i) => (
          <SkeletonLine key={i} h={14} />
        ))}
      </div>
    );
  } else if (flags.isLoadingError) {
    body = (
      <ErrorState
        error={flags.error}
        inline
        title="Could not load feature flags"
        message={isFailure(flags.error) ? flags.error.message : undefined}
        onRetry={() => void flags.refetch()}
      />
    );
  } else if (flags.data.items.length === 0) {
    body = (
      <EmptyState
        compact
        icon="sliders-horizontal"
        title="No feature flags"
        message="Flags the platform defines will appear here."
      />
    );
  } else {
    const { items, total } = flags.data;
    body = (
      <div className="flex flex-col gap-4.5">
        {items.map((flag) => (
          <div key={flag.key} className="flex items-start gap-3">
            <Toggle
              value={flag.enabled}
              onChange={(v) => handleToggle(flag.key, v)}
              label={flag.key}
              disabled={!canEdit || (setFlag.isPending && setFlag.variables.key === flag.key)}
            />
            <div className="flex flex-col gap-0.5">
              <span className="text-body text-text-strong flex items-center gap-2 font-medium">
                {flag.key}
                {flag.isPublic && <Badge status="Info">Public</Badge>}
              </span>
              <span className="text-caption text-text-muted">{flag.description}</span>
            </div>
          </div>
        ))}
        {total > items.length && (
          <span className="text-caption text-text-muted">
            Showing {items.length} of {total} flags.
          </span>
        )}
      </div>
    );
  }

  return (
    <Card>
      <SectionTitle className="mb-4.5">Feature Flags</SectionTitle>
      {body}
    </Card>
  );
}
