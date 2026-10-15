import { describeFailure } from '@/shared/lib/serverErrors';
import { Button } from '@/shared/ui/Button';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Modal } from '@/shared/ui/Modal';
import { SkeletonBlock } from '@/shared/ui/Skeleton';

import type { PrintTemplate } from '@/features/settings/domain/entities/settings.entities';
import { usePrintPreviewQuery } from '@/features/settings/application/queries/usePrintPreviewQuery';

const PREVIEW_HEIGHT = 480;

interface PrintPreviewModalProps {
  template: PrintTemplate | null;
  onClose: () => void;
}

/**
 * A template rendered by the server with sample data — never real patients
 * (`POST …/{id}/preview`). The HTML is shown in a sandboxed frame: no
 * scripts, no same-origin access.
 */
export function PrintPreviewModal({ template, onClose }: PrintPreviewModalProps) {
  const preview = usePrintPreviewQuery(
    template ? { id: template.id, version: template.version } : null,
  );
  return (
    <Modal
      open={template !== null}
      onClose={onClose}
      title={template ? `Preview — ${template.name}` : 'Preview'}
      width={760}
      footer={<Button onClick={onClose}>Close</Button>}
    >
      {preview.isPending ? (
        <SkeletonBlock h={PREVIEW_HEIGHT} />
      ) : preview.isError ? (
        <ErrorState
          inline
          title="The preview could not be rendered"
          message={describeFailure(preview.error, 'Check the template and try again.')}
          onRetry={() => void preview.refetch()}
        />
      ) : (
        <div className="flex flex-col gap-2">
          <span className="text-caption text-text-muted">
            Sample data on {preview.data.paper} paper. Names and numbers are made up.
          </span>
          <iframe
            title="Print template preview"
            sandbox=""
            srcDoc={preview.data.html}
            className="border-border h-120 w-full rounded-md border bg-white"
          />
        </div>
      )}
    </Modal>
  );
}
