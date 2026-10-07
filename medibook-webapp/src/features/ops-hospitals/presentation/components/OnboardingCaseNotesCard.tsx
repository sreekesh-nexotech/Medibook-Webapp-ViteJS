import { useState } from 'react';

import { isFailure } from '@/core/error/failure';

import { useOpsPermission } from '@/shared/hooks/useOpsPermission';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { OpsField } from '@/shared/ui/OpsField';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { Select } from '@/shared/ui/Select';
import { toast } from '@/shared/ui/toast/toast.store';

import type { OnboardingCaseDetail } from '@/features/ops-hospitals/domain/entities/onboarding.entity';
import { useUpdateOnboardingCaseMutation } from '@/features/ops-hospitals/application/queries/useUpdateOnboardingCaseMutation';
import { useAssignableStaffQuery } from '@/features/ops-users/application/queries/useAssignableStaffQuery';

/** `OnboardingCaseUpdateSerializer.notes` max length. */
const NOTES_MAX = 5000;

const UNASSIGNED = 'Unassigned';

interface OnboardingCaseNotesCardProps {
  detail: OnboardingCaseDetail;
}

/**
 * Internal notes and the operator working the case (10·R12, `PATCH
 * /platform/onboarding/cases/{id} {notes, assigned_to_id}`, If-Match).
 * The picker lists active staff from `GET /platform/staff/assignable`, which
 * `onboarding.edit` may read without the full staff list (`staff.view`).
 */
export function OnboardingCaseNotesCard({ detail }: OnboardingCaseNotesCardProps) {
  const { can } = useOpsPermission();
  const canEdit = can('onboarding.edit');
  const staff = useAssignableStaffQuery();
  const update = useUpdateOnboardingCaseMutation();
  const [notes, setNotes] = useState(detail.notes ?? '');

  const active = staff.data?.items ?? [];
  const assignee = active.find((m) => m.id === detail.assignedToId) ?? null;
  const isNotesDirty = notes.trim() !== (detail.notes ?? '').trim();

  const save = (changes: { notes?: string | null; assignedToId?: string | null }, done: string) =>
    update.mutate(
      { caseId: detail.id, changes, version: detail.version },
      {
        onSuccess: () => toast(done, 'success'),
        onError: (failure) =>
          toast(
            isFailure(failure) && failure.code === 'CONFLICT_VERSION'
              ? 'Someone else changed this case. It has been reloaded — check and try again.'
              : isFailure(failure)
                ? failure.message
                : 'The case was not saved.',
            'error',
          ),
      },
    );

  return (
    <Card>
      <SectionTitle>Case notes</SectionTitle>
      <div className="mt-3 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <OpsField label="Notes (internal, never shown to the hospital)">
            {(field) => (
              <textarea
                id={field.id}
                value={notes}
                maxLength={NOTES_MAX}
                readOnly={!canEdit}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Who you spoke to, what is promised and by when"
                className="border-border text-body text-text-strong rounded-input box-border h-24 w-full resize-y border p-3"
              />
            )}
          </OpsField>
          {canEdit && (
            <div className="mt-2 flex justify-end">
              <Button
                size="sm"
                variant="secondary"
                disabled={!isNotesDirty}
                busy={update.isPending && update.variables.changes.notes !== undefined}
                onClick={() => save({ notes: notes.trim() || null }, 'Notes saved.')}
              >
                Save notes
              </Button>
            </div>
          )}
        </div>
        <OpsField label="Assigned to">
          {canEdit ? (
            <Select
              value={assignee?.name ?? UNASSIGNED}
              options={[UNASSIGNED, ...active.map((m) => m.name)]}
              onChange={(name) => {
                const next = active.find((m) => m.name === name)?.id ?? null;
                if (next === detail.assignedToId) return;
                save(
                  { assignedToId: next },
                  next ? `Assigned to ${name}.` : 'The case is unassigned.',
                );
              }}
              disabled={update.isPending || staff.isPending}
              height={44}
            />
          ) : (
            <div className="text-body text-text-strong py-2.5">
              {assignee?.name ?? (detail.assignedToId ? 'Assigned' : UNASSIGNED)}
            </div>
          )}
        </OpsField>
      </div>
    </Card>
  );
}
