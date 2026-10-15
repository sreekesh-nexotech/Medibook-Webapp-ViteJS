import { z } from 'zod';

import { paginatedSchema } from '@/core/api/pagination';

import type { DocumentRequirement } from '@/features/ops-onboarding-documents/domain/entities/onboardingDocuments.entities';

/** `ConfigDocumentRequirementSerializer`. */
export const documentRequirementResponseSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  is_required_default: z.boolean(),
  sort_order: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
  version: z.number().int(),
});

export const documentRequirementPageResponseSchema = paginatedSchema(
  documentRequirementResponseSchema,
);

export type DocumentRequirementResponse = z.infer<typeof documentRequirementResponseSchema>;

export function toDocumentRequirement(dto: DocumentRequirementResponse): DocumentRequirement {
  return {
    id: dto.id,
    code: dto.code,
    name: dto.name,
    description: dto.description,
    isRequiredDefault: dto.is_required_default,
    sortOrder: dto.sort_order,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
    version: dto.version,
  };
}
