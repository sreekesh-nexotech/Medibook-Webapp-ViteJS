import { useState } from 'react';

import { isFailure } from '@/core/error/failure';

import { DEFAULT_PAGE_SIZE } from '@/core/api/pagination';
import { describeFailure } from '@/shared/lib/serverErrors';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Pager } from '@/shared/ui/Pager';
import { SkeletonLine } from '@/shared/ui/Skeleton';

import { useDoctorReviewsQuery } from '@/features/doctors/application/queries/useDoctorReviewsQuery';
import { useHospitalProfileQuery } from '@/features/settings/application/queries/useHospitalProfileQuery';

import { Stars } from './Stars';

/** Answers that mean "this backend has no hospital review list yet" (DOC-01 pending). */
const NOT_BUILT_STATUSES: ReadonlySet<number> = new Set([404, 405, 501]);

/** The day a review was written, in the hospital's zone (D-09; the API sends UTC). */
function reviewDate(iso: string | null, timeZone: string | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone }).format(date);
}

interface DoctorReviewsProps {
  doctorId: string;
}

/**
 * The doctor's approved patient reviews, newest first
 * (`GET /hospital/doctors/{id}/reviews`, DOC-01). Read-only: Medibook
 * moderates reviews. Until the backend serves the list, the tab says so
 * instead of showing an error.
 */
export function DoctorReviews({ doctorId }: DoctorReviewsProps) {
  const [page, setPage] = useState(0);
  const reviews = useDoctorReviewsQuery(doctorId, page + 1);
  const timeZone = useHospitalProfileQuery().data?.timezone ?? undefined;

  if (reviews.isPending) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <SkeletonLine w="70%" />
        <SkeletonLine w="90%" />
        <SkeletonLine w="60%" />
      </div>
    );
  }
  if (reviews.isError) {
    const error = reviews.error;
    if (isFailure(error) && error.status !== null && NOT_BUILT_STATUSES.has(error.status)) {
      return (
        <EmptyState
          compact
          icon="message-circle"
          title="Written reviews are not available yet"
          message="The server does not list individual reviews to the hospital yet; the average rating above is up to date."
        />
      );
    }
    return (
      <ErrorState
        inline
        title="Reviews could not be loaded"
        message={describeFailure(error, 'Please try again.')}
        onRetry={() => void reviews.refetch()}
      />
    );
  }
  const data = reviews.data;
  if (data.items.length === 0) {
    return (
      <EmptyState
        compact
        icon="message-circle"
        title="No approved reviews yet"
        message="Reviews appear here once patients rate a visit and Medibook approves them."
      />
    );
  }
  return (
    <div>
      <ul className="divide-border-soft border-border-soft divide-y rounded-md border">
        {data.items.map((r) => (
          <li key={r.id} className="flex flex-col gap-1 px-3.5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <Stars r={r.rating} />
              <span className="text-caption text-text-muted">
                {[r.patientInitials, reviewDate(r.reviewedAt, timeZone)]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </div>
            {r.comment ? (
              <p className="text-body text-text-body">{r.comment}</p>
            ) : (
              <p className="text-caption text-text-muted">Rating only, no comment.</p>
            )}
          </li>
        ))}
      </ul>
      <Pager
        total={data.total}
        page={page}
        pageSize={DEFAULT_PAGE_SIZE}
        onPage={setPage}
        noun="reviews"
      />
    </div>
  );
}
