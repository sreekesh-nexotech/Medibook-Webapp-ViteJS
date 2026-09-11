import { useMemo, useState } from 'react';

import { usePermission } from '@/shared/hooks/usePermission';
import { useSort } from '@/shared/hooks/useSort';
import { cn } from '@/shared/lib/cn';
import { downloadCsv } from '@/shared/lib/download';
import { fmtDate } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Can } from '@/shared/ui/Can';
import { Card } from '@/shared/ui/Card';
import { ConfirmModal } from '@/shared/ui/ConfirmModal';
import { EmptyState } from '@/shared/ui/EmptyState';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import { Icon } from '@/shared/ui/Icon';
import { IconBtn } from '@/shared/ui/IconBtn';
import { InfoDot } from '@/shared/ui/InfoDot';
import { Pager } from '@/shared/ui/Pager';
import { RefreshBtn } from '@/shared/ui/RefreshBtn';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { SegTabs } from '@/shared/ui/SegTabs';
import { SkeletonCards } from '@/shared/ui/Skeleton';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';
import { toast } from '@/shared/ui/toast/toast.store';
import { Toggle } from '@/shared/ui/Toggle';

import { useAppointmentsStore } from '@/features/appointments/application/store/appointments.store';
import { localDateIso, shiftIsoDays } from '@/features/audit/application/store/audit.clock';
import { useCatalogStore } from '@/features/doctors/application/store/catalog.store';
import {
  PLACEHOLDERS,
  announcementAudienceCopy,
  renderTemplate,
  sampleValues,
  smsSegments,
  type ReachCounts,
} from '@/features/messaging/application/store/messaging.logic';
import {
  useMessagingStore,
  type AnnouncementInput,
  type QueueMessageInput,
} from '@/features/messaging/application/store/messaging.store';
import {
  MESSAGE_CHANNELS,
  MESSAGE_EVENTS,
  type MessageChannel,
  type MessageTemplate,
  type OutboxMessage,
  type SendTarget,
} from '@/features/messaging/application/store/messaging.types';
import { usePatientsStore } from '@/features/patients/application/store/patients.store';
import { AnnouncementModal } from '@/features/messaging/presentation/components/AnnouncementModal';
import { MessagePreview } from '@/features/messaging/presentation/components/MessagePreview';
import { SendMessageModal } from '@/features/messaging/presentation/components/SendMessageModal';
import { TemplateModal } from '@/features/messaging/presentation/components/TemplateModal';

type MessagingTab = 'Templates' | 'Send & Outbox' | 'Announcements';

const TABS: readonly MessagingTab[] = ['Templates', 'Send & Outbox', 'Announcements'];

const OUTBOX_PAGE_SIZE = 8;
const REFRESH_MS = 420;

const ANY_STATUS = 'Status: All';
const ANY_CHANNEL = 'Channel: All';

/** How many upcoming appointments the send picker offers. */
const SEND_TARGET_LIMIT = 25;

const OUTBOX_COLUMNS = [
  'Recipient',
  'Message',
  'Channel',
  'Appointment',
  'Queued',
  'Status',
  '',
] as const;

const OUTBOX_SORT_KEYS: Readonly<Record<string, string>> = {
  Recipient: 'recipient',
  Message: 'event',
  Channel: 'channel',
  Queued: 'when',
  Status: 'status',
};

const ANNOUNCEMENT_COLUMNS = [
  'Announcement',
  'Audience',
  'Channel',
  'Reach',
  'When',
  'Status',
  '',
] as const;

/** A relative seed label ("Today"/"Tomorrow") as a real local ISO date. */
function apptDateIso(label: string): string | null {
  if (label === 'Today') return localDateIso();
  if (label === 'Tomorrow') return shiftIsoDays(localDateIso(), 1);
  return null;
}

/** What a message should call the appointment's date. */
function apptDateCopy(label: string): string {
  const iso = apptDateIso(label);
  return iso ? fmtDate(iso) : label;
}

/**
 * Messaging — audit HA-11 / HA-12 (§2.4): "The hospital cannot trigger a
 * confirmation or reminder, and cannot publish an announcement. Message
 * templates have no screen."
 *
 * Three tabs: the template library (per event × channel, with a documented
 * placeholder vocabulary, live preview and SMS segment count), triggering a
 * message for one appointment into a visible outbox, and announcements with a
 * real audience and schedule.
 *
 * Nothing here claims delivery. A queued message says **Queued** and can be
 * cancelled, which is the honest version of a control whose gateway does not
 * exist yet (THE LAW).
 */
export function MessagingScreen() {
  const templates = useMessagingStore((s) => s.templates);
  const outbox = useMessagingStore((s) => s.outbox);
  const announcements = useMessagingStore((s) => s.announcements);
  const saveTemplate = useMessagingStore((s) => s.saveTemplate);
  const toggleTemplate = useMessagingStore((s) => s.toggleTemplate);
  const queueMessage = useMessagingStore((s) => s.queueMessage);
  const cancelMessage = useMessagingStore((s) => s.cancelMessage);
  const publishAnnouncement = useMessagingStore((s) => s.publishAnnouncement);
  const cancelAnnouncement = useMessagingStore((s) => s.cancelAnnouncement);

  const appts = useAppointmentsStore((s) => s.appts);
  const patients = usePatientsStore((s) => s.patients);
  const depts = useCatalogStore((s) => s.depts);
  const { can } = usePermission();
  const mayEdit = can('Hospital Settings.edit');

  const [tab, setTab] = useState<MessagingTab>('Templates');
  const [channel, setChannel] = useState<MessageChannel>('SMS');
  const [statusFilter, setStatusFilter] = useState(ANY_STATUS);
  const [channelFilter, setChannelFilter] = useState(ANY_CHANNEL);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);

  const [templateEdit, setTemplateEdit] = useState<MessageTemplate | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [announceOpen, setAnnounceOpen] = useState(false);
  const [pendingSend, setPendingSend] = useState<{
    input: QueueMessageInput;
    target: SendTarget;
  } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<{
    kind: 'message' | 'announcement';
    id: string;
    label: string;
  } | null>(null);

  const outboxSort = useSort<OutboxMessage>({ key: 'when', dir: 'desc' });

  const departmentNames = useMemo(() => depts.map((d) => d.name), [depts]);

  /** Appointments the desk may message, flattened for the templates. */
  const sendTargets: readonly SendTarget[] = useMemo(
    () =>
      appts
        .filter((a) => a.status === 'Scheduled' || a.status === 'In Queue')
        .slice(0, SEND_TARGET_LIMIT)
        .map((a) => {
          const patient = patients.find((p) => p.mrn === a.mrn);
          return {
            appointmentId: a.id,
            patientName: a.name,
            phone: a.phone,
            email: patient?.email ?? '',
            doctorName: a.doctor,
            dept: a.dept,
            date: apptDateCopy(a.date),
            time: a.time,
            token: a.token ?? '—',
            bookingRef: `MB-2026-${a.id.replace(/\D/g, '').padStart(6, '0')}`,
          };
        }),
    [appts, patients],
  );

  const reach: ReachCounts = useMemo(() => {
    const byDepartment: Record<string, number> = {};
    for (const d of depts) {
      byDepartment[d.name] = new Set(
        appts.filter((a) => a.dept === d.name).map((a) => a.mrn),
      ).size;
    }
    const byDate: Record<string, number> = {};
    for (const a of appts) {
      const iso = apptDateIso(a.date);
      if (!iso) continue;
      byDate[iso] = (byDate[iso] ?? 0) + 1;
    }
    return { allPatients: patients.length, byDepartment, byDate };
  }, [appts, patients, depts]);

  const channelTemplates = useMemo(
    () =>
      MESSAGE_EVENTS.map((event) => templates.find((t) => t.event === event && t.channel === channel))
        .filter((t): t is MessageTemplate => t != null),
    [templates, channel],
  );

  const hasOutboxFilters = statusFilter !== ANY_STATUS || channelFilter !== ANY_CHANNEL;

  const filteredOutbox = useMemo(
    () =>
      outbox.filter(
        (m) =>
          (statusFilter === ANY_STATUS || m.status === statusFilter) &&
          (channelFilter === ANY_CHANNEL || m.channel === channelFilter),
      ),
    [outbox, statusFilter, channelFilter],
  );

  const orderedOutbox = outboxSort.sorted([...filteredOutbox], {
    recipient: (m) => m.recipient,
    event: (m) => m.event,
    channel: (m) => m.channel,
    when: (m) => `${m.date} ${m.time}`,
    status: (m) => m.status,
  });

  const pg = Math.min(page, Math.max(0, Math.ceil(orderedOutbox.length / OUTBOX_PAGE_SIZE) - 1));
  const outboxRows = orderedOutbox.slice(pg * OUTBOX_PAGE_SIZE, (pg + 1) * OUTBOX_PAGE_SIZE);

  const queuedCount = outbox.filter((m) => m.status === 'Queued').length;

  const clearOutboxFilters = (): void => {
    setStatusFilter(ANY_STATUS);
    setChannelFilter(ANY_CHANNEL);
    setPage(0);
  };

  const refresh = async (): Promise<void> => {
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, REFRESH_MS));
    setLoading(false);
  };

  const exportOutboxCsv = (): void => {
    downloadCsv('medibook-message-outbox.csv', [
      [
        'Queued date',
        'Queued time',
        'Recipient',
        'Contact',
        'Message',
        'Channel',
        'Appointment',
        'Booking ref',
        'Status',
        'Body',
      ],
      ...orderedOutbox.map((m) => [
        m.date,
        m.time,
        m.recipient,
        m.contact,
        m.event,
        m.channel,
        m.appointmentId,
        m.bookingRef,
        m.status,
        m.body,
      ]),
    ]);
    toast(`Exported ${orderedOutbox.length} outbox rows as CSV`, 'success');
  };

  const onReviewSend = (input: QueueMessageInput, target: SendTarget): void => {
    setSendOpen(false);
    setPendingSend({ input, target });
  };

  const confirmSend = (): void => {
    if (!pendingSend) return;
    queueMessage(pendingSend.input);
    setPendingSend(null);
    setTab('Send & Outbox');
  };

  const onPublish = (input: AnnouncementInput): void => {
    publishAnnouncement(input);
    setTab('Announcements');
  };

  const confirmCancel = (): void => {
    if (!cancelTarget) return;
    if (cancelTarget.kind === 'message') cancelMessage(cancelTarget.id);
    else cancelAnnouncement(cancelTarget.id);
    setCancelTarget(null);
  };

  if (!can('Hospital Settings.view')) {
    return (
      <Card>
        <EmptyState
          icon="lock"
          title="You do not have access to messaging"
          message="Templates, reminders and announcements are limited to roles with the Hospital Settings permission. Ask an administrator to grant it under Users & Roles."
        />
      </Card>
    );
  }

  const outboxTableState: TableStateSpec | undefined = loading
    ? { kind: 'loading', rows: OUTBOX_PAGE_SIZE }
    : outboxRows.length === 0
      ? {
          kind: 'empty',
          icon: hasOutboxFilters ? 'search' : 'send',
          title: hasOutboxFilters ? 'No messages match your filters.' : 'Nothing queued yet.',
          message: hasOutboxFilters
            ? 'Clear the filters to see the whole outbox.'
            : 'Queue a confirmation or reminder for an appointment and it will appear here until the gateway picks it up.',
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
        <span className="text-caption text-text-muted">
          {queuedCount} {queuedCount === 1 ? 'message' : 'messages'} queued ·{' '}
          {templates.filter((t) => t.active).length} of {templates.length} channels switched on
        </span>
        <div className="flex-1" />
        {tab === 'Send & Outbox' && (
          <Can perm="Hospital Settings.edit">
            <Button icon="send" onClick={() => setSendOpen(true)}>
              Send a Message
            </Button>
          </Can>
        )}
        {tab === 'Announcements' && (
          <Can perm="Hospital Settings.add">
            <Button icon="megaphone" onClick={() => setAnnounceOpen(true)}>
              New Announcement
            </Button>
          </Can>
        )}
      </Card>

      {tab === 'Templates' && (
        <>
          <Card pad={16} className="flex flex-wrap items-center gap-3">
            <SegTabs
              tabs={MESSAGE_CHANNELS}
              value={channel}
              onChange={(c) => setChannel(c as MessageChannel)}
            />
            <InfoDot text="One template per event and channel. Switching a channel off keeps the wording but stops that event being messaged on it." />
            <div className="flex-1" />
            <RefreshBtn onRefresh={refresh} title="Refresh templates" />
          </Card>

          {loading ? (
            <SkeletonCards count={2} lines={4} />
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {channelTemplates.map((t) => {
                const rendered = renderTemplate(t.body, sampleValues());
                return (
                  <Card key={t.id}>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <SectionTitle>{t.event}</SectionTitle>
                      <Badge status={t.active ? 'Enabled' : 'Inactive'}>
                        {t.active ? `On · ${t.channel}` : `Off · ${t.channel}`}
                      </Badge>
                      <div className="flex-1" />
                      <Can
                        perm="Hospital Settings.edit"
                        disableInstead
                        disabledTitle="Your role cannot change templates"
                      >
                        <Toggle
                          value={t.active}
                          onChange={() => toggleTemplate(t.id)}
                          label={`Message ${t.event.toLowerCase()} on ${t.channel}`}
                        />
                      </Can>
                      <Can
                        perm="Hospital Settings.edit"
                        disableInstead
                        disabledTitle="Your role cannot change templates"
                      >
                        <IconBtn
                          name="pencil"
                          label="Edit template"
                          title={`Edit the ${t.event} ${t.channel} template`}
                          box={36}
                          size={15}
                          onClick={() => setTemplateEdit(t)}
                        />
                      </Can>
                    </div>
                    <MessagePreview
                      channel={t.channel}
                      subject={t.subject}
                      rendered={rendered}
                      title="Patient sees"
                    />
                    <div className="text-caption text-text-muted mt-2.5">
                      Last edited {fmtDate(t.updatedOn)}
                      {t.channel === 'SMS' &&
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
              <InfoDot text="Only these tokens are substituted. Anything else is sent as literal text, so the editor refuses to save an unknown placeholder." />
            </div>
            <TableShell
              columns={['Placeholder', 'What it means', 'Example']}
              scrollLabel="Placeholder vocabulary"
            >
              {PLACEHOLDERS.map((p) => (
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
            <InfoDot text="Everything the desk has queued. Medibook's gateway picks these up — until it does, a queued message can still be cancelled. Nothing on this screen claims a message was delivered." />
            <div className="flex-1" />
            <Button variant="secondary" icon="download" onClick={exportOutboxCsv}>
              Export CSV
            </Button>
          </div>

          <div className="mb-4.5 flex flex-wrap items-center gap-3">
            <RefreshBtn onRefresh={refresh} title="Refresh the outbox" />
            <FilterSelect
              value={statusFilter}
              options={[ANY_STATUS, 'Queued', 'Cancelled']}
              onChange={(v) => {
                setStatusFilter(v);
                setPage(0);
              }}
              aria-label="Filter by status"
            />
            <FilterSelect
              value={channelFilter}
              options={[ANY_CHANNEL, ...MESSAGE_CHANNELS]}
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
            <span className="text-caption text-text-muted">
              {queuedCount} waiting for the gateway
            </span>
          </div>

          <TableShell
            columns={OUTBOX_COLUMNS}
            sortKeys={OUTBOX_SORT_KEYS}
            sort={outboxSort.sort}
            onSort={outboxSort.onSort}
            state={outboxTableState}
            scrollLabel="Message outbox"
          >
            {outboxRows.map((m) => (
              <tr key={m.id}>
                <td className={tdClass}>
                  <div className="flex flex-col">
                    <span className="text-text-strong font-medium">{m.recipient}</span>
                    <span className="text-caption text-text-muted tabular-nums">{m.contact}</span>
                  </div>
                </td>
                <td className={cn(tdClass, 'max-w-90')}>
                  <div className="flex flex-col">
                    <span className="text-text-strong font-medium">{m.event}</span>
                    <span className="text-caption text-text-muted truncate">{m.body}</span>
                  </div>
                </td>
                <td className={tdClass}>{m.channel}</td>
                <td className={tdClass}>
                  <div className="flex flex-col">
                    <span>{m.appointmentId}</span>
                    <span className="text-caption text-text-muted">{m.bookingRef}</span>
                  </div>
                </td>
                <td className={cn(tdClass, 'whitespace-nowrap tabular-nums')}>
                  {fmtDate(m.date)} · {m.time}
                </td>
                <td className={tdClass}>
                  <Badge status={m.status} />
                </td>
                <td className={tdClass}>
                  {m.status === 'Queued' && (
                    <Can perm="Hospital Settings.edit">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-d-500"
                        onClick={() =>
                          setCancelTarget({
                            kind: 'message',
                            id: m.id,
                            label: `${m.event} to ${m.recipient}`,
                          })
                        }
                      >
                        Cancel
                      </Button>
                    </Can>
                  )}
                </td>
              </tr>
            ))}
          </TableShell>

          <Pager
            total={orderedOutbox.length}
            page={pg}
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
            <InfoDot text="A notice to a whole audience rather than one appointment. Scheduled announcements go out at 09:00 on their date and can be cancelled until then." />
            <div className="flex-1" />
            <RefreshBtn onRefresh={refresh} title="Refresh announcements" />
          </div>

          {announcements.length === 0 ? (
            <EmptyState
              icon="megaphone"
              title="No announcements yet."
              message="Tell patients about a closure, a camp or a change of address — to everyone, one department, or one day's appointments."
              actionLabel={mayEdit ? 'New announcement' : undefined}
              onAction={mayEdit ? () => setAnnounceOpen(true) : undefined}
              actionVariant="button"
            />
          ) : (
            <TableShell
              columns={ANNOUNCEMENT_COLUMNS}
              rightCols={['Reach']}
              scrollLabel="Announcements"
            >
              {announcements.map((a) => (
                <tr key={a.id}>
                  <td className={cn(tdClass, 'max-w-100')}>
                    <div className="flex flex-col">
                      <span className="text-text-strong font-medium">{a.title}</span>
                      <span className="text-caption text-text-muted truncate">{a.body}</span>
                    </div>
                  </td>
                  <td className={tdClass}>{announcementAudienceCopy(a)}</td>
                  <td className={tdClass}>{a.channel}</td>
                  <td className={cn(tdClass, 'text-right tabular-nums')}>~{a.reach}</td>
                  <td className={cn(tdClass, 'whitespace-nowrap tabular-nums')}>
                    {a.status === 'Scheduled' && a.scheduledFor
                      ? `${fmtDate(a.scheduledFor)} · 09:00`
                      : `${fmtDate(a.createdOn)} · ${a.createdTime}`}
                  </td>
                  <td className={tdClass}>
                    <Badge status={a.status} />
                  </td>
                  <td className={tdClass}>
                    {a.status !== 'Cancelled' && (
                      <Can perm="Hospital Settings.del">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-d-500"
                          onClick={() =>
                            setCancelTarget({ kind: 'announcement', id: a.id, label: a.title })
                          }
                        >
                          Cancel
                        </Button>
                      </Can>
                    )}
                  </td>
                </tr>
              ))}
            </TableShell>
          )}

          <div className="text-caption text-text-muted mt-4 flex items-start gap-2">
            <Icon name="info" size={14} className="mt-0.5 flex-none" />
            <span>
              Announcements are queued for Medibook&apos;s messaging gateway. Reach is an estimate
              from the audience you chose, not a delivery count.
            </span>
          </div>
        </Card>
      )}

      {templateEdit && (
        <TemplateModal
          key={templateEdit.id}
          open
          template={templateEdit}
          onClose={() => setTemplateEdit(null)}
          onSave={saveTemplate}
        />
      )}
      {sendOpen && (
        <SendMessageModal
          open
          targets={sendTargets}
          templates={templates}
          onClose={() => setSendOpen(false)}
          onReview={onReviewSend}
        />
      )}
      {announceOpen && (
        <AnnouncementModal
          open
          departments={departmentNames}
          reach={reach}
          onClose={() => setAnnounceOpen(false)}
          onPublish={onPublish}
        />
      )}

      <ConfirmModal
        open={pendingSend != null}
        title="Queue this message?"
        body={
          pendingSend
            ? `${pendingSend.input.event} will be queued for ${pendingSend.target.patientName} by ${pendingSend.input.channel} to ${pendingSend.input.contact} (appointment ${pendingSend.target.appointmentId}). It stays in the outbox until Medibook's gateway picks it up, and you can cancel it until then.`
            : ''
        }
        confirmLabel="Queue message"
        onClose={() => setPendingSend(null)}
        onConfirm={confirmSend}
      />

      <ConfirmModal
        open={cancelTarget != null}
        title={
          cancelTarget?.kind === 'announcement'
            ? 'Cancel this announcement?'
            : 'Cancel this queued message?'
        }
        body={
          cancelTarget
            ? cancelTarget.kind === 'announcement'
              ? `“${cancelTarget.label}” will not go out. Cancelling cannot be undone — you would have to compose it again.`
              : `“${cancelTarget.label}” will not be handed to the gateway. Cancelling cannot be undone.`
            : ''
        }
        confirmLabel={cancelTarget?.kind === 'announcement' ? 'Cancel announcement' : 'Cancel message'}
        danger
        onClose={() => setCancelTarget(null)}
        onConfirm={confirmCancel}
      />
    </div>
  );
}
