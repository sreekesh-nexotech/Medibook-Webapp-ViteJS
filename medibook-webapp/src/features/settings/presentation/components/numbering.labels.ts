import type { NumberingReset } from '@/features/settings/domain/entities/settings.entities';

/** How each numbering series is named on screen. */
export const NUMBERING_KIND_LABEL: Readonly<Record<string, string>> = {
  mrn: 'MRN (patient number)',
  booking: 'Booking reference',
  receipt: 'Receipt number',
};

export const NUMBERING_RESET_LABEL: Readonly<Record<NumberingReset, string>> = {
  never: 'Never',
  fiscal_year: 'Every fiscal year',
  calendar_year: 'Every calendar year',
  monthly: 'Every month',
};

export function isNumberingReset(value: string): value is NumberingReset {
  return value in NUMBERING_RESET_LABEL;
}

/** "Every fiscal year" for a stored reset code; the code itself when unknown. */
export function resetLabel(reset: string): string {
  return isNumberingReset(reset) ? NUMBERING_RESET_LABEL[reset] : reset;
}
