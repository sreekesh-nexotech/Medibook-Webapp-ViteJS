import { useState } from 'react';

import { usePermission } from '@/shared/hooks/usePermission';
import { useSort } from '@/shared/hooks/useSort';
import { cn } from '@/shared/lib/cn';
import { downloadCsv } from '@/shared/lib/download';
import { fmtDate, toLocalISO } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Can } from '@/shared/ui/Can';
import { Card } from '@/shared/ui/Card';
import { ConfirmModal } from '@/shared/ui/ConfirmModal';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import { InfoDot } from '@/shared/ui/InfoDot';
import { Pager } from '@/shared/ui/Pager';
import { RefreshBtn } from '@/shared/ui/RefreshBtn';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { SegTabs } from '@/shared/ui/SegTabs';
import { SkeletonCards } from '@/shared/ui/Skeleton';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';
import { toast } from '@/shared/ui/toast/toast.store';

import { isFailure } from '@/core/error/failure';

import { useExportMessageDeliveriesMutation } from '@/features/messaging/application/queries/useExportMessageDeliveriesMutation';
import { useMessageDeliveriesQuery } from '@/features/messaging/application/queries/useMessageDeliveriesQuery';
import { useMessagingTemplatesQuery } from '@/features/messaging/application/queries/useMessagingTemplatesQuery';
import { useSendMessageMutation } from '@/features/messaging/application/queries/useSendMessageMutation';
import {
  renderTemplate,
  smsSegments,
} from '@/features/messaging/application/store/messaging.logic';
import {
  DELIVERY_STATUSES,
  PATIENT_CHANNELS,
  type DeliveryFilters,
  type DeliveryListParams,
  type DeliveryStatus,
  type MessagingChannel,
  type MessagingTemplate,
  type PatientChannel,
} from '@/features/messaging/domain/entities/messaging.entities';
import { MessagePreview } from '@/features/messaging/presentation/components/MessagePreview';
import {
  MESSAGING_PLACEHOLDERS,
  PATIENT_TEMPLATE_EVENTS,
  channelLabel,
  deliveryStatusLabel,
  eventLabel,
  fmtLocalDateTime,
  messagingSampleValues,
  patientChannelFromLabel,
} from '@/features/messaging/presentation/components/messaging.labels';
import {
  SendMessageModal,
  type SendReview,
} from '@/features/messaging/presentation/components/SendMessageModal';

type MessagingTab = 'Templates' | 'Send & Outbox' | 'Announcements';

const TABS: readonly MessagingTab[] = ['Templates', 'Send & Outbox', 'Announcements'];

const OUTBOX_PAGE_SIZE = 8;

const ANY_STATUS = 'Status: All';
const ANY_CHANNEL = 'Channel: All';

const OUTBOX_COLUMNS = ['Recipient', 'Message', 'Channel', 'Queued', 'Status'] as const;

/** Only the queued time is sortable server-side (`sort=queued_at`). */
const OUTBOX_SORT_KEYS: Readonly<Record<string, string>> = { Queued: 'when' };

/** The smallest page that still carries the `total` count. */
const COUNT_PAGE_SIZE = 1;

const MESSAGING_CHANNELS: readonly MessagingChannel[] = ['sms', 'whatsapp', 'email', 'push'];

/** Every queued delivery, for the header count. */
const QUEUED_COUNT_PARAMS: DeliveryListParams = {
  page: 1,
  pageSize: COUNT_PAGE_SIZE,
  status: 'queued',
  channel: null,
  sortField: 'queued_at',
  sortDirection: 'desc',
};

function statusFromLabel(label: string): DeliveryStatus | null {
  return DELIVERY_STATUSES.find((s) => deliveryStatusLabel(s) === label) ?? null;
}

function channelFromLabel(label: string): MessagingChannel | null {
  return MESSAGING_CHANNELS.find((c) => channelLabel(c) === label) ?? null;
}

/** Patient-facing templates on one channel, in the library's event order. */
function patientTemplates(templates: readonly MessagingTemplate[]): readonly MessagingTemplate[] {
  return PATIENT_TEMPLATE_EVENTS.flatMap((event) => {
    const found = templates.find((t) => t.eventCode === event);
    return found ? [found] : [];
  });
}

/**
 * Messaging — audit HA-11 / HA-12, on the live hospital messaging API.
 *
 * - **Templates:** the platform's patient templates per channel, read-only
 *   (Q112), each rendered with sample data, plus the placeholder vocabulary.
 * - **Send & Outbox:** queue a confirmation or reminder for one appointment
 *   (`POST /messaging/send`), and the delivery history with server-side
 *   status / channel filters, sort and paging.
 * - **Announcements:** no backend endpoint exists yet, so the tab says so.
 *
 * Nothing here claims delivery: a queued message reads **Queued** until the
 * gateway reports otherwise (THE LAW).
 */
export function MessagingScreen() {
  const { can } = usePermission();
  const mayEdit = can('Hospital Settings.edit');

  const [tab, setTab] = useState<MessagingTab>('Templates');
  const [channel, setChannel] = useState<PatientChannel>('sms');
  const [statusFilter, setStatusFilter] = useState(ANY_STATUS);
  const [channelFilter, setChannelFilter] = useState(ANY_CHANNEL);
  const [page, setPage] = useState(0);
  const [sendOpen, setSendOpen] = useState(false);
  /** The send awaiting confirmation, with the replay key minted for it. */
  const [pendingSend, setPendingSend] = useState<{
    review: SendReview;
    idempotencyKey: string;
  } | null>(null);

  const outboxSort = useSort<never>({ key: 'when', dir: 'desc' });

  const filters: DeliveryFilters = {
    status: statusFromLabel(statusFilter),
    channel: channelFromLabel(channelFilter),
  };
  const outboxParams: DeliveryListParams = {
    ...filters,
    page: page + 1,
    pageSize: OUTBOX_PAGE_SIZE,
    sortField: 'queued_at',
    sortDirection: outboxSort.sort.dir,
  };

  const templatesQuery = useMessagingTemplatesQuery(channel);
  const outboxQuery = useMessageDeliveriesQuery(outboxParams);
  const queuedQuery = useMessageDeliveriesQuery(QUEUED_COUNT_PARAMS);
  const sendMutation = useSendMessageMutation();
  const exportMutation = useExportMessageDeliveriesMutation();

  const hasOutboxFilters = statusFilter !== ANY_STATUS || channelFilter !== ANY_CHANNEL;
  const outboxRows = outboxQuery.data?.items ?? [];
  const outboxTotal = outboxQuery.data?.total ?? 0;
  const queuedCount = queuedQuery.data?.total;
  const channelTemplates = patientTemplates(templatesQuery.data ?? []);

  const clearOutboxFilters = (): void => {
    setStatusFilter(ANY_STATUS);
    setChannelFilter(ANY_CHANNEL);
    setPage(0);
  };

  const refreshOutbox = async (): Promise<void> => {
    await Promise.all([outboxQuery.refetch(), queuedQuery.refetch()]);
  };

  const exportOutboxCsv = (): void => {
    exportMutation.mutate(filters, {
      onSuccess: (rows) => {
        downloadCsv('medibook-message-outbox.csv', [
          [
            'Queued',
            'Recipient',
            'Message',
            'Event code',
            'Channel',
            'Status',
            'Subject',
            'Sent',
            'Delivered',
            'Failed',
            'Error',
            'Triggered by',
          ],
          ...rows.map((m) => [
            m.queuedAt,
            m.recipientAddress,
            eventLabel(m.eventCode),
            m.eventCode,
            channelLabel(m.channel),
            deliveryStatusLabel(m.status),
            m.renderedSubject ?? '',
            m.sentAt ?? '',
            m.deliveredAt ?? '',
            m.failedAt ?? '',
            m.errorMessage ?? '',
            m.triggeredByKind ?? '',
          ]),
        ]);
        toast(`Exported ${rows.length} outbox rows as CSV`, 'success');
      },
      onError: (error) =>
        toast(isFailure(error) ? error.message : 'The outbox could not be exported.', 'error'),
    });
  };

  const onReviewSend = (review: SendReview): void => {
    setSendOpen(false);
    setPendingSend({ review, idempotencyKey: crypto.randomUUID() });
  };

  const confirmSend = (): void => {
    // A second click while queueing is ignored; the replay key would dedupe it anyway.
    if (!pendingSend || sendMutation.isPending) return;
    const { review, idempotencyKey } = pendingSend;
    sendMutation.mutate(
      {
        appointmentId: review.appointmentId,
        eventCode: review.eventCode,
        channels: [review.channel],
        idempotencyKey,
      },
      {
        onSuccess: (deliveries) => {
          if (deliveries.length === 0) {
            toast(
              `Nothing was queued — ${review.patientName} has no reachable ${channelLabel(review.channel)} address.`,
              'info',
            );
          } else {
            toast(
              `${eventLabel(review.eventCode)} queued for ${review.patientName} by ${channelLabel(review.channel)}`,
              'success',
            );
            setTab('Send & Outbox');
          }
          setPendingSend(null);
        },
        onError: (error) => {
          toast(isFailure(error) ? error.message : 'The message could not be queued.', 'error');
          setPendingSend(null);
        },
      },
    );
  };

  if (!can('Hospital Settings.view')) {
    return (
      <Card>
        <EmptyState
          icon="lock"
          title="You do not have access to messaging"
          message="Templates, reminders and the outbox are limited to roles with the Hospital Settings permission. Ask an administrator to grant it under Users & Roles."
        />
      </Card>
    );
  }

  const outboxTableState: TableStateSpec | undefined = outboxQuery.isLoading
    ? { kind: 'loading', rows: OUTBOX_PAGE_SIZE }
    : outboxQuery.isLoadingError
      ? {
          kind: 'error',
          title: "The outbox didn't load.",
          message: isFailure(outboxQuery.error) ? outboxQuery.error.message : undefined,
          onRetry: () => void outboxQuery.refetch(),
        }
      : outboxRows.length === 0
        ? {
            kind: 'empty',
            icon: hasOutboxFilters ? 'search' : 'send',
            title: hasOutboxFilters ? 'No messages match your filters.' : 'Nothing queued yet.',
            message: hasOutboxFilters
              ? 'Clear the filters to see the whole outbox.'
              : 'Confirmations, reminders and every automatic patient message appear here as they are queued.',
            actionLabel: hasOutboxFilters
              ? 'Clear filters'
              : mayEdit
                ? 'Send a message'
                : undefined,
            onAction: hasOutboxFilters
              ? clearOutboxFilters
              : mayEdit
                ? () => setSendOpen(true)
                : undefined,
          }
        : undefined;

  return (
    <div className="flex flex-col gap-5">
      <Card pad={16} className="flex flex-wrap items-center gap-3">
        <SegTabs tabs={TABS} value={tab} onChange={(t) => setTab(t as MessagingTab)} />
        {queuedCount !== undefined && (
          <span className="text-caption text-text-muted">
            {queuedCount} {queuedCount === 1 ? 'message' : 'messages'} queued
          </span>
        )}
        <div className="flex-1" />
        {tab === 'Send & Outbox' && (
          <Can perm="Hospital Settings.edit">
            <Button icon="send" onClick={() => setSendOpen(true)}>
              Send a Message
            </Button>
          </Can>
        )}
      </Card>

      {tab === 'Templates' && (
        <>
          <Card pad={16} className="flex flex-wrap items-center gap-3">
            <SegTabs
              tabs={PATIENT_CHANNELS.map(channelLabel)}
              value={channelLabel(channel)}
              onChange={(label) => setChannel(patientChannelFromLabel(label) ?? 'sms')}
            />
            <InfoDot text="Templates are managed by Medibook and are the same for every hospital. To request a wording change, raise a ticket under Help & Support." />
            <div className="flex-1" />
            <RefreshBtn
              onRefresh={async () => {
                await templatesQuery.refetch();
              }}
              title="Refresh templates"
            />
          </Card>

          {templatesQuery.isLoading ? (
            <SkeletonCards count={2} lines={4} />
          ) : templatesQuery.isLoadingError ? (
            <Card>
              <ErrorState
                inline
                title="Templates didn't load."
                message={isFailure(templatesQuery.error) ? templatesQuery.error.message : undefined}
                onRetry={() => void templatesQuery.refetch()}
              />
            </Card>
          ) : channelTemplates.length === 0 ? (
            <Card>
              <EmptyState
                icon="message-circle"
                title={`No ${channelLabel(channel)} templates.`}
                message="Medibook has not published patient templates on this channel yet."
              />
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {channelTemplates.map((t) => {
                const rendered = renderTemplate(t.body, messagingSampleValues());
                return (
                  <Card key={t.id}>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <SectionTitle>{eventLabel(t.eventCode)}</SectionTitle>
                      <Badge status="Enabled">{channelLabel(t.channel)}</Badge>
                    </div>
                    <MessagePreview
                      channel={channelLabel(t.channel)}
                      subject={t.subject ?? undefined}
                      rendered={rendered}
                      title="Patient sees"
                    />
                    <div className="text-caption text-text-muted mt-2.5">
                      Updated by Medibook {fmtDate(toLocalISO(new Date(t.updatedAt)))}
                      {t.channel === 'sms' &&
                        ` · ${smsSegments(rendered)} ${
                          smsSegments(rendered) === 1 ? 'segment' : 'segments'
                        } per message`}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          <Card>
            <div className="mb-3 flex items-center gap-2">
              <SectionTitle>Placeholder vocabulary</SectionTitle>
              <InfoDot text="The tokens Medibook fills in for each patient when a message is sent." />
            </div>
            <TableShell
              columns={['Placeholder', 'What it means', 'Example']}
              scrollLabel="Placeholder vocabulary"
            >
              {MESSAGING_PLACEHOLDERS.map((p) => (
                <tr key={p.token}>
                  <td className={tdClass}>
                    <span className="text-text-strong font-medium">{p.token}</span>
                  </td>
                  <td className={tdClass}>{p.label}</td>
                  <td className={cn(tdClass, 'text-text-muted')}>{p.sample}</td>
                </tr>
              ))}
            </TableShell>
          </Card>
        </>
      )}

      {tab === 'Send & Outbox' && (
        <Card>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <SectionTitle>Outbox</SectionTitle>
            <InfoDot text="Every message queued for your patients — by the desk or automatically. Statuses move as Medibook's gateway works through them; nothing on this screen claims a message was delivered until the gateway says so." />
            <div className="flex-1" />
            <Button
              variant="secondary"
              icon="download"
              onClick={exportOutboxCsv}
              busy={exportMutation.isPending}
            >
              Export CSV
            </Button>
          </div>

          <div className="mb-4.5 flex flex-wrap items-center gap-3">
            <RefreshBtn onRefresh={refreshOutbox} title="Refresh the outbox" />
            <FilterSelect
              value={statusFilter}
              options={[ANY_STATUS, ...DELIVERY_STATUSES.map(deliveryStatusLabel)]}
              onChange={(v) => {
                setStatusFilter(v);
                setPage(0);
              }}
              aria-label="Filter by status"
            />
            <FilterSelect
              value={channelFilter}
              options={[ANY_CHANNEL, ...MESSAGING_CHANNELS.map(channelLabel)]}
              onChange={(v) => {
                setChannelFilter(v);
                setPage(0);
              }}
              aria-label="Filter by channel"
            />
            {hasOutboxFilters && (
              <button
                type="button"
                onClick={clearOutboxFilters}
                className="text-body text-blue cursor-pointer border-none bg-transparent p-0"
              >
                Clear all
              </button>
            )}
            <div className="flex-1" />
            {queuedCount !== undefined && (
              <span className="text-caption text-text-muted">
                {queuedCount} waiting for the gateway
              </span>
            )}
          </div>

          <TableShell
            columns={OUTBOX_COLUMNS}
            sortKeys={OUTBOX_SORT_KEYS}
            sort={outboxSort.sort}
            onSort={(key) => {
              outboxSort.onSort(key);
              setPage(0);
            }}
            state={outboxTableState}
            scrollLabel="Message outbox"
          >
            {outboxRows.map((m) => (
              <tr key={m.id}>
                <td className={tdClass}>
                  <div className="flex flex-col">
                    <span className="text-text-strong font-medium tabular-nums">
                      {m.recipientAddress}
                    </span>
                    <span className="text-caption text-text-muted">
                      {m.triggeredByKind === 'staff' ? 'Sent by the desk' : 'Automatic'}
                    </span>
                  </div>
                </td>
                <td className={cn(tdClass, 'max-w-90')}>
                  <div className="flex flex-col">
                    <span className="text-text-strong font-medium">{eventLabel(m.eventCode)}</span>
                    {m.renderedSubject && (
                      <span className="text-caption text-text-muted truncate">
                        {m.renderedSubject}
                      </span>
                    )}
                  </div>
                </td>
                <td className={tdClass}>{channelLabel(m.channel)}</td>
                <td className={cn(tdClass, 'whitespace-nowrap tabular-nums')}>
                  {fmtLocalDateTime(m.queuedAt)}
                </td>
                <td className={tdClass}>
                  <div className="flex flex-col items-start gap-1">
                    <Badge status={deliveryStatusLabel(m.status)} />
                    {m.errorMessage && (
                      <span className="text-caption text-text-muted">{m.errorMessage}</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </TableShell>

          <Pager
            total={outboxTotal}
            page={page}
            pageSize={OUTBOX_PAGE_SIZE}
            onPage={setPage}
            noun="messages"
          />
        </Card>
      )}

      {tab === 'Announcements' && (
        <Card>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <SectionTitle>Announcements</SectionTitle>
          </div>
          <EmptyState
            icon="megaphone"
            title="Announcements aren't available yet."
            message="Medibook can't send a notice to a whole audience yet. To reach a patient about their visit, use Send & Outbox."
            actionLabel="Go to Send & Outbox"
            onAction={() => setTab('Send & Outbox')}
          />
        </Card>
      )}

      {sendOpen && (
        <SendMessageModal open onClose={() => setSendOpen(false)} onReview={onReviewSend} />
      )}

      <ConfirmModal
        open={pendingSend != null}
        title="Queue this message?"
        body={
          pendingSend
            ? `${eventLabel(pendingSend.review.eventCode)} will be queued for ${pendingSend.review.patientName} by ${channelLabel(pendingSend.review.channel)} to ${pendingSend.review.destination} (booking ${pendingSend.review.bookingRef}). It appears in the outbox as Queued until Medibook's gateway sends it.`
            : ''
        }
        confirmLabel={sendMutation.isPending ? 'Queueing…' : 'Queue message'}
        onClose={() => setPendingSend(null)}
        onConfirm={confirmSend}
      />
    </div>
  );
}
