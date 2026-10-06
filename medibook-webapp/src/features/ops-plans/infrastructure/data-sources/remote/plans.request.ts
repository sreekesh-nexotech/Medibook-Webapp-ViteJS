import type { CatalogPlanDraft } from '@/features/ops-plans/domain/entities/plans.catalog';
import { PAISE_PER_RUPEE } from '@/features/ops-plans/infrastructure/data-sources/remote/plans.response';

/** `PlanWriteRequest` minus `code` — the fields both create and edit send. */
export interface PlanWriteRequest {
  readonly name: string;
  readonly description: string | null;
  readonly price_monthly_paise: number;
  readonly price_yearly_paise: number | null;
  readonly limit_users: number | null;
  readonly limit_doctors: number | null;
  readonly limit_storage_gb: number | null;
  readonly is_public: boolean;
}

/** `POST /platform/plans` also needs the immutable plan code. */
export interface PlanCreateRequest extends PlanWriteRequest {
  readonly code: string;
}

/** Backend code rule: `^[a-z0-9_\-]{2,40}$`. */
const CODE_MAX_LENGTH = 40;
const CODE_MIN_LENGTH = 2;
const CODE_FALLBACK_PREFIX = 'plan-';

function toPaise(rupees: number): number {
  return Math.round(rupees * PAISE_PER_RUPEE);
}

/**
 * Derive the plan code from its name ("Custom — Example Hospital" → `custom-example-hospital`).
 * The form has no code field; the code is set once on create and never
 * changed, so renaming a plan keeps its code stable.
 */
export function planCodeFromName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, CODE_MAX_LENGTH)
    .replace(/-+$/, '');
  return slug.length >= CODE_MIN_LENGTH
    ? slug
    : `${CODE_FALLBACK_PREFIX}${slug}`.slice(0, CODE_MAX_LENGTH);
}

export function toPlanWriteRequest(draft: CatalogPlanDraft): PlanWriteRequest {
  return {
    name: draft.name,
    description: draft.description,
    price_monthly_paise: toPaise(draft.priceMonthly),
    price_yearly_paise: draft.priceYearly === null ? null : toPaise(draft.priceYearly),
    limit_users: draft.limits.staff,
    limit_doctors: draft.limits.doctors,
    limit_storage_gb: draft.limits.storageGb,
    is_public: draft.isPublic,
  };
}

export function toPlanCreateRequest(draft: CatalogPlanDraft): PlanCreateRequest {
  return { code: planCodeFromName(draft.name), ...toPlanWriteRequest(draft) };
}
