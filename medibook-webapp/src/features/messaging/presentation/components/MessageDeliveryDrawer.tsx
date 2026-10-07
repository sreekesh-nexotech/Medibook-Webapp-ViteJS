import type { ReactNode } from 'react';

import { isFailure } from '@/core/error/failure';
import { Badge } from '@/shared/ui/Badge';
import { Drawer } from '@/shared/ui/Drawer';
import { ErrorState } from '@/shared/ui/ErrorState';
import { SkeletonLine } from '@/shared/ui/Skeleton';

import { useMessageDeliveryQuery } from '@/features/messaging/application/queries/useMessageDeliveryQuery';
import {
  channelLabel,
  deliveryErrorText,
  deliveryStatusBadge,
  eventLabel,
  fmtLocalDateTime,
  recipientSourceText,
} from '@/features/messaging/presentation/components/messaging.labels';

const DRAWER_WIDTH = 460;
const SKELETON_LINES = 7;

interface MessageDeliveryDrawerProps {
  /** The delivery to show; `null` closes the drawer. */
  deliveryId: string | null;
  onClose: () => void;
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="border-border-soft flex justify-between gap-4 border-b py-2">
      <span className="text-body text-text-muted flex-none">{label}</span>
      <span className="text-body text-text-strong text-right font-medium break-all">{value}</span>
    </div>
  );
}

/**
 * One outbox row in full (`GET /messaging/deliveries/{id}`, appendix 05 R11):
 * the address actually used and where it came from, the provider's reference,
 * every timestamp, attempts, and the reason a message failed or is held.
 */
export function MessageDeliveryDrawer({ deliveryId, onClose }: MessageDeliveryDrawerProps) {
  const query = useMessageDeliveryQuery(deliveryId);
  const d = query.data;

  let body: ReactNode;
  if (query.isPending) {
    body = (
      <div className="flex flex-col gap-3" aria-busy="true">
        {Array.from({ length: SKELETON_LINES }, (_, i) => (
          <SkeletonLine key={i} />
        ))}
      </div>
    );
  } else if (query.isError || !d) {
    body = (
      <ErrorState
        inline
        title="This message didn’t load"
        message={isFailure(query.error) ? query.error.message : undefined}
        onRetry={() => void query.refetch()}
      />
    );
  } else {
    const badge = deliveryStatusBadge(d.status);
    const reason = deliveryErrorText(d.errorCode);
    body = (
      <div className="flex flex-col">
        <Row label="Status" value={<Badge status={badge.status}>{badge.label}</Badge>} />
        <Row label="Message" value={eventLabel(d.eventCode)} />
        <Row label="Channel" value={channelLabel(d.channel)} />
        <Row label="Sent to" value={d.recipientAddress} />
        {recipientSourceText(d.recipientSource) && (
          <Row label="Address from" value={recipientSourceText(d.recipientSource)} />
        )}
        <Row label="Queued" value={fmtLocalDateTime(d.queuedAt)} />
        {d.deferredUntil && <Row label="Held until" value={fmtLocalDateTime(d.deferredUntil)} />}
        {d.sentAt && <Row label="Sent" value={fmtLocalDateTime(d.sentAt)} />}
        {d.deliveredAt && <Row label="Delivered" value={fmtLocalDateTime(d.deliveredAt)} />}
        {d.failedAt && <Row label="Failed" value={fmtLocalDateTime(d.failedAt)} />}
        {d.attempts !== null && <Row label="Attempts" value={d.attempts} />}
        {d.provider && <Row label="Provider" value={d.provider} />}
        {d.providerMessageId && <Row label="Provider reference" value={d.providerMessageId} />}
        <Row label="Sent by" value={d.triggeredByKind === 'staff' ? 'The desk' : 'Automatic'} />
        {(d.errorMessage || reason) && (
          <p className="text-caption text-d-700 m-0 mt-3">
            {[reason, d.errorMessage].filter(Boolean).join(' ')}
          </p>
        )}
      </div>
    );
  }

  return (
    <Drawer
      open={deliveryId !== null}
      onClose={onClose}
      width={DRAWER_WIDTH}
      title="Message"
      subtitle={d ? `${eventLabel(d.eventCode)} · ${channelLabel(d.channel)}` : undefined}
    >
      {body}
    </Drawer>
  );
}
