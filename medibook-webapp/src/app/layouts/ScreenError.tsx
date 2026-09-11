import { Button } from '@/shared/ui/Button';
import { ErrorState } from '@/shared/ui/ErrorState';

interface ScreenErrorProps {
  onHome: () => void;
  onRetry: () => void;
}

/**
 * Crash fallback card (design `ScreenError` in `Medibook mbAdmin.html`), now
 * rendered by the shared `ErrorState` so the whole product shows one error
 * treatment (audit 3.2/4.3). Same copy, same pixels.
 */
export function ScreenError({ onHome, onRetry }: ScreenErrorProps) {
  return (
    <ErrorState
      title="This screen hit a snag"
      message={
        "Something didn't load right. You can retry, or head back to the dashboard — your data is safe."
      }
      onRetry={onRetry}
    >
      <Button icon="house" onClick={onHome}>
        Back to Dashboard
      </Button>
    </ErrorState>
  );
}
