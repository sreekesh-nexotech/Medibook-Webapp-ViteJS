import { useState } from 'react';

import { isFailure } from '@/core/error/failure';
import { cn } from '@/shared/lib/cn';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import { Icon } from '@/shared/ui/Icon';
import { Pager } from '@/shared/ui/Pager';
import { SegTabs } from '@/shared/ui/SegTabs';
import { SkeletonCards } from '@/shared/ui/Skeleton';
import { toast } from '@/shared/ui/toast/toast.store';

import { useHospitalOptionsQuery } from '@/features/ops-hospitals/application/queries/useHospitalOptionsQuery';
import { useModerateReviewMutation } from '@/features/ops-reviews/application/queries/useModerateReviewMutation';
import { useReviewsQuery } from '@/features/ops-reviews/application/queries/useReviewsQuery';
import type { DoctorReview } from '@/features/ops-reviews/domain/entities/reviews.entities';
import { RejectReviewModal } from '@/features/ops-reviews/presentation/components/RejectReviewModal';
import {
  MODERATION_LOOK,
  RATINGS,
  ratingLabel,
  REVIEW_TABS,
  reviewActions,
  tabModeration,
  type ReviewTab,
} from '@/features/ops-reviews/presentation/components/reviews.view';

const PAGE_SIZE = 10;
const MAX_STARS = 5;
const ALL_HOSPITALS = 'All hospitals';
const ALL_RATINGS = 'Any rating';

const DATE_FORMAT = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5" role="img" aria-label={ratingLabel(rating)}>
      {Array.from({ length: MAX_STARS }, (_, i) => (
        <Icon
          key={i}
          name="star"
          size={15}
          className={cn(i < rating ? 'text-y-600' : 'text-text-faint')}
        />
      ))}
    </span>
  );
}

/**
 * Patient review moderation (UAT-31, 13·Settings F3/R6): the queue of
 * reviews, oldest first, approved to publish them (and count them in the
 * ratings) or rejected. `notifications.edit`, so the support role moderates.
 */
export function OpsReviewsScreen() {
  const [tab, setTab] = useState<ReviewTab>('Pending');
  const [hospitalId, setHospitalId] = useState<string | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [rejecting, setRejecting] = useState<DoctorReview | null>(null);
  const hospitals = useHospitalOptionsQuery();
  const moderate = useModerateReviewMutation();
  const reviews = useReviewsQuery({
    page: page + 1,
    pageSize: PAGE_SIZE,
    moderation: tabModeration(tab),
    hospitalId,
    rating,
  });
  const rows = reviews.data?.items ?? [];

  const approve = (r: DoctorReview): void => {
    moderate.mutate(
      { id: r.id, decision: { action: 'approve' } },
      {
        onSuccess: () => toast(`Review of ${r.doctorName} published.`, 'success'),
        onError: (error) =>
          toast(isFailure(error) ? error.message : 'Could not publish the review.', 'error'),
      },
    );
  };

  const reject = (reason: string | null): void => {
    if (!rejecting) return;
    const r = rejecting;
    moderate.mutate(
      { id: r.id, decision: { action: 'reject', reason } },
      {
        onSuccess: () => {
          toast(`Review of ${r.doctorName} rejected.`, 'success');
          setRejecting(null);
        },
        onError: (error) =>
          toast(isFailure(error) ? error.message : 'Could not reject the review.', 'error'),
      },
    );
  };

  const busyId = moderate.isPending ? moderate.variables.id : null;

  return (
    <div className="flex flex-col gap-5">
      <Card pad={16} className="flex flex-wrap items-center gap-3">
        <SegTabs
          tabs={REVIEW_TABS}
          value={tab}
          onChange={(t) => {
            setTab(REVIEW_TABS.find((x) => x === t) ?? tab);
            setPage(0);
          }}
        />
        <div className="flex-1"></div>
        {hospitals.canView && (
          <FilterSelect
            value={hospitals.options.find((h) => h.id === hospitalId)?.name ?? ALL_HOSPITALS}
            options={[ALL_HOSPITALS, ...hospitals.options.map((h) => h.name)]}
            onChange={(v) => {
              setHospitalId(hospitals.options.find((h) => h.name === v)?.id ?? null);
              setPage(0);
            }}
            aria-label="Filter by hospital"
          />
        )}
        <FilterSelect
          value={rating === null ? ALL_RATINGS : `${rating} stars`}
          options={[ALL_RATINGS, ...RATINGS.map((n) => `${n} stars`)]}
          onChange={(v) => {
            setRating(RATINGS.find((n) => `${n} stars` === v) ?? null);
            setPage(0);
          }}
          aria-label="Filter by rating"
        />
      </Card>

      {reviews.isPending ? (
        <SkeletonCards count={3} lines={3} />
      ) : reviews.isError ? (
        <Card>
          <ErrorState
            title="Reviews didn't load"
            message={isFailure(reviews.error) ? reviews.error.message : undefined}
            onRetry={() => void reviews.refetch()}
          />
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon="star"
            title={tab === 'Pending' ? 'No reviews waiting.' : 'No reviews here.'}
            message={
              tab === 'Pending'
                ? 'New patient reviews appear here for a decision before they are published.'
                : 'Try another tab or clear the filters.'
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((r) => {
            const look = MODERATION_LOOK[r.moderation];
            const actions = reviewActions(r);
            return (
              <Card key={r.id} className="flex flex-wrap items-start gap-4">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Stars rating={r.rating} />
                    <Badge status={look.badge}>{look.label}</Badge>
                    <span className="text-caption text-text-muted">
                      {DATE_FORMAT.format(new Date(r.createdAt))}
                    </span>
                  </div>
                  <span className="text-body text-text-strong font-medium">
                    {r.doctorName} · {r.hospitalName}
                  </span>
                  <p className="text-body text-text-body m-0 whitespace-pre-wrap">
                    {r.comment ?? 'No comment — rating only.'}
                  </p>
                  <span className="text-caption text-text-muted">
                    {r.bookingRef ? `Booking ${r.bookingRef}` : 'Booking reference unavailable'}
                    {r.moderatedAt
                      ? ` · decided ${DATE_FORMAT.format(new Date(r.moderatedAt))}`
                      : ''}
                  </span>
                </div>
                <div className="flex gap-2">
                  {actions.canApprove && (
                    <Button
                      size="sm"
                      variant="success"
                      icon="check"
                      busy={busyId === r.id}
                      disabled={busyId !== null}
                      onClick={() => approve(r)}
                    >
                      Publish
                    </Button>
                  )}
                  {actions.canReject && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-d-500"
                      disabled={busyId !== null}
                      onClick={() => setRejecting(r)}
                    >
                      {r.moderation === 'approved' ? 'Take down' : 'Reject'}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
          <Pager
            total={reviews.data.total}
            page={page}
            pageSize={PAGE_SIZE}
            onPage={setPage}
            noun="reviews"
          />
        </div>
      )}

      {rejecting && (
        <RejectReviewModal
          doctorName={rejecting.doctorName}
          busy={moderate.isPending}
          onClose={() => setRejecting(null)}
          onReject={reject}
        />
      )}
    </div>
  );
}
