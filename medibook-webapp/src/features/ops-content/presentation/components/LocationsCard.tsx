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

import { useContentLocationsQuery } from '@/features/ops-content/application/queries/useContentLocationsQuery';
import { useDeleteLocationMutation } from '@/features/ops-content/application/queries/useDeleteLocationMutation';
import type { ContentLocation } from '@/features/ops-content/domain/entities/content.entities';
import { LocationModal } from '@/features/ops-content/presentation/components/LocationModal';

const COLUMNS = ['Area', 'City', 'State', 'Coordinates', 'Status', ''] as const;

type Editor = { readonly location: ContentLocation | null } | null;

/** The city and area list the patient app searches by (`/platform/locations`, R3). */
export function LocationsCard() {
  const locations = useContentLocationsQuery();
  const remove = useDeleteLocationMutation();
  const { can } = useOpsPermission();
  const [editor, setEditor] = useState<Editor>(null);
  const [toDelete, setToDelete] = useState<ContentLocation | null>(null);
  const rows = [...(locations.data ?? [])].sort(
    (a, b) => a.city.localeCompare(b.city) || a.area.localeCompare(b.area),
  );

  const state: TableStateSpec | undefined = locations.isPending
    ? { kind: 'loading', rows: 5 }
    : locations.isError
      ? {
          kind: 'error',
          message: isFailure(locations.error) ? locations.error.message : undefined,
          onRetry: () => void locations.refetch(),
        }
      : rows.length === 0
        ? {
            kind: 'empty',
            icon: 'map-pin',
            title: 'No locations yet.',
            message: 'Add the cities and areas patients can pick in the app.',
          }
        : undefined;

  const confirmDelete = (): void => {
    if (!toDelete) return;
    remove.mutate(
      { id: toDelete.id, version: toDelete.rowVersion },
      {
        onSuccess: () => {
          toast('Location removed.', 'success');
          setToDelete(null);
        },
        onError: (error) =>
          toast(isFailure(error) ? error.message : 'Could not remove the location.', 'error'),
      },
    );
  };

  return (
    <Card>
      <div className="mb-4 flex items-center gap-3">
        <SectionTitle>Locations</SectionTitle>
        <span className="text-caption text-text-muted">{rows.length} areas</span>
        <div className="flex-1"></div>
        {can('settings.add') && (
          <Button icon="plus" onClick={() => setEditor({ location: null })}>
            Add location
          </Button>
        )}
      </div>
      <TableShell columns={COLUMNS} scrollLabel="Locations" state={state}>
        {rows.map((l) => (
          <tr key={l.id}>
            <td className={`${tdClass} text-text-strong font-medium`}>
              {l.area}
              {l.isPopular && <span className="text-caption text-text-muted"> · popular</span>}
            </td>
            <td className={tdClass}>{l.city}</td>
            <td className={tdClass}>{l.state}</td>
            <td className={`${tdClass} tabular-nums`}>
              {l.lat && l.lng ? `${l.lat}, ${l.lng}` : '—'}
            </td>
            <td className={tdClass}>
              <Badge status={l.isActive ? 'Active' : 'Inactive'} />
            </td>
            <td className={tdClass}>
              <div className="flex gap-2">
                {can('settings.edit') && (
                  <IconBtn
                    name="pencil"
                    box={36}
                    size={15}
                    label="Edit location"
                    onClick={() => setEditor({ location: l })}
                  />
                )}
                {can('settings.del') && (
                  <IconBtn
                    name="trash-2"
                    box={36}
                    size={15}
                    color="var(--color-d-500)"
                    label="Remove location"
                    onClick={() => setToDelete(l)}
                  />
                )}
              </div>
            </td>
          </tr>
        ))}
      </TableShell>
      {editor && (
        <LocationModal
          key={editor.location?.id ?? 'new'}
          location={editor.location}
          onClose={() => setEditor(null)}
        />
      )}
      <OpsConfirm
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        icon="trash-2"
        tone="danger"
        title="Remove this location?"
        body={
          toDelete
            ? `${toDelete.area}, ${toDelete.city} leaves the app's location list. It is kept on record.`
            : ''
        }
        confirmLabel={remove.isPending ? 'Removing…' : 'Remove'}
        confirmVariant="danger"
        busy={remove.isPending}
        onConfirm={confirmDelete}
      />
    </Card>
  );
}
