/**
 * Seed data for hospital onboarding (audit SA-01). The document catalog is
 * the platform's own checklist; the cases are derived once, deterministically,
 * from the registry seed so a hospital's onboarding story always agrees with
 * its registry status and its KYC record.
 */
import { OPS_HOSPITALS } from '@/features/ops-hospitals/application/store/hospitals.fixtures';
import type {
  KycDocKey,
  OpsHospital,
} from '@/features/ops-hospitals/application/store/hospitals.types';
import {
  addDaysIso,
  isoFromLongDate,
  longDateFromIso,
} from '@/features/ops-hospitals/application/store/opsDates';
import type {
  DocumentRequest,
  HospitalAdminInvite,
  OnboardingCase,
  OnboardingDoc,
  OnboardingDocKey,
} from '@/features/ops-hospitals/application/store/onboarding.types';

/** One row of the platform's document checklist. */
export interface OnboardingDocSpec {
  readonly key: OnboardingDocKey;
  readonly label: string;
  /** What the applicant is expected to send, in one line. */
  readonly hint: string;
  /** Ticked by default when ops opens the request-documents checklist. */
  readonly defaultRequired: boolean;
}

/**
 * The checklist ops picks from. The first four match the registry's existing
 * `KYC_DOCS` slots — the same four documents the onboarding modal has always
 * promised to request — and the rest are the extras a specialist hospital is
 * asked for case by case.
 */
export const ONBOARDING_DOC_CATALOG: readonly OnboardingDocSpec[] = [
  {
    key: 'reg',
    label: 'Registration certificate',
    hint: 'Clinical establishment registration issued by the state.',
    defaultRequired: true,
  },
  {
    key: 'gst',
    label: 'GST certificate',
    hint: 'GSTIN registration matching the billing entity.',
    defaultRequired: true,
  },
  {
    key: 'licence',
    label: 'Medical licence',
    hint: 'Practising licence for the hospital or its chief medical officer.',
    defaultRequired: true,
  },
  {
    key: 'bankproof',
    label: 'Bank account proof',
    hint: 'Cancelled cheque or bank letter for the settlement account.',
    defaultRequired: true,
  },
  {
    key: 'pan',
    label: 'PAN card',
    hint: 'PAN of the registered entity, for TDS reporting.',
    defaultRequired: false,
  },
  {
    key: 'fire',
    label: 'Fire safety NOC',
    hint: 'Fire department no-objection certificate for the premises.',
    defaultRequired: false,
  },
  {
    key: 'biomed',
    label: 'Biomedical waste authorisation',
    hint: 'Pollution control board authorisation for waste handling.',
    defaultRequired: false,
  },
  {
    key: 'pharmacy',
    label: 'Pharmacy licence',
    hint: 'Only when the hospital runs an in-house pharmacy.',
    defaultRequired: false,
  },
];

/** Document label by key — the one place the screens read display names from. */
export const ONBOARDING_DOC_LABEL: Readonly<Record<OnboardingDocKey, string>> =
  ONBOARDING_DOC_CATALOG.reduce<Record<OnboardingDocKey, string>>(
    (acc, spec) => {
      acc[spec.key] = spec.label;
      return acc;
    },
    {} as Record<OnboardingDocKey, string>,
  );

/** The four keys ops requests by default. */
export const DEFAULT_DOC_KEYS: readonly OnboardingDocKey[] = ONBOARDING_DOC_CATALOG.filter(
  (d) => d.defaultRequired,
).map((d) => d.key);

/**
 * The four default keys again, typed as the registry's KYC slots — the seed
 * reads each document's starting state straight off `OpsHospital.kyc`.
 */
const KYC_SEED_KEYS: readonly KycDocKey[] = ['reg', 'gst', 'licence', 'bankproof'];

/** Demo operations reviewer every seeded decision is attributed to. */
export const ONBOARDING_REVIEWER = 'riya.sharma@medibook.in';

/** Administrator names, picked deterministically by tenant id. */
const ADMIN_NAME_POOL: readonly string[] = [
  'Dr. Ramesh Iyer',
  'Priya Deshpande',
  'Sanjay Menon',
  'Anita Rao',
  'Vikram Shetty',
  'Kavita Nair',
  'Farhan Ali',
  'Deepa Krishnan',
  'Nitin Joshi',
  'Sneha Kulkarni',
  'Arjun Pillai',
  'Rekha Bhatt',
];

/** Fallback application date when a registry row has an unparsable stamp. */
const SEED_FALLBACK_ISO = '2026-06-01';

/** Uploaded-file name a seeded document carries. */
function seedFileName(h: OpsHospital, key: OnboardingDocKey): string {
  const slug = h.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug}-${key}.pdf`;
}

/** Registry `onboarded` stamp as an ISO date. */
function startIso(h: OpsHospital): string {
  return isoFromLongDate(h.onboarded) ?? SEED_FALLBACK_ISO;
}

/** The administrator invitation seeded for a hospital. */
function seedAdmin(h: OpsHospital, accepted: boolean): HospitalAdminInvite {
  const invitedAt = startIso(h);
  return {
    id: 1,
    name: ADMIN_NAME_POOL[h.id % ADMIN_NAME_POOL.length],
    email: h.email,
    phone: h.phone,
    role: 'Hospital Admin',
    status: accepted ? 'Accepted' : 'Invited',
    invitedAt,
    lastQueuedAt: `${longDateFromIso(invitedAt)} · 09:30`,
    resends: accepted ? 0 : h.id % 3,
    ...(accepted ? { acceptedAt: `${longDateFromIso(addDaysIso(invitedAt, 1))} · 11:05` } : {}),
  };
}

/** The "please send these" record seeded alongside a requested checklist. */
function seedRequest(h: OpsHospital): DocumentRequest {
  return {
    id: 1,
    at: `${longDateFromIso(startIso(h))} · 09:35`,
    keys: DEFAULT_DOC_KEYS,
    by: ONBOARDING_REVIEWER,
  };
}

/** Documents for a hospital that is already serving patients: all approved. */
function seedLiveDocs(h: OpsHospital): readonly OnboardingDoc[] {
  const iso = startIso(h);
  return KYC_SEED_KEYS.map((key) => ({
    key,
    required: true,
    status: 'Approved' as const,
    fileName: seedFileName(h, key),
    fileSize: 180000 + ((h.id * 37 + key.length * 911) % 620000),
    uploadedAt: iso,
    reviewedBy: ONBOARDING_REVIEWER,
    reviewedAt: `${longDateFromIso(addDaysIso(iso, 1))} · 10:20`,
  }));
}

/** Documents for an application still in review, read off the KYC record. */
function seedOpenDocs(h: OpsHospital, rejectMissing: boolean): readonly OnboardingDoc[] {
  const iso = startIso(h);
  const kyc = h.kyc;
  return KYC_SEED_KEYS.map((key) => {
    const state = kyc ? kyc[key] : 'Missing';
    if (state === 'Missing') {
      return rejectMissing
        ? {
            key,
            required: true,
            status: 'Rejected' as const,
            reviewedBy: ONBOARDING_REVIEWER,
            reviewedAt: `${longDateFromIso(addDaysIso(iso, 2))} · 16:10`,
            rejectReason: 'Not received — the file never arrived from the hospital.',
          }
        : { key, required: true, status: 'Requested' as const };
    }
    return {
      key,
      required: true,
      status: 'Uploaded' as const,
      fileName: seedFileName(h, key),
      fileSize: 180000 + ((h.id * 53 + key.length * 733) % 540000),
      uploadedAt: addDaysIso(iso, 1),
    };
  });
}

/** One case per registry row, so the pipeline counts cover the whole network. */
function seedCase(h: OpsHospital): OnboardingCase {
  const iso = startIso(h);
  const isLive = h.status === 'Active' || h.status === 'Suspended';
  if (isLive) {
    return {
      hid: h.id,
      docs: seedLiveDocs(h),
      requests: [seedRequest(h)],
      admins: [seedAdmin(h, true)],
      startedAt: iso,
      liveAt: iso,
    };
  }
  // A pending row with no KYC record at all has not been asked for anything
  // yet — that is the Application column.
  if (!h.kyc) {
    return { hid: h.id, docs: [], requests: [], admins: [], startedAt: iso };
  }
  return {
    hid: h.id,
    docs: seedOpenDocs(h, h.status === 'Rejected'),
    requests: [seedRequest(h)],
    admins: [seedAdmin(h, false)],
    startedAt: iso,
  };
}

export const OPS_ONBOARDING_CASES: readonly OnboardingCase[] = OPS_HOSPITALS.map(seedCase);
