import { useState, type FormEvent } from 'react';

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
import { SearchField } from '@/shared/ui/SearchField';
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
import { MessageDeliveryDrawer } from '@/features/messaging/presentation/components/MessageDeliveryDrawer';
import { MessagePreview } from '@/features/messaging/presentation/components/MessagePreview';
import {
  MESSAGING_PLACEHOLDERS,
  PATIENT_TEMPLATE_EVENTS,
  channelLabel,
  deliveryErrorText,
  deliveryStatusBadge,
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

type MessagingTab = 'Templates' | 'Send & Outbox';

/** Announcements were removed in v2 (CLAUDE.md §12), so there is no tab for them (UAT-52). */
const TABS: readonly MessagingTab[] = ['Templates', 'Send & Outbox'];

const DATE_INPUT_CLASS =
  'rounded-input border-border text-body text-text-body h-11 border bg-white px-3';

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
  dateFrom: '',
  dateTo: '',
  q: '',
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
 *   status / channel / date filters, exact search, sort, paging and a detail
 *   drawer.
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
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [qDraft, setQDraft] = useState('');
  const [q, setQ] = useState('');
  const [openedId, setOpenedId] = useState<string | null>(null);
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
    dateFrom,
    dateTo,
    q,
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

  const hasOutboxFilters =
    statusFilter !== ANY_STATUS ||
    channelFilter !== ANY_CHANNEL ||
    dateFrom !== '' ||
    dateTo !== '' ||
    q !== '';
  const outboxRows = outboxQuery.data?.items ?? [];
  const outboxTotal = outboxQuery.data?.total ?? 0;
  const queuedCount = queuedQuery.data?.total;
  const channelTemplates = patientTemplates(templatesQuery.data ?? []);

  const clearOutboxFilters = (): void => {
    setStatusFilter(ANY_STATUS);
    setChannelFilter(ANY_CHANNEL);
    setDateFrom('');
    setDateTo('');
    setQDraft('');
    setQ('');
    setPage(0);
  };

  const handleSearchSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    setQ(qDraft.trim());
    setPage(0);
  };

  const handleSearchChange = (value: string): void => {
    setQDraft(value);
    // Clearing the box clears the filter at once; a new term waits for Enter.
    if (value.trim() === '' && q !== '') {
      setQ('');
      setPage(0);
    }
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
            'Address from',
            'Message',
            'Event code',
            'Channel',
            'Status',
            'Subject',
            'Sent',
            'Delivered',
            'Failed',
            'Error code',
            'Error',
            'Triggered by',
          ],
          ...rows.map((m) => [
            m.queuedAt,
            m.recipientAddress,
            m.recipientSource ?? '',
            eventLabel(m.eventCode),
            m.eventCode,
            channelLabel(m.channel),
            deliveryStatusLabel(m.status),
            m.renderedSubject ?? '',
            m.sentAt ?? '',
            m.deliveredAt ?? '',
            m.failedAt ?? '',
            m.errorCode ?? '',
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
              `Nothing was queued — ${review.patientName} has no reachable ${channelLabel(review.channel)} address for this booking.`,
              'info',
            );
          } else {
            // The address the server actually used (B7), not the one guessed here.
            const to = [...new Set(deliveries.map((d) => d.recipientAddress))].join(', ');
            toast(
              `${eventLabel(review.eventCode)} queued for ${review.patientName} by ${channelLabel(review.channel)}${
                review.channel === 'push' ? '' : ` to ${to}`
              }`,
              'success',
            );
            setTab('Send & Outbox');
          }
          setPendingSend(null);
        },
        onError: (error) => {
          // A lost answer may still have queued it: keep the dialog (and its
          // Idempotency-Key) so "Queue message" retries the same request. A
          // refusal (wrong booking state, already sent today) closes it.
          const outcomeUnknown =
            !isFailure(error) || error.kind === 'network' || error.kind === 'server';
          toast(isFailure(error) ? error.message : 'The message could not be queued.', 'error');
          if (!outcomeUnknown) setPendingSend(null);
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
    : outboxQuery.isError
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
          ) : templatesQuery.isError ? (
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

          <form className="mb-4" onSubmit={handleSearchSubmit} role="search">
            <SearchField
              value={qDraft}
              onChange={handleSearchChange}
              placeholder="Exact phone number, provider message ID or event code — press Enter"
              aria-label="Search the outbox by exact value"
            />
          </form>

          <div className="mb-4.5 flex flex-wrap items-center gap-3">
            <RefreshBtn onRefresh={refreshOutbox} title="Refresh the outbox" />
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(0);
              }}
              aria-label="Queued from"
              title="Queued from"
              className={DATE_INPUT_CLASS}
            />
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(0);
              }}
              aria-label="Queued to"
              title="Queued to"
              className={DATE_INPUT_CLASS}
            />
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
              <tr
                key={m.id}
                onClick={() => setOpenedId(m.id)}
                className="hover:bg-grey-200 cursor-pointer transition-colors duration-150"
              >
                <td className={tdClass}>
                  <div className="flex flex-col">
                    <span className="text-text-strong font-medium tabular-nums">
                      {m.recipientAddress}
                    </span>
                    <span className="text-caption text-text-muted">
                      {m.triggeredByKind === 'staff' ? 'Sent by the desk' : 'Automatic'}
                      {m.recipientSource === 'account' ? ' · booking account' : ''}
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
                    <Badge status={deliveryStatusBadge(m.status).status}>
                      {deliveryStatusBadge(m.status).label}
                    </Badge>
                    {m.deferredUntil && m.status === 'queued' && (
                      <span className="text-caption text-text-muted">
                        Held until {fmtLocalDateTime(m.deferredUntil)}
                      </span>
                    )}
                    {(m.errorMessage || deliveryErrorText(m.errorCode)) && (
                      <span className="text-caption text-text-muted">
                        {m.errorMessage ?? deliveryErrorText(m.errorCode)}
                      </span>
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

      {sendOpen && (
        <SendMessageModal open onClose={() => setSendOpen(false)} onReview={onReviewSend} />
      )}

      <MessageDeliveryDrawer deliveryId={openedId} onClose={() => setOpenedId(null)} />

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
