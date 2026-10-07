import { useState } from 'react';

import { isFailure } from '@/core/error/failure';
import { useOpsPermission } from '@/shared/hooks/useOpsPermission';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { IconBtn } from '@/shared/ui/IconBtn';
import { OpsConfirm } from '@/shared/ui/OpsConfirm';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';
import { toast } from '@/shared/ui/toast/toast.store';

import { useAmbulanceProvidersQuery } from '@/features/ops-content/application/queries/useAmbulanceProvidersQuery';
import { useContentLocationsQuery } from '@/features/ops-content/application/queries/useContentLocationsQuery';
import { useDeleteAmbulanceProviderMutation } from '@/features/ops-content/application/queries/useDeleteAmbulanceProviderMutation';
import type { AmbulanceProvider } from '@/features/ops-content/domain/entities/content.entities';
import { AmbulanceModal } from '@/features/ops-content/presentation/components/AmbulanceModal';

const COLUMNS = ['Provider', 'Phone', 'Location', 'Arrival', 'Status', ''] as const;

type Editor = { readonly provider: AmbulanceProvider | null } | null;

/** Ambulance services the patient app lists, curated by the platform (`/platform/ambulance-providers`, R4). */
export function AmbulanceProvidersCard() {
  const providers = useAmbulanceProvidersQuery();
  const locations = useContentLocationsQuery();
  const remove = useDeleteAmbulanceProviderMutation();
  const { can } = useOpsPermission();
  const [editor, setEditor] = useState<Editor>(null);
  const [toDelete, setToDelete] = useState<AmbulanceProvider | null>(null);
  const rows = [...(providers.data ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  const places = locations.data ?? [];
  const placeOf = (id: string | null): string => {
    if (id === null) return 'Any location';
    const l = places.find((p) => p.id === id);
    return l ? `${l.area}, ${l.city}` : 'Removed location';
  };

  const state: TableStateSpec | undefined = providers.isPending
    ? { kind: 'loading', rows: 4 }
    : providers.isError
      ? {
          kind: 'error',
          message: isFailure(providers.error) ? providers.error.message : undefined,
          onRetry: () => void providers.refetch(),
        }
      : rows.length === 0
        ? {
            kind: 'empty',
            icon: 'phone',
            title: 'No ambulance providers yet.',
            message: 'Providers added here show on the app’s emergency screen.',
          }
        : undefined;

  const confirmDelete = (): void => {
    if (!toDelete) return;
    remove.mutate(
      { id: toDelete.id, version: toDelete.rowVersion },
      {
        onSuccess: () => {
          toast('Ambulance provider removed.', 'success');
          setToDelete(null);
        },
        onError: (error) =>
          toast(isFailure(error) ? error.message : 'Could not remove the provider.', 'error'),
      },
    );
  };

  return (
    <Card>
      <div className="mb-4 flex items-center gap-3">
        <SectionTitle>Ambulance providers</SectionTitle>
        <span className="text-caption text-text-muted">{rows.length} providers</span>
        <div className="flex-1"></div>
        {can('settings.add') && (
          <Button icon="plus" onClick={() => setEditor({ provider: null })}>
            Add provider
          </Button>
        )}
      </div>
      <TableShell columns={COLUMNS} scrollLabel="Ambulance providers" state={state}>
        {rows.map((p) => (
          <tr key={p.id}>
            <td className={tdClass}>
              <div className="flex flex-col">
                <span className="text-text-strong font-medium">{p.name}</span>
                {p.serviceArea && (
                  <span className="text-caption text-text-muted">{p.serviceArea}</span>
                )}
              </div>
            </td>
            <td className={`${tdClass} tabular-nums`}>{p.phoneE164}</td>
            <td className={tdClass}>{placeOf(p.locationId)}</td>
            <td className={tdClass}>{p.etaMinutes === null ? '—' : `${p.etaMinutes} min`}</td>
            <td className={tdClass}>
              <Badge status={p.isActive ? 'Active' : 'Inactive'} />
            </td>
            <td className={tdClass}>
              <div className="flex gap-2">
                {can('settings.edit') && (
                  <IconBtn
                    name="pencil"
                    box={36}
                    size={15}
                    label="Edit provider"
                    onClick={() => setEditor({ provider: p })}
                  />
                )}
                {can('settings.del') && (
                  <IconBtn
                    name="trash-2"
                    box={36}
                    size={15}
                    color="var(--color-d-500)"
                    label="Remove provider"
                    onClick={() => setToDelete(p)}
                  />
                )}
              </div>
            </td>
          </tr>
        ))}
      </TableShell>
      {editor && (
        <AmbulanceModal
          key={editor.provider?.id ?? 'new'}
          provider={editor.provider}
          locations={places}
          onClose={() => setEditor(null)}
        />
      )}
      <OpsConfirm
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        icon="trash-2"
        tone="danger"
        title="Remove this provider?"
        body={toDelete ? `${toDelete.name} leaves the app's emergency screen.` : ''}
        confirmLabel={remove.isPending ? 'Removing…' : 'Remove'}
        confirmVariant="danger"
        busy={remove.isPending}
        onConfirm={confirmDelete}
      />
    </Card>
  );
}
