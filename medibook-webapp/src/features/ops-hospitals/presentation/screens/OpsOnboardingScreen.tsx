import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { isFailure } from '@/core/error/failure';

import { cn } from '@/shared/lib/cn';
import { fmtDate } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Card } from '@/shared/ui/Card';
import { ClearChip } from '@/shared/ui/ClearChip';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import { Icon } from '@/shared/ui/Icon';
import { Pager } from '@/shared/ui/Pager';
import { RefreshBtn } from '@/shared/ui/RefreshBtn';
import { SearchField } from '@/shared/ui/SearchField';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { SkeletonCards } from '@/shared/ui/Skeleton';

import { ONBOARDING_CASE_PARAM } from '@/app/router/paths';

import type {
  OnboardingCaseStage,
  OnboardingListQuery,
} from '@/features/ops-hospitals/domain/entities/onboarding.entity';
import { useOnboardingCasesQuery } from '@/features/ops-hospitals/application/queries/useOnboardingCasesQuery';
import { useRefreshOnboarding } from '@/features/ops-hospitals/application/queries/useRefreshOnboarding';
import { OnboardingCasePanel } from '@/features/ops-hospitals/presentation/components/OnboardingCasePanel';
import {
  PIPELINE_STAGES,
  STAGE_CONTEXT,
  STAGE_GLYPH,
  STAGE_LABEL,
  STAGE_PILL,
  STAGE_TINT,
} from '@/features/ops-hospitals/presentation/components/onboarding.status';
import { useHospitalsDebouncedValue } from '@/features/ops-hospitals/presentation/components/useHospitalsDebouncedValue';

const ALL_STAGES = 'Stage: All';

/** Applications listed per page beside the open case. */
const CASES_PAGE_SIZE = 20;

const SEARCH_DEBOUNCE_MS = 300;

/** ISO timestamp → "12 Oct 2026"; empty for none. */
function dateCopy(iso: string | null): string {
  return iso ? fmtDate(iso.slice(0, 10)) : '';
}

/**
 * Hospital onboarding pipeline — audit SA-01 (`/ops/onboarding`), on
 * `/platform/onboarding/cases` (P3).
 *
 * Applications counted by the server's stage (application → documents
 * requested → under review → approved → live, plus rejected), filtered,
 * searched and paged on the server (10·F22), and one application's checklist,
 * administrator, notes and go-live gate beside it. `?case=<id>` opens a case
 * directly — the hospital page links here that way (10·F13). Refresh reloads
 * the open case too (10·F20).
 */
export function OpsOnboardingScreen() {
  const [params, setParams] = useSearchParams();
  const refreshAll = useRefreshOnboarding();

  const [q, setQ] = useState('');
  const [stageF, setStageF] = useState<OnboardingCaseStage | 'All'>('All');
  const [page, setPage] = useState(0);
  const debouncedQ = useHospitalsDebouncedValue(q.trim(), SEARCH_DEBOUNCE_MS);

  const query: OnboardingListQuery = {
    page: page + 1,
    pageSize: CASES_PAGE_SIZE,
    stages: stageF === 'All' ? [] : [stageF],
    q: debouncedQ,
    assignedToId: null,
  };
  const pipeline = useOnboardingCasesQuery(query);

  const rows = pipeline.data?.cases ?? [];
  const counts = pipeline.data?.counts;
  const total = pipeline.data?.total ?? 0;

  // The deep-linked case wins; otherwise the first row on the page.
  const linkedId = params.get(ONBOARDING_CASE_PARAM);
  const activeId = linkedId ?? rows[0]?.id ?? null;
  const pick = (id: string): void => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set(ONBOARDING_CASE_PARAM, id);
        return next;
      },
      { replace: true },
    );
  };

  const filtersActive = Boolean(q.trim()) || stageF !== 'All';
  const clearAll = (): void => {
    setQ('');
    setStageF('All');
    setPage(0);
  };
  const chooseStage = (stage: OnboardingCaseStage | 'All'): void => {
    setStageF(stage);
    setPage(0);
  };
  const nothingAtAll = !filtersActive && total === 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {PIPELINE_STAGES.map((stage) => {
          const selected = stageF === stage;
          return (
            <Card
              key={stage}
              pad={16}
              hover
              className={cn('min-w-0', selected && 'border-text-navy')}
              onClick={() => chooseStage(selected ? 'All' : stage)}
              ariaLabel={`${STAGE_LABEL[stage]}: ${counts ? counts[stage] : 'not loaded'}${selected ? ', filter on' : ''}`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    'flex size-9 flex-none items-center justify-center rounded-md',
                    STAGE_TINT[stage],
                  )}
                >
                  <Icon name={STAGE_GLYPH[stage]} size={18} />
                </div>
                <span className="text-stat text-text-navy tabular-nums">
                  {counts ? counts[stage] : '—'}
                </span>
              </div>
              <div className="text-body text-text-strong mt-2.5 font-medium">
                {STAGE_LABEL[stage]}
              </div>
              <div className="text-caption text-text-muted">{STAGE_CONTEXT[stage]}</div>
            </Card>
          );
        })}
      </div>

      <Card>
        <div className="mb-4">
          <SearchField
            value={q}
            onChange={(v) => {
              setQ(v);
              setPage(0);
            }}
            placeholder="Search applicant hospital by name"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <RefreshBtn
            onRefresh={async () => {
              await refreshAll();
            }}
            title="Refresh the pipeline and the open application"
          />
          <FilterSelect
            value={stageF === 'All' ? ALL_STAGES : STAGE_LABEL[stageF]}
            aria-label="Filter by onboarding stage"
            options={[ALL_STAGES, ...PIPELINE_STAGES.map((s) => STAGE_LABEL[s])]}
            onChange={(v) =>
              chooseStage(PIPELINE_STAGES.find((s) => STAGE_LABEL[s] === v) ?? 'All')
            }
          />
          {filtersActive && <ClearChip onClick={clearAll} />}
        </div>
      </Card>

      {pipeline.isPending ? (
        <SkeletonCards count={3} lines={4} />
      ) : pipeline.isError ? (
        <ErrorState
          title="The onboarding pipeline didn't load"
          message={isFailure(pipeline.error) ? pipeline.error.message : undefined}
          onRetry={() => void pipeline.refetch()}
        />
      ) : nothingAtAll && !linkedId ? (
        <Card>
          <EmptyState
            icon="rocket"
            title="No applications yet."
            message="A case opens here as soon as a hospital is created in the Hospitals registry."
          />
        </Card>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <div className="mb-3.5 flex items-center justify-between gap-3">
              <SectionTitle size={16}>
                {stageF === 'All' ? 'All applications' : STAGE_LABEL[stageF]}
              </SectionTitle>
              <span className="text-caption text-text-muted tabular-nums">{total}</span>
            </div>
            {rows.length === 0 ? (
              <EmptyState
                compact
                icon="search"
                title="No applications match your filters."
                message="Clear the filters to see the whole pipeline."
                actionLabel="Clear filters"
                onAction={clearAll}
              />
            ) : (
              <div className="flex max-h-150 flex-col gap-2 overflow-y-auto">
                {rows.map((c) => {
                  const selected = activeId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-current={selected ? 'true' : undefined}
                      onClick={() => pick(c.id)}
                      className={cn(
                        'flex w-full flex-col gap-1.5 rounded-md border px-3.5 py-3 text-left transition-colors duration-150',
                        selected
                          ? 'border-text-navy bg-blue-soft-bg'
                          : 'border-border-soft hover:bg-grey-200 cursor-pointer',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-body text-text-strong truncate font-medium">
                          {c.hospitalName}
                        </span>
                        <Badge status={STAGE_PILL[c.stage]}>{STAGE_LABEL[c.stage]}</Badge>
                      </div>
                      <span className="text-caption text-text-muted truncate">
                        Instance {c.hospitalStatus}
                        {c.submittedAt ? ` · applied ${dateCopy(c.submittedAt)}` : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {total > CASES_PAGE_SIZE && (
              <Pager
                total={total}
                page={page}
                pageSize={CASES_PAGE_SIZE}
                onPage={setPage}
                noun="applications"
              />
            )}
          </Card>
          <div className="lg:col-span-2">
            {activeId ? (
              <OnboardingCasePanel key={activeId} caseId={activeId} />
            ) : (
              <Card>
                <EmptyState
                  icon="building-2"
                  title="Pick an application."
                  message="Choose a hospital on the left to review its checklist and go-live gate."
                />
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
