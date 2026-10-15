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

import { useDeleteDocumentRequirementMutation } from '@/features/ops-onboarding-documents/application/queries/useDeleteDocumentRequirementMutation';
import { useDocumentRequirementsQuery } from '@/features/ops-onboarding-documents/application/queries/useDocumentRequirementsQuery';
import type { DocumentRequirement } from '@/features/ops-onboarding-documents/domain/entities/onboardingDocuments.entities';
import { DocumentRequirementModal } from '@/features/ops-onboarding-documents/presentation/components/DocumentRequirementModal';
import { inChecklistOrder } from '@/features/ops-onboarding-documents/presentation/components/onboardingDocuments.rules';

const COLUMNS = ['Order', 'Document', 'Code', 'New hospitals', ''] as const;

type Editor = { readonly requirement: DocumentRequirement | null } | null;

/**
 * The onboarding document catalogue (Q66): the physical documents the
 * onboarding team collects from a hospital and ticks off on its checklist.
 * There is no upload approval — this list only shapes the checklist.
 * `settings.*`.
 */
export function OpsOnboardingDocumentsScreen() {
  const requirements = useDocumentRequirementsQuery();
  const remove = useDeleteDocumentRequirementMutation();
  const { can } = useOpsPermission();
  const [editor, setEditor] = useState<Editor>(null);
  const [toDelete, setToDelete] = useState<DocumentRequirement | null>(null);
  const all = requirements.data ?? [];
  const rows = inChecklistOrder(all);
  const requiredCount = rows.filter((r) => r.isRequiredDefault).length;

  const state: TableStateSpec | undefined = requirements.isPending
    ? { kind: 'loading', rows: 6 }
    : requirements.isError
      ? {
          kind: 'error',
          message: isFailure(requirements.error) ? requirements.error.message : undefined,
          onRetry: () => void requirements.refetch(),
        }
      : rows.length === 0
        ? {
            kind: 'empty',
            icon: 'file-text',
            title: 'No onboarding documents yet.',
            message: 'New hospitals start with an empty checklist until documents are added here.',
          }
        : undefined;

  const confirmDelete = (): void => {
    if (!toDelete) return;
    remove.mutate(
      { id: toDelete.id, version: toDelete.version },
      {
        onSuccess: () => {
          toast(`${toDelete.name} removed from the catalogue.`, 'success');
          setToDelete(null);
        },
        onError: (error) =>
          toast(isFailure(error) ? error.message : 'Could not remove the document.', 'error'),
      },
    );
  };

  return (
    <Card>
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <SectionTitle>Onboarding documents</SectionTitle>
        <span className="text-caption text-text-muted">
          {rows.length} in the catalogue · {requiredCount} on every new checklist
        </span>
        <div className="flex-1"></div>
        {can('settings.add') && (
          <Button icon="plus" onClick={() => setEditor({ requirement: null })}>
            Add document
          </Button>
        )}
      </div>
      <p className="text-caption text-text-muted mt-0 mb-4">
        Documents are collected physically and ticked off on each hospital’s onboarding checklist.
        Changes here apply to hospitals onboarded from now on.
      </p>
      <TableShell
        columns={COLUMNS}
        scrollLabel="Onboarding documents"
        state={state}
        rightCols={['Order']}
      >
        {rows.map((r) => (
          <tr key={r.id}>
            <td className={`${tdClass} text-right tabular-nums`}>{r.sortOrder}</td>
            <td className={`${tdClass} max-w-120`}>
              <span className="text-text-strong block font-medium">{r.name}</span>
              {r.description && (
                <span className="text-text-muted text-caption">{r.description}</span>
              )}
            </td>
            <td className={`${tdClass} font-mono`}>{r.code}</td>
            <td className={tdClass}>
              <Badge status={r.isRequiredDefault ? 'Active' : 'Inactive'}>
                {r.isRequiredDefault ? 'Required' : 'Optional'}
              </Badge>
            </td>
            <td className={tdClass}>
              <div className="flex gap-2">
                {can('settings.edit') && (
                  <IconBtn
                    name="pencil"
                    box={36}
                    size={15}
                    label={`Edit ${r.name}`}
                    onClick={() => setEditor({ requirement: r })}
                  />
                )}
                {can('settings.del') && (
                  <IconBtn
                    name="trash-2"
                    box={36}
                    size={15}
                    color="var(--color-d-500)"
                    label={`Remove ${r.name}`}
                    onClick={() => setToDelete(r)}
                  />
                )}
              </div>
            </td>
          </tr>
        ))}
      </TableShell>
      {editor && (
        <DocumentRequirementModal
          key={editor.requirement?.id ?? 'new'}
          requirement={editor.requirement}
          existing={all}
          onClose={() => setEditor(null)}
        />
      )}
      <OpsConfirm
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        icon="trash-2"
        tone="danger"
        title="Remove this document?"
        body={
          toDelete
            ? `${toDelete.name} leaves the catalogue and new checklists, and its code can never be used again. Hospitals already onboarding keep it on their checklist but can no longer tick it there — if it is still open it would block their go-live. To stop asking new hospitals for it, edit it and make it optional instead.`
            : ''
        }
        confirmLabel={remove.isPending ? 'Removing…' : 'Remove document'}
        confirmVariant="danger"
        busy={remove.isPending}
        onConfirm={confirmDelete}
      />
    </Card>
  );
}
