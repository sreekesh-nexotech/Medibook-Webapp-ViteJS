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

import type { PrintTemplate } from '@/features/settings/domain/entities/settings.entities';
import { useDeletePrintTemplateMutation } from '@/features/settings/application/queries/usePrintTemplateMutations';
import { usePrintTemplatesQuery } from '@/features/settings/application/queries/usePrintTemplatesQuery';

import { PrintPreviewModal } from './PrintPreviewModal';
import { PrintTemplateModal } from './PrintTemplateModal';
import { TEMPLATE_KIND_LABEL } from './printTemplates.labels';
import { SettingsHead } from './SettingsHead';

/**
 * Print templates for receipts and token slips (`/hospital/print-templates`,
 * Q22): add, edit, preview with sample data, remove. The default of a kind
 * and the token policy's template cannot be removed (the server says why).
 */
export function PrintTemplatesPanel() {
  const templates = usePrintTemplatesQuery();
  const remove = useDeletePrintTemplateMutation();
  const [editing, setEditing] = useState<{ template: PrintTemplate | null } | null>(null);
  const [previewing, setPreviewing] = useState<PrintTemplate | null>(null);
  const [deleting, setDeleting] = useState<PrintTemplate | null>(null);

  const confirmDelete = (): void => {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    remove.mutate(target.id, {
      onSuccess: () => toast(`Template “${target.name}” removed`, 'info'),
      onError: (error) =>
        toast(describeFailure(error, 'The template could not be removed.'), 'error'),
    });
  };

  return (
    <Card pad={28}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1">
          <SettingsHead info="Layouts for printed receipts and token slips. Each kind has one default; the token policy can pick a slip template of its own.">
            Print Templates
          </SettingsHead>
        </div>
        <Can perm="Hospital Settings.add">
          <Button icon="plus" onClick={() => setEditing({ template: null })}>
            Add Template
          </Button>
        </Can>
      </div>
      {templates.isPending ? (
        <SkeletonCards count={2} lines={2} />
      ) : templates.isError ? (
        <ErrorState
          inline
          title="Print templates did not load"
          message={describeFailure(templates.error, 'Please try again.')}
          onRetry={() => void templates.refetch()}
        />
      ) : templates.data.length === 0 ? (
        <EmptyState
          compact
          icon="printer"
          title="No print templates"
          message="Receipts and slips print with Medibook's standard layout."
        />
      ) : (
        <ul className="divide-border-soft border-border-soft divide-y rounded-md border">
          {templates.data.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-50 flex-1">
                <div className="text-body text-text-strong font-medium">{t.name}</div>
                <div className="text-caption text-text-muted">
                  {TEMPLATE_KIND_LABEL[t.kind]} · {t.paper}
                </div>
              </div>
              {t.isDefault && <Badge status="Active">Default</Badge>}
              <Button size="sm" variant="secondary" icon="eye" onClick={() => setPreviewing(t)}>
                Preview
              </Button>
              <Can perm="Hospital Settings.edit">
                <IconBtn
                  name="pencil"
                  label={`Edit template ${t.name}`}
                  box={34}
                  size={15}
                  onClick={() => setEditing({ template: t })}
                />
              </Can>
              <Can perm="Hospital Settings.del">
                <IconBtn
                  name="trash-2"
                  label={`Remove template ${t.name}`}
                  box={34}
                  size={15}
                  color="var(--color-d-500)"
                  disabled={t.isDefault}
                  title={t.isDefault ? 'Make another template the default first' : undefined}
                  onClick={() => setDeleting(t)}
                />
              </Can>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <PrintTemplateModal
          key={editing.template?.id ?? 'new-template'}
          template={editing.template}
          onClose={() => setEditing(null)}
        />
      )}
      <PrintPreviewModal template={previewing} onClose={() => setPreviewing(null)} />
      <ConfirmModal
        open={deleting !== null}
        danger
        title="Remove this template?"
        confirmLabel="Remove"
        body={deleting ? `“${deleting.name}” will no longer be used for printing.` : ''}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </Card>
  );
}
