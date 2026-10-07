import { describe, expect, it } from 'vitest';

import type { DocumentRequirement } from '@/features/ops-onboarding-documents/domain/entities/onboardingDocuments.entities';
import {
  toRequirementCreateBody,
  toRequirementPatchBody,
} from '@/features/ops-onboarding-documents/infrastructure/data-sources/remote/onboardingDocuments.request';
import {
  hasRequirementErrors,
  inChecklistOrder,
  nextSortOrder,
  parseSortOrder,
  requirementErrors,
} from '@/features/ops-onboarding-documents/presentation/components/onboardingDocuments.rules';

const req = (code: string, sortOrder: number): DocumentRequirement => ({
  id: code,
  code,
  name: code,
  description: null,
  isRequiredDefault: true,
  sortOrder,
  createdAt: '',
  updatedAt: '',
  version: 1,
});

const ROWS = [req('pan', 2), req('gst_certificate', 1), req('reg_certificate', 0), req('bank', 1)];

const draft = {
  code: 'fire_noc',
  name: 'Fire NOC',
  description: null,
  isRequiredDefault: true,
  sortOrder: 7,
};

describe('requirementErrors', () => {
  it('accepts a new snake_case code', () => {
    expect(hasRequirementErrors(requirementErrors(draft, ROWS, null))).toBe(false);
  });

  it('refuses a bad or taken code on create only', () => {
    expect(requirementErrors({ ...draft, code: 'Fire NOC' }, ROWS, null).code).toBeDefined();
    expect(requirementErrors({ ...draft, code: 'pan' }, ROWS, null).code).toMatch(/already/);
    expect(requirementErrors({ ...draft, code: 'pan' }, ROWS, 'pan').code).toBeUndefined();
  });

  it('needs a name and a whole-number order', () => {
    const e = requirementErrors({ ...draft, name: ' ', sortOrder: 1.5 }, ROWS, null);
    expect(Object.keys(e).sort()).toEqual(['name', 'sortOrder']);
  });
});

describe('checklist order', () => {
  it('sorts by order, then code, and appends new items', () => {
    expect(inChecklistOrder(ROWS).map((r) => r.code)).toEqual([
      'reg_certificate',
      'bank',
      'gst_certificate',
      'pan',
    ]);
    expect(nextSortOrder(ROWS)).toBe(3);
    expect(nextSortOrder([])).toBe(0);
  });

  it('parses whole numbers only', () => {
    expect(parseSortOrder(' 4 ')).toBe(4);
    expect(parseSortOrder('4.5')).toBeUndefined();
    expect(parseSortOrder('')).toBeUndefined();
  });
});

describe('requirement requests', () => {
  it('sends the code only on create and blanks as null', () => {
    expect(toRequirementCreateBody({ ...draft, code: ' fire_noc ' }).code).toBe('fire_noc');
    const patch = toRequirementPatchBody({ ...draft, description: '  ' });
    expect('code' in patch).toBe(false);
    expect(patch.description).toBeNull();
  });
});
