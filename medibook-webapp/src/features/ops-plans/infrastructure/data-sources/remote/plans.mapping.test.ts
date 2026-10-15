import { describe, expect, it } from 'vitest';

import type { CatalogPlanDraft } from '@/features/ops-plans/domain/entities/plans.catalog';
import { toPlanCreateRequest } from '@/features/ops-plans/infrastructure/data-sources/remote/plans.request';
import {
  planResponseSchema,
  toCatalogPlan,
} from '@/features/ops-plans/infrastructure/data-sources/remote/plans.response';

const draft: CatalogPlanDraft = {
  name: 'Growth',
  description: null,
  priceMonthly: 24_999,
  priceYearly: null,
  limits: { staff: 25, doctors: null, storageGb: 20 },
  hardLimits: ['users', 'doctors'],
  gstRateBp: 1800,
  trialDays: 14,
  sortOrder: 10,
  isPublic: true,
};

describe('plan create request (UAT-14)', () => {
  it('always sends trial_days, GST, enforcement and catalog order', () => {
    expect(toPlanCreateRequest(draft)).toMatchObject({
      code: 'growth',
      price_monthly_paise: 2_499_900,
      trial_days: 14,
      gst_rate_bp: 1800,
      hard_limits: ['doctors', 'users'],
      sort_order: 10,
      limit_doctors: null,
    });
  });
});

describe('plan response', () => {
  const row = {
    id: 'p-1',
    code: 'growth',
    name: 'Growth',
    description: null,
    price_monthly_paise: 2_499_900,
    price_yearly_paise: null,
    limit_users: 25,
    limit_doctors: null,
    limit_storage_gb: 20,
    is_public: true,
    is_active: false,
    version: 4,
  };

  it('reads GST, trial, enforcement and order', () => {
    const plan = toCatalogPlan(
      planResponseSchema.parse({
        ...row,
        gst_rate_bp: 500,
        trial_days: 30,
        hard_limits: ['storage', 'later_metric'],
        sort_order: 3,
      }),
    );
    expect(plan).toMatchObject({
      gstRateBp: 500,
      trialDays: 30,
      hardLimits: ['storage'],
      sortOrder: 3,
      isActive: false,
    });
  });

  it('falls back to the serializer defaults when fields are missing', () => {
    expect(toCatalogPlan(planResponseSchema.parse(row))).toMatchObject({
      gstRateBp: 1800,
      trialDays: 0,
      hardLimits: ['users', 'doctors'],
      sortOrder: 0,
    });
  });
});
