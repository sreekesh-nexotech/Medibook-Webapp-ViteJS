import { useState } from 'react';

import { DEFAULT_PAGE_SIZE } from '@/core/api/pagination';
import { cn } from '@/shared/lib/cn';
import { describeFailure } from '@/shared/lib/serverErrors';
import { Drawer } from '@/shared/ui/Drawer';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Pager } from '@/shared/ui/Pager';
import { SkeletonLine } from '@/shared/ui/Skeleton';

import { formatIsoDayLabel } from '@/features/doctors/domain/calendar';
import { useGenerationRunsQuery } from '@/features/slots/application/queries/useGenerationRunsQuery';

import { runChangesCopy, runStatus, runTime, runTriggerLabel } from './slotsRuns.view';

const STATUS_LABEL = { done: 'Done', running: 'Running', failed: 'Failed' } as const;

interface GenerationRunsDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Narrow to one doctor's runs (the doctor filter on the grid), or every run. */
  doctorId: string | null;
  doctorName: string | null;
  /** Doctor names for runs that belong to one doctor. */
  doctorNames: ReadonlyMap<string, string>;
  timeZone: string | null;
}

/**
 * Every slot generation run, newest first (`GET /slots/generation-runs`) —
 * nightly, rule-change and manual — with what each created, closed and kept
 * for bookings, and why a failed one failed (06·Slots R2).
 */
export function GenerationRunsDrawer({
  open,
  onClose,
  doctorId,
  doctorName,
  doctorNames,
  timeZone,
}: GenerationRunsDrawerProps) {
  const [page, setPage] = useState(0);
  const runs = useGenerationRunsQuery(doctorId, page + 1, open);
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Generation runs"
      subtitle={doctorName ? `Runs for ${doctorName} and the whole hospital` : 'Every run'}
      width={520}
    >
      {runs.isPending ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <SkeletonLine w="80%" />
          <SkeletonLine w="65%" />
          <SkeletonLine w="75%" />
        </div>
      ) : runs.isError ? (
        <ErrorState
          inline
          title="Generation runs could not be loaded"
          message={describeFailure(runs.error, 'Please try again.')}
          onRetry={() => void runs.refetch()}
        />
      ) : runs.data.items.length === 0 ? (
        <EmptyState
          compact
          icon="refresh-cw"
          title="No generation runs yet"
          message="Slots are generated nightly and after every schedule change; runs appear here."
        />
      ) : (
        <>
          <ul className="divide-border-soft border-border-soft divide-y rounded-md border">
            {runs.data.items.map((run) => {
              const status = runStatus(run);
              return (
                <li key={run.id} className="flex flex-col gap-1 px-3.5 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-body text-text-strong font-medium">
                      {runTime(run.startedAt, timeZone)}
                    </span>
                    <span className="text-caption text-text-muted">
                      {runTriggerLabel(run.trigger)}
                      {run.doctorId
                        ? ` · ${doctorNames.get(run.doctorId) ?? 'one doctor'}`
                        : ' · whole hospital'}
                    </span>
                    <span
                      className={cn(
                        'text-caption ml-auto rounded-full px-2 py-0.5',
                        status === 'failed' && 'bg-d-100 text-d-700',
                        status === 'running' && 'bg-y-100 text-y-700',
                        status === 'done' && 'bg-g-100 text-g-700',
                      )}
                    >
                      {STATUS_LABEL[status]}
                    </span>
                  </div>
                  <span className="text-caption text-text-body">{runChangesCopy(run)}</span>
                  {run.horizonFrom && run.horizonTo && (
                    <span className="text-caption text-text-muted">
                      Covers {formatIsoDayLabel(run.horizonFrom)} –{' '}
                      {formatIsoDayLabel(run.horizonTo)}
                    </span>
                  )}
                  {run.error && <span className="text-caption text-d-700">{run.error}</span>}
                </li>
              );
            })}
          </ul>
          <Pager
            total={runs.data.total}
            page={page}
            pageSize={DEFAULT_PAGE_SIZE}
            onPage={setPage}
            noun="runs"
          />
        </>
      )}
    </Drawer>
  );
}
