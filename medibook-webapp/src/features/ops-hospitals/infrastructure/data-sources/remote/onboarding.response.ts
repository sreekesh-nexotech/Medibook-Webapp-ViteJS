import { z } from 'zod';

import { paginatedSchema } from '@/core/api/pagination';

import type {
  ChecklistItem,
  DocumentRequirement,
  GoLiveBlocker,
  OnboardingCaseDetail,
  OnboardingCaseStage,
  OnboardingCaseSummary,
  OnboardingPipeline,
} from '@/features/ops-hospitals/domain/entities/onboarding.entity';

/**
 * Response DTOs for module P3, from `schema.yml` (`OnboardingCase`,
 * `OnboardingChecklistItem`, `ConfigDocumentRequirement`) and the backend
 * views for the parts `schema.yml` types as bare objects: the list adds
 * `counts` to the page (`onboarding_case_list.py`), and the detail adds
 * `checklist` and `go_live_blockers` (`onboarding_case_detail.py`).
 */

const STAGES = [
  'application',
  'documents_pending',
  'review',
  'approved',
  'live',
  'rejected',
] as const;

const stageSchema = z.enum(STAGES);

const caseSchema = z.object({
  id: z.string(),
  hospital_id: z.string(),
  hospital_name: z.string(),
  hospital_status: z.string(),
  stage: stageSchema,
  submitted_at: z.string().nullable(),
  approved_at: z.string().nullable(),
  rejection_reason: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
});

type CaseDto = z.infer<typeof caseSchema>;

function toSummary(dto: CaseDto): OnboardingCaseSummary {
  return {
    id: dto.id,
    hospitalId: dto.hospital_id,
    hospitalName: dto.hospital_name,
    hospitalStatus: dto.hospital_status,
    stage: dto.stage,
    submittedAt: dto.submitted_at,
    approvedAt: dto.approved_at,
    rejectionReason: dto.rejection_reason,
    createdAt: dto.created_at,
  };
}

/* ------------------------------------------------------------------- list */

export const caseListResponseSchema = paginatedSchema(caseSchema).extend({
  counts: z.record(z.string(), z.number().int()),
});

export type CaseListResponse = z.infer<typeof caseListResponseSchema>;

export function toPipeline(dto: CaseListResponse): OnboardingPipeline {
  const count = (stage: OnboardingCaseStage): number => dto.counts[stage] ?? 0;
  return {
    cases: dto.results.map(toSummary),
    total: dto.total,
    counts: {
      application: count('application'),
      documents_pending: count('documents_pending'),
      review: count('review'),
      approved: count('approved'),
      live: count('live'),
      rejected: count('rejected'),
    },
  };
}

/* ----------------------------------------------------------------- detail */

const checklistStatusSchema = z.enum(['pending', 'received', 'verified', 'waived']);

export const checklistItemResponseSchema = z.object({
  code: z.string(),
  name: z.string(),
  status: checklistStatusSchema,
  received_at: z.string().nullable(),
  verified_at: z.string().nullable(),
  file_id: z.string().nullable(),
  note: z.string().nullable(),
});

export type ChecklistItemResponse = z.infer<typeof checklistItemResponseSchema>;

export function toChecklistItem(dto: ChecklistItemResponse): ChecklistItem {
  return {
    code: dto.code,
    name: dto.name,
    status: dto.status,
    receivedAt: dto.received_at,
    verifiedAt: dto.verified_at,
    fileId: dto.file_id,
    note: dto.note,
  };
}

const blockerSchema = z.object({
  code: z.string(),
  items: z.array(z.string()).optional(),
  kinds: z.array(z.string()).optional(),
});

function toBlocker(dto: z.infer<typeof blockerSchema>): GoLiveBlocker {
  return { code: dto.code, details: dto.items ?? dto.kinds ?? [] };
}

export const caseDetailResponseSchema = caseSchema.extend({
  checklist: z.array(checklistItemResponseSchema),
  go_live_blockers: z.array(blockerSchema),
});

export type CaseDetailResponse = z.infer<typeof caseDetailResponseSchema>;

export function toCaseDetail(dto: CaseDetailResponse): OnboardingCaseDetail {
  return {
    ...toSummary(dto),
    notes: dto.notes,
    checklist: dto.checklist.map(toChecklistItem),
    blockers: dto.go_live_blockers.map(toBlocker),
  };
}

/* ----------------------------------------------------- document catalogue */

const requirementSchema = z.object({
  code: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  is_required_default: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

/** `GET /onboarding/document-requirements` answers with the page envelope (`config_resource_list.py`). */
export const requirementPageResponseSchema = paginatedSchema(requirementSchema);

export type RequirementResponse = z.infer<typeof requirementSchema>;

export function toRequirements(
  dto: readonly RequirementResponse[],
): readonly DocumentRequirement[] {
  return dto
    .map((r) => ({
      code: r.code,
      name: r.name,
      description: r.description ?? null,
      isRequiredDefault: r.is_required_default ?? false,
      sortOrder: r.sort_order ?? 0,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

/** Approve / go-live answer with the hospital; only its identity is checked. */
export const hospitalActionResponseSchema = z.object({ id: z.string() });
