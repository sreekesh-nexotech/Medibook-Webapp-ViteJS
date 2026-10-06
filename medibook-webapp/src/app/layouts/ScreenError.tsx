import { Button } from '@/shared/ui/Button';
import { ErrorState } from '@/shared/ui/ErrorState';

import { isStaleBuildError } from '@/app/staleBuild';

interface ScreenErrorProps {
  /** What the boundary caught; a missing code file is retried with a full reload. */
  error: unknown;
  onHome: () => void;
  onRetry: () => void;
}

/**
 * Crash fallback card (design `ScreenError` in `Medibook mbAdmin.html`), now
 * rendered by the shared `ErrorState` so the whole product shows one error
 * treatment (audit 3.2/4.3). Same copy, same pixels.
 */
export function ScreenError({ error, onHome, onRetry }: ScreenErrorProps) {
  // Re-rendering cannot fix a code file removed by a redeploy (React.lazy
  // keeps the failure); a reload fetches the new build (RUN-01).
  const retry = isStaleBuildError(error) ? () => window.location.reload() : onRetry;
  return (
    <ErrorState
      title="This screen hit a snag"
      message={
        "Something didn't load right. You can retry, or head back to the dashboard — your data is safe."
      }
      onRetry={retry}
    >
      <Button icon="house" onClick={onHome}>
        Back to Dashboard
      </Button>
    </ErrorState>
  );
}
