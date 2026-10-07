import { useState } from 'react';

import { isFailure } from '@/core/error/failure';
import { cn } from '@/shared/lib/cn';
import { fmtDate, todayISO } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Icon } from '@/shared/ui/Icon';
import { IconBtn } from '@/shared/ui/IconBtn';
import { InfoDot } from '@/shared/ui/InfoDot';
import { OpsConfirm } from '@/shared/ui/OpsConfirm';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { SegTabs } from '@/shared/ui/SegTabs';
import { SkeletonCards } from '@/shared/ui/Skeleton';
import { toast } from '@/shared/ui/toast/toast.store';

import { useBannerPermissions } from '@/features/ops-notifications/application/queries/useBannerPermissions';
import { useBannersQuery } from '@/features/ops-notifications/application/queries/useBannersQuery';
import { useDeleteBannerMutation } from '@/features/ops-notifications/application/queries/useDeleteBannerMutation';
import { useReorderBannersMutation } from '@/features/ops-notifications/application/queries/useReorderBannersMutation';
import { useSaveBannerMutation } from '@/features/ops-notifications/application/queries/useSaveBannerMutation';
import { useToggleBannerMutation } from '@/features/ops-notifications/application/queries/useToggleBannerMutation';
import type {
  BannerDraft,
  CampaignBanner,
} from '@/features/ops-notifications/domain/entities/notifications.entities';
import { audienceLabel } from '@/features/ops-notifications/presentation/components/bannerRules';
import { BannerModal } from '@/features/ops-notifications/presentation/components/BannerModal';
import { BannerThumb } from '@/features/ops-notifications/presentation/components/BannerThumb';

type BannerStateLabel = 'Paused' | 'Expired' | 'Scheduled' | 'Live';

/** Derived banner state vs today (design `bannerState`); an open-ended window never expires. */
function bannerState(b: CampaignBanner, today: string): BannerStateLabel {
  if (!b.active) return 'Paused';
  if (b.to && b.to < today) return 'Expired';
  if (b.from && b.from > today) return 'Scheduled';
  return 'Live';
}

const EMPTY_BANNERS: readonly CampaignBanner[] = [];

/** A failed action's user-safe message (the typed `Failure`'s own, when there is one). */
function failureMessage(error: unknown, fallbackMessage: string): string {
  return isFailure(error) ? error.message : fallbackMessage;
}

type NotificationsTab = 'App Banners' | 'Push Notifications';

interface EditNew {
  new: true;
}
interface EditBanner {
  banner: CampaignBanner;
}
type EditState = EditNew | EditBanner | null;

/**
 * Patient-app notifications (design OpsNotifications): campaign banners on
 * `/platform/banners`. The platform API has no default-banner setting and no
 * push-notification endpoints yet, so those parts say so instead of showing
 * data that is not real.
 */
export function OpsNotificationsScreen() {
  const bannersQuery = useBannersQuery();
  const banners = bannersQuery.data ?? EMPTY_BANNERS;
  const saveMutation = useSaveBannerMutation();
  const deleteMutation = useDeleteBannerMutation();
  const toggleMutation = useToggleBannerMutation();
  const reorderMutation = useReorderBannersMutation();
  const { canAdd, canEdit, canDelete } = useBannerPermissions();
  const today = todayISO();

  const [tab, setTab] = useState<NotificationsTab>('App Banners');
  const [edit, setEdit] = useState<EditState>(null);
  const [delId, setDelId] = useState<string | null>(null);

  const liveNow = banners.find((b) => bannerState(b, today) === 'Live');

  const editBanner = edit && 'banner' in edit ? edit.banner : null;

  const onSaveBanner = (draft: BannerDraft) => {
    const nextSortOrder = Math.max(-1, ...banners.map((b) => b.sortOrder)) + 1;
    saveMutation.mutate(
      { target: editBanner, draft, nextSortOrder },
      {
        onSuccess: () => {
          toast(
            editBanner ? 'Banner updated.' : 'Banner added — it goes live on its start date.',
            'success',
          );
          setEdit(null);
        },
        onError: (error) => toast(failureMessage(error, 'Could not save the banner.'), 'error'),
      },
    );
  };

  /** Swap the banner at index i with i+dir and save the new rotation order. */
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= banners.length) return;
    const next = [...banners];
    [next[i], next[j]] = [next[j], next[i]];
    reorderMutation.mutate(next, {
      onError: (error) =>
        toast(failureMessage(error, 'Could not change the rotation order.'), 'error'),
    });
  };

  const togglePause = (b: CampaignBanner) =>
    toggleMutation.mutate(b, {
      onError: (error) =>
        toast(
          failureMessage(error, `Could not ${b.active ? 'pause' : 'resume'} the banner.`),
          'error',
        ),
    });

  const confirmDelete = () => {
    if (!delBanner) return;
    deleteMutation.mutate(delBanner, {
      onSuccess: () => {
        toast('Banner deleted.', 'success');
        setDelId(null);
      },
      onError: (error) => toast(failureMessage(error, 'Could not delete the banner.'), 'error'),
    });
  };

  const delBanner = banners.find((b) => b.id === delId);

  const liveCount = banners.filter((b) => bannerState(b, today) === 'Live').length;

  /** The banner the editor is opened on — also its remount key (no sync effect). */
  const editKey = editBanner ? `banner-${editBanner.id}` : edit ? 'new' : 'closed';

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
          <Button icon="plus" disabled={!canAdd} onClick={() => setEdit({ new: true })}>
            Add Banner
          </Button>
        )}
      </Card>

      {tab === 'App Banners' && bannersQuery.isPending ? (
        <SkeletonCards count={1} lines={5} />
      ) : tab === 'App Banners' && bannersQuery.isError ? (
        <ErrorState
          title="Banners didn't load"
          message={failureMessage(
            bannersQuery.error,
            "That didn't load. Retrying usually fixes it.",
          )}
          onRetry={() => void bannersQuery.refetch()}
        />
      ) : tab === 'App Banners' ? (
        <>
          <Card pad={16} className="flex items-center gap-3">
            <div className="bg-g-100 text-g-600 flex size-9.5 flex-none items-center justify-center rounded-md">
              <Icon name="smartphone" size={18} />
            </div>
            <div className="min-w-0">
              <div className="text-body text-text-strong font-medium">
                Showing in the app right now:{' '}
                {liveNow ? `“${liveNow.title}”` : 'no campaign banner'}
              </div>
              <div className="text-caption text-text-muted">
                Live banners rotate on the patient app home screen in the order below, each for the
                audience it is set to. When none is live, the app shows its built-in home screen.
              </div>
            </div>
          </Card>

          <Card>
            <SectionTitle className="mb-3">Default Banner</SectionTitle>
            <EmptyState
              compact
              icon="image"
              title="The default banner can't be managed here yet."
              message="The platform API has no default-banner setting. When no campaign banner is live, the app shows its built-in home screen."
            />
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
                  message="Until one is live the app shows its built-in home screen."
                  actionLabel="Add Banner"
                  actionIcon="plus"
                  actionVariant="button"
                  onAction={canAdd ? () => setEdit({ new: true }) : undefined}
                />
              )}
              {banners.map((b, i) => {
                const st = bannerState(b, today);
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
                        disabled={i === 0 || !canEdit || reorderMutation.isPending}
                        onClick={() => move(i, -1)}
                      />
                      <IconBtn
                        name="chevron-down"
                        box={26}
                        size={15}
                        label="Move down"
                        title={`Move “${b.title}” down the rotation`}
                        disabled={i === banners.length - 1 || !canEdit || reorderMutation.isPending}
                        onClick={() => move(i, 1)}
                      />
                    </div>
                    <span className="text-body text-text-muted w-4.5 flex-none text-center font-medium tabular-nums">
                      {i + 1}
                    </span>
                    <BannerThumb fileId={b.imageFileId} title={b.title} />
                    <div className="min-w-0 flex-1">
                      <div className="text-body text-text-strong truncate font-medium">
                        {b.title}
                      </div>
                      <div className="text-caption text-text-muted tabular-nums">
                        {fmtDate(b.from)} – {fmtDate(b.to)} · {audienceLabel(b.audience)}
                        {b.ctaLabel ? ` · “${b.ctaLabel}” button` : ''}
                      </div>
                    </div>
                    <Badge status={st} />
                    {st !== 'Expired' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!canEdit}
                        busy={toggleMutation.isPending && toggleMutation.variables.id === b.id}
                        onClick={() => togglePause(b)}
                      >
                        {b.active ? 'Pause' : 'Resume'}
                      </Button>
                    )}
                    <IconBtn
                      name="pencil"
                      box={36}
                      size={15}
                      label="Edit banner"
                      title={`Edit “${b.title}”`}
                      disabled={!canEdit}
                      onClick={() => setEdit({ banner: b })}
                    />
                    <IconBtn
                      name="trash-2"
                      box={36}
                      size={15}
                      color="var(--color-d-500)"
                      label="Delete banner"
                      title={`Delete “${b.title}”`}
                      disabled={!canDelete}
                      onClick={() => setDelId(b.id)}
                    />
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      ) : (
        <Card>
          <EmptyState
            icon="bell-ring"
            title="Push notifications aren't available yet."
            message="The platform API has no endpoint for composing, scheduling or listing push notifications. Booking and queue updates are still sent to patients automatically."
          />
        </Card>
      )}

      <BannerModal
        key={editKey}
        open={edit != null}
        banner={editBanner}
        busy={saveMutation.isPending}
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
            ? `“${delBanner.title}” leaves the app straight away. It is kept on record but cannot be restored from the console.`
            : ''
        }
        confirmLabel={deleteMutation.isPending ? 'Deleting…' : 'Delete Banner'}
        confirmVariant="danger"
        busy={deleteMutation.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
