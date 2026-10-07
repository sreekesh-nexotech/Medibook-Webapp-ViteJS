import { useState } from 'react';

import { describeFailure } from '@/shared/lib/serverErrors';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Can } from '@/shared/ui/Can';
import { Card } from '@/shared/ui/Card';
import { ConfirmModal } from '@/shared/ui/ConfirmModal';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { IconBtn } from '@/shared/ui/IconBtn';
import { SkeletonCards } from '@/shared/ui/Skeleton';
import { toast } from '@/shared/ui/toast/toast.store';

import { useCan } from '@/shared/hooks/usePermission';

import type { Counter } from '@/features/settings/domain/entities/settings.entities';
import { useDeleteCounterMutation } from '@/features/settings/application/queries/useCounterMutations';
import { useCountersQuery } from '@/features/settings/application/queries/useCountersQuery';

import { CounterModal } from './CounterModal';
import { SettingsHead } from './SettingsHead';

/**
 * Settings › Counters — the front-desk counters (`/hospital/counters`,
 * `hospital_settings.view/add/edit/del`). A counter's code prints on every
 * receipt taken there; deleting one keeps past receipts' reference.
 */
export function CountersPanel() {
  const counters = useCountersQuery();
  const remove = useDeleteCounterMutation();
  const canAdd = useCan('Hospital Settings.add');
  const [editing, setEditing] = useState<{ counter: Counter | null } | null>(null);
  const [deleting, setDeleting] = useState<Counter | null>(null);

  const confirmDelete = (): void => {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    remove.mutate(
      { id: target.id, version: target.version },
      {
        onSuccess: () => toast(`Counter ${target.code} removed`, 'info'),
        onError: (error) =>
          toast(describeFailure(error, 'The counter could not be removed.'), 'error'),
      },
    );
  };

  return (
    <Card pad={28}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1">
          <SettingsHead info="Each receipt prints the counter it was taken at. Staff get a default counter in Users & Roles; a cash drawer is opened at a counter.">
            Counters
          </SettingsHead>
        </div>
        <Can perm="Hospital Settings.add">
          <Button icon="plus" onClick={() => setEditing({ counter: null })}>
            Add Counter
          </Button>
        </Can>
      </div>
      {counters.isPending ? (
        <SkeletonCards count={2} lines={2} />
      ) : counters.isError ? (
        <ErrorState
          inline
          title="Counters did not load"
          message={describeFailure(counters.error, 'Please try again.')}
          onRetry={() => void counters.refetch()}
        />
      ) : counters.data.length === 0 ? (
        <EmptyState
          compact
          icon="contact"
          title="No counters yet"
          message="Add the desks where staff take payments, e.g. C1 Main Reception."
          actionLabel={canAdd ? 'Add a counter' : undefined}
          onAction={canAdd ? () => setEditing({ counter: null }) : undefined}
        />
      ) : (
        <ul className="divide-border-soft border-border-soft divide-y rounded-md border">
          {counters.data.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="text-body text-text-strong w-20 font-semibold">{c.code}</span>
              <span className="text-body text-text-body flex-1">{c.name}</span>
              <Badge status={c.isActive ? 'Active' : 'Inactive'} />
              <Can perm="Hospital Settings.edit">
                <IconBtn
                  name="pencil"
                  label={`Edit counter ${c.code}`}
                  box={34}
                  size={15}
                  onClick={() => setEditing({ counter: c })}
                />
              </Can>
              <Can perm="Hospital Settings.del">
                <IconBtn
                  name="trash-2"
                  label={`Remove counter ${c.code}`}
                  box={34}
                  size={15}
                  color="var(--color-d-500)"
                  onClick={() => setDeleting(c)}
                />
              </Can>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <CounterModal
          key={editing.counter?.id ?? 'new-counter'}
          counter={editing.counter}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmModal
        open={deleting !== null}
        danger
        title="Remove this counter?"
        confirmLabel="Remove"
        body={
          deleting
            ? `Counter ${deleting.code} (${deleting.name}) can no longer be picked. Past receipts keep showing it.`
            : ''
        }
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </Card>
  );
}
