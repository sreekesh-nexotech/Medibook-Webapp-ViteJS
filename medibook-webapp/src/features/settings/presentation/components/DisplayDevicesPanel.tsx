import { useState } from 'react';

import { describeFailure } from '@/shared/lib/serverErrors';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { ConfirmModal } from '@/shared/ui/ConfirmModal';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { IconBtn } from '@/shared/ui/IconBtn';
import { SkeletonCards } from '@/shared/ui/Skeleton';
import { toast } from '@/shared/ui/toast/toast.store';

import type { DisplayDevice } from '@/features/settings/domain/entities/settings.entities';
import type { DisplayDeviceAccess } from '@/features/settings/application/queries/useDisplayDeviceAccess';
import {
  useDeleteDisplayDeviceMutation,
  useRotateDisplayDeviceKeyMutation,
  useUpdateDisplayDeviceMutation,
} from '@/features/settings/application/queries/useDisplayDeviceMutations';
import { useDisplayDevicesQuery } from '@/features/settings/application/queries/useDisplayDevicesQuery';

import { DeviceKeyModal } from './DeviceKeyModal';
import { DisplayDeviceModal } from './DisplayDeviceModal';
import { SettingsHead } from './SettingsHead';

/** "7 Oct, 9:05 am", or "never" for a screen that has not signed in yet. */
function lastSeen(iso: string | null): string {
  if (!iso) return 'never signed in';
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : `last seen ${date.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`;
}

type Pending =
  | { readonly kind: 'rotate'; readonly device: DisplayDevice }
  | { readonly kind: 'delete'; readonly device: DisplayDevice };

interface DisplayDevicesPanelProps {
  access: DisplayDeviceAccess;
}

/**
 * Settings › Display Screens — token TVs (`/hospital/display-devices`,
 * O-10, permission module `display_devices`). Register a screen (its key is
 * shown once), rename it, rotate its key, deactivate or remove it.
 */
export function DisplayDevicesPanel({ access }: DisplayDevicesPanelProps) {
  const devices = useDisplayDevicesQuery(access.canView);
  const update = useUpdateDisplayDeviceMutation();
  const rotate = useRotateDisplayDeviceKeyMutation();
  const remove = useDeleteDisplayDeviceMutation();
  const [editing, setEditing] = useState<{ device: DisplayDevice | null } | null>(null);
  const [issued, setIssued] = useState<{ name: string; key: string } | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);

  const toggleActive = (d: DisplayDevice): void => {
    update.mutate(
      { id: d.id, changes: { isActive: !d.isActive }, version: d.version },
      {
        onSuccess: () =>
          toast(
            d.isActive ? `${d.name} deactivated — it is signed out` : `${d.name} reactivated`,
            'info',
          ),
        onError: (error) =>
          toast(describeFailure(error, 'The screen could not be changed.'), 'error'),
      },
    );
  };

  const confirmPending = (): void => {
    if (!pending) return;
    const { kind, device } = pending;
    setPending(null);
    if (kind === 'rotate') {
      rotate.mutate(device.id, {
        onSuccess: (out) => setIssued({ name: out.device.name, key: out.deviceKey }),
        onError: (error) => toast(describeFailure(error, 'The key could not be rotated.'), 'error'),
      });
      return;
    }
    remove.mutate(
      { id: device.id, version: device.version },
      {
        onSuccess: () => toast(`${device.name} removed`, 'info'),
        onError: (error) =>
          toast(describeFailure(error, 'The screen could not be removed.'), 'error'),
      },
    );
  };

  return (
    <Card pad={28}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1">
          <SettingsHead info="Each screen signs in with its own key and shows the live queue — first name and last initial unless Queue & Tokens says otherwise.">
            Display Screens
          </SettingsHead>
        </div>
        {access.canAdd && (
          <Button icon="plus" onClick={() => setEditing({ device: null })}>
            Register Screen
          </Button>
        )}
      </div>
      {devices.isPending ? (
        <SkeletonCards count={2} lines={2} />
      ) : devices.isError ? (
        <ErrorState
          inline
          title="Display screens did not load"
          message={describeFailure(devices.error, 'Please try again.')}
          onRetry={() => void devices.refetch()}
        />
      ) : devices.data.length === 0 ? (
        <EmptyState
          compact
          icon="monitor"
          title="No display screens yet"
          message="Register the TV in your waiting area to show the live token queue."
          actionLabel={access.canAdd ? 'Register a screen' : undefined}
          onAction={access.canAdd ? () => setEditing({ device: null }) : undefined}
        />
      ) : (
        <ul className="divide-border-soft border-border-soft divide-y rounded-md border">
          {devices.data.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-50 flex-1">
                <div className="text-body text-text-strong font-medium">{d.name}</div>
                <div className="text-caption text-text-muted">{lastSeen(d.lastSeenAt)}</div>
              </div>
              <Badge status={d.isActive ? 'Active' : 'Inactive'} />
              {access.canEdit && (
                <>
                  <Button size="sm" variant="secondary" onClick={() => toggleActive(d)}>
                    {d.isActive ? 'Deactivate' : 'Reactivate'}
                  </Button>
                  <IconBtn
                    name="key-round"
                    label={`Rotate the key of ${d.name}`}
                    box={34}
                    size={15}
                    onClick={() => setPending({ kind: 'rotate', device: d })}
                  />
                  <IconBtn
                    name="pencil"
                    label={`Rename ${d.name}`}
                    box={34}
                    size={15}
                    onClick={() => setEditing({ device: d })}
                  />
                </>
              )}
              {access.canDelete && (
                <IconBtn
                  name="trash-2"
                  label={`Remove ${d.name}`}
                  box={34}
                  size={15}
                  color="var(--color-d-500)"
                  onClick={() => setPending({ kind: 'delete', device: d })}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <DisplayDeviceModal
          key={editing.device?.id ?? 'new-device'}
          device={editing.device}
          onClose={() => setEditing(null)}
          onRegistered={(created) => {
            setEditing(null);
            setIssued({ name: created.device.name, key: created.deviceKey });
          }}
        />
      )}
      <DeviceKeyModal issued={issued} onClose={() => setIssued(null)} />
      <ConfirmModal
        open={pending !== null}
        danger
        title={pending?.kind === 'rotate' ? 'Rotate this screen’s key?' : 'Remove this screen?'}
        confirmLabel={pending?.kind === 'rotate' ? 'Rotate key' : 'Remove'}
        body={
          pending
            ? pending.kind === 'rotate'
              ? `${pending.device.name} is signed out at once and needs the new key to show the queue again.`
              : `${pending.device.name} is signed out and removed. Register it again to use it.`
            : ''
        }
        onClose={() => setPending(null)}
        onConfirm={confirmPending}
      />
    </Card>
  );
}
