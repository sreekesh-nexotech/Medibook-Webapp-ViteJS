import { describeFailure } from '@/shared/lib/serverErrors';
import { Button } from '@/shared/ui/Button';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Modal } from '@/shared/ui/Modal';
import { Spinner } from '@/shared/ui/Spinner';

import {
  type DisplayPreviewTarget,
  useDisplayPreviewQuery,
} from '@/features/settings/application/queries/useDisplayPreviewQuery';
import { DisplayBoardView } from '@/features/display/presentation/components/DisplayBoardView';

/** Wide enough to read the board, which is drawn in a 16:9 box exactly like the TV. */
const PREVIEW_WIDTH = 960;

interface DisplayPreviewModalProps {
  /** `null` keeps the dialog closed. */
  target: DisplayPreviewTarget | null;
  /** The screen's name, or the name typed so far in the form. */
  screenName: string;
  onClose: () => void;
}

/**
 * Preview a display screen (client feedback point 8): exactly what the TV shows right now for
 * this selection — the same board, the same shortened patient names — without its key. Refreshes
 * every 15 seconds while open, like the screen.
 */
export function DisplayPreviewModal({ target, screenName, onClose }: DisplayPreviewModalProps) {
  const preview = useDisplayPreviewQuery(target);
  const title = screenName.trim() ? `Preview · ${screenName.trim()}` : 'Preview';
  return (
    <Modal
      open={target !== null}
      onClose={onClose}
      title={title}
      width={PREVIEW_WIDTH}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <p className="text-caption text-text-muted mb-4">
        {target?.kind === 'draft'
          ? 'What this screen will show with the choices in the form — nothing is saved yet.'
          : 'What this screen shows right now.'}{' '}
        It refreshes every 15 seconds.
      </p>
      {preview.isPending ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : preview.isError ? (
        <ErrorState
          inline
          title="The preview did not load"
          message={describeFailure(preview.error, 'Please try again.')}
          onRetry={() => void preview.refetch()}
        />
      ) : (
        <div
          className="bg-bg-app aspect-video w-full overflow-hidden rounded-md"
          aria-label="Display screen preview"
          role="region"
        >
          <DisplayBoardView board={preview.data} />
        </div>
      )}
    </Modal>
  );
}
