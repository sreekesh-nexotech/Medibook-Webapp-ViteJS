import { formatTimeIn } from '@/shared/lib/hospitalTime';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';

interface StaleDataBannerProps {
  /** When the figures on screen were last read (epoch ms). */
  updatedAt: number;
  timeZone: string;
  onRetry: () => void;
}

/**
 * A background refresh failed, so the figures on screen are older than they
 * look (appendix 02 F4): say so, with their time and a retry.
 */
export function StaleDataBanner({ updatedAt, timeZone, onRetry }: StaleDataBannerProps) {
  return (
    <div role="status">
      <Card pad={12} className="flex flex-wrap items-center gap-3">
        <Icon name="triangle-alert" size={16} className="text-y-700" />
        <span className="text-body text-text-body flex-1">
          These figures could not be refreshed. They are from{' '}
          {updatedAt ? formatTimeIn(new Date(updatedAt).toISOString(), timeZone) : 'earlier'}.
        </span>
        <Button size="sm" variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      </Card>
    </div>
  );
}
