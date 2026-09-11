import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';

import { useHomeTarget } from './useHomeTarget';

interface NotFoundScreenProps {
  /** Override the headline (e.g. for a missing record rather than a bad URL). */
  title?: string;
  /** Override the explanation sentence. */
  message?: string;
}

/**
 * Not-found screen — audit 3.2.4/3.7: the route tree used to answer every
 * unknown URL with `<Navigate to="/" replace />`, which "silently redirects to
 * the dashboard, with no explanation". A mistyped or stale link now says what
 * happened and offers the one action that helps.
 */
export function NotFoundScreen({
  title = "We can't find that page",
  message = 'The link may be out of date, or the screen may have moved. Nothing has been lost — pick up from your dashboard.',
}: NotFoundScreenProps) {
  const home = useHomeTarget();
  return (
    <div className="flex min-h-105 items-center justify-center p-5">
      <Card pad={32} className="max-w-115 text-center">
        <div className="bg-blue-soft-bg text-blue mx-auto mb-4 flex size-14 items-center justify-center rounded-lg">
          <Icon name="circle-help" size={26} />
        </div>
        <div className="text-h2 text-text-strong mb-2">{title}</div>
        <p className="text-body text-text-muted mb-5.5">{message}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button icon="house" onClick={home.go}>
            {home.label}
          </Button>
        </div>
      </Card>
    </div>
  );
}
