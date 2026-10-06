import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';
import { useRefreshFailures } from '@/shared/hooks/useRefreshFailures';
import { formatInstant } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';

/**
 * One line under the top bar whenever the screen may be out of date: the
 * browser is offline (RUN-03), or data on screen could not refresh (RUN-04,
 * RUN-05). Offline writes fail straight away with a message rather than
 * waiting to replay on reconnect.
 */
const NOTICE_CLASS =
  'border-border bg-y-100 text-caption text-text-strong flex flex-wrap items-center gap-2 border-b px-4 py-2 lg:px-7';

export function ConnectionNotice() {
  const online = useOnlineStatus();
  const { since, retry } = useRefreshFailures();
  if (!online) {
    return (
      <div role="status" className={NOTICE_CLASS}>
        <Icon name="wifi-off" size={14} className="flex-none" />
        <span>
          You&apos;re offline. Changes can&apos;t be saved until the connection is back, and
          what&apos;s on screen may be out of date.
        </span>
      </div>
    );
  }
  if (since === null) return null;
  return (
    <div role="status" className={NOTICE_CLASS}>
      <Icon name="refresh-cw" size={14} className="flex-none" />
      <span>
        Some information couldn&apos;t refresh. Showing what loaded at{' '}
        {formatInstant(since, { hour: 'numeric', minute: '2-digit' })}.
      </span>
      <Button size="sm" variant="ghost" onClick={retry}>
        Retry
      </Button>
    </div>
  );
}
