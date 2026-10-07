/**
 * Banner editor rules. The CTA target rule is the backend's (B6, audit L-01):
 * a patient-app deep link (`medibook://…`) or an https URL — nothing else may
 * be opened from a banner.
 */
import type { BannerAudience } from '@/features/ops-notifications/domain/entities/notifications.entities';

/** The patient app's deep-link scheme. */
export const APP_DEEP_LINK_PREFIX = 'medibook://';

const HTTPS_PROTOCOL = 'https:';

/** Longest CTA label the app lays out on one line. */
export const CTA_LABEL_MAX = 40;

/** Longest supporting line under the title. */
export const BODY_MAX = 280;

/** Why `target` cannot be a banner's CTA target, or `null` when it can. */
export function ctaTargetError(target: string): string | null {
  const t = target.trim();
  if (t.startsWith(APP_DEEP_LINK_PREFIX)) {
    return t.length > APP_DEEP_LINK_PREFIX.length && !/\s/.test(t)
      ? null
      : 'Add the app screen after medibook://, e.g. medibook://hospitals.';
  }
  try {
    const url = new URL(t);
    return url.protocol === HTTPS_PROTOCOL && url.hostname !== ''
      ? null
      : 'Use an https:// link or a medibook:// app link.';
  } catch {
    return 'Use an https:// link or a medibook:// app link.';
  }
}

/** CTA label and target go together: both set, or both empty. */
export function ctaErrors(
  label: string,
  target: string,
): { readonly label: string | null; readonly target: string | null } {
  const hasLabel = label.trim() !== '';
  const hasTarget = target.trim() !== '';
  if (!hasLabel && !hasTarget) return { label: null, target: null };
  return {
    label: !hasLabel
      ? 'Add button text, or clear the link.'
      : label.trim().length > CTA_LABEL_MAX
        ? `Keep the button text under ${CTA_LABEL_MAX} characters.`
        : null,
    target: !hasTarget ? 'Add where the button leads, or clear its text.' : ctaTargetError(target),
  };
}

/** Audience choices for a platform banner, code → label, in menu order. */
export const BANNER_AUDIENCES: readonly {
  readonly code: BannerAudience;
  readonly label: string;
}[] = [
  { code: 'all_patients_in_city', label: 'All app users' },
  { code: 'hospital_patients', label: 'Patients registered with a Medibook hospital' },
];

/** The default audience of a new platform banner: everyone in the app. */
export const DEFAULT_BANNER_AUDIENCE: BannerAudience = 'all_patients_in_city';

/** An audience code as people read it; unknown codes are humanised. */
export function audienceLabel(code: string): string {
  return BANNER_AUDIENCES.find((a) => a.code === code)?.label ?? code.replaceAll('_', ' ');
}
