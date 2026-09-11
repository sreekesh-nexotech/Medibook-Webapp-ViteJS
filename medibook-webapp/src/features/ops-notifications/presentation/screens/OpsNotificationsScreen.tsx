import { useState } from 'react';

import { useOpsAct } from '@/shared/hooks/useOpsAct';
import { cn } from '@/shared/lib/cn';
import { fmtDate } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Icon } from '@/shared/ui/Icon';
import { IconBtn } from '@/shared/ui/IconBtn';
import { InfoDot } from '@/shared/ui/InfoDot';
import { OpsConfirm } from '@/shared/ui/OpsConfirm';
import { OpsEntity } from '@/shared/ui/OpsEntity';
import { OpsField } from '@/shared/ui/OpsField';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { SegTabs } from '@/shared/ui/SegTabs';
import { Select } from '@/shared/ui/Select';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import { TextInput } from '@/shared/ui/TextInput';

import {
  AUDIENCES,
  BAN_TODAY,
} from '@/features/ops-notifications/application/store/notifications.fixtures';
import { useNotificationsStore } from '@/features/ops-notifications/application/store/notifications.store';
import type {
  Banner,
  PushAudience,
} from '@/features/ops-notifications/application/store/notifications.types';
import { BannerModal } from '@/features/ops-notifications/presentation/components/BannerModal';
import { BannerThumb } from '@/features/ops-notifications/presentation/components/BannerThumb';

type BannerStateLabel = 'Paused' | 'Expired' | 'Scheduled' | 'Live';

/** Derived banner state vs the demo "today" (design `bannerState` / `BAN_TODAY`). */
function bannerState(b: Banner): BannerStateLabel {
  if (!b.active) return 'Paused';
  if (b.to < BAN_TODAY) return 'Expired';
  if (b.from > BAN_TODAY) return 'Scheduled';
  return 'Live';
}

type NotificationsTab = 'App Banners' | 'Push Notifications';
type PushTiming = 'Send now' | 'Schedule';

interface EditNew {
  new: true;
}
interface EditBanner {
  banner: Banner;
}
interface EditFallback {
  fallback: true;
}
type EditState = EditNew | EditBanner | EditFallback | null;

interface PushComposer {
  title: string;
  body: string;
  audience: PushAudience;
  timing: PushTiming;
  date: string;
}

interface PushErrors {
  title?: string | null;
  body?: string | null;
  date?: string | null;
}

const EMPTY_COMPOSER: PushComposer = {
  title: '',
  body: '',
  audience: 'All users',
  timing: 'Send now',
  date: '',
};

const dateInputClass =
  'text-body text-text-body rounded-input border-border h-12 w-full border bg-white px-3';

const PUSH_COLUMNS = [
  'Notification',
  'Audience',
  'When',
  'Delivered',
  'Open Rate',
  'Status',
  '',
] as const;

/** Patient-app notifications — home-screen banners + push composer (design OpsNotifications). */
export function OpsNotificationsScreen() {
  const banners = useNotificationsStore((s) => s.banners);
  const fallback = useNotificationsStore((s) => s.fallback);
  const pushes = useNotificationsStore((s) => s.pushes);
  const move = useNotificationsStore((s) => s.move);
  const saveBanner = useNotificationsStore((s) => s.saveBanner);
  const deleteBanner = useNotificationsStore((s) => s.deleteBanner);
  const togglePause = useNotificationsStore((s) => s.togglePause);
  const sendPush = useNotificationsStore((s) => s.sendPush);
  const schedulePush = useNotificationsStore((s) => s.schedulePush);
  const cancelPush = useNotificationsStore((s) => s.cancelPush);

  const [tab, setTab] = useState<NotificationsTab>('App Banners');
  const [edit, setEdit] = useState<EditState>(null);
  const [delId, setDelId] = useState<number | null>(null);
  const [busy, run] = useOpsAct();
  const [p, setP] = useState<PushComposer>(EMPTY_COMPOSER);
  const [pErr, setPErr] = useState<PushErrors>({});
  const [confirmSend, setConfirmSend] = useState(false);
  const [cancelId, setCancelId] = useState<number | null>(null);

  const liveNow = [...banners]
    .filter((b) => bannerState(b) === 'Live')
    .sort((a, b) => banners.indexOf(a) - banners.indexOf(b))[0];

  const editBanner = edit && 'banner' in edit ? edit.banner : null;
  const editFallback = edit != null && 'fallback' in edit;

  const onSaveBanner = (f: Parameters<typeof saveBanner>[1]) => {
    if (editFallback) saveBanner({ fallback: true }, f);
    else if (editBanner) saveBanner({ bannerId: editBanner.id }, f);
    else saveBanner({}, f);
    setEdit(null);
  };

  const delBanner = banners.find((b) => b.id === delId);

  const submitPush = () => {
    const e: PushErrors = {
      title: p.title.trim() ? null : 'Add a title.',
      body: p.body.trim() ? null : 'Add a message.',
      date: p.timing === 'Schedule' && !p.date ? 'Pick a date.' : null,
    };
    setPErr(e);
    if (e.title || e.body || e.date) return;
    setConfirmSend(true);
  };

  const doSend = () => {
    const sched = p.timing === 'Schedule';
    run('push', sched ? 'Notification scheduled.' : 'Notification queued for delivery.', () => {
      if (sched) {
        schedulePush({ title: p.title, body: p.body, audience: p.audience, date: p.date });
      } else {
        sendPush({ title: p.title, body: p.body, audience: p.audience });
      }
      setP(EMPTY_COMPOSER);
      setConfirmSend(false);
    });
  };

  const cancelTarget = pushes.find((n) => n.id === cancelId) ?? null;

  /**
   * Audit 3.6.2 — cancelling a scheduled push used to fire on the first
   * click, on the very screen whose send dialog warns that pushes cannot be
   * recalled. It is now confirmed, and the dialog names the consequence.
   */
  const doCancelPush = (): void => {
    if (cancelId == null) return;
    const id = cancelId;
    run('cancelpush', null, () => {
      cancelPush(id);
      setCancelId(null);
    });
  };

  const liveCount = banners.filter((b) => bannerState(b) === 'Live').length;

  /** The banner the editor is opened on — also its remount key (no sync effect). */
  const editKey = editFallback
    ? 'fallback'
    : editBanner
      ? `banner-${editBanner.id}`
      : edit
        ? 'new'
        : 'closed';

  return (
    <div className="flex flex-col gap-5">
      <Card pad={16} className="flex flex-wrap items-center gap-3">
        <SegTabs
          tabs={['App Banners', 'Push Notifications']}
          value={tab}
          onChange={(t) => setTab(t as NotificationsTab)}
        />
        <div className="flex-1"></div>
        {tab === 'App Banners' && (
          <Button icon="plus" onClick={() => setEdit({ new: true })}>
            Add Banner
          </Button>
        )}
      </Card>

      {tab === 'App Banners' ? (
        <>
          <Card pad={16} className="flex items-center gap-3">
            <div className="bg-g-100 text-g-600 flex size-9.5 flex-none items-center justify-center rounded-md">
              <Icon name="smartphone" size={18} />
            </div>
            <div className="min-w-0">
              <div className="text-body text-text-strong font-medium">
                Showing in the app right now:{' '}
                {liveNow ? `“${liveNow.title}”` : `default banner — “${fallback.title}”`}
              </div>
              <div className="text-caption text-text-muted">
                Live banners rotate on the patient app home screen in the order below. When none is
                live, the default banner shows.
              </div>
            </div>
          </Card>

          <Card>
            <SectionTitle className="mb-3">Default Banner</SectionTitle>
            <div className="border-border-soft bg-bg-subtle flex items-center gap-3.5 rounded-md border px-3.5 py-3">
              <BannerThumb img={fallback.img} title={fallback.title} />
              <div className="min-w-0 flex-1">
                <div className="text-body text-text-strong font-medium">{fallback.title}</div>
                <div className="text-caption text-text-muted">
                  Always on — shown whenever no campaign banner is live. Cannot be deleted.
                </div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                icon="pencil"
                onClick={() => setEdit({ fallback: true })}
              >
                Edit
              </Button>
            </div>
          </Card>

          <Card>
            <div className="mb-3 flex items-center gap-2">
              <SectionTitle>Campaign Banners</SectionTitle>
              <InfoDot text="Order sets rotation priority in the app — use the arrows. Pause takes a banner out of rotation without losing its schedule. Expired banners stay here for reference until deleted." />
              <div className="flex-1"></div>
              <span className="text-caption text-text-muted">
                {liveCount} live · {banners.length} total
              </span>
            </div>
            <div className="flex flex-col">
              {banners.length === 0 && (
                <EmptyState
                  icon="image"
                  title="No campaign banners yet."
                  message="Until one is live the app shows the default banner above."
                  actionLabel="Add Banner"
                  actionIcon="plus"
                  actionVariant="button"
                  onAction={() => setEdit({ new: true })}
                />
              )}
              {banners.map((b, i) => {
                const st = bannerState(b);
                return (
                  <div
                    key={b.id}
                    className={cn(
                      'flex items-center gap-3.5 px-1 py-3.25',
                      i < banners.length - 1 && 'border-border-soft border-b',
                    )}
                  >
                    <div className="flex flex-none flex-col gap-0.5">
                      <IconBtn
                        name="chevron-up"
                        box={26}
                        size={15}
                        label="Move up"
                        title={`Move “${b.title}” up the rotation`}
                        disabled={i === 0}
                        onClick={() => move(i, -1)}
                      />
                      <IconBtn
                        name="chevron-down"
                        box={26}
                        size={15}
                        label="Move down"
                        title={`Move “${b.title}” down the rotation`}
                        disabled={i === banners.length - 1}
                        onClick={() => move(i, 1)}
                      />
                    </div>
                    <span className="text-body text-text-muted w-4.5 flex-none text-center font-medium tabular-nums">
                      {i + 1}
                    </span>
                    <BannerThumb img={b.img} title={b.title} />
                    <div className="min-w-0 flex-1">
                      <div className="text-body text-text-strong truncate font-medium">
                        {b.title}
                      </div>
                      <div className="text-caption text-text-muted tabular-nums">
                        {fmtDate(b.from)} – {fmtDate(b.to)}
                      </div>
                    </div>
                    <Badge status={st} />
                    {st !== 'Expired' && (
                      <Button size="sm" variant="secondary" onClick={() => togglePause(b.id)}>
                        {b.active ? 'Pause' : 'Resume'}
                      </Button>
                    )}
                    <IconBtn
                      name="pencil"
                      box={36}
                      size={15}
                      label="Edit banner"
                      title={`Edit “${b.title}”`}
                      onClick={() => setEdit({ banner: b })}
                    />
                    <IconBtn
                      name="trash-2"
                      box={36}
                      size={15}
                      color="var(--color-d-500)"
                      label="Delete banner"
                      title={`Delete “${b.title}”`}
                      onClick={() => setDelId(b.id)}
                    />
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      ) : (
        <>
          <Card>
            <div className="mb-4 flex items-center gap-2">
              <SectionTitle>Compose Push Notification</SectionTitle>
              <InfoDot text="Delivered to the Medibook patient app on the chosen devices. Booking and queue updates are sent automatically by the system — this composer is for offers and announcements only." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-4">
                <OpsField label="Title" required error={pErr.title}>
                  <TextInput
                    value={p.title}
                    onChange={(v) => {
                      if (v.length <= 40) {
                        setP({ ...p, title: v });
                        setPErr({ ...pErr, title: null });
                      }
                    }}
                    placeholder="e.g. 20% off health checkups"
                    height={48}
                  />
                  <span className="text-caption text-text-muted mt-1 block text-right">
                    {p.title.length}/40
                  </span>
                </OpsField>
                <OpsField label="Message" required error={pErr.body}>
                  <textarea
                    value={p.body}
                    onChange={(e) => {
                      if (e.target.value.length <= 120) {
                        setP({ ...p, body: e.target.value });
                        setPErr({ ...pErr, body: null });
                      }
                    }}
                    placeholder="Short, actionable — one line is best."
                    className="text-body-lg text-text-strong rounded-input border-border h-18.5 w-full resize-none border p-3"
                  ></textarea>
                  <span className="text-caption text-text-muted mt-1 block text-right">
                    {p.body.length}/120
                  </span>
                </OpsField>
              </div>
              <div className="flex flex-col gap-4">
                <OpsField label="Audience">
                  <Select
                    value={p.audience}
                    options={Object.keys(AUDIENCES)}
                    onChange={(v) => setP({ ...p, audience: v as PushAudience })}
                    height={48}
                  />
                  <span className="text-caption text-text-muted mt-1 block">
                    Reaches ~{AUDIENCES[p.audience]} users
                  </span>
                </OpsField>
                <OpsField label="Timing">
                  <SegTabs
                    tabs={['Send now', 'Schedule']}
                    value={p.timing}
                    onChange={(v) => setP({ ...p, timing: v as PushTiming })}
                  />
                </OpsField>
                {p.timing === 'Schedule' && (
                  <OpsField label="Send On" required error={pErr.date}>
                    {(field) => (
                      <input
                        type="date"
                        id={field.id}
                        aria-invalid={field.invalid || undefined}
                        aria-describedby={field.describedById}
                        value={p.date}
                        onChange={(e) => {
                          setP({ ...p, date: e.target.value });
                          setPErr({ ...pErr, date: null });
                        }}
                        className={dateInputClass}
                      />
                    )}
                  </OpsField>
                )}
                <div className="mt-auto flex justify-end">
                  <Button icon="send" onClick={submitPush}>
                    {p.timing === 'Schedule' ? 'Schedule Notification' : 'Send Notification'}
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <SectionTitle className="mb-4">Sent &amp; Scheduled</SectionTitle>
            <TableShell
              columns={PUSH_COLUMNS}
              scrollLabel="Sent and scheduled notifications"
              rightCols={['Delivered', 'Open Rate']}
              state={
                pushes.length === 0
                  ? {
                      kind: 'empty',
                      icon: 'bell-ring',
                      title: 'No notifications sent yet.',
                      message:
                        'Offers and announcements you send or schedule above are listed here with their delivery and open rates.',
                    }
                  : undefined
              }
            >
              {pushes.map((n) => (
                <tr key={n.id}>
                  <td className={cn(tdClass, 'max-w-85')}>
                    <OpsEntity
                      icon="bell-ring"
                      tint={n.status === 'Scheduled' ? 'info' : 'primary'}
                      title={n.title}
                      sub={n.body}
                    />
                  </td>
                  <td className={tdClass}>{n.audience}</td>
                  <td className={tdClass}>{n.when}</td>
                  <td className={cn(tdClass, 'text-right tabular-nums')}>{n.delivered}</td>
                  <td className={cn(tdClass, 'text-right tabular-nums')}>{n.opened}</td>
                  <td className={tdClass}>
                    <Badge status={n.status} />
                  </td>
                  <td className={tdClass}>
                    {n.status === 'Scheduled' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        style={{ color: 'var(--color-d-500)' }}
                        onClick={() => setCancelId(n.id)}
                      >
                        Cancel
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </TableShell>
          </Card>
        </>
      )}

      <BannerModal
        key={editKey}
        open={edit != null}
        banner={editBanner}
        fallback={editFallback}
        onClose={() => setEdit(null)}
        onSave={onSaveBanner}
      />
      <OpsConfirm
        open={!!delBanner}
        onClose={() => setDelId(null)}
        icon="trash-2"
        tone="danger"
        title="Delete this banner?"
        body={
          delBanner
            ? `“${delBanner.title}” is removed from the app immediately. This cannot be undone.`
            : ''
        }
        confirmLabel={busy.delb ? 'Deleting…' : 'Delete Banner'}
        confirmVariant="danger"
        busy={busy.delb}
        onConfirm={() =>
          run('delb', 'Banner deleted.', () => {
            if (delId == null) return;
            deleteBanner(delId);
            setDelId(null);
          })
        }
      />
      <OpsConfirm
        open={confirmSend}
        onClose={() => setConfirmSend(false)}
        icon="send"
        tone="neutral"
        title={
          p.timing === 'Schedule' ? 'Schedule this notification?' : 'Send this notification now?'
        }
        body={`“${p.title.trim()}” goes to ${p.audience} (~${AUDIENCES[p.audience]} users)${p.timing === 'Schedule' && p.date ? ` on ${fmtDate(p.date)} at 09:00` : ''}. Push notifications can't be recalled after delivery.`}
        confirmLabel={
          busy.push
            ? p.timing === 'Schedule'
              ? 'Scheduling…'
              : 'Sending…'
            : p.timing === 'Schedule'
              ? 'Schedule'
              : 'Send Now'
        }
        confirmVariant="primary"
        busy={busy.push}
        onConfirm={doSend}
      />
      <OpsConfirm
        open={cancelTarget != null}
        onClose={() => setCancelId(null)}
        icon="bell-ring"
        tone="danger"
        title="Cancel this scheduled notification?"
        summary={
          cancelTarget
            ? [
                { k: 'Notification', v: `“${cancelTarget.title}”` },
                { k: 'Audience', v: cancelTarget.audience },
                { k: 'Scheduled for', v: cancelTarget.when },
              ]
            : undefined
        }
        body={
          cancelTarget
            ? `It will not be sent, and the ~${AUDIENCES[cancelTarget.audience]} users in this audience will never receive it. Cancelling is only possible before delivery — once a push is out it cannot be recalled — and the cancellation itself cannot be undone: you would have to compose and schedule the notification again.`
            : ''
        }
        confirmLabel={busy.cancelpush ? 'Cancelling…' : 'Cancel Notification'}
        confirmVariant="danger"
        busy={busy.cancelpush}
        onConfirm={doCancelPush}
      />
    </div>
  );
}
