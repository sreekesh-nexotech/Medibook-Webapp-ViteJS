import { useState } from 'react';

import { isFailure } from '@/core/error/failure';
import { FormModal } from '@/shared/ui/FormModal';
import { OpsField } from '@/shared/ui/OpsField';
import { TextArea } from '@/shared/ui/TextArea';
import { Toggle } from '@/shared/ui/Toggle';
import { toast } from '@/shared/ui/toast/toast.store';

import { useUpdateOpsFeatureFlagMutation } from '@/features/ops-settings/application/queries/useUpdateOpsFeatureFlagMutation';
import type { FeatureFlag } from '@/features/ops-settings/domain/entities/opsSettings.entity';

interface OpsFeatureFlagModalProps {
  flag: FeatureFlag;
  onClose: () => void;
}

/**
 * Describe a feature flag and choose whether the apps may read it
 * (`PATCH /platform/feature-flags/{key}`, `settings.edit`). The key is fixed;
 * switching the flag stays on the card. Mount only while open.
 */
export function OpsFeatureFlagModal({ flag, onClose }: OpsFeatureFlagModalProps) {
  const update = useUpdateOpsFeatureFlagMutation();
  const [description, setDescription] = useState(flag.description);
  const [isPublic, setIsPublic] = useState(flag.isPublic);
  const changed = description.trim() !== flag.description || isPublic !== flag.isPublic;

  const submit = (): void => {
    if (!changed) {
      onClose();
      return;
    }
    update.mutate(
      {
        key: flag.key,
        changes: {
          ...(description.trim() !== flag.description ? { description: description.trim() } : {}),
          ...(isPublic !== flag.isPublic ? { isPublic } : {}),
        },
      },
      {
        onSuccess: () => {
          toast(`${flag.key} saved.`, 'success');
          onClose();
        },
        onError: (failure) =>
          toast(isFailure(failure) ? failure.message : 'Could not save the flag.', 'error'),
      },
    );
  };

  return (
    <FormModal
      open
      onClose={onClose}
      title={`Edit ${flag.key}`}
      width={560}
      onSubmit={submit}
      submitLabel="Save flag"
      busy={update.isPending}
      disabled={!changed}
    >
      <div className="flex flex-col gap-4">
        <OpsField
          label="Description"
          hint="What switching it on changes, for whoever reads this next."
        >
          <TextArea value={description} onChange={setDescription} rows={3} />
        </OpsField>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <Toggle value={isPublic} onChange={setIsPublic} label="Public" />
            <span className="text-body text-text-strong">Public</span>
          </div>
          <span className="text-caption text-text-muted">
            {isPublic
              ? 'Sent to the apps in the public app configuration — anyone can read its value, so never use it for anything secret.'
              : 'Read by the server only; the apps never see it.'}
          </span>
        </div>
      </div>
    </FormModal>
  );
}
