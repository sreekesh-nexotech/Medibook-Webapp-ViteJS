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

import { useDeleteFaqMutation } from '@/features/ops-content/application/queries/useDeleteFaqMutation';
import { useFaqsQuery } from '@/features/ops-content/application/queries/useFaqsQuery';
import type { FaqEntry } from '@/features/ops-content/domain/entities/content.entities';
import { FAQ_AUDIENCE_LABEL } from '@/features/ops-content/presentation/components/content.rules';
import { FaqModal } from '@/features/ops-content/presentation/components/FaqModal';

const COLUMNS = ['Question', 'Category', 'Shown in', 'Order', 'Status', ''] as const;

type Editor = { readonly faq: FaqEntry | null } | null;

/** FAQs for the patient app and the hospital console (`/platform/faqs`, R2). */
export function FaqsCard() {
  const faqs = useFaqsQuery();
  const remove = useDeleteFaqMutation();
  const { can } = useOpsPermission();
  const [editor, setEditor] = useState<Editor>(null);
  const [toDelete, setToDelete] = useState<FaqEntry | null>(null);
  const rows = faqs.data ?? [];
  const hasAudience = rows.some((f) => f.audience !== null);
  const categories = [...new Set(rows.map((f) => f.category))].sort();

  const state: TableStateSpec | undefined = faqs.isPending
    ? { kind: 'loading', rows: 5 }
    : faqs.isError
      ? {
          kind: 'error',
          message: isFailure(faqs.error) ? faqs.error.message : undefined,
          onRetry: () => void faqs.refetch(),
        }
      : rows.length === 0
        ? {
            kind: 'empty',
            icon: 'circle-help',
            title: 'No FAQs yet.',
            message: 'Questions added here show in the help section of the app.',
          }
        : undefined;

  const confirmDelete = (): void => {
    if (!toDelete) return;
    remove.mutate(
      { id: toDelete.id, version: toDelete.rowVersion },
      {
        onSuccess: () => {
          toast('FAQ removed.', 'success');
          setToDelete(null);
        },
        onError: (error) =>
          toast(isFailure(error) ? error.message : 'Could not remove the FAQ.', 'error'),
      },
    );
  };

  return (
    <Card>
      <div className="mb-4 flex items-center gap-3">
        <SectionTitle>FAQs</SectionTitle>
        <span className="text-caption text-text-muted">{rows.length} entries</span>
        <div className="flex-1"></div>
        {can('settings.add') && (
          <Button icon="plus" onClick={() => setEditor({ faq: null })}>
            Add FAQ
          </Button>
        )}
      </div>
      <TableShell columns={COLUMNS} scrollLabel="FAQ entries" state={state} rightCols={['Order']}>
        {[...rows]
          .sort((a, b) => a.category.localeCompare(b.category) || a.sortOrder - b.sortOrder)
          .map((f) => (
            <tr key={f.id}>
              <td className={`${tdClass} max-w-120`}>
                <span className="text-text-strong font-medium">{f.question}</span>
              </td>
              <td className={tdClass}>{f.category}</td>
              <td className={tdClass}>{FAQ_AUDIENCE_LABEL[f.audience ?? 'patient']}</td>
              <td className={`${tdClass} text-right tabular-nums`}>{f.sortOrder}</td>
              <td className={tdClass}>
                <Badge status={f.isPublished ? 'Live' : 'Paused'}>
                  {f.isPublished ? 'Published' : 'Hidden'}
                </Badge>
              </td>
              <td className={tdClass}>
                <div className="flex gap-2">
                  {can('settings.edit') && (
                    <IconBtn
                      name="pencil"
                      box={36}
                      size={15}
                      label="Edit FAQ"
                      onClick={() => setEditor({ faq: f })}
                    />
                  )}
                  {can('settings.del') && (
                    <IconBtn
                      name="trash-2"
                      box={36}
                      size={15}
                      color="var(--color-d-500)"
                      label="Remove FAQ"
                      onClick={() => setToDelete(f)}
                    />
                  )}
                </div>
              </td>
            </tr>
          ))}
      </TableShell>
      {editor && (
        <FaqModal
          key={editor.faq?.id ?? 'new'}
          faq={editor.faq}
          hasAudience={hasAudience}
          categories={categories}
          onClose={() => setEditor(null)}
        />
      )}
      <OpsConfirm
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        icon="trash-2"
        tone="danger"
        title="Remove this FAQ?"
        body={toDelete ? `“${toDelete.question}” leaves the app straight away.` : ''}
        confirmLabel={remove.isPending ? 'Removing…' : 'Remove FAQ'}
        confirmVariant="danger"
        busy={remove.isPending}
        onConfirm={confirmDelete}
      />
    </Card>
  );
}
