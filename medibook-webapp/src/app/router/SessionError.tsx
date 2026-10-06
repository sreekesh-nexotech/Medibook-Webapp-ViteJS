import type { ReactNode } from 'react';

import { Button } from '@/shared/ui/Button';
import { ErrorState } from '@/shared/ui/ErrorState';

interface SessionErrorProps {
  title?: string;
  message: ReactNode;
  /** Re-run the session check (network / server failures). */
  onRetry?: () => void;
  onLogout: () => void;
}

/**
 * Full-page failure while validating a session: the server could not be
 * reached, or the account cannot use the app (e.g. a suspended hospital).
 * Always offers a way out, so the user is never stuck.
 */
export function SessionError({
  title = 'We could not open your session',
  message,
  onRetry,
  onLogout,
}: SessionErrorProps) {
  return (
    <div className="bg-bg-app flex h-full items-center justify-center p-5">
      <ErrorState title={title} message={message} onRetry={onRetry}>
        <Button icon="log-out" onClick={onLogout}>
          Log Out
        </Button>
      </ErrorState>
    </div>
  );
}

/** The session check is waiting for the network (RUN-03): say so instead of spinning. */
export function OfflineSession({ onLogout }: { onLogout: () => void }) {
  return (
    <SessionError
      title="You're offline"
      message="Medibook opens as soon as the connection is back. Nothing has been lost."
      onLogout={onLogout}
    />
  );
}
